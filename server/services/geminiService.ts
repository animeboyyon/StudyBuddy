import { GoogleGenAI } from "@google/genai";

export interface GeneratedQuestion {
  question: string;
  expectedAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
}

export interface AnswerEvaluation {
  score: number;
  feedback: string;
  suggestions: string[];
}

class GeminiService {
  private genAI: GoogleGenAI;

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }

  async generateQuestions(content: string, documentName: string): Promise<GeneratedQuestion[]> {
    try {
      console.log('Using Gemini API Key:', process.env.GEMINI_API_KEY?.substring(0, 15) + '...');
      
      const prompt = `You are an expert educator who generates study questions from academic content. 
Create diverse, thoughtful questions that test understanding, application, and analysis.
Return your response as a JSON array of questions with the following structure:
{
  "questions": [
    {
      "question": "The actual question text",
      "expectedAnswer": "A comprehensive expected answer",
      "difficulty": "easy|medium|hard",
      "category": "Subject area or topic"
    }
  ]
}

Generate 8-12 study questions from this document: "${documentName}"

Content:
${content.slice(0, 8000)}`;

      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    expectedAnswer: { type: "string" },
                    difficulty: { type: "string" },
                    category: { type: "string" },
                  },
                  required: ["question", "expectedAnswer", "difficulty", "category"],
                },
              },
            },
            required: ["questions"],
          },
        },
        contents: prompt,
      });

      const result = JSON.parse(response.text || '{"questions": []}');
      return result.questions || [];
    } catch (error) {
      console.error('Error generating questions with Gemini:', error);
      return [];
    }
  }

  async evaluateAnswer(question: string, expectedAnswer: string, userAnswer: string): Promise<AnswerEvaluation> {
    try {
      const prompt = `You are an expert educator who evaluates student answers. 
Compare the student's answer to the expected answer and provide:
1. A score from 0-100 based on accuracy, completeness, and understanding
2. Constructive feedback explaining the score
3. Suggestions for improvement

Be encouraging but honest. Focus on what the student got right and how they can improve.

Return your response as JSON:
{
  "score": number,
  "feedback": "Detailed explanation of the score",
  "suggestions": ["suggestion1", "suggestion2"]
}

Question: ${question}

Expected Answer: ${expectedAnswer}

Student Answer: ${userAnswer}`;

      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              score: { type: "number" },
              feedback: { type: "string" },
              suggestions: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["score", "feedback", "suggestions"],
          },
        },
        contents: prompt,
      });

      const result = JSON.parse(response.text || '{"score": 0, "feedback": "", "suggestions": []}');
      return {
        score: Math.max(0, Math.min(100, result.score)),
        feedback: result.feedback || 'No feedback available',
        suggestions: result.suggestions || [],
      };
    } catch (error) {
      console.error('Error evaluating answer with Gemini:', error);
      return {
        score: 0,
        feedback: 'Error evaluating answer. Please try again.',
        suggestions: [],
      };
    }
  }

  async summarizeDocument(content: string): Promise<string> {
    try {
      const prompt = `You are an expert at summarizing academic content. Provide a concise but comprehensive summary that captures the key points and main themes.

Summarize this document content:

${content.slice(0, 8000)}`;

      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return response.text || 'Unable to generate summary';
    } catch (error) {
      console.error('Error summarizing document with Gemini:', error);
      return 'Error generating summary';
    }
  }
}

export const geminiService = new GeminiService();