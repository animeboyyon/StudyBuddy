import * as cron from 'node-cron';
import { storage } from '../storage';
import { openaiService } from './openaiService';
import type { StudySession } from '@shared/schema';
import type TelegramBot from 'node-telegram-bot-api';

interface ActiveSession {
  session: StudySession;
  bot: TelegramBot;
  currentQuestion?: any;
  waitingForAnswer: boolean;
}

class QuestionScheduler {
  private activeSessions: Map<number, ActiveSession> = new Map();
  private scheduler: any;

  constructor() {
    // Check for questions to send every minute
    this.scheduler = cron.schedule('* * * * *', () => {
      this.checkAndSendQuestions();
    }, { scheduled: false });
  }

  start() {
    this.scheduler.start();
    console.log('Question scheduler started');
  }

  stop() {
    this.scheduler.stop();
    console.log('Question scheduler stopped');
  }

  addSession(session: StudySession, bot: TelegramBot) {
    this.activeSessions.set(session.id, {
      session,
      bot,
      waitingForAnswer: false,
    });
  }

  removeSession(sessionId: number) {
    this.activeSessions.delete(sessionId);
  }

  private async checkAndSendQuestions() {
    const now = new Date();
    
    for (const [sessionId, activeSession] of this.activeSessions) {
      const { session, bot } = activeSession;
      
      // Skip if waiting for answer
      if (activeSession.waitingForAnswer) continue;
      
      // Check if it's time to send a question
      const timeSinceLastQuestion = session.lastQuestionAt 
        ? now.getTime() - session.lastQuestionAt.getTime()
        : session.interval * 60 * 1000 + 1; // Force first question
      
      const intervalMs = session.interval * 60 * 1000;
      
      if (timeSinceLastQuestion >= intervalMs) {
        await this.sendQuestion(sessionId, activeSession);
      }
    }
  }

  private async sendQuestion(sessionId: number, activeSession: ActiveSession) {
    try {
      const { session, bot } = activeSession;
      
      // Get a random question from the document
      const question = await storage.getRandomQuestionByDocumentId(session.documentId);
      
      if (!question) {
        console.log(`No questions found for session ${sessionId}`);
        return;
      }
      
      // Get user to send message
      const user = await storage.getUserByTelegramId(session.userId.toString());
      if (!user) {
        console.log(`User not found for session ${sessionId}`);
        return;
      }
      
      // Send question to user
      const chatId = parseInt(user.telegramId);
      await bot.sendMessage(chatId, `❓ Question ${session.questionsAsked + 1}:\n\n${question.question}`);
      
      // Update session
      await storage.updateSession(sessionId, {
        lastQuestionAt: new Date(),
        questionsAsked: session.questionsAsked + 1,
      });
      
      // Mark as waiting for answer
      activeSession.waitingForAnswer = true;
      activeSession.currentQuestion = question;
      
      // Set timeout to move to next question if no answer
      setTimeout(() => {
        if (activeSession.waitingForAnswer) {
          activeSession.waitingForAnswer = false;
          activeSession.currentQuestion = null;
        }
      }, 5 * 60 * 1000); // 5 minutes timeout
      
    } catch (error) {
      console.error('Error sending question:', error);
    }
  }

  async handleAnswer(sessionId: number, userAnswer: string) {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession || !activeSession.waitingForAnswer || !activeSession.currentQuestion) {
      return;
    }
    
    try {
      const { session, bot, currentQuestion } = activeSession;
      
      // Evaluate answer
      const evaluation = await openaiService.evaluateAnswer(
        currentQuestion.question,
        currentQuestion.expectedAnswer,
        userAnswer
      );
      
      // Save response
      await storage.createQuestionResponse({
        sessionId,
        questionId: currentQuestion.id,
        userAnswer,
        score: evaluation.score,
        feedback: evaluation.feedback,
      });
      
      // Send feedback
      const user = await storage.getUserByTelegramId(session.userId.toString());
      if (user) {
        const chatId = parseInt(user.telegramId);
        const emoji = evaluation.score >= 80 ? '🎉' : evaluation.score >= 60 ? '👍' : '💪';
        
        await bot.sendMessage(chatId, 
          `${emoji} Score: ${evaluation.score}%\n\n${evaluation.feedback}\n\nNext question coming in ${session.interval} minutes!`
        );
      }
      
      // Reset waiting state
      activeSession.waitingForAnswer = false;
      activeSession.currentQuestion = null;
      
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  setCurrentQuestion(sessionId: number, question: any) {
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession) {
      activeSession.currentQuestion = question;
      activeSession.waitingForAnswer = true;
      
      // Set timeout to move to next question if no answer
      setTimeout(() => {
        if (activeSession.waitingForAnswer) {
          activeSession.waitingForAnswer = false;
          activeSession.currentQuestion = null;
        }
      }, 5 * 60 * 1000); // 5 minutes timeout
    }
  }
}

export const questionScheduler = new QuestionScheduler();
