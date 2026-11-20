# NOVA AI Workspace — Firestore Security Specification

## 1. Data Invariants
1. Every top-level user resource (`workspaces`, `conversations`, `personas`, `quizzes`, `codeProjects`, `plans`, `knowledgeDocuments`) MUST carry an immutable `userId` equal to `request.auth.uid`.
2. Users may only read, list, create, update, or delete their own documents, and must have `request.auth.token.email_verified == true` for writes.
3. Subcollection `/conversations/{conversationId}/messages/{messageId}` MUST enforce the Master Gate by checking `get(/databases/$(database)/documents/conversations/$(conversationId)).data.userId == request.auth.uid` on single-document reads/writes.
4. `users/{userId}` contains PII (`email`) and MUST forbid `list` entirely (`allow list: if false;`) and allow `get`/`write` only when `request.auth.uid == userId`.
5. Terminal state locking: completed quizzes (`status == 'completed'`) and archived plans (`status == 'archived'`) cannot be modified after reaching terminal state.
6. All string fields enforce bounded `.size()`, all IDs match `^[a-zA-Z0-9_-]+$`, and `createdAt`/`updatedAt` timestamps must match `request.time`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write**: `auth = null` attempting `get(/conversations/c1)`.
2. **Cross-user read**: `auth.uid = 'userB'` attempting `get(/conversations/c1)` owned by `'userA'`.
3. **Blanket list scraping**: `auth.uid = 'userB'` listing `/conversations` without `where('userId', '==', 'userB')`.
4. **Users PII list scraping**: `auth.uid = 'userA'` attempting `list(/users)`.
5. **Identity spoofing on create**: `auth.uid = 'userA'` creating `/personas/p1` with `userId: 'userB'`.
6. **Shadow/Ghost field injection**: Creating `/personas/p1` with extra key `isAdmin: true`.
7. **Unverified email write**: `auth.token.email_verified = false` attempting `create(/workspaces/w1)`.
8. **ID Poisoning**: Creating `/workspaces/${'a'.repeat(200)}` or ID containing slashes/spaces.
9. **Resource Exhaustion (1MB String)**: Creating `/personas/p1` with `instructions` exceeding 4000 chars.
10. **Immutable Owner Tampering**: Updating `/plans/pl1` to change `userId` or `createdAt`.
11. **Terminal State Bypass**: Updating `/quizzes/q1` after `existing().status == 'completed'`.
12. **Client Timestamp Forgery**: Creating `/conversations/c1` with a backdated `createdAt` not equal to `request.time`.
