import { SyncQueueItem } from '../../types/nova';
import { auth, saveConversationMetaToFirestore } from '../firebase/client';

export async function flushSyncQueue(
  queue: SyncQueueItem[],
  onItemSynced: (id: string) => void,
  onItemRetry: (id: string) => void
): Promise<{ syncedCount: number; remainingCount: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, remainingCount: queue.length };
  }

  const user = auth.currentUser;
  if (!user) {
    return { syncedCount: 0, remainingCount: queue.length };
  }

  let idToken = '';
  try {
    idToken = await user.getIdToken();
  } catch {
    return { syncedCount: 0, remainingCount: queue.length };
  }

  let syncedCount = 0;

  for (const item of queue) {
    try {
      if (item.entityType === 'conversation' && item.action === 'upsert') {
        const conv = item.payload as {
          id: string;
          title: string;
          folder: string;
          pinned: boolean;
          archived: boolean;
          modelId: string;
          personaId: string;
          messages: unknown[];
        };
        await saveConversationMetaToFirestore(user.uid, {
          id: conv.id,
          title: conv.title,
          folder: conv.folder,
          pinned: conv.pinned,
          archived: conv.archived,
          modelId: conv.modelId,
          personaId: conv.personaId,
          messageCount: conv.messages.length,
        });

        await fetch('/api/sql/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            id: conv.id,
            title: conv.title,
            folder: conv.folder,
            pinned: conv.pinned,
            archived: conv.archived,
            modelId: conv.modelId,
            personaId: conv.personaId,
            messagesJson: conv.messages,
          }),
        }).catch(() => null);
      }

      onItemSynced(item.id);
      syncedCount += 1;
    } catch {
      onItemRetry(item.id);
    }
  }

  return {
    syncedCount,
    remainingCount: Math.max(0, queue.length - syncedCount),
  };
}
