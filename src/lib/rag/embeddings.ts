import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY || "");

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    });
    return Array.from(result as number[]);
  } catch (error) {
    console.error("Embedding generation failed:", error);
    throw new Error("Failed to generate embedding.");
  }
}

export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const results = await Promise.all(
      texts.map(text => hf.featureExtraction({
        model: "sentence-transformers/all-MiniLM-L6-v2",
        inputs: text,
      }))
    );
    return results.map(r => Array.from(r as number[]));
  } catch (error) {
    console.error("Batch embedding generation failed:", error);
    throw new Error("Failed to generate batch embeddings.");
  }
}
