import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  codeProjects,
  conversations,
  knowledgeDocuments,
  personas,
  plans,
  quizzes,
  usageRecords,
  workspaces,
} from './schema.ts';

export async function listUserConversations(userUid: string) {
  try {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userUid, userUid))
      .orderBy(desc(conversations.updatedAt));
  } catch (error) {
    console.error('Failed to list conversations:', error);
    throw new Error('Failed to retrieve conversations.', { cause: error });
  }
}

export async function upsertConversation(
  userUid: string,
  payload: {
    id: string;
    title: string;
    folder: string;
    pinned: boolean;
    archived: boolean;
    modelId: string;
    personaId: string;
    messagesJson: unknown;
  }
) {
  try {
    const rows = await db
      .insert(conversations)
      .values({
        id: payload.id,
        userUid,
        title: payload.title,
        folder: payload.folder,
        pinned: payload.pinned,
        archived: payload.archived,
        modelId: payload.modelId,
        personaId: payload.personaId,
        messagesJson: payload.messagesJson,
      })
      .onConflictDoUpdate({
        target: conversations.id,
        set: {
          title: payload.title,
          folder: payload.folder,
          pinned: payload.pinned,
          archived: payload.archived,
          modelId: payload.modelId,
          personaId: payload.personaId,
          messagesJson: payload.messagesJson,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Failed to upsert conversation:', error);
    throw new Error('Failed to save conversation.', { cause: error });
  }
}

export async function deleteUserConversation(userUid: string, id: string) {
  try {
    await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userUid, userUid)));
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    throw new Error('Failed to delete conversation.', { cause: error });
  }
}

export async function listUserQuizzes(userUid: string) {
  try {
    return await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.userUid, userUid))
      .orderBy(desc(quizzes.createdAt));
  } catch (error) {
    console.error('Failed to list quizzes:', error);
    throw new Error('Failed to retrieve quizzes.', { cause: error });
  }
}

export async function upsertQuiz(
  userUid: string,
  payload: {
    id: string;
    title: string;
    subject: string;
    quizType: string;
    difficulty: string;
    score: number | null;
    totalQuestions: number;
    questionsJson: unknown;
  }
) {
  try {
    const rows = await db
      .insert(quizzes)
      .values({
        id: payload.id,
        userUid,
        title: payload.title,
        subject: payload.subject,
        quizType: payload.quizType,
        difficulty: payload.difficulty,
        score: payload.score,
        totalQuestions: payload.totalQuestions,
        questionsJson: payload.questionsJson,
      })
      .onConflictDoUpdate({
        target: quizzes.id,
        set: {
          title: payload.title,
          score: payload.score,
          questionsJson: payload.questionsJson,
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Failed to upsert quiz:', error);
    throw new Error('Failed to save quiz.', { cause: error });
  }
}

export async function listUserCodeProjects(userUid: string) {
  try {
    return await db
      .select()
      .from(codeProjects)
      .where(eq(codeProjects.userUid, userUid))
      .orderBy(desc(codeProjects.updatedAt));
  } catch (error) {
    console.error('Failed to list code projects:', error);
    throw new Error('Failed to retrieve code projects.', { cause: error });
  }
}

export async function upsertCodeProject(
  userUid: string,
  payload: {
    id: string;
    name: string;
    language: string;
    filesJson: unknown;
    sourceSketchDataUrl?: string | null;
  }
) {
  try {
    const rows = await db
      .insert(codeProjects)
      .values({
        id: payload.id,
        userUid,
        name: payload.name,
        language: payload.language,
        filesJson: payload.filesJson,
        sourceSketchDataUrl: payload.sourceSketchDataUrl ?? null,
      })
      .onConflictDoUpdate({
        target: codeProjects.id,
        set: {
          name: payload.name,
          language: payload.language,
          filesJson: payload.filesJson,
          sourceSketchDataUrl: payload.sourceSketchDataUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Failed to upsert code project:', error);
    throw new Error('Failed to save code project.', { cause: error });
  }
}

export async function listUserPlans(userUid: string) {
  try {
    return await db
      .select()
      .from(plans)
      .where(eq(plans.userUid, userUid))
      .orderBy(desc(plans.updatedAt));
  } catch (error) {
    console.error('Failed to list plans:', error);
    throw new Error('Failed to retrieve plans.', { cause: error });
  }
}

export async function upsertPlan(
  userUid: string,
  payload: {
    id: string;
    title: string;
    horizon: string;
    goal: string;
    tasksJson: unknown;
  }
) {
  try {
    const rows = await db
      .insert(plans)
      .values({
        id: payload.id,
        userUid,
        title: payload.title,
        horizon: payload.horizon,
        goal: payload.goal,
        tasksJson: payload.tasksJson,
      })
      .onConflictDoUpdate({
        target: plans.id,
        set: {
          title: payload.title,
          horizon: payload.horizon,
          goal: payload.goal,
          tasksJson: payload.tasksJson,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Failed to upsert plan:', error);
    throw new Error('Failed to save plan.', { cause: error });
  }
}

export async function listUserWorkspaces(userUid: string) {
  try {
    return await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userUid, userUid))
      .orderBy(desc(workspaces.updatedAt));
  } catch (error) {
    console.error('Failed to list workspaces:', error);
    throw new Error('Failed to retrieve custom workspaces.', { cause: error });
  }
}

export async function upsertWorkspace(
  userUid: string,
  payload: {
    id: string;
    name: string;
    description?: string | null;
    isDefault: boolean;
    layoutJson: unknown;
  }
) {
  try {
    const rows = await db
      .insert(workspaces)
      .values({
        id: payload.id,
        userUid,
        name: payload.name,
        description: payload.description ?? null,
        isDefault: payload.isDefault,
        layoutJson: payload.layoutJson,
      })
      .onConflictDoUpdate({
        target: workspaces.id,
        set: {
          name: payload.name,
          description: payload.description ?? null,
          isDefault: payload.isDefault,
          layoutJson: payload.layoutJson,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Failed to upsert workspace:', error);
    throw new Error('Failed to save custom workspace.', { cause: error });
  }
}

export async function recordUsageTelemetry(
  userUid: string,
  payload: {
    workspaceType: string;
    modelId: string;
    executionSource: string;
    latencyMs: number;
    status: string;
    reason: string;
  }
) {
  try {
    const rows = await db
      .insert(usageRecords)
      .values({
        userUid,
        workspaceType: payload.workspaceType,
        modelId: payload.modelId,
        executionSource: payload.executionSource,
        latencyMs: Math.round(payload.latencyMs),
        status: payload.status,
        reason: payload.reason,
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Failed to log usage record:', error);
    throw new Error('Failed to record usage telemetry.', { cause: error });
  }
}

export async function listUserPersonas(userUid: string) {
  try {
    return await db
      .select()
      .from(personas)
      .where(eq(personas.userUid, userUid))
      .orderBy(desc(personas.createdAt));
  } catch (error) {
    console.error('Failed to list personas:', error);
    throw new Error('Failed to retrieve personas.', { cause: error });
  }
}

export async function listUserKnowledgeDocs(userUid: string) {
  try {
    return await db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.userUid, userUid))
      .orderBy(desc(knowledgeDocuments.createdAt));
  } catch (error) {
    console.error('Failed to list knowledge documents:', error);
    throw new Error('Failed to retrieve knowledge documents.', { cause: error });
  }
}
