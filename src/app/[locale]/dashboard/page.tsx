'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Database, Calendar, Layers, RefreshCcw, Loader2, AlertCircle } from 'lucide-react';

interface DocumentSummary {
  filename: string;
  chunkCount: number;
  uploadedAt: string;
  type: string;
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch documents');
      }

      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Document Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage and view documents currently in the AI vector store.</p>
        </div>
        <button 
          onClick={fetchDocuments}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center gap-4 text-red-800">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <p>{error}</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-24 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-indigo-500" />
          <p className="text-lg font-medium text-slate-600">Fetching documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-24 flex flex-col items-center justify-center text-slate-400">
          <Database className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-xl font-medium text-slate-900">No documents found</p>
          <p className="mt-2 text-slate-500">Upload some documents to see them here.</p>
          <a 
            href="./upload" 
            className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium"
          >
            Go to Upload
          </a>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Document Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider text-center">Chunks</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Uploaded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                          <FileText className="h-5 w-5" />
                        </div>
                        <span className="font-medium text-slate-900 truncate max-w-xs">{doc.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200 uppercase">
                        {doc.type.split('/').pop() || doc.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-600 font-mono text-sm">
                        <Layers className="h-3.5 w-3.5" />
                        {doc.chunkCount}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Calendar className="h-4 w-4" />
                        {new Date(doc.uploadedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
