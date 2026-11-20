import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  routingMode: text('routing_mode').notNull().default('automatic'),
  privacyPreference: text('privacy_preference').notNull().default('standard'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isDefault: boolean('is_default').default(false).notNull(),
  layoutJson: jsonb('layout_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  title: text('title').notNull(),
  folder: text('folder').default('General').notNull(),
  pinned: boolean('pinned').default(false).notNull(),
  archived: boolean('archived').default(false).notNull(),
  modelId: text('model_id').notNull(),
  personaId: text('persona_id').notNull(),
  messagesJson: jsonb('messages_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const personas = pgTable('personas', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  instructions: text('instructions').notNull(),
  preferredModelId: text('preferred_model_id'),
  responseStyle: text('response_style').default('balanced').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const quizzes = pgTable('quizzes', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  quizType: text('quiz_type').notNull(),
  difficulty: text('difficulty').notNull(),
  score: integer('score'),
  totalQuestions: integer('total_questions').notNull(),
  questionsJson: jsonb('questions_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const codeProjects = pgTable('code_projects', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  name: text('name').notNull(),
  language: text('language').notNull(),
  filesJson: jsonb('files_json').notNull(),
  sourceSketchDataUrl: text('source_sketch_data_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  title: text('title').notNull(),
  horizon: text('horizon').notNull(),
  goal: text('goal').notNull(),
  tasksJson: jsonb('tasks_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  collectionName: text('collection_name').notNull(),
  title: text('title').notNull(),
  mimeType: text('mime_type').notNull(),
  summary: text('summary'),
  contentExcerpt: text('content_excerpt').notNull(),
  tagsJson: jsonb('tags_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usageRecords = pgTable('usage_records', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  workspaceType: text('workspace_type').notNull(),
  modelId: text('model_id').notNull(),
  executionSource: text('execution_source').notNull(),
  latencyMs: integer('latency_ms').notNull(),
  status: text('status').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaces),
  conversations: many(conversations),
}));
