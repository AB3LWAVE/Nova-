import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

test('firestore.rules includes default-deny global catch-all', () => {
  assert.match(rulesContent, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules enforces email_verified on writes and strict ID validation', () => {
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesContent, /function isValidId\(id\)/);
  assert.match(rulesContent, /\^\[a-zA-Z0-9_\\\\-\]\+\$/);
});

test('firestore.rules protects users PII from list queries', () => {
  assert.match(rulesContent, /match \/users\/\{userId\}[\s\S]*allow list: if false;/);
});

test('firestore.rules enforces resource.data.userId on all list rules and avoids blanket isSignedIn reads', () => {
  assert.doesNotMatch(rulesContent, /allow read: if isSignedIn\(\);/);
  assert.doesNotMatch(rulesContent, /allow list: if isSignedIn\(\);/);
  assert.match(rulesContent, /allow list: if isSignedIn\(\) && resource\.data\.userId == request\.auth\.uid;/);
});

test('firestore.rules locks terminal states for quizzes and plans', () => {
  assert.match(rulesContent, /existing\(\)\.status != 'completed'/);
  assert.match(rulesContent, /existing\(\)\.status != 'archived'/);
});
