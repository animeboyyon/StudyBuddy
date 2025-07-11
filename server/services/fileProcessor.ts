import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';
import * as mammoth from 'mammoth';

interface MammothResult {
  value: string;
  messages: any[];
}

class FileProcessor {
  async processFile(filePath: string, mimeType: string): Promise<string> {
    try {
      if (mimeType === 'application/pdf') {
        return await this.processPDF(filePath);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await this.processDOCX(filePath);
      } else {
        throw new Error('Unsupported file type');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;
    }
  }

  private async processPDF(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  private async processDOCX(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      return result.value;
    } catch (error) {
      console.error('Error processing DOCX:', error);
      throw error;
    }
  }

  async extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === 'application/pdf') {
        const data = await pdf(buffer);
        return data.text;
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } else {
        throw new Error('Unsupported file type');
      }
    } catch (error) {
      console.error('Error extracting text from buffer:', error);
      throw error;
    }
  }

  validateFile(fileName: string, fileSize: number, mimeType: string): boolean {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const maxSize = 1024 * 1024 * 1024; // 1GB
    
    return allowedTypes.includes(mimeType) && fileSize <= maxSize;
  }

  getFileInfo(fileName: string, mimeType: string): { extension: string; type: string } {
    const extension = path.extname(fileName).toLowerCase();
    let type = 'unknown';
    
    if (mimeType === 'application/pdf') {
      type = 'pdf';
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      type = 'docx';
    }
    
    return { extension, type };
  }
}

export const fileProcessor = new FileProcessor();
