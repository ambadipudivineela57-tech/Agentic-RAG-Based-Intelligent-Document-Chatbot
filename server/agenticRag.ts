import { dbStore } from './db';
import { GeminiService, cosineSimilarity, generateFastVector } from './geminiService';
import { DbChunk } from './types';

export interface SourceCitation {
  document: string;
  document_id: string;
  page?: number | null;
  sheet?: string | null;
  section?: string | null;
  row_range?: string | null;
  chunk_id: number;
  snippet: string;
}

export interface AgenticRAGResult {
  answer: string;
  sources: SourceCitation[];
  metadata: {
    retry_count: number;
    retrieved_chunk_count: number;
    rewritten_query?: string | null;
    relevance_score: number;
  };
}

export async function runAgenticRAG(
  question: string,
  userId: string,
  documentIds?: string[],
  conversationHistory?: { role: string; content: string }[]
): Promise<AgenticRAGResult> {
  let activeQuery = question.trim();
  let rewrittenQuery: string | null = null;
  let retryCount = 0;
  const MAX_RETRIES = 1;

  // 1. Get candidate chunks from vector store for this user (filtered by documentIds if specified)
  const userChunks = dbStore.getChunks(userId, documentIds);

  if (userChunks.length === 0) {
    return {
      answer: "I couldn't find enough information about this in the uploaded documents. Please upload relevant documents first.",
      sources: [],
      metadata: {
        retry_count: 0,
        retrieved_chunk_count: 0,
        relevance_score: 0,
      },
    };
  }

  let retrievedChunks: { chunk: DbChunk; similarity: number }[] = [];
  let relevanceScore = 0;

  // Iterative Agentic Loop with Adaptive Query Rewriting
  while (retryCount <= MAX_RETRIES) {
    // A. Embed query
    const queryEmbedding = await GeminiService.getEmbedding(activeQuery);
    const fastQueryVector = generateFastVector(activeQuery, 128);

    // B. Calculate similarity for each chunk and rank top-5
    const scored = userChunks.map((chunk) => {
      let sim = 0;
      if (chunk.embedding && chunk.embedding.length === queryEmbedding.length) {
        sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      } else if (chunk.embedding && chunk.embedding.length === 128) {
        sim = cosineSimilarity(fastQueryVector, chunk.embedding);
      } else {
        sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      }
      return { chunk, similarity: sim };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    retrievedChunks = scored.slice(0, 5);

    // C. Evaluate relevance
    const evalResult = GeminiService.evaluateRelevance(
      activeQuery,
      retrievedChunks.map((rc) => ({ similarity: rc.similarity, content: rc.chunk.content }))
    );

    relevanceScore = evalResult.score;

    // D. Conditional branch: break if relevant, good similarity match found, or retried once
    if (evalResult.isRelevant || (retrievedChunks[0] && retrievedChunks[0].similarity >= 0.2) || retryCount >= MAX_RETRIES) {
      break;
    }

    // Adaptive Rewrite Node
    retryCount++;
    rewrittenQuery = await GeminiService.rewriteQuery(question, conversationHistory);
    activeQuery = rewrittenQuery;
  }

  // 5. Generate Grounded Answer Node
  const answer = await GeminiService.generateGroundedAnswer(
    question,
    retrievedChunks.map((rc) => ({ content: rc.chunk.content, metadata: rc.chunk.metadata })),
    conversationHistory
  );

  // Format source citations
  const sources: SourceCitation[] = retrievedChunks.map((rc) => ({
    document: rc.chunk.metadata.filename || 'Document',
    document_id: rc.chunk.document_id,
    page: rc.chunk.metadata.page,
    sheet: rc.chunk.metadata.sheet,
    section: rc.chunk.metadata.section,
    row_range: rc.chunk.metadata.row_range,
    chunk_id: rc.chunk.chunk_index,
    snippet: rc.chunk.content.slice(0, 180) + (rc.chunk.content.length > 180 ? '...' : ''),
  }));

  return {
    answer,
    sources,
    metadata: {
      retry_count: retryCount,
      retrieved_chunk_count: retrievedChunks.length,
      rewritten_query: rewrittenQuery,
      relevance_score: relevanceScore,
    },
  };
}
