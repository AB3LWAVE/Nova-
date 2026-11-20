import { getWorkspaceAccessToken } from '../firebase/client';
import { PlanTask, QuizSession } from '../../types/nova';

function requireWorkspaceToken(): string {
  const token = getWorkspaceAccessToken();
  if (!token) {
    throw new Error('Google Workspace sign-in is required. Click "Sign in with Google" to grant access.');
  }
  return token;
}

export async function exportConversationToGoogleDoc(title: string, markdownContent: string) {
  const token = requireWorkspaceToken();
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to create Google Doc.');
  }
  const doc = (await createRes.json()) as { documentId: string; title: string };

  const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: markdownContent,
          },
        },
      ],
    }),
  });
  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Created Google Doc, but failed to write content.');
  }

  return {
    documentId: doc.documentId,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
  };
}

export async function exportQuizToGoogleSheet(quiz: QuizSession) {
  const token = requireWorkspaceToken();
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: `NOVA Quiz: ${quiz.title}` },
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to create Google Sheet.');
  }
  const sheet = (await createRes.json()) as {
    spreadsheetId: string;
    sheets?: Array<{ properties?: { title?: string } }>;
  };

  const firstSheetName = sheet.sheets?.[0]?.properties?.title || 'Sheet1';
  const rows = [
    ['Question #', 'Prompt', 'Your Answer', 'Correct Answer', 'Explanation'],
    ...quiz.questions.map((q, idx) => [
      String(idx + 1),
      q.prompt,
      quiz.userAnswers[q.id] || '',
      q.correctAnswer,
      q.explanation,
    ]),
  ];

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/${encodeURIComponent(firstSheetName)}!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!writeRes.ok) {
    const err = await writeRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Created Google Sheet, but failed to append rows.');
  }

  return {
    spreadsheetId: sheet.spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`,
  };
}

export async function exportPlanToGoogleSlides(planTitle: string, goal: string, tasks: PlanTask[]) {
  const token = requireWorkspaceToken();
  const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: `NOVA Plan: ${planTitle}` }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to create Google Slides deck.');
  }
  const deck = (await createRes.json()) as { presentationId: string };

  const slideId = `nova_slide_${Date.now()}`;
  const titleBoxId = `nova_title_${Date.now()}`;
  const bodyBoxId = `nova_body_${Date.now()}`;

  await fetch(`https://slides.googleapis.com/v1/presentations/${deck.presentationId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          createSlide: {
            objectId: slideId,
            slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
            placeholderIdMappings: [
              { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: titleBoxId },
              { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bodyBoxId },
            ],
          },
        },
        { insertText: { objectId: titleBoxId, text: planTitle } },
        {
          insertText: {
            objectId: bodyBoxId,
            text: `Goal: ${goal}\n\n${tasks
              .slice(0, 8)
              .map((t) => `• [${t.status.toUpperCase()}] ${t.title} (${t.dueDate})`)
              .join('\n')}`,
          },
        },
      ],
    }),
  });

  return {
    presentationId: deck.presentationId,
    url: `https://docs.google.com/presentation/d/${deck.presentationId}/edit`,
  };
}

export async function listUpcomingCalendarEvents(): Promise<
  Array<{ id: string; summary: string; start: string }>
> {
  const token = requireWorkspaceToken();
  const timeMin = new Date().toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=6&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to read Google Calendar events.');
  }
  const data = (await res.json()) as {
    items?: Array<{ id: string; summary?: string; start?: { dateTime?: string; date?: string } }>;
  };
  return (data.items || []).map((e) => ({
    id: e.id,
    summary: e.summary || 'Untitled Event',
    start: e.start?.dateTime || e.start?.date || '',
  }));
}

export async function scheduleTaskOnGoogleCalendar(task: PlanTask) {
  const token = requireWorkspaceToken();
  const startDate = `${task.dueDate}T09:00:00Z`;
  const endDate = new Date(new Date(startDate).getTime() + (task.estimatedMinutes || 30) * 60000).toISOString();

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: `[NOVA] ${task.title}`,
      description: `${task.notes || ''}\nMilestone: ${task.milestone}\nPriority: ${task.priority}`,
      start: { dateTime: startDate },
      end: { dateTime: endDate },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to create Google Calendar event.');
  }
  return res.json();
}
