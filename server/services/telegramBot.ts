import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { fileProcessor } from './fileProcessor';
import { geminiService } from './geminiService';
import { questionScheduler } from './questionScheduler';
import type { InsertUser, InsertDocument, InsertStudySession } from '@shared/schema';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

class TelegramBotService {
  private bot: TelegramBot;
  private isRunning = false;
  private userSelections: Map<string, { documentId?: number; interval?: number }> = new Map();

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
3. Use /study to start a study session with custom settings
4. I'll ask you questions at your chosen intervals
5. I'll evaluate your answers and provide feedback

Commands:
/start - Show this welcome message
/help - Show help information
/files - View and select your uploaded documents
/study - Start a study session with custom settings
/exam - Start an exam mode (10 questions in a row)
/sessions - Manage your study sessions
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
• /files - View and select your uploaded documents
• /study - Start a study session with custom settings
• /exam - Start an exam mode (10 questions in a row)
• /sessions - View and manage study sessions
• /stop - Stop all active study sessions
• /stats - View your learning statistics

To upload study material:
• Send me a PDF or DOCX file
• I'll process it and create questions
• Use /study to start getting questions

During a study session:
• I'll ask you questions at your chosen intervals
• Answer in text format
• I'll evaluate your answer and provide feedback

Tips:
• Use /files to choose which document to study
• You can set custom question intervals (1-60 minutes)
• Use /exam for rapid-fire question practice
• Be specific in your answers for better scores

Need more help? Just ask! 🤔
      `;
      
      await this.bot.sendMessage(chatId, helpMessage);
    });

    this.bot.onText(/\/files/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString() || '';
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to register.');
        return;
      }
      
      const documents = await storage.getDocumentsByUserId(user.id);
      
      if (documents.length === 0) {
        await this.bot.sendMessage(chatId, 'You have no uploaded documents. Send me a PDF or DOCX file to get started!');
        return;
      }
      
      // Create inline keyboard with document options
      const keyboard = documents.map((doc, index) => [{
        text: `📄 ${doc.originalName} (${Math.round(doc.fileSize / 1024)}KB)`,
        callback_data: `select_doc_${doc.id}`
      }]);
      
      await this.bot.sendMessage(chatId, 
        '📚 Select a document for your next study session:\n\n' +
        'Click on any document below to select it for studying.',
        {
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
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
        await this.bot.sendMessage(chatId, 'You have no active study sessions. Use /study to start one!');
        return;
      }
      
      let message = '📚 Your active study sessions:\n\n';
      for (const session of sessions) {
        const document = await storage.getDocumentById(session.documentId);
        const sessionType = session.isExamMode ? 'Exam Mode' : 'Study Mode';
        message += `${sessionType}: ${document?.originalName || 'Unknown'}\n`;
        message += `   Questions asked: ${session.questionsAsked}\n`;
        if (!session.isExamMode) {
          message += `   Interval: ${session.interval} minutes\n`;
        }
        message += '\n';
      }
      
      message += 'Use /stop to stop all sessions.';
      
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
      
      // Check if user has a selected document
      const userSelection = this.userSelections.get(telegramId);
      
      if (!userSelection?.documentId) {
        // Show document selection
        const keyboard = documents.map((doc) => [{
          text: `📄 ${doc.originalName}`,
          callback_data: `study_doc_${doc.id}`
        }]);
        
        await this.bot.sendMessage(chatId, 
          '📚 First, select which document you want to study:',
          {
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
        return;
      }
      
      // Show interval selection
      const intervalKeyboard = [
        [
          { text: '⚡ 5 min', callback_data: 'interval_5' },
          { text: '🔥 10 min', callback_data: 'interval_10' },
          { text: '⏰ 15 min', callback_data: 'interval_15' }
        ],
        [
          { text: '📚 20 min', callback_data: 'interval_20' },
          { text: '🎯 30 min', callback_data: 'interval_30' },
          { text: '🧠 60 min', callback_data: 'interval_60' }
        ]
      ];
      
      await this.bot.sendMessage(chatId, 
        '⏱️ How often would you like to receive questions?',
        {
          reply_markup: {
            inline_keyboard: intervalKeyboard
          }
        }
      );
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
      
      // Clear user selections
      this.userSelections.delete(telegramId);
      
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
      
      // Check if user has a selected document
      const userSelection = this.userSelections.get(telegramId);
      let selectedDoc;
      
      if (userSelection?.documentId) {
        selectedDoc = await storage.getDocumentById(userSelection.documentId);
      }
      
      if (!selectedDoc) {
        // Show document selection for exam
        const keyboard = userDocuments.map((doc) => [{
          text: `📄 ${doc.originalName}`,
          callback_data: `exam_doc_${doc.id}`
        }]);
        
        await this.bot.sendMessage(chatId, 
          '📝 Select which document you want to take an exam on:',
          {
            reply_markup: {
              inline_keyboard: keyboard
            }
          }
        );
        return;
      }
      
      await this.startExamSession(chatId, user.id, selectedDoc.id);
    });

    // Handle callback queries (inline keyboard responses)
    this.bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const telegramId = query.from.id.toString();
      const data = query.callback_data;
      
      if (!chatId || !data) return;
      
      try {
        if (data.startsWith('select_doc_')) {
          const documentId = parseInt(data.replace('select_doc_', ''));
          const document = await storage.getDocumentById(documentId);
          
          if (document) {
            // Store user's document selection
            const currentSelection = this.userSelections.get(telegramId) || {};
            this.userSelections.set(telegramId, { ...currentSelection, documentId });
            
            await this.bot.editMessageText(
              `✅ Selected: ${document.originalName}\n\nNow use /study to start a study session or /exam for exam mode.`,
              {
                chat_id: chatId,
                message_id: query.message?.message_id
              }
            );
          }
        }
        else if (data.startsWith('study_doc_')) {
          const documentId = parseInt(data.replace('study_doc_', ''));
          const document = await storage.getDocumentById(documentId);
          
          if (document) {
            // Store selection and show interval options
            const currentSelection = this.userSelections.get(telegramId) || {};
            this.userSelections.set(telegramId, { ...currentSelection, documentId });
            
            const intervalKeyboard = [
              [
                { text: '⚡ 5 min', callback_data: 'interval_5' },
                { text: '🔥 10 min', callback_data: 'interval_10' },
                { text: '⏰ 15 min', callback_data: 'interval_15' }
              ],
              [
                { text: '📚 20 min', callback_data: 'interval_20' },
                { text: '🎯 30 min', callback_data: 'interval_30' },
                { text: '🧠 60 min', callback_data: 'interval_60' }
              ]
            ];
            
            await this.bot.editMessageText(
              `📄 Selected: ${document.originalName}\n\n⏱️ How often would you like to receive questions?`,
              {
                chat_id: chatId,
                message_id: query.message?.message_id,
                reply_markup: {
                  inline_keyboard: intervalKeyboard
                }
              }
            );
          }
        }
        else if (data.startsWith('exam_doc_')) {
          const documentId = parseInt(data.replace('exam_doc_', ''));
          const document = await storage.getDocumentById(documentId);
          
          if (document) {
            const user = await storage.getUserByTelegramId(telegramId);
            if (user) {
              await this.bot.editMessageText(
                `📝 Starting exam with: ${document.originalName}`,
                {
                  chat_id: chatId,
                  message_id: query.message?.message_id
                }
              );
              
              await this.startExamSession(chatId, user.id, documentId);
            }
          }
        }
        else if (data.startsWith('interval_')) {
          const interval = parseInt(data.replace('interval_', ''));
          const userSelection = this.userSelections.get(telegramId);
          
          if (userSelection?.documentId) {
            const user = await storage.getUserByTelegramId(telegramId);
            const document = await storage.getDocumentById(userSelection.documentId);
            
            if (user && document) {
              await this.bot.editMessageText(
                `🚀 Starting study session!\n\n📄 Document: ${document.originalName}\n⏰ Questions every: ${interval} minutes`,
                {
                  chat_id: chatId,
                  message_id: query.message?.message_id
                }
              );
              
              await this.startStudySession(chatId, user.id, userSelection.documentId, interval);
            }
          }
        }
        
        await this.bot.answerCallbackQuery(query.id);
      } catch (error) {
        console.error('Error handling callback query:', error);
        await this.bot.answerCallbackQuery(query.id, { text: 'Error processing request' });
      }
    });
  }

  private async startStudySession(chatId: number, userId: number, documentId: number, interval: number) {
    try {
      // Stop any existing sessions for this user
      const existingSessions = await storage.getActiveSessionsByUserId(userId);
      for (const session of existingSessions) {
        await storage.updateSession(session.id, { isActive: false });
        questionScheduler.removeSession(session.id);
      }
      
      const insertSession: InsertStudySession = {
        userId,
        documentId,
        isActive: true,
        interval,
        questionsAsked: 0,
      };
      
      const session = await storage.createStudySession(insertSession);
      
      // Register with scheduler
      questionScheduler.addSession(session, this.bot);
      
      await this.bot.sendMessage(chatId, 
        `I'll ask you your first question now! 🍀`
      );
      
      // Send the first question immediately
      const question = await storage.getRandomQuestionByDocumentId(documentId);
      if (question) {
        await this.bot.sendMessage(chatId, `❓ Question 1:\n\n${question.question}`);
        
        // Update session to track the first question
        await storage.updateSession(session.id, {
          lastQuestionAt: new Date(),
          questionsAsked: 1,
        });
        
        // Set up scheduler to handle the answer
        questionScheduler.setCurrentQuestion(session.id, question);
      } else {
        await this.bot.sendMessage(chatId, 
          '❌ No questions available for this document yet. Please wait for processing to complete or try a different document.'
        );
        await storage.updateSession(session.id, { isActive: false });
      }
    } catch (error) {
      console.error('Error starting study session:', error);
      await this.bot.sendMessage(chatId, 'Sorry, there was an error starting your study session. Please try again.');
    }
  }

  private async startExamSession(chatId: number, userId: number, documentId: number) {
    try {
      const questions = await storage.getQuestionsByDocumentId(documentId);
      
      if (questions.length === 0) {
        await this.bot.sendMessage(chatId, 'No questions available for this document. Please wait for processing to complete.');
        return;
      }
      
      // Stop any existing sessions
      const existingSessions = await storage.getActiveSessionsByUserId(userId);
      for (const session of existingSessions) {
        await storage.updateSession(session.id, { isActive: false });
        questionScheduler.removeSession(session.id);
      }
      
      // Create exam session
      const insertSession: InsertStudySession = {
        userId,
        documentId,
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
        `Questions: ${session.examQuestionsCount}\n\n` +
        `I'll ask you ${session.examQuestionsCount} questions in a row. Answer each one and I'll provide feedback immediately. Ready? Let's begin! 🎯`
      );
      
      // Send the first question immediately
      const question = await storage.getRandomQuestionByDocumentId(documentId);
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
    } catch (error) {
      console.error('Error starting exam session:', error);
      await this.bot.sendMessage(chatId, 'Sorry, there was an error starting your exam. Please try again.');
    }
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
        const questions = await geminiService.generateQuestions(content, savedDocument.originalName);
        
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
        
        // Auto-select this document for the user
        this.userSelections.set(telegramId, { documentId: savedDocument.id });
        
        await this.bot.sendMessage(chatId, 
          `✅ Document processed successfully!\n\n` +
          `📚 ${savedDocument.originalName}\n` +
          `❓ ${questions.length} questions generated\n\n` +
          `This document is now selected for your next study session. Use /study to begin!`
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