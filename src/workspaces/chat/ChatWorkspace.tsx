import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  FileText,
  FolderOpen,
  GitBranch,
  Image as ImageIcon,
  Mic,
  MicOff,
  Paperclip,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { BUILTIN_PERSONAS, NOVA_MODELS } from '../../data/seedData';
import { useNovaStore } from '../../stores/useNovaStore';
import { executeHybridPrompt } from '../../services/ai/novaAiEngine';
import { exportConversationToGoogleDoc } from '../../services/workspace/googleWorkspaceService';
import { AttachmentItem, ChatMessage, Persona } from '../../types/nova';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';

export const ChatWorkspace: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    updateConversation,
    deleteConversation,
    appendMessage,
    updateMessage,
    branchConversation,
    selectedModelId,
    setSelectedModelId,
    selectedPersonaId,
    setSelectedPersonaId,
    customPersonas,
    saveCustomPersona,
    deleteCustomPersona,
    routingMode,
    privacyPreference,
    localReadiness,
    isOnline,
    knowledgeDocs,
    templates,
    leftSidebarOpen,
    rightSidebarOpen,
    addTelemetryEvent,
    pushToast,
    openConfirm,
    setActiveOverlay,
  } = useNovaStore();

  const [promptInput, setPromptInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [personaSearch, setPersonaSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('All');
  const [showArchived, setShowArchived] = useState(false);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [personaForm, setPersonaForm] = useState<Persona>({
    id: '',
    name: '',
    role: '',
    instructions: '',
    preferredModelId: 'gemini-4-hydrogen',
    responseStyle: 'balanced',
    isCustom: true,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [verifyingMsgId, setVerifyingMsgId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const allPersonas = useMemo(() => [...customPersonas, ...BUILTIN_PERSONAS], [customPersonas]);
  const activePersona = useMemo(
    () => allPersonas.find((p) => p.id === selectedPersonaId) || BUILTIN_PERSONAS[0],
    [allPersonas, selectedPersonaId]
  );
  const activeModel = useMemo(
    () => NOVA_MODELS.find((m) => m.id === selectedModelId) || NOVA_MODELS[1],
    [selectedModelId]
  );

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || conversations[0],
    [conversations, activeConversationId]
  );

  const filteredPersonas = useMemo(() => {
    const q = personaSearch.trim().toLowerCase();
    if (!q) return allPersonas;
    return allPersonas.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.instructions.toLowerCase().includes(q)
    );
  }, [allPersonas, personaSearch]);

  const folders = useMemo(() => {
    const set = new Set<string>(['All', 'General']);
    conversations.forEach((c) => set.add(c.folder || 'General'));
    return Array.from(set);
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return [...conversations]
      .filter((c) => (showArchived ? c.archived : !c.archived))
      .filter((c) => folderFilter === 'All' || c.folder === folderFilter)
      .filter((c) => {
        if (!q) return true;
        if (c.title.toLowerCase().includes(q)) return true;
        return c.messages.some((m) => m.content.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [conversations, historySearch, folderFilter, showArchived]);

  const handleSelectPersona = (persona: Persona) => {
    setSelectedPersonaId(persona.id);
    if (persona.preferredModelId) {
      setSelectedModelId(persona.preferredModelId);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const loaded: AttachmentItem[] = [];
    for (const file of Array.from(files)) {
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = String(reader.result || '');
            resolve(res.split(',')[1] || '');
          };
          reader.readAsDataURL(file);
        });
        loaded.push({ id, name: file.name, mimeType: file.type, sizeBytes: file.size, base64Data });
      } else {
        const textPreview = await file.text().catch(() => '');
        loaded.push({
          id,
          name: file.name,
          mimeType: file.type || 'text/plain',
          sizeBytes: file.size,
          textPreview: textPreview.slice(0, 8000),
        });
      }
    }
    setAttachments((prev) => [...prev, ...loaded]);
    setShowAttachMenu(false);
  };

  const handleSendPrompt = async (overrideText?: string) => {
    const text = (overrideText ?? promptInput).trim();
    if ((!text && attachments.length === 0) || isGenerating) return;

    const conv = activeConversation || createConversation(text.slice(0, 40) || 'New Chat');
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text || 'Analyze attached files.',
      createdAt: new Date().toISOString(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    appendMessage(conv.id, userMsg);
    if (!overrideText) {
      setPromptInput('');
    }
    const currentAttachments = [...attachments];
    setAttachments([]);
    setIsGenerating(true);
    setStreamingText('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const historyPayload = conv.messages.map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

      const result = await executeHybridPrompt({
        workspace: 'chat',
        prompt: userMsg.content,
        history: historyPayload,
        systemInstruction: `Persona: ${activePersona.name} (${activePersona.role}). Style: ${activePersona.responseStyle}. Instructions: ${activePersona.instructions}`,
        requestedModelId: selectedModelId,
        routingMode,
        privacyPreference,
        localReadiness,
        isOnline,
        attachments: currentAttachments,
        abortSignal: controller.signal,
        onTelemetry: addTelemetryEvent,
        onStreamChunk: (partial) => setStreamingText(partial),
      });

      appendMessage(conv.id, {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: result.text,
        createdAt: new Date().toISOString(),
        modelId: result.modelId,
        executionSource: result.executionSource,
        latencyMs: result.latencyMs,
        verificationStatus: 'none',
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'Inference request failed.';
        pushToast({ type: 'error', title: 'Inference Error', detail: msg });
        appendMessage(conv.id, {
          id: `msg-err-${Date.now()}`,
          role: 'assistant',
          content: `Request could not be completed: ${msg}`,
          createdAt: new Date().toISOString(),
          modelId: selectedModelId,
          executionSource: 'blocked_offline',
          verificationStatus: 'none',
        });
      }
    } finally {
      setIsGenerating(false);
      setStreamingText('');
      abortRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setStreamingText('');
  };

  const handleRegenerate = async (assistantMsgId: string) => {
    if (!activeConversation || isGenerating) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === assistantMsgId);
    if (idx <= 0) return;
    const previousUser = [...activeConversation.messages.slice(0, idx)]
      .reverse()
      .find((m) => m.role === 'user');
    if (previousUser) {
      await handleSendPrompt(previousUser.content);
    }
  };

  const handleSaveEditedPrompt = async (msgId: string) => {
    if (!activeConversation || !editDraft.trim()) return;
    updateMessage(activeConversation.id, msgId, { content: editDraft.trim() });
    setEditingMsgId(null);
    await handleSendPrompt(editDraft.trim());
  };

  const handleReadAloud = async (msg: ChatMessage) => {
    if (playingMsgId === msg.id) {
      setPlayingMsgId(null);
      return;
    }
    setPlayingMsgId(msg.id);
    try {
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.content, voiceName: 'Kore' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'TTS failed');
      }
      const data = (await res.json()) as { audioBase64: string };
      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      audio.onended = () => setPlayingMsgId(null);
      await audio.play();
    } catch (err) {
      setPlayingMsgId(null);
      pushToast({
        type: 'error',
        title: 'Speech Synthesis Failed',
        detail: err instanceof Error ? err.message : 'Unable to generate speech.',
      });
    }
  };

  const handleToggleMic = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = String(reader.result || '').split(',')[1];
          if (!base64) return;
          try {
            const res = await fetch('/api/gemini/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Transcription failed');
            setPromptInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
          } catch (err) {
            pushToast({
              type: 'error',
              title: 'Transcription Error',
              detail: err instanceof Error ? err.message : 'Failed to transcribe audio.',
            });
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      pushToast({
        type: 'warning',
        title: 'Microphone Unavailable',
        detail: 'Grant microphone permission in your browser to dictate prompts.',
      });
    }
  };

  const handleVerifyClaims = async (msg: ChatMessage) => {
    if (!activeConversation) return;
    setVerifyingMsgId(msg.id);
    updateMessage(activeConversation.id, msg.id, { verificationStatus: 'pending' });
    try {
      const sources = knowledgeDocs.slice(0, 5).map((d) => ({
        title: d.title,
        excerpt: d.content.slice(0, 1000),
      }));
      const res = await fetch('/api/gemini/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText: msg.content, sources }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      const status =
        data.overallStatus === 'verified' ||
        data.overallStatus === 'corrected' ||
        data.overallStatus === 'needs_review'
          ? data.overallStatus
          : 'needs_review';

      updateMessage(activeConversation.id, msg.id, {
        verificationStatus: status,
        claims: data.claims || [],
        verificationNote: data.limitations || 'Evaluated against Knowledge Vault sources.',
      });
    } catch (err) {
      updateMessage(activeConversation.id, msg.id, { verificationStatus: 'needs_review' });
      pushToast({
        type: 'error',
        title: 'Verification Failed',
        detail: err instanceof Error ? err.message : 'Unable to verify claims.',
      });
    } finally {
      setVerifyingMsgId(null);
    }
  };

  const handleExportMarkdown = () => {
    if (!activeConversation) return;
    const md = activeConversation.messages
      .map((m) => `### ${m.role.toUpperCase()} (${m.createdAt})\n\n${m.content}\n`)
      .join('\n---\n\n');
    const blob = new Blob([`# ${activeConversation.title}\n\n${md}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeConversation.title.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGoogleDoc = () => {
    if (!activeConversation) return;
    const text = activeConversation.messages
      .map((m) => `[${m.role.toUpperCase()}]\n${m.content}\n`)
      .join('\n---\n\n');
    openConfirm({
      title: 'Export Conversation to Google Docs?',
      description: `This will create a new Google Doc titled "${activeConversation.title}" in your connected Google account.`,
      confirmLabel: 'Create Google Doc',
      onConfirm: async () => {
        try {
          const doc = await exportConversationToGoogleDoc(activeConversation.title, text);
          pushToast({
            type: 'success',
            title: 'Exported to Google Docs',
            detail: `Document ID: ${doc.documentId}`,
          });
        } catch (err) {
          pushToast({
            type: 'error',
            title: 'Google Docs Export Failed',
            detail: err instanceof Error ? err.message : 'Sign in with Google first.',
          });
        }
      },
    });
  };

  const openNewPersonaModal = (existing?: Persona) => {
    setPersonaForm(
      existing || {
        id: `persona-${Date.now()}`,
        name: '',
        role: '',
        instructions: '',
        preferredModelId: selectedModelId,
        responseStyle: 'balanced',
        isCustom: true,
      }
    );
    setShowPersonaModal(true);
  };

  const submitPersonaForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaForm.name.trim() || !personaForm.instructions.trim()) return;
    saveCustomPersona({
      ...personaForm,
      id: personaForm.id || `persona-${Date.now()}`,
      name: personaForm.name.trim(),
      role: personaForm.role.trim() || 'Custom Specialist',
      instructions: personaForm.instructions.trim(),
      isCustom: true,
    });
    setShowPersonaModal(false);
    pushToast({ type: 'success', title: 'Persona Saved', detail: personaForm.name });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* LEFT CONTEXTUAL PANEL: AI Models + Personas */}
      {leftSidebarOpen && (
        <aside
          aria-label="Models and Personas"
          className="w-72 shrink-0 border-r border-slate-800/80 bg-[#0B101D] flex flex-col min-h-0 overflow-hidden max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:shadow-2xl"
        >
          {/* Top Zone: AI Models */}
          <div className="border-b border-slate-800/80 p-3.5 max-h-[50%] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                AI Models
              </h2>
              <button
                type="button"
                onClick={() => setActiveOverlay('monitor')}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Monitor
              </button>
            </div>
            <div className="space-y-1.5">
              {NOVA_MODELS.map((model) => {
                const selected = model.id === selectedModelId;
                const isLocal = model.location === 'on-device';
                const statusLabel = isLocal
                  ? localReadiness === 'available'
                    ? 'Local Ready'
                    : localReadiness === 'downloadable'
                    ? 'Downloadable'
                    : 'Local: Off'
                  : model.availability === 'ready'
                  ? 'Cloud Ready'
                  : model.availability === 'requires_paid_key'
                  ? 'Paid Key Req.'
                  : 'Extension Slot';

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModelId(model.id)}
                    className={`w-full text-left rounded-lg px-2.5 py-1.5 border transition-colors ${
                      selected
                        ? 'border-indigo-500/70 bg-indigo-500/12 text-slate-100'
                        : 'border-slate-800/70 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{model.name}</span>
                      <span
                        className={`text-[10px] shrink-0 ${
                          isLocal
                            ? localReadiness === 'available'
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                            : model.availability === 'ready'
                            ? 'text-cyan-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                      {model.provider} · {model.contextWindow}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Zone: Personas + Search */}
          <div className="flex-1 min-h-0 flex flex-col p-3.5 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Personas
              </h2>
              <button
                type="button"
                onClick={() => openNewPersonaModal()}
                aria-label="Create custom persona"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/15 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            </div>

            <div className="relative mb-2.5">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={personaSearch}
                onChange={(e) => setPersonaSearch(e.target.value)}
                placeholder="Search personas..."
                aria-label="Search personas"
                className="w-full rounded-lg border border-slate-800 bg-[#070B14] pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
              {filteredPersonas.map((persona) => {
                const selected = persona.id === selectedPersonaId;
                return (
                  <div
                    key={persona.id}
                    className={`group flex items-center justify-between rounded-lg px-2.5 py-2 border transition-colors ${
                      selected
                        ? 'border-cyan-500/60 bg-cyan-500/10 text-slate-100'
                        : 'border-transparent hover:border-slate-800 hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectPersona(persona)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="text-xs font-medium truncate">{persona.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {persona.role}
                        {persona.isCustom ? ' · Custom' : ''}
                      </div>
                    </button>
                    {persona.isCustom && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openNewPersonaModal(persona)}
                          aria-label={`Edit persona ${persona.name}`}
                          className="p-1 text-slate-400 hover:text-slate-200"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomPersona(persona.id)}
                          aria-label={`Delete persona ${persona.name}`}
                          className="p-1 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      )}

      {/* CENTRAL WORKSPACE: Conversation + Bottom Prompt Bar */}
      <section className="flex-1 min-w-0 flex flex-col bg-[#070B14] min-h-0">
        {/* Conversation Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 px-5 py-3">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-100 truncate">
              {activeConversation?.title || 'New Hybrid Session'}
            </h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400 truncate">
              <span>{activeModel.name}</span>
              <span aria-hidden="true">·</span>
              <span>{activePersona.name}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{routingMode}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => createConversation('New Hybrid Session')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Chat</span>
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Export MD</span>
            </button>
            <button
              type="button"
              onClick={handleExportGoogleDoc}
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5 text-cyan-400" />
              <span>Google Doc</span>
            </button>
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="mx-auto max-w-2xl py-10 text-center">
              <h2 className="text-lg font-semibold text-slate-100">
                Hybrid AI Chat Studio
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Send a prompt, attach images or video, dictate with your microphone, or test local Gemini Nano routing with {activePersona.name}.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {[
                  'Compare Firebase AI Logic on-device vs cloud execution trade-offs.',
                  'Summarize key architectural patterns for offline-first IndexedDB sync.',
                  'Write a clean TypeScript state reducer with strict exhaustive checks.',
                  'Create a 5-point study outline for distributed systems consensus.',
                ].map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => handleSendPrompt(starter)}
                    className="rounded-xl border border-slate-800 bg-[#0D1322] p-3.5 text-xs text-slate-300 hover:border-indigo-500/60 hover:bg-slate-900 transition-colors"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            activeConversation.messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`mx-auto max-w-3xl flex flex-col ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`w-full rounded-xl px-4 py-3.5 border ${
                      isUser
                        ? 'max-w-2xl border-indigo-500/35 bg-indigo-950/35 text-slate-100'
                        : 'border-slate-800/80 bg-[#0D1322] text-slate-200'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-300">
                          {isUser ? 'You' : activePersona.name}
                        </span>
                        {!isUser && msg.modelId && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{msg.modelId}</span>
                          </>
                        )}
                        {!isUser && msg.executionSource && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                msg.executionSource === 'on_device'
                                  ? 'text-emerald-400'
                                  : msg.executionSource === 'hybrid_fallback'
                                  ? 'text-amber-400'
                                  : msg.executionSource === 'blocked_offline'
                                  ? 'text-rose-400'
                                  : 'text-cyan-400'
                              }
                            >
                              {msg.executionSource === 'on_device'
                                ? 'On-Device'
                                : msg.executionSource === 'hybrid_fallback'
                                ? 'Cloud Fallback'
                                : msg.executionSource === 'blocked_offline'
                                ? 'Blocked'
                                : 'Cloud'}
                            </span>
                          </>
                        )}
                        {!isUser && typeof msg.latencyMs === 'number' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{msg.latencyMs}ms</span>
                          </>
                        )}
                      </div>
                      <span className="tabular-nums">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {msg.attachments.map((att) => (
                          <span
                            key={att.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                          >
                            <Paperclip className="h-3 w-3 text-cyan-400" />
                            <span>{att.name}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {editingMsgId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-slate-700 bg-[#070B14] p-2.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingMsgId(null)}
                            className="rounded-md px-3 py-1 text-xs text-slate-400 hover:bg-slate-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditedPrompt(msg.id)}
                            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                          >
                            Save & Resend
                          </button>
                        </div>
                      </div>
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}

                    {/* Response Verification Summary */}
                    {!isUser && msg.verificationStatus && msg.verificationStatus !== 'none' && (
                      <div className="mt-3 rounded-lg border border-slate-800 bg-[#070B14] p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-200">
                            Verification Status:{' '}
                            <span
                              className={
                                msg.verificationStatus === 'verified'
                                  ? 'text-emerald-400'
                                  : msg.verificationStatus === 'corrected'
                                  ? 'text-cyan-400'
                                  : 'text-amber-400'
                              }
                            >
                              {msg.verificationStatus.replace('_', ' ')}
                            </span>
                          </span>
                          {msg.verificationNote && (
                            <span className="text-[11px] text-slate-400">{msg.verificationNote}</span>
                          )}
                        </div>
                        {msg.claims && msg.claims.length > 0 && (
                          <ul className="mt-2 space-y-1.5 text-slate-300">
                            {msg.claims.map((c, idx) => (
                              <li key={idx} className="border-t border-slate-800/70 pt-1.5">
                                <span className="font-medium">[{c.status}]</span> {c.claim}{' '}
                                <span className="text-slate-400">— {c.evidenceCitation}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Message Actions */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          pushToast({ type: 'info', title: 'Copied message to clipboard' });
                        }}
                        aria-label="Copy message"
                        className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-800 hover:text-slate-200"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </button>

                      {isUser ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMsgId(msg.id);
                            setEditDraft(msg.content);
                          }}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-800 hover:text-slate-200"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRegenerate(msg.id)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-800 hover:text-slate-200"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Regenerate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReadAloud(msg)}
                            className={`inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-800 ${
                              playingMsgId === msg.id ? 'text-cyan-400' : 'hover:text-slate-200'
                            }`}
                          >
                            <Volume2 className="h-3 w-3" />
                            <span>{playingMsgId === msg.id ? 'Playing...' : 'Listen'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyClaims(msg)}
                            disabled={verifyingMsgId === msg.id}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-800 hover:text-slate-200"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            <span>{verifyingMsgId === msg.id ? 'Checking...' : 'Verify'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => branchConversation(activeConversation.id, msg.id)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-800 hover:text-slate-200"
                          >
                            <GitBranch className="h-3 w-3" />
                            <span>Branch</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateMessage(activeConversation.id, msg.id, {
                                feedback: msg.feedback === 'up' ? null : 'up',
                              })
                            }
                            aria-label="Helpful response"
                            className={`rounded p-1 hover:bg-slate-800 ${
                              msg.feedback === 'up' ? 'text-emerald-400' : ''
                            }`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateMessage(activeConversation.id, msg.id, {
                                feedback: msg.feedback === 'down' ? null : 'down',
                              })
                            }
                            aria-label="Unhelpful response"
                            className={`rounded p-1 hover:bg-slate-800 ${
                              msg.feedback === 'down' ? 'text-rose-400' : ''
                            }`}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isGenerating && (
            <div className="mx-auto max-w-3xl rounded-xl border border-indigo-500/40 bg-[#0D1322] px-4 py-3.5">
              <div className="mb-1.5 text-xs text-cyan-400">
                Generating via {activeModel.name}...
              </div>
              {streamingText ? (
                <MarkdownRenderer content={streamingText} />
              ) : (
                <div className="space-y-2 py-1">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-800" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Prompt Composer (Sketch: "+" on left + multiline input) */}
        <div className="border-t border-slate-800/80 bg-[#0B101D] p-3.5">
          <div className="mx-auto max-w-3xl">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="truncate max-w-[160px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((p) => p.id !== att.id))}
                      aria-label={`Remove ${att.name}`}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative flex items-end gap-2 rounded-xl border border-slate-700/80 bg-[#070B14] p-2 focus-within:border-indigo-500">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAttachMenu((v) => !v)}
                  aria-label="Add attachments or templates"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
                {showAttachMenu && (
                  <div className="absolute bottom-11 left-0 z-30 w-56 rounded-xl border border-slate-700 bg-[#0D1322] p-1.5 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Upload Image / Video / Doc</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tpl = templates.find((t) => t.category === 'prompt');
                        if (tpl) setPromptInput(tpl.content);
                        setShowAttachMenu(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Insert Prompt Template</span>
                    </button>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.txt,.md,.csv,.json,.pdf,.docx"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />

              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt();
                  }
                }}
                rows={2}
                placeholder={`Ask ${activePersona.name} (${activeModel.name})...`}
                aria-label="Chat prompt input"
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  aria-label={isRecording ? 'Stop audio recording' : 'Record voice prompt'}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    isRecording
                      ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>

                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    aria-label="Stop generation"
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-500"
                  >
                    <Square className="h-3.5 w-3.5" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendPrompt()}
                    disabled={!promptInput.trim() && attachments.length === 0}
                    aria-label="Send prompt"
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-500">
              <span>
                Execution path: {routingMode} · {isOnline ? 'Online' : 'Offline'} · Local Nano: {localReadiness}
              </span>
              <span>Enter to send · Shift+Enter newline</span>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT CONTEXTUAL PANEL: Chat History (Strictly separate from Settings) */}
      {rightSidebarOpen && (
        <aside
          aria-label="Chat History"
          className="w-72 shrink-0 border-l border-slate-800/80 bg-[#0B101D] flex flex-col min-h-0 overflow-hidden max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-2xl"
        >
          <div className="border-b border-slate-800/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Chat History
              </h2>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                {showArchived ? 'Active' : 'Archived'}
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search titles & messages..."
                aria-label="Search chat history"
                className="w-full rounded-lg border border-slate-800 bg-[#070B14] pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {folders.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  onClick={() => setFolderFilter(folder)}
                  className={`rounded-md px-2 py-1 text-[11px] whitespace-nowrap transition-colors ${
                    folderFilter === folder
                      ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {folder}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No conversations match your filter.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const active = conv.id === activeConversation?.id;
                return (
                  <div
                    key={conv.id}
                    className={`group rounded-lg border p-2.5 transition-colors ${
                      active
                        ? 'border-indigo-500/60 bg-indigo-500/10'
                        : 'border-slate-800/70 bg-slate-900/30 hover:border-slate-700'
                    }`}
                  >
                    {renamingConvId === conv.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          className="flex-1 rounded border border-slate-700 bg-[#070B14] px-2 py-1 text-xs text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (renameDraft.trim()) {
                              updateConversation(conv.id, { title: renameDraft.trim() });
                            }
                            setRenamingConvId(null);
                          }}
                          aria-label="Confirm rename"
                          className="p-1 text-emerald-400"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveConversationId(conv.id)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-center gap-1.5">
                            {conv.pinned && <Pin className="h-3 w-3 shrink-0 text-cyan-400" />}
                            <span className="text-xs font-medium text-slate-200 truncate">
                              {conv.title}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400 truncate">
                            {conv.folder} · {conv.messages.length} msgs ·{' '}
                            {new Date(conv.updatedAt).toLocaleDateString()}
                          </div>
                        </button>
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-end gap-1 opacity-75 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => updateConversation(conv.id, { pinned: !conv.pinned })}
                        aria-label={`Pin ${conv.title}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-cyan-400"
                      >
                        <Pin className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingConvId(conv.id);
                          setRenameDraft(conv.title);
                        }}
                        aria-label={`Rename ${conv.title}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateConversation(conv.id, { archived: !conv.archived })}
                        aria-label={`Archive ${conv.title}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      >
                        <Archive className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openConfirm({
                            title: 'Delete Conversation?',
                            description: `Delete "${conv.title}" from local and synced history?`,
                            confirmLabel: 'Delete',
                            destructive: true,
                            onConfirm: () => deleteConversation(conv.id),
                          })
                        }
                        aria-label={`Delete ${conv.title}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* Custom Persona Modal */}
      {showPersonaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={submitPersonaForm}
            className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0D1322] p-5 shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Custom AI Persona</h3>
              <button
                type="button"
                onClick={() => setShowPersonaModal(false)}
                aria-label="Close persona modal"
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Persona Name</label>
              <input
                type="text"
                required
                value={personaForm.name}
                onChange={(e) => setPersonaForm({ ...personaForm, name: e.target.value })}
                placeholder="e.g. Algorithms Coach"
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Role</label>
              <input
                type="text"
                value={personaForm.role}
                onChange={(e) => setPersonaForm({ ...personaForm, role: e.target.value })}
                placeholder="e.g. Complexity Reviewer"
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Preferred Model</label>
              <select
                value={personaForm.preferredModelId || 'gemini-4-hydrogen'}
                onChange={(e) => setPersonaForm({ ...personaForm, preferredModelId: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100"
              >
                {NOVA_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">System Instructions</label>
              <textarea
                required
                rows={4}
                value={personaForm.instructions}
                onChange={(e) => setPersonaForm({ ...personaForm, instructions: e.target.value })}
                placeholder="Describe tone, formatting, and domain constraints..."
                className="w-full rounded-lg border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPersonaModal(false)}
                className="rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Save Persona
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
