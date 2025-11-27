/**
 * Test script for Mistral OCR extraction
 * Run with: npx tsx test-extraction.ts <path-to-pdf>
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

import { extractProtocol, extractTextWithOCR } from './lib/mistral-ocr';

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error('Usage: npx tsx test-extraction.ts <path-to-pdf>');
    process.exit(1);
  }

  // Resolve path
  const resolvedPath = path.resolve(pdfPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Protocol Extractor Test');
  console.log('='.repeat(60));
  console.log(`File: ${resolvedPath}`);
  console.log(`Size: ${(fs.statSync(resolvedPath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  // Check API key
  if (!process.env.MISTRAL_API_KEY) {
    console.error('ERROR: MISTRAL_API_KEY not set in .env.local');
    process.exit(1);
  }
  console.log('MISTRAL_API_KEY: configured');
  console.log('');

  // Read and encode PDF
  const pdfBuffer = fs.readFileSync(resolvedPath);
  const base64 = pdfBuffer.toString('base64');

  // Test OCR extraction
  console.log('Step 1: Testing OCR text extraction...');
  console.log('-'.repeat(40));

  const ocrResult = await extractTextWithOCR(base64);

  if (ocrResult.error) {
    console.error('OCR ERROR:', ocrResult.error);
    process.exit(1);
  }

  console.log(`Extracted ${ocrResult.text.length} characters`);
  console.log('');
  console.log('First 500 characters:');
  console.log(ocrResult.text.substring(0, 500));
  console.log('...');
  console.log('');

  // Test full extraction
  console.log('Step 2: Testing protocol data extraction...');
  console.log('-'.repeat(40));

  const result = await extractProtocol(base64);

  if (result.method === 'error') {
    console.error('EXTRACTION ERROR:', result.error);
    process.exit(1);
  }

  console.log('');
  console.log('EXTRACTED DATA:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(result.data, null, 2));
  console.log('');
  console.log('SUMMARY:');
  console.log('-'.repeat(40));
  console.log(`Study Name: ${result.data?.name}`);
  console.log(`Phase: ${result.data?.phase}`);
  console.log(`Indication: ${result.data?.indication}`);
  console.log(`Target Enrollment: ${result.data?.target_enrollment}`);
  console.log(`Inclusion Criteria: ${result.data?.inclusion_criteria.length} items`);
  console.log(`Exclusion Criteria: ${result.data?.exclusion_criteria.length} items`);
  console.log(`Visit Schedule: ${result.data?.visit_schedule.length} visits`);
  console.log('');
  console.log('Test completed successfully!');
}

main().catch(console.error);
