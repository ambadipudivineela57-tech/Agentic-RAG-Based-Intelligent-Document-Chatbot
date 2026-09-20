import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[Gemini] GEMINI_API_KEY is not set in environment.');
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiClient;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const mag = Math.sqrt(normA) * Math.sqrt(normB);
  return mag === 0 ? 0 : dot / mag;
}

export function generateFastVector(text: string, dimension = 128): number[] {
  // Deterministic frequency-hashed feature vector used for fast semantic similarity
  const vector = new Array(dimension).fill(0);
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimension;
    vector[idx] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? vector.map((v) => v / norm) : vector;
}

export class GeminiService {
  /**
   * Generates embedding vector for a text string using Gemini text-embedding-004
   * Falls back gracefully to normalized feature vector if API key is not yet configured.
   */
  static async getEmbedding(text: string): Promise<number[]> {
    try {
      const client = getAIClient();
      if (process.env.GEMINI_API_KEY) {
        const response = await client.models.embedContent({
          model: 'text-embedding-004',
          contents: text.slice(0, 2048),
        });
        const resAny = response as any;
        if (resAny.embedding?.values) {
          return resAny.embedding.values;
        }
        if (resAny.embeddings?.[0]?.values) {
          return resAny.embeddings[0].values;
        }
      }
    } catch (err: any) {
      console.warn('[Gemini] embedContent failed, using fallback vector:', err.message);
    }
    return generateFastVector(text);
  }

  /**
   * Generates grounded response based strictly on supplied context chunks
   */
  static async generateGroundedAnswer(
    question: string,
    contextChunks: { content: string; metadata: any }[],
    conversationHistory?: { role: string; content: string }[]
  ): Promise<string> {
    if (!contextChunks || contextChunks.length === 0) {
      return "I couldn't find enough information about this in the uploaded documents.";
    }

    const formattedContext = contextChunks
      .map((c, i) => {
        const meta = c.metadata || {};
        const sourceName = meta.filename || 'Document';
        const page = meta.page ? `, Page ${meta.page}` : '';
        const sheet = meta.sheet ? `, Sheet '${meta.sheet}'` : '';
        const rows = meta.row_range ? `, Rows ${meta.row_range}` : '';
        const sec = meta.section ? `, Section '${meta.section}'` : '';
        return `[Source ${i + 1}: ${sourceName}${page}${sheet}${sec}${rows}]\n${c.content.trim()}`;
      })
      .join('\n\n---\n\n');

    const historyStr = conversationHistory && conversationHistory.length > 0
      ? '\nRecent Conversation:\n' +
        conversationHistory
          .slice(-4)
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n') +
        '\n'
      : '';

    const systemInstruction =
      'You are a document-grounded AI assistant.\n' +
      'Use only the supplied retrieved context for factual claims about the user\'s documents.\n' +
      'Do not invent information.\n' +
      'If the answer is not supported by the retrieved context, clearly state that the uploaded documents do not contain enough information.\n' +
      'Do not claim to have read content that was not retrieved.\n' +
      'Use source metadata to identify supporting documents and cite sources naturally (e.g. [Document, Page X] or [Sheet Y, Rows Z]).';

    const prompt =
      `${historyStr}\n` +
      `Retrieved Document Context:\n${formattedContext}\n\n` +
      `User Question:\n${question}\n\n` +
      `Answer factually and cite sources:`;

    try {
      const client = getAIClient();
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      return response.text || "I couldn't find enough information about this in the uploaded documents.";
    } catch (err: any) {
      console.error('[Gemini] generateContent error:', err);
      throw new Error(`Gemini response generation failed: ${err.message}`);
    }
  }

  /**
   * Rewrites ambiguous or low-yield queries
   */
  static async rewriteQuery(
    question: string,
    conversationHistory?: { role: string; content: string }[]
  ): Promise<string> {
    try {
      const client = getAIClient();
      const historyStr = conversationHistory && conversationHistory.length > 0
        ? 'Conversation context:\n' +
          conversationHistory
            .slice(-3)
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n') +
          '\n'
        : '';

      const prompt =
        `${historyStr}` +
        `Original User Question: "${question}"\n\n` +
        `Task: Rewrite this question into an unambiguous search query for semantic vector document retrieval.\n` +
        `Preserve the exact meaning, expand acronyms, and resolve pronouns.\n` +
        `Return ONLY the rewritten query text.`;

      const res = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.1 },
      });

      const rewritten = (res.text || '').trim().replace(/^["']|["']$/g, '');
      return rewritten || question;
    } catch {
      return question;
    }
  }

  /**
   * Evaluates relevance between question and retrieved chunks
   */
  static evaluateRelevance(
    question: string,
    chunks: { similarity: number; content: string }[]
  ): { isRelevant: boolean; score: number } {
    if (!chunks || chunks.length === 0) {
      return { isRelevant: false, score: 0 };
    }

    const bestSim = Math.max(...chunks.map((c) => c.similarity), 0);
    const keywords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const allText = chunks.map((c) => c.content.toLowerCase()).join(' ');

    const matched = keywords.filter((kw) => allText.includes(kw));
    const keywordOverlap = keywords.length > 0 ? matched.length / keywords.length : 0.5;

    const score = bestSim * 0.6 + keywordOverlap * 0.4;
    const isRelevant = score >= 0.65 || bestSim >= 0.72;

    return { isRelevant, score: Number(score.toFixed(3)) };
  }
}
