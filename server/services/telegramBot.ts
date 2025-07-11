import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { fileProcessor } from './fileProcessor';
import { openaiService } from './openaiService';
import { questionScheduler } from './questionScheduler';
import type { InsertUser, InsertDocument, InsertStudySession } from '@shared/schema';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

class TelegramBotService {
  private bot: TelegramBot;
  private isRunning = false;

  constructor() {
    this.bot = new TelegramBot(BOT_TOKEN, { polling: false });
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.bot.startPolling();
    
    // Set up command handlers
    this.setupCommands();
    
    // Set up message handlers
    this.setupMessageHandlers();
    
    console.log('Telegram bot started');
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    await this.bot.stopPolling();
    
    console.log('Telegram bot stopped');
  }

  private setupCommands() {
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString() || '';
      
      // Create or get user
      let user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        try {
          const insertUser: InsertUser = {
            telegramId,
            username: msg.from?.username,
            firstName: msg.from?.first_name,
            lastName: msg.from?.last_name,
          };
          user = await storage.createUser(insertUser);
        } catch (error) {
          // If user already exists (race condition), fetch it
          user = await storage.getUserByTelegramId(telegramId);
          if (!user) {
            console.error('Error creating user:', error);
            await this.bot.sendMessage(chatId, 'Sorry, there was an error setting up your account. Please try again.');
            return;
          }
        }
      }
      
      const welcomeMessage = `
Welcome to StudyBot! 🎓

I help you study by asking questions from your uploaded materials.

Here's how it works:
1. Send me a PDF or DOCX file with your study material
2. I'll process it and generate questions
3. You can start a study session and I'll ask you questions every 15 minutes
4. I'll evaluate your answers and provide feedback

Commands:
/start - Show this welcome message
/help - Show help information
/sessions - Manage your study sessions
/study - Start a study session with your latest document
/exam - Start an exam mode (10 questions in a row)
/stop - Stop all active study sessions
/stats - View your learning statistics

Just send me a document to get started! 📚
      `;
      
      await this.bot.sendMessage(chatId, welcomeMessage);
    });

    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      const helpMessage = `
StudyBot Help 📖

Commands:
• /start - Welcome message
• /help - This help message
• /sessions - View and manage study sessions
• /study - Start a study session with your latest document
• /exam - Start an exam mode (10 questions in a row)
• /stop - Stop all active study sessions
• /stats - View your learning statistics

To upload study material:
• Send me a PDF or DOCX file
• I'll process it and create questions
• Use /study to start getting questions every 15 minutes

During a study session:
• I'll ask you questions every 15 minutes
• Answer in text format
• I'll evaluate your answer and provide feedback

Tips:
• Be specific in your answers
• Take your time to think
• Review feedback to improve

Need more help? Just ask! 🤔
      `;
      
      await this.bot.sendMessage(chatId, helpMessage);
    });

    this.bot.onText(/\/sessions/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString() || '';
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to register.');
        return;
      }
      
      const sessions = await storage.getActiveSessionsByUserId(user.id);
      
      if (sessions.length === 0) {
        await this.bot.sendMessage(chatId, 'You have no active study sessions. Upload a document to start studying!');
        return;
      }
      
      let message = 'Your active study sessions:\n\n';
      for (const session of sessions) {
        const document = await storage.getDocumentById(session.documentId);
        message += `📚 ${document?.originalName || 'Unknown'}\n`;
        message += `   Questions asked: ${session.questionsAsked}\n`;
        message += `   Interval: ${session.interval} minutes\n\n`;
      }
      
      await this.bot.sendMessage(chatId, message);
    });

    this.bot.onText(/\/stats/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString() || '';
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to register.');
        return;
      }
      
      const sessions = await storage.getActiveSessionsByUserId(user.id);
      const documents = await storage.getDocumentsByUserId(user.id);
      
      let totalQuestions = 0;
      let totalResponses = 0;
      let totalScore = 0;
      
      for (const session of sessions) {
        const responses = await storage.getResponsesBySessionId(session.id);
        totalResponses += responses.length;
        totalScore += responses.reduce((sum, r) => sum + r.score, 0);
        totalQuestions += session.questionsAsked;
      }
      
      const averageScore = totalResponses > 0 ? Math.round(totalScore / totalResponses) : 0;
      
      const statsMessage = `
📊 Your Learning Statistics

📚 Documents uploaded: ${documents.length}
🎯 Active sessions: ${sessions.length}
❓ Questions answered: ${totalResponses}
📈 Average score: ${averageScore}%
🔥 Total questions asked: ${totalQuestions}

Keep up the great work! 🌟
      `;
      
      await this.bot.sendMessage(chatId, statsMessage);
    });

    this.bot.onText(/\/study/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString() || '';
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to register.');
        return;
      }
      
      const documents = await storage.getDocumentsByUserId(user.id);
      
      if (documents.length === 0) {
        await this.bot.sendMessage(chatId, 'You need to upload a document first! Send me a PDF or DOCX file to get started.');
        return;
      }
      
      // Use the most recent document
      const latestDocument = documents[documents.length - 1];
      
      const insertSession: InsertStudySession = {
        userId: user.id,
        documentId: latestDocument.id,
        isActive: true,
        interval: 15,
        questionsAsked: 0,
      };
      
      const session = await storage.createStudySession(insertSession);
      
      // Register with scheduler
      questionScheduler.addSession(session, this.bot);
      
      await this.bot.sendMessage(chatId, 
        `🚀 Study session started!\n\n` +
        `📚 Document: ${latestDocument.originalName}\n` +
        `⏰ Questions every: ${session.interval} minutes\n\n` +
        `I'll ask you your first question now! 🍀`
      );
      
      // Send the first question immediately
      const question = await storage.getRandomQuestionByDocumentId(latestDocument.id);
      if (question) {
        await this.bot.sendMessage(chatId, `❓ Question 1:\n\n${question.question}`);
        
        // Update session to track the first question
        await storage.updateSession(session.id, {
          lastQuestionAt: new Date(),
          questionsAsked: 1,
        });
        
        // Set up scheduler to handle the answer
        questionScheduler.setCurrentQuestion(session.id, question);
      }
    });

    this.bot.onText(/\/stop/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString() || '';
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to register.');
        return;
      }
      
      const sessions = await storage.getActiveSessionsByUserId(user.id);
      
      if (sessions.length === 0) {
        await this.bot.sendMessage(chatId, 'You have no active study sessions to stop.');
        return;
      }
      
      // Stop all active sessions
      for (const session of sessions) {
        await storage.updateSession(session.id, { isActive: false });
        questionScheduler.removeSession(session.id);
      }
      
      await this.bot.sendMessage(chatId, 
        `🛑 All study sessions stopped!\n\n` +
        `Stopped ${sessions.length} session(s). You can start a new session anytime with /study.`
      );
    });

    this.bot.onText(/\/exam/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString() || '';
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to register.');
        return;
      }
      
      const userDocuments = await storage.getDocumentsByUserId(user.id);
      if (userDocuments.length === 0) {
        await this.bot.sendMessage(chatId, 'You need to upload a document first. Send me a PDF or DOCX file!');
        return;
      }
      
      const latestDocument = userDocuments[0];
      const questions = await storage.getQuestionsByDocumentId(latestDocument.id);
      
      if (questions.length === 0) {
        await this.bot.sendMessage(chatId, 'No questions available for this document. Please wait for processing to complete.');
        return;
      }
      
      // Stop any existing sessions
      const existingSessions = await storage.getActiveSessionsByUserId(user.id);
      for (const session of existingSessions) {
        await storage.updateSession(session.id, { isActive: false });
        questionScheduler.removeSession(session.id);
      }
      
      // Create exam session
      const insertSession: InsertStudySession = {
        userId: user.id,
        documentId: latestDocument.id,
        isActive: true,
        interval: 0, // No interval for exam mode
        isExamMode: true,
        examQuestionsCount: Math.min(questions.length, 10), // Max 10 questions
        questionsAsked: 0,
      };
      
      const session = await storage.createStudySession(insertSession);
      questionScheduler.addSession(session, this.bot);
      
      await this.bot.sendMessage(chatId, 
        `📝 Exam Mode Started!\n\n` +
        `Document: ${latestDocument.originalName}\n` +
        `Questions: ${session.examQuestionsCount}\n\n` +
        `I'll ask you ${session.examQuestionsCount} questions in a row. Answer each one and I'll provide feedback immediately. Ready? Let's begin! 🎯`
      );
      
      // Send the first question immediately
      const question = await storage.getRandomQuestionByDocumentId(latestDocument.id);
      if (question) {
        await this.bot.sendMessage(chatId, `❓ Question 1 of ${session.examQuestionsCount}:\n\n${question.question}`);
        
        // Update session to track the first question
        await storage.updateSession(session.id, {
          lastQuestionAt: new Date(),
          questionsAsked: 1,
        });
        
        // Set up scheduler to handle the answer
        questionScheduler.setCurrentQuestion(session.id, question);
      }
    });
  }

  private setupMessageHandlers() {
    // Handle document uploads
    this.bot.on('document', async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString() || '';
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to register.');
        return;
      }
      
      const document = msg.document;
      
      // Check file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(document!.mime_type || '')) {
        await this.bot.sendMessage(chatId, 'Please send a PDF or DOCX file.');
        return;
      }
      
      // Check file size (1GB limit)
      if (document!.file_size! > 1024 * 1024 * 1024) {
        await this.bot.sendMessage(chatId, 'File size must be less than 1GB.');
        return;
      }
      
      await this.bot.sendMessage(chatId, 'Processing your document... This may take a moment. ⏳');
      
      try {
        // Download file
        const fileId = document!.file_id;
        const fileInfo = await this.bot.getFile(fileId);
        const filePath = await this.bot.downloadFile(fileId, './uploads/');
        
        // Process file
        const content = await fileProcessor.processFile(filePath, document!.mime_type || '');
        
        // Save document
        const insertDocument: InsertDocument = {
          userId: user.id,
          filename: fileId,
          originalName: document!.file_name || 'Unknown',
          fileType: document!.mime_type || '',
          fileSize: document!.file_size || 0,
          content,
          status: 'completed',
        };
        
        const savedDocument = await storage.createDocument(insertDocument);
        
        // Generate questions
        const questions = await openaiService.generateQuestions(content, savedDocument.originalName);
        
        // Save questions
        for (const q of questions) {
          await storage.createQuestion({
            documentId: savedDocument.id,
            question: q.question,
            expectedAnswer: q.expectedAnswer,
            difficulty: q.difficulty,
            category: q.category,
          });
        }
        
        await this.bot.sendMessage(chatId, 
          `✅ Document processed successfully!\n\n` +
          `📚 ${savedDocument.originalName}\n` +
          `❓ ${questions.length} questions generated\n\n` +
          `Ready to start studying? Use /study to begin your session!`
        );
        
      } catch (error) {
        console.error('Error processing document:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          fileId: document?.file_id,
          fileName: document?.file_name,
          fileSize: document?.file_size,
          mimeType: document?.mime_type
        });
        
        let errorMessage = 'Sorry, there was an error processing your document. ';
        if (error.message.includes('network') || error.message.includes('download')) {
          errorMessage += 'Please check your internet connection and try again.';
        } else if (error.message.includes('OpenAI') || error.message.includes('API') || error.message.includes('quota') || error.message.includes('429')) {
          errorMessage += 'The AI service quota has been exceeded. Please contact support to increase the quota.';
        } else if (error.message.includes('file') || error.message.includes('parse')) {
          errorMessage += 'The file format may be corrupted. Please try a different file.';
        } else {
          errorMessage += 'Please try again or contact support if the issue persists.';
        }
        
        await this.bot.sendMessage(chatId, errorMessage);
      }
    });

    // Handle text messages
    this.bot.on('message', async (msg) => {
      if (msg.document || msg.text?.startsWith('/')) return;
      
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString() || '';
      const text = msg.text || '';
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) return;
      
      // This is handled by the /study command now
      
      // Check if this is an answer to a question
      await this.handleAnswer(chatId, user.id, text);
    });
  }

  private async handleAnswer(chatId: number, userId: number, answer: string) {
    const sessions = await storage.getActiveSessionsByUserId(userId);
    if (sessions.length === 0) return;
    
    // Check if there's an active session waiting for an answer
    for (const session of sessions) {
      await questionScheduler.handleAnswer(session.id, answer);
    }
  }

  async sendQuestion(chatId: number, question: string) {
    await this.bot.sendMessage(chatId, `❓ ${question}`);
  }

  async sendFeedback(chatId: number, feedback: string, score: number) {
    const emoji = score >= 80 ? '🎉' : score >= 60 ? '👍' : '💪';
    await this.bot.sendMessage(chatId, 
      `${emoji} Score: ${score}%\n\n${feedback}\n\nKeep up the great work!`
    );
  }

  getBot() {
    return this.bot;
  }
}

export const telegramBot = new TelegramBotService();
