import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Columns3,
  GanttChartSquare,
  ListTodo,
  Plus,
  Presentation,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { NOVA_MODELS } from '../../data/seedData';
import { useNovaStore } from '../../stores/useNovaStore';
import {
  PlanHorizon,
  PlanRecord,
  PlanTask,
  PlanViewMode,
  TaskPriority,
  TaskStatus,
} from '../../types/nova';
import { calculatePlanProgress } from '../../utils/workspaceLogic';
import {
  exportPlanToGoogleSlides,
  listUpcomingCalendarEvents,
  scheduleTaskOnGoogleCalendar,
} from '../../services/workspace/googleWorkspaceService';

const HORIZONS: Array<{ id: PlanHorizon; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'project', label: 'Project' },
  { id: 'study', label: 'Study' },
];

const VIEW_MODES: Array<{ id: PlanViewMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'list', label: 'List', icon: ListTodo },
  { id: 'kanban', label: 'Kanban', icon: Columns3 },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'timeline', label: 'Timeline', icon: GanttChartSquare },
  { id: 'agenda', label: 'Daily Agenda', icon: Clock },
];

const PLAN_ACTIONS = [
  { id: 'generate', label: 'Generate Plan' },
  { id: 'breakdown', label: 'Break Down Tasks' },
  { id: 'prioritize', label: 'Prioritize Risks' },
  { id: 'rebalance', label: 'Rebalance Schedule' },
];

export const PlanWorkspace: React.FC = () => {
  const {
    selectedModelId,
    setSelectedModelId,
    plans,
    activePlanId,
    setActivePlanId,
    savePlan,
    deletePlan,
    templates,
    leftSidebarOpen,
    rightSidebarOpen,
    localReadiness,
    routingMode,
    addTelemetryEvent,
    pushToast,
    openConfirm,
  } = useNovaStore();

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || plans[0],
    [plans, activePlanId]
  );

  const [horizon, setHorizon] = useState<PlanHorizon>(activePlan?.horizon || 'weekly');
  const [viewMode, setViewMode] = useState<PlanViewMode>('list');
  const [selectedAction, setSelectedAction] = useState('generate');
  const [goalPrompt, setGoalPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Manual task creation state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskMinutes, setNewTaskMinutes] = useState(30);
  const [newTaskDueDate, setNewTaskDueDate] = useState('2026-11-24');
  const [newTaskMilestone, setNewTaskMilestone] = useState('Execution');
  const [calendarEvents, setCalendarEvents] = useState<Array<{ id: string; summary: string; start: string }>>([]);
  const [loadingCal, setLoadingCal] = useState(false);

  const progress = useMemo(
    () => calculatePlanProgress(activePlan?.tasks || []),
    [activePlan?.tasks]
  );

  const handleGeneratePlan = async (actionOverride?: string) => {
    const goalText = goalPrompt.trim() || activePlan?.goal || 'Build a high-impact weekly execution sprint';
    const actionToRun = actionOverride || selectedAction;
    setIsGenerating(true);
    const startedAt = performance.now();

    try {
      const modelToUse = selectedModelId === 'gemini-nano-4' ? 'gemini-4-hydrogen' : selectedModelId;
      const res = await fetch('/api/gemini/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalText,
          horizon,
          action: actionToRun,
          existingTasks: activePlan?.tasks || [],
          model: modelToUse,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Plan generation failed.');

      const created: PlanRecord = {
        id: `plan-${Date.now()}`,
        title: data.title || `${horizon} Execution Plan`,
        horizon,
        goal: goalText,
        summary: data.summary || 'Structured AI execution roadmap.',
        tasks: (data.tasks || []).map((t: PlanTask, idx: number) => ({
          id: t.id || `task-${Date.now()}-${idx}`,
          title: t.title,
          notes: t.notes || '',
          priority: (['low', 'medium', 'high', 'urgent'].includes(t.priority)
            ? t.priority
            : 'medium') as TaskPriority,
          status: (['todo', 'in_progress', 'done'].includes(t.status)
            ? t.status
            : 'todo') as TaskStatus,
          estimatedMinutes: Number(t.estimatedMinutes) || 30,
          dueDate: t.dueDate || '2026-11-21',
          milestone: t.milestone || 'Milestone 1',
          dependsOn: t.dependsOn,
        })),
        updatedAt: new Date().toISOString(),
      };

      savePlan(created);
      setActivePlanId(created.id);
      setGoalPrompt('');

      addTelemetryEvent({
        id: `tel-${Date.now()}`,
        timestamp: new Date().toISOString(),
        workspace: 'plan',
        requestedModelId: selectedModelId,
        routingMode,
        decision: 'in_cloud',
        actualSource: selectedModelId === 'gemini-nano-4' ? 'hybrid_fallback' : 'in_cloud',
        reason: `Plan Studio (${actionToRun}) structured JSON generated via ${modelToUse}.`,
        latencyMs: Math.round(performance.now() - startedAt),
        fallbackTriggered: selectedModelId === 'gemini-nano-4',
        status: 'success',
      });

      pushToast({ type: 'success', title: 'Plan Generated', detail: created.title });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Plan Error',
        detail: err instanceof Error ? err.message : 'Failed to generate plan.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan || !newTaskTitle.trim()) return;
    const task: PlanTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      status: 'todo',
      estimatedMinutes: Math.max(5, Number(newTaskMinutes) || 30),
      dueDate: newTaskDueDate,
      milestone: newTaskMilestone.trim() || 'General',
    };
    savePlan({
      ...activePlan,
      tasks: [...activePlan.tasks, task],
      updatedAt: new Date().toISOString(),
    });
    setNewTaskTitle('');
  };

  const handleUpdateTaskStatus = (taskId: string, status: TaskStatus) => {
    if (!activePlan) return;
    savePlan({
      ...activePlan,
      tasks: activePlan.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!activePlan) return;
    savePlan({
      ...activePlan,
      tasks: activePlan.tasks.filter((t) => t.id !== taskId),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleLoadCalendarEvents = async () => {
    setLoadingCal(true);
    try {
      const events = await listUpcomingCalendarEvents();
      setCalendarEvents(events);
      pushToast({
        type: 'success',
        title: 'Google Calendar Synced',
        detail: `Loaded ${events.length} upcoming event(s).`,
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Calendar Read Failed',
        detail: err instanceof Error ? err.message : 'Sign in with Google to view Calendar events.',
      });
    } finally {
      setLoadingCal(false);
    }
  };

  const handleScheduleTask = (task: PlanTask) => {
    openConfirm({
      title: 'Schedule Task on Google Calendar?',
      description: `This will create an event "[NOVA] ${task.title}" on your primary Google Calendar for ${task.dueDate}.`,
      confirmLabel: 'Create Calendar Event',
      onConfirm: async () => {
        try {
          await scheduleTaskOnGoogleCalendar(task);
          pushToast({
            type: 'success',
            title: 'Scheduled on Calendar',
            detail: task.title,
          });
        } catch (err) {
          pushToast({
            type: 'error',
            title: 'Calendar Export Failed',
            detail: err instanceof Error ? err.message : 'Sign in with Google first.',
          });
        }
      },
    });
  };

  const handleExportSlides = () => {
    if (!activePlan) return;
    openConfirm({
      title: 'Create Google Slides Deck from Plan?',
      description: `This will generate a new Google Slides presentation summarizing "${activePlan.title}" and its top tasks.`,
      confirmLabel: 'Export to Google Slides',
      onConfirm: async () => {
        try {
          const res = await exportPlanToGoogleSlides(
            activePlan.title,
            activePlan.goal,
            activePlan.tasks
          );
          pushToast({
            type: 'success',
            title: 'Exported to Google Slides',
            detail: `Presentation ID: ${res.presentationId}`,
          });
        } catch (err) {
          pushToast({
            type: 'error',
            title: 'Google Slides Export Failed',
            detail: err instanceof Error ? err.message : 'Sign in with Google first.',
          });
        }
      },
    });
  };

  const tasksByDate = useMemo(() => {
    const groups: Record<string, PlanTask[]> = {};
    for (const t of activePlan?.tasks || []) {
      const key = t.dueDate || 'Unscheduled';
      groups[key] = groups[key] ? [...groups[key], t] : [t];
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [activePlan?.tasks]);

  const tasksByMilestone = useMemo(() => {
    const groups: Record<string, PlanTask[]> = {};
    for (const t of activePlan?.tasks || []) {
      const key = t.milestone || 'General';
      groups[key] = groups[key] ? [...groups[key], t] : [t];
    }
    return Object.entries(groups);
  }, [activePlan?.tasks]);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      {/* LEFT PANEL: Models + Planning Horizons + Google Calendar/Slides */}
      {leftSidebarOpen && (
        <aside
          aria-label="Plan Controls and Models"
          className="w-72 max-w-[85vw] shrink-0 border-r border-slate-800/80 bg-[#0B101D] flex flex-col min-h-0 overflow-hidden max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:shadow-2xl"
        >
          <div className="border-b border-slate-800/80 p-3.5 max-h-[50%] overflow-y-auto">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              AI Models
            </h2>
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
                      <span className="text-[10px] shrink-0 text-cyan-400">{statusLabel}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                      {model.provider} · {model.contextWindow}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Planning Horizon
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {HORIZONS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHorizon(h.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors ${
                      horizon === h.id
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                        : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                AI Planner Action
              </h2>
              <div className="space-y-1">
                {PLAN_ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedAction(a.id);
                      if (a.id !== 'generate') {
                        void handleGeneratePlan(a.id);
                      }
                    }}
                    className={`w-full text-left rounded-lg px-2.5 py-1.5 text-xs border transition-colors ${
                      selectedAction === a.id
                        ? 'border-cyan-500/60 bg-cyan-500/12 text-cyan-200'
                        : 'border-slate-800/70 bg-slate-900/40 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Google Workspace
              </h2>
              <button
                type="button"
                onClick={handleLoadCalendarEvents}
                disabled={loadingCal}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                <span>{loadingCal ? 'Syncing Calendar...' : 'Sync Upcoming Calendar'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportSlides}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Presentation className="h-3.5 w-3.5 text-indigo-400" />
                <span>Export to Google Slides</span>
              </button>

              {calendarEvents.length > 0 && (
                <div className="mt-2 rounded-lg border border-slate-800 bg-[#070B14] p-2 space-y-1.5">
                  <p className="text-[11px] font-medium text-slate-400">Upcoming Events</p>
                  {calendarEvents.map((ev) => (
                    <div key={ev.id} className="text-[11px] text-slate-300 truncate">
                      {ev.summary}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* CENTRAL WORKSPACE: Multi-view Planner + Progress + Bottom Prompt Bar */}
      <section className="flex-1 min-w-0 flex flex-col bg-[#070B14] min-h-0">
        {/* Header & View Switcher */}
        <div className="border-b border-slate-800/80 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-100 truncate">
              {activePlan?.title || 'Execution Plan Studio'}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="capitalize">{activePlan?.horizon || horizon}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{progress.doneCount}/{activePlan?.tasks.length || 0} done ({progress.percentComplete}%)</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{Math.round(progress.totalMinutes / 60 * 10) / 10}h total</span>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B101D] p-1 overflow-x-auto">
            {VIEW_MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                    viewMode === m.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress Bar + Quick Add Task */}
        <div className="border-b border-slate-800/60 bg-[#0B101D]/60 px-5 py-3 space-y-3">
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>

          <form onSubmit={handleAddTask} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a task to this plan..."
              aria-label="New task title"
              className="flex-1 min-w-[180px] rounded-lg border border-slate-800 bg-[#070B14] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <select
              aria-label="Task priority"
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
              className="rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input
              type="date"
              aria-label="Task due date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="number"
              min={5}
              max={480}
              aria-label="Estimated minutes"
              value={newTaskMinutes}
              onChange={(e) => setNewTaskMinutes(Number(e.target.value))}
              className="w-20 rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200 tabular-nums focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="text"
              value={newTaskMilestone}
              onChange={(e) => setNewTaskMilestone(e.target.value)}
              placeholder="Milestone"
              aria-label="Task milestone"
              className="w-28 rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Task</span>
            </button>
          </form>
        </div>

        {/* Plan Views Surface */}
        <div className="flex-1 overflow-y-auto p-5">
          {!activePlan || activePlan.tasks.length === 0 ? (
            <div className="mx-auto max-w-lg py-12 text-center">
              <p className="text-sm text-slate-400">
                No tasks in this plan yet. Add a task above or generate a structured plan below.
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="mx-auto max-w-4xl space-y-2.5">
              {activePlan.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#0D1322] p-3.5"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateTaskStatus(
                          task.id,
                          task.status === 'done' ? 'todo' : 'done'
                        )
                      }
                      aria-label={`Toggle completion for ${task.title}`}
                      className={`mt-0.5 shrink-0 rounded-full p-0.5 transition-colors ${
                        task.status === 'done' ? 'text-emerald-400' : 'text-slate-500 hover:text-indigo-400'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-100'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {task.milestone} · {task.dueDate} ·{' '}
                        <span className="tabular-nums">{task.estimatedMinutes}m</span>
                        {task.dependsOn ? ` · Depends on ${task.dependsOn}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] font-medium capitalize ${
                        task.priority === 'urgent'
                          ? 'text-rose-400'
                          : task.priority === 'high'
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {task.priority}
                    </span>
                    <select
                      aria-label={`Status for ${task.title}`}
                      value={task.status}
                      onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                      className="rounded-lg border border-slate-700 bg-[#070B14] px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleScheduleTask(task)}
                      aria-label={`Schedule ${task.title} on Google Calendar`}
                      className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-cyan-400"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      aria-label={`Delete task ${task.title}`}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((colStatus) => {
                const colTasks = activePlan.tasks.filter((t) => t.status === colStatus);
                const label =
                  colStatus === 'todo'
                    ? 'To Do'
                    : colStatus === 'in_progress'
                    ? 'In Progress'
                    : 'Done';
                return (
                  <div
                    key={colStatus}
                    className="rounded-xl border border-slate-800/80 bg-[#0B101D] p-3.5 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        {label}
                      </h3>
                      <span className="text-xs text-slate-500 tabular-nums">{colTasks.length}</span>
                    </div>
                    {colTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-lg border border-slate-800 bg-[#070B14] p-3 space-y-2"
                      >
                        <div className="text-xs font-medium text-slate-100">{task.title}</div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{task.milestone}</span>
                          <span className="tabular-nums">{task.estimatedMinutes}m</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <select
                            aria-label={`Move ${task.title} column`}
                            value={task.status}
                            onChange={(e) =>
                              handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)
                            }
                            className="rounded border border-slate-800 bg-[#0B101D] px-1.5 py-0.5 text-[11px] text-slate-300"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleScheduleTask(task)}
                            aria-label={`Schedule ${task.title}`}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300"
                          >
                            + Calendar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'calendar' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {tasksByDate.map(([date, dayTasks]) => (
                <div
                  key={date}
                  className="rounded-xl border border-slate-800 bg-[#0D1322] p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-cyan-300 tabular-nums">{date}</span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {dayTasks.map((t) => (
                    <div key={t.id} className="rounded-lg bg-[#070B14] p-2.5 text-xs">
                      <div className="font-medium text-slate-200">{t.title}</div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{t.milestone}</span>
                        <span className="capitalize">{t.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : viewMode === 'timeline' ? (
            <div className="mx-auto max-w-4xl space-y-4">
              {tasksByMilestone.map(([milestone, mTasks]) => (
                <div
                  key={milestone}
                  className="rounded-xl border border-slate-800 bg-[#0D1322] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-indigo-300">{milestone}</h3>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {mTasks.filter((t) => t.status === 'done').length}/{mTasks.length} completed
                    </span>
                  </div>
                  <div className="space-y-2">
                    {mTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-4 rounded-lg bg-[#070B14] px-3 py-2 text-xs"
                      >
                        <span className="text-slate-200 truncate">{t.title}</span>
                        <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400 tabular-nums">
                          <span>{t.dueDate}</span>
                          <span>{t.estimatedMinutes}m</span>
                          <span className="capitalize text-cyan-400">
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Daily Agenda View */
            <div className="mx-auto max-w-3xl space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Time-Blocked Daily Agenda
              </h2>
              {activePlan.tasks.map((t, idx) => (
                <div
                  key={t.id}
                  className="flex items-center gap-4 rounded-xl border border-slate-800 bg-[#0D1322] p-3.5"
                >
                  <div className="w-20 shrink-0 text-xs font-mono text-cyan-400 tabular-nums">
                    {String(9 + idx).padStart(2, '0')}:00
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">{t.title}</div>
                    <div className="text-xs text-slate-400">
                      {t.estimatedMinutes} min focus block · {t.milestone}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateTaskStatus(t.id, t.status === 'done' ? 'todo' : 'done')
                    }
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      t.status === 'done'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {t.status === 'done' ? 'Done' : 'Complete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Prompt Bar */}
        <div className="border-t border-slate-800/80 bg-[#0B101D] p-3">
          <div className="mx-auto max-w-4xl flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#070B14] p-2 focus-within:border-indigo-500">
            <button
              type="button"
              onClick={() => {
                const tpl = templates.find((t) => t.category === 'plan');
                if (tpl) setGoalPrompt(tpl.content);
              }}
              aria-label="Insert plan prompt template"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={goalPrompt}
              onChange={(e) => setGoalPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isGenerating) {
                  e.preventDefault();
                  void handleGeneratePlan('generate');
                }
              }}
              placeholder="Describe a goal, exam study roadmap, or launch milestone to generate a plan..."
              aria-label="Plan generation goal"
              className="flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleGeneratePlan('generate')}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap"
            >
              {isGenerating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>{isGenerating ? 'Planning...' : 'Generate Plan'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* RIGHT PANEL: Plan History & Templates */}
      {rightSidebarOpen && (
        <aside
          aria-label="Plan History and Templates"
          className="w-72 max-w-[85vw] shrink-0 border-l border-slate-800/80 bg-[#0B101D] flex flex-col min-h-0 overflow-hidden p-3.5 max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-2xl"
        >
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Saved Plans
            </h2>
            <span className="text-[11px] text-slate-500 tabular-nums">{plans.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {plans.map((p) => {
              const isActive = p.id === activePlan?.id;
              const stats = calculatePlanProgress(p.tasks);
              return (
                <div
                  key={p.id}
                  className={`group flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors ${
                    isActive
                      ? 'border-indigo-500/60 bg-indigo-500/12'
                      : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActivePlanId(p.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-xs font-medium text-slate-100 truncate">{p.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400 truncate tabular-nums">
                      {p.horizon} · {stats.percentComplete}% ({p.tasks.length} tasks)
                    </div>
                  </button>
                  {plans.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        openConfirm({
                          title: `Delete plan "${p.title}"?`,
                          description: 'This saved execution plan will be permanently deleted.',
                          confirmLabel: 'Delete Plan',
                          destructive: true,
                          onConfirm: () => deletePlan(p.id),
                        })
                      }
                      aria-label={`Delete plan ${p.title}`}
                      className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-800 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Quick Templates
            </h3>
            <div className="space-y-1.5">
              {[
                { label: 'Hackathon 48h Launch', prompt: 'Create a 48-hour hackathon launch checklist with demo prep.' },
                { label: 'Exam Study Week', prompt: 'Create a 7-day active recall study plan for final exams.' },
                { label: 'Product Release Sprint', prompt: 'Create a software release sprint plan with QA and deployment gates.' },
              ].map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setGoalPrompt(tpl.prompt)}
                  className="w-full text-left rounded-lg border border-slate-800/70 bg-slate-900/40 px-2.5 py-2 text-xs text-slate-300 hover:border-indigo-500/60"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
