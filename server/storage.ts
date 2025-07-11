import { 
  users, documents, questions, studySessions, questionResponses, botStats,
  type User, type InsertUser,
  type Document, type InsertDocument,
  type Question, type InsertQuestion,
  type StudySession, type InsertStudySession,
  type QuestionResponse, type InsertQuestionResponse,
  type BotStats
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocumentsByUserId(userId: number): Promise<Document[]>;
  updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined>;
  
  // Question operations
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestionsByDocumentId(documentId: number): Promise<Question[]>;
  getRandomQuestionByDocumentId(documentId: number): Promise<Question | undefined>;
  
  // Study session operations
  createStudySession(session: InsertStudySession): Promise<StudySession>;
  getActiveSessionsByUserId(userId: number): Promise<StudySession[]>;
  getSessionById(id: number): Promise<StudySession | undefined>;
  updateSession(id: number, updates: Partial<StudySession>): Promise<StudySession | undefined>;
  
  // Question response operations
  createQuestionResponse(response: InsertQuestionResponse): Promise<QuestionResponse>;
  getResponsesBySessionId(sessionId: number): Promise<QuestionResponse[]>;
  
  // Statistics operations
  getBotStats(): Promise<BotStats>;
  updateBotStats(stats: Partial<BotStats>): Promise<BotStats>;
  
  // Dashboard operations
  getRecentDocuments(limit?: number): Promise<Document[]>;
  getRecentActivity(limit?: number): Promise<any[]>;
  getTotalUsers(): Promise<number>;
  getActiveSessions(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private documents: Map<number, Document> = new Map();
  private questions: Map<number, Question> = new Map();
  private studySessions: Map<number, StudySession> = new Map();
  private questionResponses: Map<number, QuestionResponse> = new Map();
  private botStats: BotStats;
  
  private currentUserId = 1;
  private currentDocumentId = 1;
  private currentQuestionId = 1;
  private currentSessionId = 1;
  private currentResponseId = 1;
  
  constructor() {
    this.botStats = {
      id: 1,
      totalUsers: 0,
      totalDocuments: 0,
      totalQuestions: 0,
      totalSessions: 0,
      updatedAt: new Date(),
    };
  }
  
  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.telegramId === telegramId);
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      ...insertUser,
      id,
      username: insertUser.username || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      isActive: insertUser.isActive ?? true,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    this.botStats.totalUsers = this.users.size;
    return user;
  }
  
  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = this.currentDocumentId++;
    const document: Document = {
      ...insertDocument,
      id,
      status: insertDocument.status || 'processing',
      createdAt: new Date(),
    };
    this.documents.set(id, document);
    this.botStats.totalDocuments = this.documents.size;
    return document;
  }
  
  async getDocumentById(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }
  
  async getDocumentsByUserId(userId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => doc.userId === userId);
  }
  
  async updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updatedDocument = { ...document, ...updates };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }
  
  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = this.currentQuestionId++;
    const question: Question = {
      ...insertQuestion,
      id,
      difficulty: insertQuestion.difficulty || 'medium',
      category: insertQuestion.category || null,
      createdAt: new Date(),
    };
    this.questions.set(id, question);
    this.botStats.totalQuestions = this.questions.size;
    return question;
  }
  
  async getQuestionsByDocumentId(documentId: number): Promise<Question[]> {
    return Array.from(this.questions.values()).filter(q => q.documentId === documentId);
  }
  
  async getRandomQuestionByDocumentId(documentId: number): Promise<Question | undefined> {
    const questions = await this.getQuestionsByDocumentId(documentId);
    if (questions.length === 0) return undefined;
    return questions[Math.floor(Math.random() * questions.length)];
  }
  
  async createStudySession(insertSession: InsertStudySession): Promise<StudySession> {
    const id = this.currentSessionId++;
    const session: StudySession = {
      ...insertSession,
      id,
      isActive: insertSession.isActive ?? true,
      interval: insertSession.interval || 15,
      questionsAsked: insertSession.questionsAsked || 0,
      lastQuestionAt: insertSession.lastQuestionAt || null,
      createdAt: new Date(),
    };
    this.studySessions.set(id, session);
    this.botStats.totalSessions = this.studySessions.size;
    return session;
  }
  
  async getActiveSessionsByUserId(userId: number): Promise<StudySession[]> {
    return Array.from(this.studySessions.values()).filter(
      session => session.userId === userId && session.isActive
    );
  }
  
  async getSessionById(id: number): Promise<StudySession | undefined> {
    return this.studySessions.get(id);
  }
  
  async updateSession(id: number, updates: Partial<StudySession>): Promise<StudySession | undefined> {
    const session = this.studySessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.studySessions.set(id, updatedSession);
    return updatedSession;
  }
  
  async createQuestionResponse(insertResponse: InsertQuestionResponse): Promise<QuestionResponse> {
    const id = this.currentResponseId++;
    const response: QuestionResponse = {
      ...insertResponse,
      id,
      feedback: insertResponse.feedback || null,
      answeredAt: new Date(),
    };
    this.questionResponses.set(id, response);
    return response;
  }
  
  async getResponsesBySessionId(sessionId: number): Promise<QuestionResponse[]> {
    return Array.from(this.questionResponses.values()).filter(r => r.sessionId === sessionId);
  }
  
  async getBotStats(): Promise<BotStats> {
    return this.botStats;
  }
  
  async updateBotStats(stats: Partial<BotStats>): Promise<BotStats> {
    this.botStats = { ...this.botStats, ...stats, updatedAt: new Date() };
    return this.botStats;
  }
  
  async getRecentDocuments(limit: number = 10): Promise<Document[]> {
    const allDocs = Array.from(this.documents.values());
    return allDocs
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime())
      .slice(0, limit);
  }
  
  async getRecentActivity(limit: number = 10): Promise<any[]> {
    const responses = Array.from(this.questionResponses.values());
    const documents = Array.from(this.documents.values());
    
    const activity = [
      ...responses.map(r => ({
        type: 'question_answered',
        timestamp: r.answeredAt,
        data: r,
      })),
      ...documents.map(d => ({
        type: 'document_uploaded',
        timestamp: d.createdAt,
        data: d,
      })),
    ];
    
    return activity
      .sort((a, b) => b.timestamp!.getTime() - a.timestamp!.getTime())
      .slice(0, limit);
  }
  
  async getTotalUsers(): Promise<number> {
    return this.users.size;
  }
  
  async getActiveSessions(): Promise<number> {
    return Array.from(this.studySessions.values()).filter(s => s.isActive).length;
  }
}

export const storage = new MemStorage();
