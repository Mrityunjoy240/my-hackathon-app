import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for common TTS responses
const ttsCache = new Map<string, ArrayBuffer>();
const MAX_CACHE_SIZE = 50;

function cleanForVoice(text: string): string {
  return text
    .replace(/^[-•*–]\s*/gm, '')
    .replace(/INR\s*/gi, '')
    .replace(/(\d+),(\d{2}),(\d{3})/g, (m, a, b, c) => {
      const n = parseInt(a + b + c);
      const l = n / 100000;
      return (l % 1 === 0 ? l : l.toFixed(2)) + ' lakhs';
    })
    .replace(/(\d{2}),(\d{3})/g, (m, a, b) => {
      return (parseInt(a + b) / 1000) + ' thousand';
    })
    .replace(/[–—→←*#:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits text into chunks of maximum maxLength characters,
 * strictly at sentence boundaries . ? ! । ।।
 */
function splitText(text: string, maxLength: number = 120): string[] {
  // Split at . ? ! । ।। followed by optional space
  // Using a lookbehind to keep the delimiter
  const sentences = text.match(/[^.!?।॥]+[.!?।॥]*\s*/g) || [text];
  
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    // If a single sentence is longer than maxLength, we still have to split it
    if (sentence.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      let remaining = sentence;
      while (remaining.length > maxLength) {
        let splitIdx = remaining.lastIndexOf(' ', maxLength);
        if (splitIdx === -1) splitIdx = maxLength;
        
        chunks.push(remaining.substring(0, splitIdx).trim());
        remaining = remaining.substring(splitIdx).trim();
      }
      currentChunk = remaining;
    } else if ((currentChunk + sentence).length > maxLength) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const { text: rawText, language } = await req.json();

    if (!rawText || !language) {
      return NextResponse.json(
        { error: 'Missing text or language' },
        { status: 400 }
      );
    }

    const text = cleanForVoice(rawText);

    // Cache check
    const cacheKey = `${text.substring(0, 100)}_${language}`;
    const cachedAudio = ttsCache.get(cacheKey);
    if (cachedAudio) {
      return new Response(cachedAudio, {
        headers: { 'Content-Type': 'audio/wav' },
      });
    }

    if (!process.env.SARVAM_API_KEY) {
      return NextResponse.json({ error: 'SARVAM_API_KEY not configured' }, { status: 500 });
    }

    const langMap: Record<string, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      bn: 'bn-IN',
    };

    const speakerMap: Record<string, string> = {
      en: 'amelia',
      hi: 'anand',
      bn: 'ratan',
    };

    const targetLanguageCode = langMap[language] || 'en-IN';
    const speaker = speakerMap[language] || 'amelia';

    // TASK 4: Return only FIRST chunk immediately
    const textChunks = splitText(text, 120);
    const chunkToProcess = textChunks[0];

    if (!chunkToProcess) {
       return NextResponse.json({ error: 'No valid text to synthesize' }, { status: 400 });
    }

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [chunkToProcess],
        target_language_code: targetLanguageCode,
        speaker: speaker,
        pace: 1.0,
        model: 'bulbul:v3',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Sarvam TTS API error:', errorData);
      return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: response.status });
    }

    const data = await response.json();
    const base64Audio = data.audios[0];
    const audioBuffer = Buffer.from(base64Audio, 'base64');

    // Update cache
    if (ttsCache.size >= MAX_CACHE_SIZE) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, audioBuffer.buffer.slice(
      audioBuffer.byteOffset, 
      audioBuffer.byteOffset + audioBuffer.byteLength
    ));

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
      },
    });
  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
