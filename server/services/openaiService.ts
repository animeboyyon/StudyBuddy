import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || 'default_key',
});

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

class OpenAIService {
  async generateQuestions(content: string, documentName: string): Promise<GeneratedQuestion[]> {
    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert educator who generates study questions from academic content. 
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
            }`
          },
          {
            role: "user",
            content: `Generate 8-12 study questions from this document: "${documentName}"\n\nContent:\n${content.slice(0, 8000)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"questions": []}');
      return result.questions || [];
    } catch (error) {
      console.error('Error generating questions:', error);
      return [];
    }
  }

  async evaluateAnswer(question: string, expectedAnswer: string, userAnswer: string): Promise<AnswerEvaluation> {
    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert educator who evaluates student answers. 
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
            }`
          },
          {
            role: "user",
            content: `Question: ${question}\n\nExpected Answer: ${expectedAnswer}\n\nStudent Answer: ${userAnswer}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"score": 0, "feedback": "", "suggestions": []}');
      return {
        score: Math.max(0, Math.min(100, result.score)),
        feedback: result.feedback || 'No feedback available',
        suggestions: result.suggestions || [],
      };
    } catch (error) {
      console.error('Error evaluating answer:', error);
      return {
        score: 0,
        feedback: 'Error evaluating answer. Please try again.',
        suggestions: [],
      };
    }
  }

  async summarizeDocument(content: string): Promise<string> {
    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a skilled summarizer. Create a concise summary of the document content, highlighting key concepts and main ideas."
          },
          {
            role: "user",
            content: `Please summarize this document content:\n\n${content.slice(0, 8000)}`
          }
        ],
        max_tokens: 500,
      });

      return response.choices[0].message.content || 'Unable to generate summary';
    } catch (error) {
      console.error('Error summarizing document:', error);
      return 'Error generating summary';
    }
  }
}

export const openaiService = new OpenAIService();
