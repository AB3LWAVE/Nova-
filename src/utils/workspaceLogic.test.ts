import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePlanProgress,
  calculateQuizScore,
  evaluateCalculatorExpression,
  sanitizePreviewHtml,
} from './workspaceLogic';

test('calculateQuizScore grades objective and short answers accurately', () => {
  const result = calculateQuizScore(
    [
      { id: '1', type: 'multiple_choice', prompt: 'Q1', options: ['A', 'B'], correctAnswer: 'A', explanation: '' },
      { id: '2', type: 'true_false', prompt: 'Q2', options: ['True', 'False'], correctAnswer: 'True', explanation: '' },
      { id: '3', type: 'short_answer', prompt: 'Q3', options: [], correctAnswer: 'raft', explanation: '' },
    ],
    { '1': 'A', '2': 'False', '3': 'The Raft consensus algorithm' }
  );
  assert.equal(result.correct, 2);
  assert.equal(result.total, 3);
  assert.equal(result.percentage, 67);
});

test('calculatePlanProgress aggregates counts and minutes', () => {
  const stats = calculatePlanProgress([
    { id: '1', title: 'A', priority: 'high', status: 'done', estimatedMinutes: 30, dueDate: '2026-11-20', milestone: 'M1' },
    { id: '2', title: 'B', priority: 'low', status: 'in_progress', estimatedMinutes: 45, dueDate: '2026-11-21', milestone: 'M1' },
    { id: '3', title: 'C', priority: 'medium', status: 'todo', estimatedMinutes: 15, dueDate: '2026-11-22', milestone: 'M2' },
  ]);
  assert.equal(stats.doneCount, 1);
  assert.equal(stats.inProgressCount, 1);
  assert.equal(stats.todoCount, 1);
  assert.equal(stats.totalMinutes, 90);
  assert.equal(stats.percentComplete, 33);
});

test('sanitizePreviewHtml neutralizes parent/top window references', () => {
  const sanitized = sanitizePreviewHtml('<script>window.top.location = "x"; window.parent.alert(1);</script>');
  assert.equal(sanitized.includes('window.top'), false);
  assert.equal(sanitized.includes('window.parent'), false);
});

test('evaluateCalculatorExpression computes arithmetic safely', () => {
  assert.equal(evaluateCalculatorExpression('(12 + 8) * 3 / 2'), '30');
  assert.equal(evaluateCalculatorExpression('alert(1) + 5'), '6');
});
