import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  FileText,
  GitCompare,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useNovaStore } from '../../stores/useNovaStore';
import { KnowledgeDocument } from '../../types/nova';
import { executeHybridPrompt } from '../../services/ai/novaAiEngine';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';

export const KnowledgeVaultModal: React.FC = () => {
  const {
    activeOverlay,
    setActiveOverlay,
    knowledgeDocs,
    addKnowledgeDoc,
    deleteKnowledgeDoc,
    selectedModelId,
    routingMode,
    privacyPreference,
    localReadiness,
    isOnline,
    addTelemetryEvent,
    pushToast,
    openConfirm,
  } = useNovaStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('All');
  const [activeDocId, setActiveDocId] = useState(knowledgeDocs[0]?.id || '');
  const [compareDocId, setCompareDocId] = useState('');
  const [qaPrompt, setQaPrompt] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCollection, setNewCollection] = useState('General');
  const [newTags, setNewTags] = useState('');
  const [newContent, setNewContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const collections = useMemo(() => {
    const set = new Set<string>(['All']);
    knowledgeDocs.forEach((d) => set.add(d.collectionName || 'General'));
    return Array.from(set);
  }, [knowledgeDocs]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return knowledgeDocs
      .filter((d) => selectedCollection === 'All' || d.collectionName === selectedCollection)
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
  }, [knowledgeDocs, searchQuery, selectedCollection]);

  const activeDoc = useMemo(
    () => knowledgeDocs.find((d) => d.id === activeDocId) || filteredDocs[0],
    [knowledgeDocs, activeDocId, filteredDocs]
  );

  if (activeOverlay !== 'vault') return null;

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const text = await file.text().catch(() => '');
      const doc: KnowledgeDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        collectionName: selectedCollection === 'All' ? 'Uploads' : selectedCollection,
        title: file.name,
        mimeType: file.type || 'text/plain',
        tags: ['uploaded'],
        content: text.slice(0, 15000) || `Binary attachment: ${file.name} (${file.size} bytes)`,
        summary: `Uploaded ${file.name} (${Math.round(file.size / 1024)} KB)`,
        createdAt: new Date().toISOString(),
      };
      addKnowledgeDoc(doc);
      setActiveDocId(doc.id);
    }
    pushToast({ type: 'success', title: 'Document Added to Knowledge Vault' });
  };

  const handleSaveManualDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    const doc: KnowledgeDocument = {
      id: `doc-${Date.now()}`,
      collectionName: newCollection.trim() || 'General',
      title: newTitle.trim(),
      mimeType: 'text/markdown',
      tags: newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      content: newContent.trim(),
      summary: newContent.trim().slice(0, 140),
      createdAt: new Date().toISOString(),
    };
    addKnowledgeDoc(doc);
    setActiveDocId(doc.id);
    setNewTitle('');
    setNewContent('');
    setNewTags('');
    setShowAddForm(false);
    pushToast({ type: 'success', title: 'Knowledge Note Saved', detail: doc.title });
  };

  const handleDocumentIntelligence = async (mode: 'summarize' | 'qa' | 'compare') => {
    if (!activeDoc) return;
    setIsAnalyzing(true);
    setQaAnswer('');
    try {
      const compareDoc = knowledgeDocs.find((d) => d.id === compareDocId);
      const prompt =
        mode === 'summarize'
          ? `Summarize this document into key findings, definitions, and open questions. Cite sections accurately.\n\nTitle: ${activeDoc.title}\nContent:\n${activeDoc.content}`
          : mode === 'compare' && compareDoc
          ? `Compare Document A and Document B across key points, agreements, and differences.\n\n[Document A: ${activeDoc.title}]\n${activeDoc.content}\n\n[Document B: ${compareDoc.title}]\n${compareDoc.content}`
          : `Answer the following question strictly using the provided document and cite relevant excerpts. Question: ${
              qaPrompt.trim() || 'What are the core takeaways?'
            }\n\n[${activeDoc.title}]\n${activeDoc.content}`;

      const res = await executeHybridPrompt({
        workspace: 'vault',
        prompt,
        requestedModelId: selectedModelId,
        routingMode,
        privacyPreference,
        localReadiness,
        isOnline,
        onTelemetry: addTelemetryEvent,
      });
      setQaAnswer(res.text);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Document Intelligence Failed',
        detail: err instanceof Error ? err.message : 'Unable to analyze document.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-modal-title"
    >
      <div className="w-full max-w-5xl h-[86vh] flex flex-col rounded-2xl border border-slate-700/80 bg-[#0B101D] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 id="vault-modal-title" className="text-base font-semibold text-slate-100">
                Knowledge Vault &amp; Document Intelligence
              </h2>
              <p className="text-xs text-slate-400">
                Collections, file uploads, citations, semantic search, and document comparison
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5 text-cyan-400" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Note</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay(null)}
              aria-label="Close Knowledge Vault"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv,.pdf,.docx"
            onChange={(e) => handleUploadFiles(e.target.files)}
            className="hidden"
          />
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left Doc List */}
          <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-800 p-3.5 flex flex-col min-h-0 max-h-60 md:max-h-none">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vault documents..."
                aria-label="Search Knowledge Vault"
                className="w-full rounded-lg border border-slate-800 bg-[#070B14] pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="mb-2 flex flex-wrap gap-1">
              {collections.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setSelectedCollection(col)}
                  className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                    selectedCollection === col
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {col}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={`group flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors ${
                    doc.id === activeDoc?.id
                      ? 'border-indigo-500/60 bg-indigo-500/12'
                      : 'border-slate-800/70 bg-[#070B14] hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveDocId(doc.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-100 truncate">
                      <FileText className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{doc.title}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                      {doc.collectionName} · {doc.tags.join(', ') || 'untagged'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openConfirm({
                        title: `Delete "${doc.title}"?`,
                        description: 'Remove this document from your Knowledge Vault?',
                        confirmLabel: 'Delete',
                        destructive: true,
                        onConfirm: () => deleteKnowledgeDoc(doc.id),
                      })
                    }
                    aria-label={`Delete ${doc.title}`}
                    className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right Preview + AI Document Intelligence */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-[#070B14]">
            {showAddForm && (
              <form
                onSubmit={handleSaveManualDoc}
                className="rounded-xl border border-indigo-500/50 bg-[#0D1322] p-4 space-y-3"
              >
                <h3 className="text-sm font-semibold text-slate-100">Add Knowledge Note</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Document title"
                    className="rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-slate-100"
                  />
                  <input
                    type="text"
                    value={newCollection}
                    onChange={(e) => setNewCollection(e.target.value)}
                    placeholder="Collection (e.g. Research)"
                    className="rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-slate-100"
                  />
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="Tags comma-separated"
                    className="rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-slate-100"
                  />
                </div>
                <textarea
                  required
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Paste source text, lecture notes, or specifications..."
                  className="w-full rounded-lg border border-slate-700 bg-[#070B14] p-3 text-xs text-slate-100"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Save Document
                  </button>
                </div>
              </form>
            )}

            {activeDoc ? (
              <>
                <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">{activeDoc.title}</h3>
                      <p className="text-xs text-slate-400">
                        {activeDoc.collectionName} · {activeDoc.mimeType}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDocumentIntelligence('summarize')}
                      disabled={isAnalyzing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Summarize Document</span>
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300 max-h-48 overflow-y-auto border-t border-slate-800 pt-3">
                    {activeDoc.content}
                  </p>
                </div>

                {/* Q&A + Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-3.5 space-y-2">
                    <label
                      htmlFor="vault-qa-input"
                      className="block text-xs font-semibold text-slate-300"
                    >
                      Ask Document with Citations
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="vault-qa-input"
                        type="text"
                        value={qaPrompt}
                        onChange={(e) => setQaPrompt(e.target.value)}
                        placeholder="Ask a question grounded in this document..."
                        className="flex-1 rounded-lg border border-slate-700 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleDocumentIntelligence('qa')}
                        disabled={isAnalyzing}
                        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                      >
                        Ask
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-3.5 space-y-2">
                    <label
                      htmlFor="vault-compare-select"
                      className="block text-xs font-semibold text-slate-300"
                    >
                      Compare With Another Document
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="vault-compare-select"
                        value={compareDocId}
                        onChange={(e) => setCompareDocId(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-700 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <option value="">Select document...</option>
                        {knowledgeDocs
                          .filter((d) => d.id !== activeDoc.id)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.title}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!compareDocId || isAnalyzing}
                        onClick={() => handleDocumentIntelligence('compare')}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                      >
                        <GitCompare className="h-3.5 w-3.5" />
                        <span>Compare</span>
                      </button>
                    </div>
                  </div>
                </div>

                {qaAnswer && (
                  <div className="rounded-xl border border-cyan-500/40 bg-[#0D1322] p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">
                      Document Intelligence Output
                    </h4>
                    <MarkdownRenderer content={qaAnswer} />
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-sm text-slate-400">
                Select or upload a document to inspect and analyze.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
