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
        const insertUser: InsertUser = {
          telegramId,
          username: msg.from?.username,
          firstName: msg.from?.first_name,
          lastName: msg.from?.last_name,
        };
        user = await storage.createUser(insertUser);
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
      
      // Check file size (10MB limit)
      if (document!.file_size! > 10 * 1024 * 1024) {
        await this.bot.sendMessage(chatId, 'File size must be less than 10MB.');
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
        await this.bot.sendMessage(chatId, 'Sorry, there was an error processing your document. Please try again.');
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
