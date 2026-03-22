import { pipeline } from '@xenova/transformers';

let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return embedder;
}

export async function generateEmbedding(
  text: string
): Promise<number[]> {
  try {
    const embed = await getEmbedder();
    const result = await embed(text, { 
      pooling: 'mean', 
      normalize: true 
    });
    return Array.from(result.data) as number[];
  } catch (error) {
    console.error('Embedding failed:', error);
    throw new Error('Failed to generate embedding.');
  }
}

export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  try {
    const embed = await getEmbedder();
    const results = await Promise.all(
      texts.map(text => embed(text, { 
        pooling: 'mean', 
        normalize: true 
      }))
    );
    return results.map(r => Array.from(r.data) as number[]);
  } catch (error) {
    console.error('Batch embedding failed:', error);
    throw new Error('Failed to generate batch embeddings.');
  }
}
