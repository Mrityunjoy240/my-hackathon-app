import { supabase } from "@/lib/rag/supabase";
import { generateEmbedding, generateBatchEmbeddings } from "@/lib/rag/embeddings";

export interface DocumentChunk {
  content: string;
  metadata?: DocumentMetadata;
  embedding?: number[];
}

export interface DocumentMetadata {
  filename: string;
  type: string;
  size: number;
  ingestedAt: string;
  chunkIndex?: number;
}

interface MatchedDocument {
  content: string;
  metadata: DocumentMetadata;
  similarity: number;
}

/**
 * Service for handling document storage and retrieval in the Vector DB.
 */
export class VectorService {
  /**
   * Chunks a large text into smaller parts with overlap.
   */
  chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      chunks.push(text.slice(start, start + chunkSize));
      start += chunkSize - overlap;
    }
    return chunks;
  }

  /**
   * Ingests a full document by chunking, embedding, and storing it.
   */
  async ingestDocument(text: string, metadata: DocumentMetadata) {
    try {
      const chunks = this.chunkText(text);

      // Batch process embeddings
      const embeddings = await generateBatchEmbeddings(chunks);

      const records = chunks.map((chunk, i) => ({
        content: chunk,
        metadata: { ...metadata, chunkIndex: i },
        embedding: embeddings[i],
      }));

      const { error } = await supabase.from("documents").insert(records);

      if (error) throw error;

      return { success: true, chunksIngested: chunks.length };
    } catch (error) {
      console.error("Vector Ingestion Error:", error);
      throw new Error("Failed to ingest document into vector store.");
    }
  }

  /**
   * Searches for similar context using a vector similarity search.
   */
  async searchSimilar(
    query: string,
    matchThreshold: number = 0.5,
    matchCount: number = 5
  ): Promise<string> {
    try {
      const queryEmbedding = await generateEmbedding(query);

      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
      });

      if (error) throw error;

      return (data as MatchedDocument[])
        .map((item) => item.content)
        .join("\n\n");
    } catch (error) {
      console.error("Vector Search Error:", error);
      return ""; // Fallback to empty context
    }
  }
}

export const vectorService = new VectorService();
