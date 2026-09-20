import mammoth from 'mammoth';
import * as xlsx from 'xlsx';

// Dynamic or CJS compatible pdf-parse import
// eslint-disable-next-line @typescript-eslint/no-var-requires
let pdfParse: any;
try {
  pdfParse = require('pdf-parse');
  if (pdfParse.default) pdfParse = pdfParse.default;
} catch {
  // ESM fallback
}

export interface ParsedChunk {
  content: string;
  metadata: {
    page?: number | null;
    sheet?: string | null;
    section?: string | null;
    row_range?: string | null;
  };
}

export class DocumentParser {
  static async parseFile(
    fileBuffer: Buffer,
    filename: string,
    fileType: string
  ): Promise<{ rawText: string; chunks: ParsedChunk[] }> {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    let rawText = '';
    let extractedChunks: ParsedChunk[] = [];

    switch (ext) {
      case 'pdf': {
        const data = await pdfParse(fileBuffer);
        rawText = data.text || '';
        // Split text by page markers or paragraph breaks
        const pages = rawText.split(/\f|\n{3,}/);
        pages.forEach((pageText, idx) => {
          if (pageText.trim()) {
            const pageChunks = this.splitTextIntoChunks(pageText);
            pageChunks.forEach((c) => {
              extractedChunks.push({
                content: c,
                metadata: { page: idx + 1 },
              });
            });
          }
        });
        break;
      }

      case 'docx':
      case 'doc': {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        rawText = result.value || '';
        const docChunks = this.splitTextIntoChunks(rawText);
        docChunks.forEach((c) => {
          extractedChunks.push({
            content: c,
            metadata: { section: 'Document Body' },
          });
        });
        break;
      }

      case 'xlsx':
      case 'xls':
      case 'csv': {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const csvContent = xlsx.utils.sheet_to_csv(sheet);
          rawText += `\n[Sheet: ${sheetName}]\n` + csvContent;

          const lines = csvContent.split('\n').filter((l) => l.trim().length > 0);
          const header = lines[0] || '';
          const batchSize = 25; // 25 rows per tabular chunk

          for (let i = 1; i < lines.length; i += batchSize) {
            const rowBatch = lines.slice(i, i + batchSize);
            const chunkText = `[Sheet: ${sheetName} | Header: ${header}]\n` + rowBatch.join('\n');
            extractedChunks.push({
              content: chunkText,
              metadata: {
                sheet: sheetName,
                row_range: `${i + 1}-${Math.min(i + batchSize, lines.length)}`,
              },
            });
          }
        });
        break;
      }

      case 'json': {
        try {
          const jsonStr = fileBuffer.toString('utf-8');
          const parsed = JSON.parse(jsonStr);
          rawText = JSON.stringify(parsed, null, 2);
          const jsonChunks = this.splitTextIntoChunks(rawText);
          jsonChunks.forEach((c) => {
            extractedChunks.push({
              content: c,
              metadata: { section: 'JSON Data' },
            });
          });
        } catch {
          rawText = fileBuffer.toString('utf-8');
          const fallbackChunks = this.splitTextIntoChunks(rawText);
          fallbackChunks.forEach((c) => extractedChunks.push({ content: c, metadata: {} }));
        }
        break;
      }

      case 'xml': {
        rawText = fileBuffer.toString('utf-8');
        // Clean basic XML tags or keep structure
        const xmlChunks = this.splitTextIntoChunks(rawText);
        xmlChunks.forEach((c) => {
          extractedChunks.push({
            content: c,
            metadata: { section: 'XML Node Tree' },
          });
        });
        break;
      }

      case 'rtf': {
        const rtfStr = fileBuffer.toString('utf-8');
        // Strip RTF control words
        rawText = rtfStr.replace(/\\[a-z0-9-]+ ?/gi, '').replace(/[{}\\]/g, '');
        const rtfChunks = this.splitTextIntoChunks(rawText);
        rtfChunks.forEach((c) => {
          extractedChunks.push({
            content: c,
            metadata: { section: 'RTF Content' },
          });
        });
        break;
      }

      case 'md':
      case 'markdown':
      case 'txt':
      default: {
        rawText = fileBuffer.toString('utf-8');
        // Split markdown by headings
        const sections = rawText.split(/(?=\n#{1,3}\s)/);
        sections.forEach((sec) => {
          const firstLine = sec.trim().split('\n')[0] || '';
          const secTitle = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '') : 'General';
          const secChunks = this.splitTextIntoChunks(sec);
          secChunks.forEach((c) => {
            extractedChunks.push({
              content: c,
              metadata: { section: secTitle },
            });
          });
        });
        break;
      }
    }

    // Fallback if no chunks generated
    if (extractedChunks.length === 0 && rawText.trim()) {
      const basicChunks = this.splitTextIntoChunks(rawText);
      extractedChunks = basicChunks.map((c) => ({
        content: c,
        metadata: {},
      }));
    }

    return { rawText, chunks: extractedChunks };
  }

  /**
   * Recursive character text splitter implementation
   * Chunk Size: 1000 characters
   * Chunk Overlap: 200 characters
   */
  static splitTextIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
    const cleanText = text.trim();
    if (!cleanText) return [];
    if (cleanText.length <= chunkSize) return [cleanText];

    const chunks: string[] = [];
    const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];

    let startIndex = 0;
    while (startIndex < cleanText.length) {
      let endIndex = Math.min(startIndex + chunkSize, cleanText.length);

      if (endIndex < cleanText.length) {
        // Find best split point
        let splitPoint = -1;
        for (const sep of separators) {
          const lastIdx = cleanText.lastIndexOf(sep, endIndex);
          if (lastIdx > startIndex + overlap) {
            splitPoint = lastIdx + sep.length;
            break;
          }
        }
        if (splitPoint !== -1) {
          endIndex = splitPoint;
        }
      }

      const chunk = cleanText.substring(startIndex, endIndex).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }

      startIndex = endIndex - overlap;
      if (startIndex >= cleanText.length - overlap) break;
    }

    return chunks;
  }
}
