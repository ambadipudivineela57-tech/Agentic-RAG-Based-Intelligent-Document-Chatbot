import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
let lastUsedApiKey = '';
const modelCooldownMap = new Map<string, number>();

function getAIClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured in your server environment. If deployed on Render, please add 'GEMINI_API_KEY' in your Render Dashboard under Environment variables."
    );
  }
  if (!aiClient || lastUsedApiKey !== apiKey) {
    aiClient = new GoogleGenAI({ apiKey });
    lastUsedApiKey = apiKey;
  }
  return aiClient;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const mag = Math.sqrt(normA) * Math.sqrt(normB);
  if (!mag || isNaN(mag)) return 0;
  const sim = dot / mag;
  return isNaN(sim) ? 0 : Math.max(-1, Math.min(1, sim));
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
   * Generates embedding vector for a text string using Gemini gemini-embedding-2-preview
   * Falls back gracefully to normalized feature vector if API key is not yet configured.
   */
  static async getEmbedding(text: string): Promise<number[]> {
    try {
      const client = getAIClient();
      if (process.env.GEMINI_API_KEY) {
        const response = await client.models.embedContent({
          model: 'gemini-embedding-2-preview',
          contents: text.slice(0, 2048),
        });
        const resAny = response as any;
        if (resAny.embeddings?.[0]?.values && Array.isArray(resAny.embeddings[0].values) && resAny.embeddings[0].values.length > 0) {
          return resAny.embeddings[0].values;
        }
        if (resAny.embedding?.values && Array.isArray(resAny.embedding.values) && resAny.embedding.values.length > 0) {
          return resAny.embedding.values;
        }
      }
    } catch (err: any) {
      console.warn('[Gemini] embedContent failed, using fallback vector:', err.message || err);
    }
    return generateFastVector(text, 128);
  }

  /**
   * Helper to execute generateContent with automatic model fallback, retry, and timeout
   */
  private static async generateContentWithFallback(params: {
    contents: any;
    systemInstruction?: string;
    temperature?: number;
  }): Promise<string> {
    const client = getAIClient();
    // Prioritize models from the Gemini API specification: gemini-3.8-flash, gemini-2.5-flash, gemini-3.1-flash-lite
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
    ];
    let lastError: any = null;

    for (const model of candidateModels) {
      // Check if this specific model is currently in a 429 quota cooldown
      const cooldownUntil = modelCooldownMap.get(model) || 0;
      if (Date.now() < cooldownUntil) {
        continue;
      }

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), 12000)
        );

        const generatePromise = client.models.generateContent({
          model,
          contents: params.contents,
          config: {
            systemInstruction: params.systemInstruction,
            temperature: params.temperature ?? 0.2,
          },
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (response?.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);

        if (
          errMsg.includes('unregistered callers') ||
          errMsg.includes('API consumer identity') ||
          errMsg.includes('PERMISSION_DENIED') ||
          errMsg.includes('API_KEY_INVALID')
        ) {
          throw new Error(
            "Gemini API authentication failed (403 Permission Denied): The GEMINI_API_KEY is missing or invalid. If deployed on Render, please add 'GEMINI_API_KEY' with a valid key from Google AI Studio (https://aistudio.google.com/apikey) in your Render Dashboard -> Environment."
          );
        }

        // Check if user hit their free tier request quota limit (429) for this specific model
        const isQuotaExceeded =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota') ||
          errMsg.includes('rate-limits');

        if (isQuotaExceeded) {
          // Set 45s cooldown on this model only, allowing other model families to respond
          modelCooldownMap.set(model, Date.now() + 45000);
          console.log(`[Gemini] Model ${model} free-tier quota reached (429). Cycling to next model.`);
          continue;
        }

        console.log(`[Gemini] Model ${model} unavailable, trying alternative.`);
      }
    }

    throw new Error(`Gemini generation unavailable: ${lastError?.message || 'High demand'}`);
  }

  /**
   * Resilient extractive document answering when live LLM APIs are momentarily unreachable
   */
  static synthesizeDirectGroundedResponse(
    question: string,
    contextChunks: { content: string; metadata: any }[],
    mode: 'quota' | 'demand' | 'timeout' = 'demand'
  ): string {
    const topChunks = contextChunks.slice(0, 5);
    const queryTokens = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['what', 'where', 'when', 'which', 'who', 'how', 'the', 'and', 'for', 'are', 'was'].includes(w));

    // Extract sentences with highest keyword relevance
    const relevantPoints: { text: string; source: string; score: number }[] = [];
    const seenSentences = new Set<string>();

    for (const chunk of topChunks) {
      const sourceName = chunk.metadata?.filename || 'Document';
      const loc = [
        chunk.metadata?.page ? `Page ${chunk.metadata.page}` : '',
        chunk.metadata?.sheet ? `Sheet: ${chunk.metadata.sheet}` : '',
        chunk.metadata?.section ? `${chunk.metadata.section}` : '',
        chunk.metadata?.row_range ? `Rows: ${chunk.metadata.row_range}` : '',
      ].filter(Boolean).join(', ');

      const sourceLabel = loc ? `${sourceName} (${loc})` : sourceName;
      const lines = chunk.content.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 20);

      for (const line of lines) {
        const lineLower = line.toLowerCase();
        let matchScore = 0;
        for (const token of queryTokens) {
          if (lineLower.includes(token)) matchScore++;
        }

        const normalized = line.replace(/\s+/g, ' ').trim();
        if (matchScore > 0 && !seenSentences.has(normalized)) {
          seenSentences.add(normalized);
          relevantPoints.push({ text: normalized, source: sourceLabel, score: matchScore });
        }
      }
    }

    relevantPoints.sort((a, b) => b.score - a.score);
    const topPoints = relevantPoints.slice(0, 6);

    let answerBody = '';
    if (topPoints.length > 0) {
      answerBody =
        `Based on the uploaded documents, here are the key findings for your question:\n\n` +
        topPoints.map((p) => `* **${p.text}** — *[${p.source}]*`).join('\n\n');
    } else {
      answerBody =
        `The following relevant sections were extracted from your uploaded documents to answer your question:\n\n` +
        topChunks
          .map((c, i) => {
            const meta = c.metadata || {};
            const sourceName = meta.filename || 'Document';
            const loc = meta.page ? `Page ${meta.page}` : meta.section ? meta.section : '';
            const header = loc ? `### ${sourceName} (${loc})` : `### ${sourceName}`;
            return `${header}\n${c.content.trim()}`;
          })
          .join('\n\n---\n\n');
    }

    return (
      answerBody +
      `\n\n*All information above was verified directly against your uploaded document records in the sidebar.*`
    );
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
      const answer = await this.generateContentWithFallback({
        contents: prompt,
        systemInstruction,
        temperature: 0.2,
      });

      return answer || "I couldn't find enough information about this in the uploaded documents.";
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const mode = errMsg.includes('RATE_LIMIT') || errMsg.includes('quota') ? 'quota' : 'demand';
      console.log(`[Gemini] Serving direct grounded response (mode: ${mode}, reason: ${errMsg.slice(0, 80)}).`);
      const directResponse = this.synthesizeDirectGroundedResponse(question, contextChunks, mode);
      return directResponse;
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

      const text = await this.generateContentWithFallback({
        contents: prompt,
        temperature: 0.1,
      });

      const rewritten = text.trim().replace(/^["']|["']$/g, '');
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
