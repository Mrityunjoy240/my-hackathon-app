import { getGeminiModel } from "@/lib/ai/gemini";
import { vectorService } from "@/services/vector-service";

/**
 * AI Service for orchestrating Gemini AI calls with RAG context.
 */
export class AIService {
  private model = getGeminiModel();

  /**
   * Generates a response from the AI assistant using Gemini.
   * @param query The user's input message.
   * @param context Optional RAG context from the vector database.
   */
  async getResponse(query: string, context?: string) {
    try {
      const prompt = context 
        ? `You are an AI College Assistant. Use the following context to answer the student's question accurately.\n\nContext:\n${context}\n\nStudent Question: ${query}`
        : `You are an AI College Assistant. Answer the following student question accurately: ${query}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini AI generation failed:", error);
      throw new Error("Failed to generate response from Gemini AI.");
    }
  }

  /**
   * Retrieves relevant context for a query using RAG.
   */
  async getRAGContext(query: string) {
    return vectorService.searchSimilar(query);
  }
}

export const aiService = new AIService();
