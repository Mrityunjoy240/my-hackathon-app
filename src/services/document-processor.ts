import * as pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';

/**
 * Service to extract text from various file formats.
 */
export class DocumentProcessor {
  /**
   * Processes a PDF file buffer and returns text.
   */
  async processPDF(buffer: Buffer): Promise<string> {
    try {
      // @ts-ignore - pdf-parse typing is often problematic in ESM/TS environments
      const data = await pdf(buffer);
      return data.text || '';
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF document.');
    }
  }

  /**
   * Processes a DOCX file buffer and returns text.
   */
  async processDOCX(buffer: Buffer): Promise<string> {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    } catch (error) {
      console.error('Error parsing DOCX:', error);
      throw new Error('Failed to parse DOCX document.');
    }
  }

  /**
   * Processes an Excel file buffer and returns text.
   * Formats it in a way that's clear for LLM context.
   */
  async processExcel(buffer: Buffer): Promise<string> {
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let text = '';

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        text += `[Sheet: ${sheetName}]\n`;
        // CSV is a clean format for LLMs to understand tabular data
        text += xlsx.utils.sheet_to_csv(sheet);
        text += '\n\n';
      });

      return text;
    } catch (error) {
      console.error('Error parsing Excel:', error);
      throw new Error('Failed to parse Excel/CSV document.');
    }
  }

  /**
   * Generic handler to extract text based on file type.
   */
  async extractText(buffer: Buffer, filename: string): Promise<string> {
    const extension = filename.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'pdf':
        return this.processPDF(buffer);
      case 'docx':
        return this.processDOCX(buffer);
      case 'xlsx':
      case 'xls':
      case 'csv':
        return this.processExcel(buffer);
      case 'txt':
        return buffer.toString('utf-8');
      default:
        throw new Error(`Unsupported file type: .${extension}`);
    }
  }
}

export const documentProcessor = new DocumentProcessor();
