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
    const { message, language } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not defined' }, { status: 500 });
    }

    // Step 1: Detect Language or use passed language
    const langNames: Record<string, string> = {
      en: 'English',
      hi: 'Hindi',
      bn: 'Bengali'
    };
    const detectedLang = language ? (langNames[language] || detectLanguage(message)) : detectLanguage(message);

    // Step 2: Generate embedding for the user's question
    const queryEmbedding = await generateEmbedding(message);

    // Step 3: Search Supabase vector store for relevant chunks
    let { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.15,
      match_count: 8,
    });

    // FALLBACK: If no documents or specific keywords present, search with lower threshold
    const forceKeywords = [/fee/i, /hostel/i, /placement/i, /admission/i, /package/i, /salary/i, /cost/i, /rupees/i, /taka/i, /paisa/i, /kitna/i, /koto/i, /কত/i, /কতটুকু/i, /फीस/i, /होस्टेल/i];
    const needsForce = forceKeywords.some(regex => regex.test(message));

    if ((!documents || documents.length === 0 || needsForce) && !error) {
      console.log('Applying fallback vector search...');
      const { data: fallback } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.05,
        match_count: 8,
      });
      if (fallback && fallback.length > 0) {
        documents = fallback;
      }
    }

    console.log('Documents found:', documents?.length, 
      'Query:', message.substring(0, 50));

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

VOICE OUTPUT RULES - CRITICAL:
You are speaking out loud. Format for ears not eyes.
NEVER use bullet points, dashes, or numbered lists.
NEVER write INR - say "lakhs" or "thousand rupees".
NEVER write numbers like 1,02,050 or 3,75,000.
ALWAYS write numbers in spoken form:
  1,09,000 = "1.09 lakhs"
  25,000 = "25 thousand"  
  15,00,000 = "15 lakhs"
  3,75,000 = "3.75 lakhs"
Keep each sentence under 15 words for smooth speaking.
Maximum 3 sentences total per response.
Never start with "The fee structure is as follows:"
Just say the answer directly in one sentence.

WRONG: "The B.Tech fee is INR 1,09,000 - 1,69,000"
RIGHT: "B.Tech fee is around 1 to 1.7 lakhs per year"

WRONG: "- B.Tech First Year Fee: INR 1,02,050"  
RIGHT: "First year costs around 1 lakh per semester"

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
