import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { createRequire } from 'node:module';

let customRequire: any = null;
try {
  if (typeof require === 'function') {
    customRequire = require;
  } else if (typeof import.meta !== 'undefined' && import.meta?.url) {
    customRequire = createRequire(import.meta.url);
  }
} catch {
  // ignore
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
  /**
   * Universal document parser and chunker supporting PDFs, Office docs, spreadsheets,
   * markdown, plain text, code, config files, and any document format.
   */
  static async parseFile(
    fileBuffer: Buffer,
    filename: string,
    fileType: string
  ): Promise<{ rawText: string; chunks: ParsedChunk[] }> {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    let rawText = '';
    let extractedChunks: ParsedChunk[] = [];

    switch (ext) {
      // -------------------------------------------------------------
      // PDF Documents (Page-aware chunking with metadata)
      // -------------------------------------------------------------
      case 'pdf': {
        try {
          // 1. First priority: Direct ESM import class PDFParse
          if (typeof PDFParse === 'function') {
            const parser = new PDFParse({ data: fileBuffer });
            const result = await parser.getText();
            rawText = result.text || '';

            if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
              result.pages.forEach((page: { text?: string; num?: number }, idx: number) => {
                const pageNum = page.num || idx + 1;
                const pageContent = (page.text || '').trim();

                if (pageContent) {
                  const pageChunks = this.splitTextIntoChunks(pageContent, 800, 150);
                  pageChunks.forEach((chunkText, chunkIdx) => {
                    extractedChunks.push({
                      content: chunkText,
                      metadata: {
                        page: pageNum,
                        section: `Page ${pageNum} (Part ${chunkIdx + 1})`,
                      },
                    });
                  });
                }
              });
            }

            // If pages didn't populate chunks but rawText exists, chunk rawText directly
            if (extractedChunks.length === 0 && rawText.trim().length > 0) {
              const cleanText = rawText.replace(/\s{2,}/g, ' ').trim();
              const chunks = this.splitTextIntoChunks(cleanText, 800, 150);
              chunks.forEach((chunkText, chunkIdx) => {
                extractedChunks.push({
                  content: chunkText,
                  metadata: {
                    page: Math.floor(chunkIdx / 2) + 1,
                    section: `Page ${Math.floor(chunkIdx / 2) + 1}`,
                  },
                });
              });
            }

            if (typeof parser.destroy === 'function') {
              await parser.destroy();
            }
          } else {
            // 2. Safe dynamic fallback via createRequire
            let pdfPkg: any;
            try {
              pdfPkg = customRequire('pdf-parse');
            } catch {
              // ignore require failure
            }

            if (pdfPkg && typeof pdfPkg.PDFParse === 'function') {
              const parser = new pdfPkg.PDFParse({ data: fileBuffer });
              const result = await parser.getText();
              rawText = result.text || '';

              if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
                result.pages.forEach((page: { text?: string; num?: number }, idx: number) => {
                  const pageNum = page.num || idx + 1;
                  const pageContent = (page.text || '').trim();

                  if (pageContent) {
                    const pageChunks = this.splitTextIntoChunks(pageContent, 800, 150);
                    pageChunks.forEach((chunkText, chunkIdx) => {
                      extractedChunks.push({
                        content: chunkText,
                        metadata: {
                          page: pageNum,
                          section: `Page ${pageNum} (Part ${chunkIdx + 1})`,
                        },
                      });
                    });
                  }
                });
              }

              if (extractedChunks.length === 0 && rawText.trim().length > 0) {
                const cleanText = rawText.replace(/\s{2,}/g, ' ').trim();
                const chunks = this.splitTextIntoChunks(cleanText, 800, 150);
                chunks.forEach((chunkText, chunkIdx) => {
                  extractedChunks.push({
                    content: chunkText,
                    metadata: {
                      page: Math.floor(chunkIdx / 2) + 1,
                      section: `Page ${Math.floor(chunkIdx / 2) + 1}`,
                    },
                  });
                });
              }

              if (typeof parser.destroy === 'function') {
                await parser.destroy();
              }
            } else if (typeof pdfPkg === 'function') {
              const result = await pdfPkg(fileBuffer);
              rawText = result.text || '';
              const chunks = this.splitTextIntoChunks(rawText, 850, 150);
              chunks.forEach((c, idx) => {
                extractedChunks.push({
                  content: c,
                  metadata: {
                    page: Math.floor(idx / 2) + 1,
                    section: `PDF Section ${idx + 1}`,
                  },
                });
              });
            }
          }
        } catch (pdfErr) {
          console.warn('[PDF Parser] Standard PDFParse failed:', pdfErr);
        }

        // Clean text fallback only for real text streams, never binary dump
        if (extractedChunks.length === 0) {
          const rawStr = fileBuffer.toString('latin1');
          const tjMatches = rawStr.match(/\(([^)]{3,})\)\s*Tj/g) || [];
          const words = tjMatches
            .map((m) => m.replace(/[()]/g, '').trim())
            .filter((w) => /[a-zA-Z]{3,}/.test(w) && !/obj|endobj|stream|Font|Subtype|XObject|FlateDecode/i.test(w));

          if (words.length > 25) {
            const reconstructed = words.join(' ');
            rawText = reconstructed;
            const fallbackChunks = this.splitTextIntoChunks(reconstructed, 800, 150);
            fallbackChunks.forEach((c, idx) => {
              extractedChunks.push({
                content: c,
                metadata: {
                  page: Math.floor(idx / 2) + 1,
                  section: `Extracted Text ${idx + 1}`,
                },
              });
            });
          }
        }

        if (extractedChunks.length === 0) {
          throw new Error(
            'Unable to extract readable text from this PDF. It appears to be an image-only scanned document or protected with custom font encoding. Please upload a PDF with selectable text, or a Word (.docx) / Excel (.xlsx) / Text file.'
          );
        }
        break;
      }

      // -------------------------------------------------------------
      // Microsoft Word (.docx, .doc)
      // -------------------------------------------------------------
      case 'docx':
      case 'doc': {
        try {
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          rawText = result.value || '';
          const docChunks = this.splitTextIntoChunks(rawText, 900, 180);
          docChunks.forEach((c, idx) => {
            extractedChunks.push({
              content: c,
              metadata: { section: `Document Section ${idx + 1}` },
            });
          });
        } catch (docxErr) {
          console.warn('[Docx Parser] mammoth failed, falling back to raw text:', docxErr);
          rawText = fileBuffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
          const chunks = this.splitTextIntoChunks(rawText);
          chunks.forEach((c) => extractedChunks.push({ content: c, metadata: { section: 'Word Document' } }));
        }
        break;
      }

      // -------------------------------------------------------------
      // Tabular Data: Excel (.xlsx, .xls), CSV, TSV
      // -------------------------------------------------------------
      case 'xlsx':
      case 'xls':
      case 'csv':
      case 'tsv': {
        try {
          const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const csvContent = xlsx.utils.sheet_to_csv(sheet);
            rawText += `\n[Sheet: ${sheetName}]\n` + csvContent;

            const lines = csvContent.split('\n').filter((l) => l.trim().length > 0);
            if (lines.length > 0) {
              const header = lines[0];
              const batchSize = 25; // 25 rows per tabular chunk with header repeated

              for (let i = 1; i < lines.length; i += batchSize) {
                const rowBatch = lines.slice(i, i + batchSize);
                const chunkText = `[Sheet: ${sheetName} | Columns: ${header}]\n` + rowBatch.join('\n');
                extractedChunks.push({
                  content: chunkText,
                  metadata: {
                    sheet: sheetName,
                    row_range: `Rows ${i + 1}-${Math.min(i + batchSize, lines.length)}`,
                    section: `Sheet: ${sheetName}`,
                  },
                });
              }

              // If sheet had only headers or 1 row
              if (lines.length <= 1) {
                extractedChunks.push({
                  content: `[Sheet: ${sheetName}]\n${lines.join('\n')}`,
                  metadata: {
                    sheet: sheetName,
                    row_range: 'Row 1',
                    section: `Sheet: ${sheetName}`,
                  },
                });
              }
            }
          });
        } catch (tabErr) {
          console.warn('[Table Parser] xlsx parse failed, falling back to text:', tabErr);
          rawText = fileBuffer.toString('utf-8');
          const chunks = this.splitTextIntoChunks(rawText);
          chunks.forEach((c) => extractedChunks.push({ content: c, metadata: { sheet: 'Sheet1' } }));
        }
        break;
      }

      // -------------------------------------------------------------
      // JSON and JSON Lines (.json, .jsonl)
      // -------------------------------------------------------------
      case 'json':
      case 'jsonl': {
        try {
          const jsonStr = fileBuffer.toString('utf-8');
          if (ext === 'jsonl') {
            const lines = jsonStr.split('\n').filter((l) => l.trim());
            rawText = lines.join('\n');
            const batchSize = 15;
            for (let i = 0; i < lines.length; i += batchSize) {
              const batch = lines.slice(i, i + batchSize).join('\n');
              extractedChunks.push({
                content: batch,
                metadata: {
                  section: `JSON Lines ${i + 1}-${Math.min(i + batchSize, lines.length)}`,
                },
              });
            }
          } else {
            const parsed = JSON.parse(jsonStr);
            rawText = JSON.stringify(parsed, null, 2);

            // If it is an array of records
            if (Array.isArray(parsed)) {
              const batchSize = 10;
              for (let i = 0; i < parsed.length; i += batchSize) {
                const batch = parsed.slice(i, i + batchSize);
                extractedChunks.push({
                  content: JSON.stringify(batch, null, 2),
                  metadata: {
                    section: `JSON Records ${i + 1}-${Math.min(i + batchSize, parsed.length)}`,
                  },
                });
              }
            } else {
              const jsonChunks = this.splitTextIntoChunks(rawText, 850, 150);
              jsonChunks.forEach((c, idx) => {
                extractedChunks.push({
                  content: c,
                  metadata: { section: `JSON Block ${idx + 1}` },
                });
              });
            }
          }
        } catch {
          rawText = fileBuffer.toString('utf-8');
          const fallbackChunks = this.splitTextIntoChunks(rawText);
          fallbackChunks.forEach((c) => extractedChunks.push({ content: c, metadata: { section: 'JSON Data' } }));
        }
        break;
      }

      // -------------------------------------------------------------
      // XML and HTML documents
      // -------------------------------------------------------------
      case 'xml':
      case 'html':
      case 'htm': {
        rawText = fileBuffer.toString('utf-8');
        // Clean script and style tags if HTML
        const stripped = rawText
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();

        const chunks = this.splitTextIntoChunks(stripped || rawText, 850, 150);
        chunks.forEach((c, idx) => {
          extractedChunks.push({
            content: c,
            metadata: { section: `${ext.toUpperCase()} Section ${idx + 1}` },
          });
        });
        break;
      }

      // -------------------------------------------------------------
      // Configuration & Structured Text (.yaml, .yml, .toml, .ini, .env, .properties)
      // -------------------------------------------------------------
      case 'yaml':
      case 'yml':
      case 'toml':
      case 'ini':
      case 'env':
      case 'properties': {
        rawText = fileBuffer.toString('utf-8');
        const configChunks = this.splitTextIntoChunks(rawText, 800, 150);
        configChunks.forEach((c, idx) => {
          extractedChunks.push({
            content: c,
            metadata: { section: `Configuration Block ${idx + 1}` },
          });
        });
        break;
      }

      // -------------------------------------------------------------
      // RTF Content (.rtf)
      // -------------------------------------------------------------
      case 'rtf': {
        const rtfStr = fileBuffer.toString('utf-8');
        rawText = rtfStr.replace(/\\[a-z0-9-]+ ?/gi, ' ').replace(/[{}\\]/g, ' ').replace(/\s{2,}/g, ' ').trim();
        const rtfChunks = this.splitTextIntoChunks(rawText, 900, 180);
        rtfChunks.forEach((c, idx) => {
          extractedChunks.push({
            content: c,
            metadata: { section: `RTF Section ${idx + 1}` },
          });
        });
        break;
      }

      // -------------------------------------------------------------
      // Markdown (.md, .markdown)
      // -------------------------------------------------------------
      case 'md':
      case 'markdown': {
        rawText = fileBuffer.toString('utf-8');
        const sections = rawText.split(/(?=\n#{1,3}\s)/);
        sections.forEach((sec) => {
          const firstLine = sec.trim().split('\n')[0] || '';
          const secTitle = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '') : 'General';
          const secChunks = this.splitTextIntoChunks(sec, 850, 150);
          secChunks.forEach((c) => {
            extractedChunks.push({
              content: c,
              metadata: { section: secTitle },
            });
          });
        });
        break;
      }

      // -------------------------------------------------------------
      // Code & Script Files (.py, .ts, .js, .jsx, .tsx, .sql, .sh, etc.)
      // -------------------------------------------------------------
      case 'py':
      case 'ts':
      case 'js':
      case 'tsx':
      case 'jsx':
      case 'sql':
      case 'sh':
      case 'bash':
      case 'java':
      case 'c':
      case 'cpp':
      case 'cs':
      case 'go':
      case 'rs':
      case 'php':
      case 'rb': {
        rawText = fileBuffer.toString('utf-8');
        const codeChunks = this.splitTextIntoChunks(rawText, 800, 120);
        codeChunks.forEach((c, idx) => {
          extractedChunks.push({
            content: c,
            metadata: { section: `Source Code Block ${idx + 1}` },
          });
        });
        break;
      }

      // -------------------------------------------------------------
      // Plain text, log files, and ANY generic document fallback
      // -------------------------------------------------------------
      case 'txt':
      case 'text':
      case 'log':
      default: {
        try {
          rawText = fileBuffer.toString('utf-8');
        } catch {
          rawText = fileBuffer.toString('latin1');
        }

        // Clean non-printable binary bytes if any
        const cleanedText = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
        const basicChunks = this.splitTextIntoChunks(cleanedText, 900, 180);
        basicChunks.forEach((c, idx) => {
          extractedChunks.push({
            content: c,
            metadata: { section: `Document Chunk ${idx + 1}` },
          });
        });
        break;
      }
    }

    // Safety fallback: if no chunks were generated and text exists
    if (extractedChunks.length === 0 && rawText.trim()) {
      const basicChunks = this.splitTextIntoChunks(rawText, 850, 150);
      extractedChunks = basicChunks.map((c, i) => ({
        content: c,
        metadata: { section: `Chunk ${i + 1}` },
      }));
    }

    return { rawText, chunks: extractedChunks };
  }

  /**
   * Recursive character text splitter implementation
   * Chunk Size: 800-1000 characters
   * Chunk Overlap: 150-200 characters
   */
  static splitTextIntoChunks(text: string, chunkSize = 850, overlap = 150): string[] {
    const cleanText = text.trim();
    if (!cleanText) return [];
    if (cleanText.length <= chunkSize) return [cleanText];

    const chunks: string[] = [];
    const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];

    let startIndex = 0;
    while (startIndex < cleanText.length) {
      let endIndex = Math.min(startIndex + chunkSize, cleanText.length);

      if (endIndex < cleanText.length) {
        // Find best natural split point near boundary
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
      if (chunk.length > 15) {
        chunks.push(chunk);
      }

      startIndex = endIndex - overlap;
      if (startIndex >= cleanText.length - overlap) break;
    }

    return chunks;
  }
}
