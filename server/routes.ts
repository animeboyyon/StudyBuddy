import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { telegramBot } from "./services/telegramBot";
import { questionScheduler } from "./services/questionScheduler";
import { openaiService } from "./services/openaiService";

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard API routes
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await storage.getBotStats();
      const totalUsers = await storage.getTotalUsers();
      const activeSessions = await storage.getActiveSessions();
      
      res.json({
        totalDocuments: stats.totalDocuments,
        questionsAsked: stats.totalQuestions,
        accuracyRate: 78, // This would be calculated from actual data
        activeSessions,
        totalUsers,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/recent-documents', async (req, res) => {
    try {
      const documents = await storage.getRecentDocuments(5);
      res.json(documents);
    } catch (error) {
      console.error('Error fetching recent documents:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/recent-activity', async (req, res) => {
    try {
      const activity = await storage.getRecentActivity(10);
      res.json(activity);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/sample-questions', async (req, res) => {
    try {
      // Get some sample questions from recent documents
      const documents = await storage.getRecentDocuments(2);
      const sampleQuestions = [];
      
      for (const doc of documents) {
        const questions = await storage.getQuestionsByDocumentId(doc.id);
        if (questions.length > 0) {
          sampleQuestions.push({
            question: questions[0].question,
            expectedAnswer: questions[0].expectedAnswer,
            difficulty: questions[0].difficulty,
            category: questions[0].category || 'General',
            document: doc.originalName,
          });
        }
      }
      
      res.json(sampleQuestions);
    } catch (error) {
      console.error('Error fetching sample questions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/bot/start', async (req, res) => {
    try {
      await telegramBot.start();
      questionScheduler.start();
      res.json({ message: 'Bot started successfully' });
    } catch (error) {
      console.error('Error starting bot:', error);
      res.status(500).json({ message: 'Failed to start bot' });
    }
  });

  app.post('/api/bot/stop', async (req, res) => {
    try {
      await telegramBot.stop();
      questionScheduler.stop();
      res.json({ message: 'Bot stopped successfully' });
    } catch (error) {
      console.error('Error stopping bot:', error);
      res.status(500).json({ message: 'Failed to stop bot' });
    }
  });

  app.get('/api/bot/status', (req, res) => {
    res.json({
      isRunning: true, // In a real app, we'd track this
      activeSessions: questionScheduler.getActiveSessionCount(),
    });
  });

  // Generate questions for a specific document
  app.post('/api/generate-questions/:documentId', async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const document = await storage.getDocumentById(documentId);
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      const questions = await openaiService.generateQuestions(document.content, document.originalName);
      
      // Save questions
      for (const q of questions) {
        await storage.createQuestion({
          documentId,
          question: q.question,
          expectedAnswer: q.expectedAnswer,
          difficulty: q.difficulty,
          category: q.category,
        });
      }
      
      res.json({ message: `Generated ${questions.length} questions`, questions });
    } catch (error) {
      console.error('Error generating questions:', error);
      res.status(500).json({ message: 'Failed to generate questions' });
    }
  });

  // Start the bot automatically when server starts
  telegramBot.start().then(() => {
    questionScheduler.start();
    console.log('Telegram bot and scheduler started automatically');
  }).catch(error => {
    console.error('Failed to start bot automatically:', error);
  });

  const httpServer = createServer(app);
  return httpServer;
}
