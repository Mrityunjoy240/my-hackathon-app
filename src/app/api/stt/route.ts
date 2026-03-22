import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob;
    const hint = formData.get('hint') as string || 'auto';

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Convert Blob to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // 1. Logic to decide provider
    // If hi or bn, go to Sarvam
    // If en or auto, go to AssemblyAI (it detects language better)
    if (hint === 'hi' || hint === 'bn') {
      if (!process.env.SARVAM_API_KEY) {
        return NextResponse.json({ error: 'SARVAM_API_KEY not configured' }, { status: 500 });
      }

      const sarvamLang = hint === 'hi' ? 'hi-IN' : 'bn-IN';
      const sarvamFormData = new FormData();
      sarvamFormData.append('file', file, 'audio.webm');
      sarvamFormData.append('language_code', sarvamLang);
      sarvamFormData.append('model', 'saaras:v3');

      const response = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'api-subscription-key': process.env.SARVAM_API_KEY,
        },
        body: sarvamFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Sarvam STT API error:', errorData);
        return NextResponse.json({ error: 'Failed to transcribe audio via Sarvam' }, { status: response.status });
      }

      const data = await response.json();
      return NextResponse.json({
        transcript: data.transcript,
        detectedLanguage: hint,
        provider: 'sarvam'
      });
    }

    // Default to AssemblyAI for 'en' or 'auto'
    if (!process.env.ASSEMBLYAI_API_KEY) {
      return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not configured' }, { status: 500 });
    }

    const client = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY
    });

    const transcript = await client.transcripts.transcribe({
      audio: audioBuffer,
      language_detection: true
    });

    if (transcript.status === 'error') {
      throw new Error(`AssemblyAI Error: ${transcript.error}`);
    }

    // Map AssemblyAI language codes to our supported 'en', 'hi', 'bn'
    let detectedLang: 'en' | 'hi' | 'bn' = 'en';
    const langCode = transcript.language_code || 'en';
    
    if (langCode.startsWith('hi')) {
      detectedLang = 'hi';
    } else if (langCode.startsWith('bn')) {
      detectedLang = 'bn';
    } else {
      detectedLang = 'en';
    }

    return NextResponse.json({
      transcript: transcript.text,
      detectedLanguage: detectedLang,
      provider: 'assemblyai'
    });

  } catch (error: any) {
    console.error('STT Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
