import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  content: text("content").notNull(),
  status: text("status").default("processing"), // processing, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  question: text("question").notNull(),
  expectedAnswer: text("expected_answer").notNull(),
  difficulty: text("difficulty").default("medium"), // easy, medium, hard
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const studySessions = pgTable("study_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  isActive: boolean("is_active").default(true),
  interval: integer("interval").default(15), // minutes
  questionsAsked: integer("questions_asked").default(0),
  lastQuestionAt: timestamp("last_question_at"),
  isExamMode: boolean("is_exam_mode").default(false),
  examQuestionsCount: integer("exam_questions_count").default(10),
  createdAt: timestamp("created_at").defaultNow(),
});

export const questionResponses = pgTable("question_responses", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => studySessions.id).notNull(),
  questionId: integer("question_id").references(() => questions.id).notNull(),
  userAnswer: text("user_answer").notNull(),
  score: integer("score").notNull(), // 0-100
  feedback: text("feedback"),
  answeredAt: timestamp("answered_at").defaultNow(),
});

export const botStats = pgTable("bot_stats", {
  id: serial("id").primaryKey(),
  totalUsers: integer("total_users").default(0),
  totalDocuments: integer("total_documents").default(0),
  totalQuestions: integer("total_questions").default(0),
  totalSessions: integer("total_sessions").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
});

export const insertStudySessionSchema = createInsertSchema(studySessions).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionResponseSchema = createInsertSchema(questionResponses).omit({
  id: true,
  answeredAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type StudySession = typeof studySessions.$inferSelect;
export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;

export type QuestionResponse = typeof questionResponses.$inferSelect;
export type InsertQuestionResponse = z.infer<typeof insertQuestionResponseSchema>;

export type BotStats = typeof botStats.$inferSelect;
