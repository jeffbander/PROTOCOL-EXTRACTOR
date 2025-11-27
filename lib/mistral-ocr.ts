/**
 * Mistral OCR extraction library for Protocol Extractor
 * Uses Mistral's dedicated OCR API for superior document processing
 */

import { Mistral } from '@mistralai/mistralai';

interface ProtocolData {
  name: string;
  phase: string;
  indication: string;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  visit_schedule: string[];
  target_enrollment: number;
}

interface ExtractionResult {
  data?: ProtocolData;
  rawText?: string;
  method: 'mistral_ocr' | 'mistral_chat' | 'error';
  error?: string;
}

/**
 * Extract text from PDF using Mistral OCR API
 * Uses file upload method for PDF documents
 */
export async function extractTextWithOCR(pdfBase64: string): Promise<{ text: string; error?: string }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { text: '', error: 'MISTRAL_API_KEY not configured' };
  }

  const client = new Mistral({ apiKey });

  try {
    // Convert base64 to buffer for file upload
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Create a Blob from the buffer for upload
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });

    // Upload the file first
    const uploadedFile = await client.files.upload({
      file: {
        fileName: `protocol-${Date.now()}.pdf`,
        content: blob,
      },
      purpose: 'ocr'
    });

    console.log('File uploaded:', uploadedFile.id);

    // Get signed URL for the uploaded file
    const signedUrl = await client.files.getSignedUrl({
      fileId: uploadedFile.id
    });

    // Process with OCR API using the URL
    const response = await client.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        documentUrl: signedUrl.url
      },
      includeImageBase64: false
    });

    // Combine all pages into single text
    const text = response.pages?.map((p: any) => p.markdown).join('\n\n--- PAGE BREAK ---\n\n') || '';

    // Clean up uploaded file
    try {
      await client.files.delete({ fileId: uploadedFile.id });
    } catch (deleteErr) {
      console.warn('Failed to delete uploaded file:', deleteErr);
    }

    if (!text.trim()) {
      return { text: '', error: 'No text extracted from document' };
    }

    return { text };
  } catch (error: any) {
    console.error('Mistral OCR error:', error);
    return { text: '', error: error.message || 'OCR processing failed' };
  }
}

/**
 * Extract structured protocol data using Mistral chat completion
 */
export async function extractProtocolData(documentText: string): Promise<ExtractionResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { method: 'error', error: 'MISTRAL_API_KEY not configured' };
  }

  const client = new Mistral({ apiKey });

  const systemPrompt = `You are a clinical trial protocol extraction expert. Extract structured data from protocol documents with high accuracy.

IMPORTANT:
- Extract ALL inclusion criteria found in the document
- Extract ALL exclusion criteria found in the document
- Extract ALL visits/timepoints from the visit schedule
- If a field is not found, use empty string or empty array
- Return ONLY valid JSON, no markdown formatting or explanation`;

  const userPrompt = `Extract the following information from this clinical trial protocol:

1. Study name/title (full official name)
2. Phase (Phase 1, Phase 2, Phase 3, Phase 4, or combination like "Phase 2/3")
3. Medical condition or indication being studied
4. ALL inclusion criteria (each criterion as a separate array item)
5. ALL exclusion criteria (each criterion as a separate array item)
6. Visit schedule or study timepoints (each visit as a separate array item, e.g., "Screening Visit", "Day 1", "Week 4", etc.)
7. Target enrollment number (as integer, 0 if not specified)

Return the data as JSON with these exact keys:
{
  "name": "",
  "phase": "",
  "indication": "",
  "inclusion_criteria": [],
  "exclusion_criteria": [],
  "visit_schedule": [],
  "target_enrollment": 0
}

DOCUMENT TEXT:
${documentText}`;

  try {
    const response = await client.chat.complete({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      maxTokens: 8000
    });

    const resultText = response.choices?.[0]?.message?.content || '';

    // Clean and parse JSON
    const cleaned = cleanJsonResponse(resultText);
    const data = JSON.parse(cleaned) as ProtocolData;

    // Ensure arrays are actually arrays
    data.inclusion_criteria = ensureArray(data.inclusion_criteria);
    data.exclusion_criteria = ensureArray(data.exclusion_criteria);
    data.visit_schedule = ensureArray(data.visit_schedule);
    data.target_enrollment = parseInt(String(data.target_enrollment)) || 0;

    return {
      data,
      rawText: documentText,
      method: 'mistral_chat'
    };
  } catch (error: any) {
    console.error('Mistral chat extraction error:', error);
    return {
      method: 'error',
      error: error.message || 'Failed to extract protocol data',
      rawText: documentText
    };
  }
}

/**
 * Full extraction pipeline: OCR → Structured Extraction
 */
export async function extractProtocol(pdfBase64: string): Promise<ExtractionResult> {
  // Step 1: Extract text using OCR
  console.log('Step 1: Extracting text with Mistral OCR...');
  const ocrResult = await extractTextWithOCR(pdfBase64);

  if (ocrResult.error || !ocrResult.text.trim()) {
    return {
      method: 'error',
      error: ocrResult.error || 'No text could be extracted from the document'
    };
  }

  console.log(`OCR extracted ${ocrResult.text.length} characters`);

  // Step 2: Extract structured data
  console.log('Step 2: Extracting structured protocol data...');
  const result = await extractProtocolData(ocrResult.text);

  return result;
}

/**
 * Clean markdown/formatting from JSON response
 */
function cleanJsonResponse(response: string): string {
  // Remove markdown code blocks
  let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  // Try to find JSON object in response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return cleaned.trim();
}

/**
 * Ensure value is an array of strings
 */
function ensureArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    // Try to split by common delimiters
    if (value.includes('\n')) {
      return value.split('\n').map(s => s.trim()).filter(Boolean);
    }
    return [value.trim()];
  }
  return [];
}
