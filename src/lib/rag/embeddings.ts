import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY || "");

export async function generateEmbedding(
  text: string
): Promise<number[]> {
  try {
    const result = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    });
    const flat = Array.isArray(result[0]) 
      ? (result as number[][])[0] 
      : (result as number[]);
    return flat;
  } catch (error) {
    console.error("Embedding failed:", error);
    throw new Error("Failed to generate embedding.");
  }
}

export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  try {
    const results = await Promise.all(
      texts.map(text =>
        hf.featureExtraction({
          model: "sentence-transformers/all-MiniLM-L6-v2",
          inputs: text,
        })
      )
    );
    return results.map(r =>
      Array.isArray(r[0]) ? (r as number[][])[0] : (r as number[])
    );
  } catch (error) {
    console.error("Batch embedding failed:", error);
    throw new Error("Failed to generate batch embeddings.");
  }
}
