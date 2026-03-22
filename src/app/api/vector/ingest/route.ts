import { NextResponse } from 'next/server';
import { documentProcessor } from '@/services/document-processor';
import { vectorService } from '@/services/vector-service';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1. Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extract Text
    const text = await documentProcessor.extractText(buffer, file.name);

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from document' }, { status: 400 });
    }

    // 3. Ingest into Vector DB
    const result = await vectorService.ingestDocument(text, {
      filename: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      ingestedAt: new Date().toISOString()
    });

    return NextResponse.json({ 
      success: true, 
      filename: file.name,
      chunksStored: result.chunksIngested 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
