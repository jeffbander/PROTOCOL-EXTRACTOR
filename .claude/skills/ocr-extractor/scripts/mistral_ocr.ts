/**
 * Mistral OCR extraction with OpenAI fallback
 * TypeScript implementation for Node.js applications
 */

import { Mistral } from '@mistralai/mistralai';
import OpenAI from 'openai';
import * as fs from 'fs';

interface ExtractionSchema {
  [key: string]: string | string[] | ExtractionSchema;
}

interface ExtractionResult {
  [key: string]: any;
  method?: string;
  error?: string;
}

interface SmartExtractOptions {
  systemPrompt?: string;
  useOcrApi?: boolean;
  enableFallback?: boolean;
  temperature?: number;
}

const PLACEHOLDER_PATTERNS = [
  'john', 'jane', 'doe', 'smith',
  'patient', 'redacted', 'confidential',
  'example', 'sample', 'test'
];

function isPlaceholderName(firstName: string, lastName: string): boolean {
  if (!firstName || !lastName) return false;
  const fullName = `${firstName} ${lastName}`.toLowerCase();
  return PLACEHOLDER_PATTERNS.some(pattern => fullName.includes(pattern));
}

function cleanJsonResponse(response: string): string {
  return response
    .replace(/```json\n?|\n?```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
}

export async function extractWithOcrApi(
  pdfPath: string,
  includeImages: boolean = false
): Promise<ExtractionResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { error: 'MISTRAL_API_KEY environment variable not set' };
  }

  const client = new Mistral({ apiKey });
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfB64 = pdfBuffer.toString('base64');

  try {
    const response = await client.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_base64',
        documentBase64: pdfB64
      },
      includeImageBase64: includeImages
    });

    const text = response.pages.map(p => p.markdown).join('\n\n');
    return { text, method: 'ocr_api' };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function extractWithChatCompletion(
  pdfPath: string,
  schema: ExtractionSchema,
  systemPrompt: string = 'Extract structured data from documents. Return valid JSON only.',
  temperature: number = 0.1
): Promise<ExtractionResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { error: 'MISTRAL_API_KEY environment variable not set' };
  }

  const client = new Mistral({ apiKey });
  
  // For simplicity, using OCR API to get text first
  const ocrResult = await extractWithOcrApi(pdfPath);
  if (ocrResult.error) {
    return ocrResult;
  }

  const userPrompt = `Extract the following fields from this document text.

RETURN ONLY JSON with these exact fields:
${JSON.stringify(schema, null, 2)}

Document text:
${ocrResult.text}`;

  try {
    const response = await client.chat.complete({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      maxTokens: 1000
    });

    const resultText = response.choices?.[0]?.message?.content || '';
    const cleaned = cleanJsonResponse(resultText);
    const extracted = JSON.parse(cleaned);
    extracted.method = 'chat_completion';
    return extracted;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function extractWithOpenAiFallback(
  pdfPath: string,
  schema: ExtractionSchema,
  systemPrompt: string = 'Extract structured data from documents. Return valid JSON only.'
): Promise<ExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: 'OPENAI_API_KEY environment variable not set' };
  }

  const client = new OpenAI({ apiKey });
  
  // Get text via Mistral OCR first
  const ocrResult = await extractWithOcrApi(pdfPath);
  if (ocrResult.error) {
    return ocrResult;
  }

  const userPrompt = `Extract the following fields from this document text.

RETURN ONLY JSON with these exact fields:
${JSON.stringify(schema, null, 2)}

Document text:
${ocrResult.text}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });

    const resultText = response.choices[0]?.message?.content || '';
    const cleaned = cleanJsonResponse(resultText);
    const extracted = JSON.parse(cleaned);
    extracted.method = 'openai_fallback';
    return extracted;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function smartExtract(
  pdfPath: string,
  schema: ExtractionSchema,
  options: SmartExtractOptions = {}
): Promise<ExtractionResult> {
  const {
    systemPrompt = 'Extract structured data from documents. Return valid JSON only.',
    useOcrApi = false,
    enableFallback = true,
    temperature = 0.1
  } = options;

  if (useOcrApi) {
    const result = await extractWithOcrApi(pdfPath);
    if (!result.error) return result;
    console.error(`OCR API failed: ${result.error}`);
  }

  const result = await extractWithChatCompletion(pdfPath, schema, systemPrompt, temperature);

  if (result.error) {
    console.error(`Mistral extraction failed: ${result.error}`);
    if (enableFallback) {
      console.error('Attempting OpenAI fallback...');
      return extractWithOpenAiFallback(pdfPath, schema, systemPrompt);
    }
    return result;
  }

  // Check for placeholder names
  if (enableFallback) {
    const firstName = result.patient_first_name || result.first_name || '';
    const lastName = result.patient_last_name || result.last_name || '';
    
    if (firstName && lastName && isPlaceholderName(firstName, lastName)) {
      console.error('Detected placeholder names, attempting OpenAI fallback...');
      return extractWithOpenAiFallback(pdfPath, schema, systemPrompt);
    }
  }

  return result;
}

export default { smartExtract, extractWithOcrApi, extractWithChatCompletion, extractWithOpenAiFallback };
