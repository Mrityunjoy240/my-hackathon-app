import { NextResponse } from 'next/server';
import { supabase } from '@/lib/rag/supabase';

export async function GET() {
  try {
    // Query the documents table for metadata
    const { data, error } = await supabase
      .from('documents')
      .select('metadata');

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ documents: [] });
    }

    // Group the chunks by filename to create a summary for each document
    const docsMap = new Map();
    
    data.forEach((item: any) => {
      const meta = item.metadata;
      if (!meta || !meta.filename) return;

      const existing = docsMap.get(meta.filename);
      if (existing) {
        existing.chunkCount += 1;
      } else {
        docsMap.set(meta.filename, {
          filename: meta.filename,
          chunkCount: 1,
          uploadedAt: meta.ingestedAt || new Date().toISOString(),
          type: meta.type || 'Unknown'
        });
      }
    });

    const documents = Array.from(docsMap.values()).sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('API Documents GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
