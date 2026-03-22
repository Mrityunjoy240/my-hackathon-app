import { NextResponse } from 'next/server';
import Groq from "groq-sdk";
import { generateEmbedding } from '@/lib/rag/embeddings';
import { supabase } from '@/lib/rag/supabase';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Simple language detection for English, Hindi, and Bengali.
 */
function detectLanguage(text: string): string {
  if (/[\u0980-\u09FF]/.test(text)) return 'Bengali';
  if (/[\u0900-\u097F]/.test(text)) return 'Hindi';
  return 'English';
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not defined' }, { status: 500 });
    }

    // Step 1: Detect Language
    const detectedLang = detectLanguage(message);

    // Step 2: Generate embedding for the user's question
    const queryEmbedding = await generateEmbedding(message);

    // Step 3: Search Supabase vector store for relevant chunks
    const { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
    });

    if (error) {
      console.error('Supabase vector search error:', error);
    }

    // Step 4: Build context from matched documents with filename metadata
    let context = '';
    const sources: string[] = [];
    
    if (documents && documents.length > 0) {
      context = documents
        .map((doc: any, i: number) => {
          const filename = doc.metadata?.filename || 'Unknown Document';
          if (!sources.includes(filename)) sources.push(filename);
          return `[Source: ${filename}]: ${doc.content}`;
        })
        .join('\n\n');
    }

    // Step 5: Build prompt — enforcing same-language response
    const prompt = `You are a helpful AI college assistant. 

IMPORTANT: The user wrote in ${detectedLang}. 
You MUST respond in the exact same language.
- If Hindi: respond in Hindi (Devanagari script)
- If Bengali: respond in Bengali script
- If English: respond in English

${context 
  ? `Answer the user's question based on the document context below. If the context does not contain the answer, say so honestly.

CONTEXT FROM DOCUMENTS:
${context}` 
  : "No relevant documents have been uploaded yet. Answer the question to the best of your general knowledge, but mention that no official documents were found."}

USER QUESTION:
${message}

ANSWER:`;

    // Step 6: Generate answer with Groq
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      });
      const response = completion.choices[0].message.content || "";

      return NextResponse.json({ 
        response,
        sourcesFound: documents?.length ?? 0,
        sources
      });
    } catch (groqError: any) {
      console.error('Groq AI Generation Error:', groqError);
      
      if (groqError.status === 429) {
        return NextResponse.json({ 
          error: "AI quota exceeded. Please try again in a few minutes.",
          details: groqError.message
        }, { status: 429 });
      }

      throw groqError;
    }

  } catch (error: any) {
    console.error('API Chat Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error.message 
    }, { status: 500 });
  }
}
