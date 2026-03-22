'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [chunksStored, setChunksStored] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setMessage(null);
    setChunksStored(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/vector/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Successfully uploaded "${data.filename}"` });
        setChunksStored(data.chunksStored);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred during upload.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-2xl font-bold text-slate-900">Authority Document Upload</h1>
          <p className="text-slate-500 mt-1">Upload college documents (PDF, DOCX, Excel, TXT) to the AI knowledge base.</p>
        </div>

        <div className="p-8">
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
              ${file ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}
            `}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
              className="hidden"
            />
            
            <div className="flex flex-col items-center">
              {file ? (
                <FileText className="h-12 w-12 text-indigo-500 mb-4" />
              ) : (
                <Upload className="h-12 w-12 text-slate-400 mb-4" />
              )}
              <h3 className="text-lg font-medium text-slate-900">
                {file ? file.name : 'Click to browse or drag and drop'}
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                Supports PDF, DOCX, Excel, and Plain Text
              </p>
              {file && (
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex items-center justify-end gap-4">
            {file && !isUploading && (
              <button
                onClick={() => setFile(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className={`
                px-6 py-2.5 rounded-lg font-semibold text-white transition-all flex items-center gap-2
                ${!file || isUploading 
                  ? 'bg-slate-300 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-100'}
              `}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Start Ingestion'
              )}
            </button>
          </div>

          {/* Messages */}
          {message && (
            <div className={`mt-8 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-red-50 border border-red-100 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{message.text}</p>
                {chunksStored !== null && (
                  <p className="text-sm mt-1 opacity-90">
                    The document was split into <span className="font-bold">{chunksStored}</span> vector chunks for the AI.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
