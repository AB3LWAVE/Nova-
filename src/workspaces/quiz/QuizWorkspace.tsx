import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  Highlighter,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { NOVA_MODELS } from '../../data/seedData';
import { useNovaStore } from '../../stores/useNovaStore';
import { QuizDifficulty, QuizQuestion, QuizSession, QuizType } from '../../types/nova';
import { calculateQuizScore, evaluateCalculatorExpression } from '../../utils/workspaceLogic';
import { exportQuizToGoogleSheet } from '../../services/workspace/googleWorkspaceService';

export const QuizWorkspace: React.FC = () => {
  const {
    selectedModelId,
    setSelectedModelId,
    subjects,
    addSubject,
    deleteSubject,
    quizzes,
    activeQuizId,
    setActiveQuizId,
    saveQuizSession,
    deleteQuizSession,
    leftSidebarOpen,
    rightSidebarOpen,
    addTelemetryEvent,
    routingMode,
    pushToast,
    openConfirm,
  } = useNovaStore();

  const [selectedSubject, setSelectedSubject] = useState(subjects[4]?.name || 'Computer Science');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCat, setNewSubjectCat] = useState('STEM');
  const [showAddSubject, setShowAddSubject] = useState(false);

  const [quizType, setQuizType] = useState<QuizType>('multiple_choice');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('intermediate');
  const [questionCount, setQuestionCount] = useState(5);
  const [choiceCount, setChoiceCount] = useState(4);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [topicPrompt, setTopicPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Active Quiz Runtime State
  const activeQuiz = useMemo(
    () => quizzes.find((q) => q.id === activeQuizId) || quizzes[0],
    [quizzes, activeQuizId]
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(600);
  const [historyFilter, setHistoryFilter] = useState('');

  // Quiz Accessories (matching red oval in NOVA sketch)
  const [activeAccessory, setActiveAccessory] = useState<'calc' | 'highlighter' | 'magnifier' | 'notes'>('calc');
  const [calcExpr, setCalcExpr] = useState('');
  const [calcResult, setCalcResult] = useState('0');
  const [highlighterOn, setHighlighterOn] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Record<string, boolean>>({});
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [scratchNotes, setScratchNotes] = useState('');

  useEffect(() => {
    if (!activeQuiz || activeQuiz.status !== 'in_progress' || activeQuiz.timeLimitMinutes <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeQuiz?.id, activeQuiz?.status, activeQuiz?.timeLimitMinutes]);

  const handleGenerateQuiz = async () => {
    setIsGenerating(true);
    const startedAt = performance.now();
    try {
      const res = await fetch('/api/gemini/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedSubject,
          topicPrompt: topicPrompt.trim() || `${selectedSubject} core concepts`,
          quizType,
          difficulty,
          count: questionCount,
          choiceCount,
          includeExplanations,
          model: selectedModelId === 'gemini-nano-4' ? 'gemini-4-hydrogen' : selectedModelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quiz generation failed');

      let qs: QuizQuestion[] = data.questions || [];
      if (randomizeQuestions) {
        qs = [...qs].sort(() => Math.random() - 0.5);
      }

      const created: QuizSession = {
        id: `quiz-${Date.now()}`,
        title: data.title || `${selectedSubject} Quiz`,
        subject: selectedSubject,
        quizType,
        difficulty,
        timeLimitMinutes,
        includeExplanations,
        includeAnswerKey,
        questions: qs,
        userAnswers: {},
        score: null,
        status: 'in_progress',
        createdAt: new Date().toISOString(),
      };
      saveQuizSession(created);
      setSecondsLeft((timeLimitMinutes || 10) * 60);
      setTopicPrompt('');

      addTelemetryEvent({
        id: `tel-${Date.now()}`,
        timestamp: new Date().toISOString(),
        workspace: 'quiz',
        requestedModelId: selectedModelId,
        routingMode,
        decision: 'in_cloud',
        actualSource: 'in_cloud',
        reason: 'Structured quiz JSON generation routed to cloud Gemini.',
        latencyMs: Math.round(performance.now() - startedAt),
        fallbackTriggered: false,
        status: 'success',
      });
      pushToast({ type: 'success', title: 'Quiz Generated', detail: created.title });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Quiz Generation Failed',
        detail: err instanceof Error ? err.message : 'Unable to generate quiz.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    if (!activeQuiz || activeQuiz.status === 'completed') return;
    saveQuizSession({
      ...activeQuiz,
      status: activeQuiz.status === 'draft' ? 'in_progress' : activeQuiz.status,
      userAnswers: { ...activeQuiz.userAnswers, [questionId]: answer },
    });
  };

  const handleSubmitQuiz = () => {
    if (!activeQuiz) return;
    const result = calculateQuizScore(activeQuiz.questions, activeQuiz.userAnswers);
    saveQuizSession({
      ...activeQuiz,
      score: result.percentage,
      status: 'completed',
    });
    pushToast({
      type: result.percentage >= 70 ? 'success' : 'info',
      title: `Quiz Submitted: ${result.percentage}%`,
      detail: `${result.correct} of ${result.total} correct.`,
    });
  };

  const handleExportSheet = () => {
    if (!activeQuiz) return;
    openConfirm({
      title: 'Export Quiz Results to Google Sheets?',
      description: `Create a Google Spreadsheet for "${activeQuiz.title}" with your answers, answer key, and explanations.`,
      confirmLabel: 'Export Sheet',
      onConfirm: async () => {
        try {
          const sheet = await exportQuizToGoogleSheet(activeQuiz);
          pushToast({
            type: 'success',
            title: 'Exported to Google Sheets',
            detail: `Spreadsheet ID: ${sheet.spreadsheetId}`,
          });
        } catch (err) {
          pushToast({
            type: 'error',
            title: 'Google Sheets Export Failed',
            detail: err instanceof Error ? err.message : 'Sign in with Google first.',
          });
        }
      },
    });
  };

  const filteredQuizzes = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    if (!q) return quizzes;
    return quizzes.filter(
      (item) =>
        item.title.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q)
    );
  }, [quizzes, historyFilter]);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* LEFT PANEL: Models + Subjects + Quiz Options + Prompt Bar */}
      {leftSidebarOpen && (
        <aside
          aria-label="Quiz Configuration"
          className="w-80 max-w-[85vw] shrink-0 border-r border-slate-800/80 bg-[#0B101D] flex flex-col min-h-0 overflow-hidden max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:shadow-2xl"
        >
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {/* Models */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                AI Model
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                aria-label="Quiz AI Model"
                className="w-full rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                {NOVA_MODELS.filter((m) => m.availability !== 'unconfigured').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subjects */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Subjects
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddSubject((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {showAddSubject && (
                <div className="mb-2 flex gap-1.5">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Subject name"
                    className="flex-1 rounded-md border border-slate-700 bg-[#070B14] px-2 py-1 text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSubjectName.trim()) return;
                      addSubject(newSubjectName.trim(), newSubjectCat);
                      setSelectedSubject(newSubjectName.trim());
                      setNewSubjectName('');
                      setShowAddSubject(false);
                    }}
                    className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white"
                  >
                    Save
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {subjects.map((subj) => {
                  const active = subj.name === selectedSubject;
                  return (
                    <div key={subj.id} className="group inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedSubject(subj.name)}
                        className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                          active
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                            : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {subj.name}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Question Type & Difficulty */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Question Type</label>
                <select
                  value={quizType}
                  onChange={(e) => setQuizType(e.target.value as QuizType)}
                  aria-label="Question Type"
                  className="w-full rounded-lg border border-slate-800 bg-[#070B14] px-2 py-1.5 text-xs text-slate-200"
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True or False</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="fill_blank">Fill in Blanks</option>
                  <option value="mixed">Mixed</option>
                  <option value="essay">Essay</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as QuizDifficulty)}
                  aria-label="Difficulty"
                  className="w-full rounded-lg border border-slate-800 bg-[#070B14] px-2 py-1.5 text-xs text-slate-200"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>

            {/* Counts */}
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Questions</span>
                  <span className="font-mono tabular-nums text-slate-200">{questionCount}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  aria-label="Number of questions"
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Time Limit (min)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Choices</label>
                  <input
                    type="number"
                    min={2}
                    max={5}
                    value={choiceCount}
                    onChange={(e) => setChoiceCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2 pt-1 text-xs text-slate-300">
              <label className="flex items-center justify-between cursor-pointer">
                <span>Include explanations</span>
                <input
                  type="checkbox"
                  checked={includeExplanations}
                  onChange={(e) => setIncludeExplanations(e.target.checked)}
                  className="accent-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Include answer key</span>
                <input
                  type="checkbox"
                  checked={includeAnswerKey}
                  onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                  className="accent-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Randomize questions</span>
                <input
                  type="checkbox"
                  checked={randomizeQuestions}
                  onChange={(e) => setRandomizeQuestions(e.target.checked)}
                  className="accent-indigo-500"
                />
              </label>
            </div>
          </div>

          {/* Left Bottom Prompt Bar (matches sketch) */}
          <div className="border-t border-slate-800/80 p-3 bg-[#080C17]">
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#070B14] p-1.5">
              <button
                type="button"
                onClick={() => setTopicPrompt(`Focus on ${selectedSubject} problem solving and edge cases`)}
                aria-label="Insert quiz prompt suggestion"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerateQuiz();
                }}
                placeholder="Topic instructions..."
                aria-label="Quiz topic instructions"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateQuiz}
                disabled={isGenerating}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isGenerating ? '...' : 'Generate'}</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* CENTER QUIZ WORKSPACE */}
      <section className="flex-1 min-w-0 flex flex-col bg-[#070B14] min-h-0">
        {activeQuiz ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-3">
              <div>
                <h1 className="text-sm font-semibold text-slate-100">{activeQuiz.title}</h1>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span>{activeQuiz.subject}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{activeQuiz.difficulty}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {Object.keys(activeQuiz.userAnswers).length}/{activeQuiz.questions.length} answered
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeQuiz.timeLimitMinutes > 0 && activeQuiz.status !== 'completed' && (
                  <div className="rounded-lg border border-slate-800 bg-[#0D1322] px-3 py-1.5 text-xs font-mono tabular-nums text-cyan-400">
                    {Math.floor(secondsLeft / 60)}:
                    {String(secondsLeft % 60).padStart(2, '0')}
                  </div>
                )}

                {activeQuiz.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSecondsLeft((activeQuiz.timeLimitMinutes || 10) * 60);
                      saveQuizSession({ ...activeQuiz, status: 'in_progress' });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Start Quiz</span>
                  </button>
                )}

                {activeQuiz.status === 'in_progress' && (
                  <>
                    <button
                      type="button"
                      onClick={() => saveQuizSession({ ...activeQuiz, status: 'paused' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>Pause</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitQuiz}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Submit</span>
                    </button>
                  </>
                )}

                {activeQuiz.status === 'paused' && (
                  <button
                    type="button"
                    onClick={() => saveQuizSession({ ...activeQuiz, status: 'in_progress' })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Resume</span>
                  </button>
                )}

                {activeQuiz.status === 'completed' && (
                  <>
                    <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold font-mono tabular-nums text-emerald-300">
                      Score: {activeQuiz.score ?? 0}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSecondsLeft((activeQuiz.timeLimitMinutes || 10) * 60);
                        saveQuizSession({
                          ...activeQuiz,
                          userAnswers: {},
                          score: null,
                          status: 'in_progress',
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Retry</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSheet}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-cyan-300 hover:bg-slate-800"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Sheets</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-5 space-y-4"
              style={{ fontSize: `${zoomPct}%` }}
            >
              {activeQuiz.status === 'paused' ? (
                <div className="mx-auto max-w-md rounded-xl border border-slate-800 bg-[#0D1322] p-8 text-center">
                  <h2 className="text-base font-semibold text-slate-100">Quiz Paused</h2>
                  <p className="mt-2 text-xs text-slate-400">
                    Timer paused. Click Resume when you are ready to continue.
                  </p>
                </div>
              ) : (
                activeQuiz.questions.map((q, idx) => {
                  const selected = activeQuiz.userAnswers[q.id] || '';
                  const isCompleted = activeQuiz.status === 'completed';
                  const isCorrect =
                    selected.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
                  const isHighlighted = highlightedIds[q.id];

                  return (
                    <div
                      key={q.id}
                      onClick={() => {
                        if (highlighterOn) {
                          setHighlightedIds((prev) => ({ ...prev, [q.id]: !prev[q.id] }));
                        }
                      }}
                      className={`mx-auto max-w-3xl rounded-xl border p-4 transition-colors ${
                        isHighlighted
                          ? 'border-amber-400/60 bg-amber-500/10'
                          : 'border-slate-800/80 bg-[#0D1322]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium text-slate-100">
                          <span className="font-mono tabular-nums text-indigo-400 mr-2">
                            Q{idx + 1}.
                          </span>
                          {q.prompt}
                        </h3>
                        {isCompleted &&
                          (isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                          ))}
                      </div>

                      {q.options && q.options.length > 0 ? (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt) => {
                            const chosen = selected === opt;
                            const isAns = opt === q.correctAnswer;
                            return (
                              <button
                                key={opt}
                                type="button"
                                disabled={isCompleted}
                                onClick={() => handleAnswerChange(q.id, opt)}
                                className={`text-left rounded-lg border px-3 py-2.5 text-xs transition-colors ${
                                  isCompleted && activeQuiz.includeAnswerKey && isAns
                                    ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-200'
                                    : chosen
                                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                                    : 'border-slate-800 bg-[#070B14] text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <textarea
                          value={selected}
                          disabled={isCompleted}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          rows={2}
                          placeholder="Type your answer..."
                          className="mt-3 w-full rounded-lg border border-slate-800 bg-[#070B14] p-2.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                        />
                      )}

                      {isCompleted && (activeQuiz.includeAnswerKey || activeQuiz.includeExplanations) && (
                        <div className="mt-3 border-t border-slate-800/80 pt-2.5 text-xs space-y-1">
                          {activeQuiz.includeAnswerKey && (
                            <div className="text-emerald-400">
                              Answer: <span className="font-medium">{q.correctAnswer}</span>
                            </div>
                          )}
                          {activeQuiz.includeExplanations && q.explanation && (
                            <p className="text-slate-400">{q.explanation}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-400">
            Configure your subject and generate a quiz on the left.
          </div>
        )}
      </section>

      {/* RIGHT PANEL: Quiz History + Accessories (Highlighter, Calc, Magnifier, Notes) */}
      {rightSidebarOpen && (
        <aside
          aria-label="Quiz History and Accessories"
          className="w-80 max-w-[85vw] shrink-0 border-l border-slate-800/80 bg-[#0B101D] flex flex-col min-h-0 overflow-hidden max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-2xl"
        >
          {/* Top Half: Quiz History & Saved Subjects */}
          <div className="flex-1 min-h-0 flex flex-col border-b border-slate-800/80 p-3.5 overflow-hidden">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Quiz History
            </h2>
            <div className="relative mb-2.5">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                placeholder="Filter quizzes or subjects..."
                className="w-full rounded-lg border border-slate-800 bg-[#070B14] pl-8 pr-2.5 py-1.5 text-xs text-slate-200"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5">
              {filteredQuizzes.map((item) => {
                const active = item.id === activeQuiz?.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-lg border p-2.5 ${
                      active
                        ? 'border-indigo-500/60 bg-indigo-500/10'
                        : 'border-slate-800/70 bg-slate-900/30 hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveQuizId(item.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="text-xs font-medium text-slate-200 truncate">{item.title}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {item.subject} ·{' '}
                        {item.score !== null ? `${item.score}%` : `${item.questions.length} Qs`}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteQuizSession(item.id)}
                      aria-label={`Delete quiz ${item.title}`}
                      className="p-1 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Half: Quiz Accessories (Calculator, Highlighter, Magnifier, Notes) */}
          <div className="h-72 shrink-0 p-3.5 flex flex-col bg-[#080C17]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Quiz Accessories
              </h2>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'calc', icon: Calculator, label: 'Calculator' },
                    { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
                    { id: 'magnifier', icon: ZoomIn, label: 'Magnifier' },
                    { id: 'notes', icon: Plus, label: 'Notes' },
                  ] as const
                ).map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActiveAccessory(tool.id)}
                      aria-label={tool.label}
                      className={`rounded-md p-1.5 transition-colors ${
                        activeAccessory === tool.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {activeAccessory === 'calc' && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="rounded-lg border border-slate-800 bg-[#070B14] px-3 py-2 text-right">
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    {calcExpr || '0'}
                  </div>
                  <div className="text-base font-semibold font-mono tabular-nums text-cyan-300">
                    {calcResult}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-2">
                  {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'].map(
                    (key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (key === '=') {
                            setCalcResult(evaluateCalculatorExpression(calcExpr));
                          } else {
                            setCalcExpr((e) => e + key);
                          }
                        }}
                        className="rounded-md border border-slate-800 bg-slate-900 py-1.5 text-xs font-mono text-slate-200 hover:bg-slate-800"
                      >
                        {key}
                      </button>
                    )
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCalcExpr('');
                    setCalcResult('0');
                  }}
                  className="mt-1 text-[11px] text-slate-400 hover:text-slate-200 text-right"
                >
                  Clear
                </button>
              </div>
            )}

            {activeAccessory === 'highlighter' && (
              <div className="flex-1 flex flex-col justify-center gap-3 text-xs text-slate-300">
                <p className="text-slate-400">
                  Enable the study highlighter and click any question card to mark it for review.
                </p>
                <button
                  type="button"
                  onClick={() => setHighlighterOn((v) => !v)}
                  className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                    highlighterOn
                      ? 'bg-amber-500 text-slate-950'
                      : 'border border-slate-700 bg-slate-900 text-slate-200'
                  }`}
                >
                  {highlighterOn ? 'Highlighter Active' : 'Enable Highlighter'}
                </button>
                <button
                  type="button"
                  onClick={() => setHighlightedIds({})}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Clear Highlights
                </button>
              </div>
            )}

            {activeAccessory === 'magnifier' && (
              <div className="flex-1 flex flex-col justify-center gap-3 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Question Zoom</span>
                  <span className="font-mono tabular-nums text-cyan-400">{zoomPct}%</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[90, 100, 115, 130].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setZoomPct(pct)}
                      className={`rounded-md border py-2 font-mono text-xs ${
                        zoomPct === pct
                          ? 'border-indigo-500 bg-indigo-500/20 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-300'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeAccessory === 'notes' && (
              <textarea
                value={scratchNotes}
                onChange={(e) => setScratchNotes(e.target.value)}
                placeholder="Scratchpad notes & formulas..."
                className="flex-1 resize-none rounded-lg border border-slate-800 bg-[#070B14] p-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
