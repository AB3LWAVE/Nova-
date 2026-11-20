import { PlanTask, QuizQuestion } from '../types/nova';

export function calculateQuizScore(
  questions: QuizQuestion[],
  userAnswers: Record<string, string>
): { correct: number; total: number; percentage: number } {
  const total = questions.length;
  if (total === 0) {
    return { correct: 0, total: 0, percentage: 0 };
  }
  let correct = 0;
  for (const q of questions) {
    const expected = (q.correctAnswer || '').trim().toLowerCase();
    const actual = (userAnswers[q.id] || '').trim().toLowerCase();
    if (expected && actual && (actual === expected || (q.type === 'short_answer' && actual.includes(expected)))) {
      correct += 1;
    }
  }
  return {
    correct,
    total,
    percentage: Math.round((correct / total) * 100),
  };
}

export function calculatePlanProgress(tasks: PlanTask[]): {
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  totalMinutes: number;
  percentComplete: number;
} {
  if (tasks.length === 0) {
    return { doneCount: 0, inProgressCount: 0, todoCount: 0, totalMinutes: 0, percentComplete: 0 };
  }
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
  return {
    doneCount,
    inProgressCount,
    todoCount,
    totalMinutes,
    percentComplete: Math.round((doneCount / tasks.length) * 100),
  };
}

export function sanitizePreviewHtml(rawHtml: string): string {
  // Strip any attempt to access window.top / window.parent or external parent navigation
  return rawHtml
    .replace(/window\.top/gi, 'window.self')
    .replace(/window\.parent/gi, 'window.self')
    .replace(/parent\.postMessage/gi, 'void 0');
}

export function evaluateCalculatorExpression(expr: string): string {
  const cleaned = expr.replace(/[^0-9+\-*/().%\s]/g, '');
  if (!cleaned.trim()) return '0';
  try {
    const result = Function(`"use strict"; return (${cleaned})`)();
    if (typeof result === 'number' && Number.isFinite(result)) {
      return String(Math.round(result * 100000) / 100000);
    }
    return 'Error';
  } catch {
    return 'Error';
  }
}
