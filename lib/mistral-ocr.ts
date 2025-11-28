/**
 * Mistral OCR extraction library for Protocol Extractor
 * Uses Mistral's dedicated OCR API for superior document processing
 */

import { Mistral } from '@mistralai/mistralai';

// Study status options
export const STUDY_STATUSES = [
  { value: 'pending_irb_submission', label: 'Pending IRB Submission' },
  { value: 'pending_budget_submission', label: 'Pending Budget Submission' },
  { value: 'awaiting_irb_approval', label: 'Awaiting IRB Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'enrolling', label: 'Enrolling' },
  { value: 'follow_up_phase', label: 'Follow-up Phase' },
  { value: 'closed', label: 'Closed' },
] as const;

export type StudyStatus = typeof STUDY_STATUSES[number]['value'];

// Study design structure
export interface StudyDesign {
  type?: string;           // Interventional, Observational
  randomization?: string;  // Randomized, Non-randomized
  blinding?: string;       // Open-label, Single-blind, Double-blind
  allocation_ratio?: string; // e.g., "1:1", "2:1"
}

// Treatment arm structure
export interface StudyArm {
  name: string;
  type?: string;           // experimental, active_comparator, placebo
  intervention?: string;
  dose?: string;
}

// Endpoint structure
export interface StudyEndpoint {
  name: string;
  description?: string;
  timepoint?: string;
  measurement_method?: string;
}

// Investigational product structure
export interface InvestigationalProduct {
  name?: string;
  formulation?: string;
  dose?: string;
  route?: string;
  frequency?: string;
}

// Concomitant medications structure
export interface ConcomitantMedications {
  allowed?: string[];
  prohibited?: string[];
  washout_required?: Array<{ medication: string; washout_period: string }>;
}

// Extended Protocol Data interface
export interface ProtocolData {
  // Basic fields (existing)
  name: string;
  phase: string;
  indication: string;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  visit_schedule: string[];
  target_enrollment: number;

  // Administrative fields (manually entered or extracted)
  gco_number?: string;           // GCO/Protocol number
  protocol_number?: string;      // Official protocol number
  fund_number?: string;          // PI Fund number
  sponsor_name?: string;         // Sponsor organization
  nct_number?: string;           // ClinicalTrials.gov ID

  // Extended study design (extracted)
  study_design?: StudyDesign;
  study_arms?: StudyArm[];
  investigational_product?: InvestigationalProduct;
  treatment_duration?: string;
  comparator_type?: string;

  // Endpoints (extracted)
  primary_endpoints?: StudyEndpoint[];
  secondary_endpoints?: StudyEndpoint[];

  // Medications (extracted)
  concomitant_medications?: ConcomitantMedications;
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

  const systemPrompt = `You are a clinical trial protocol extraction expert. Extract comprehensive structured data from protocol documents with high accuracy.

IMPORTANT RULES:
- Extract ALL inclusion criteria found in the document (each as separate array item)
- Extract ALL exclusion criteria found in the document (each as separate array item)
- Extract ALL visits/timepoints from the visit schedule
- Look for protocol identifiers, sponsor information, and NCT numbers
- Identify study design characteristics (randomization, blinding, arms)
- Extract treatment/drug information if present
- Identify primary and secondary endpoints
- Note any prohibited or allowed concomitant medications
- If a field is not found, use empty string, null, or empty array as appropriate
- Return ONLY valid JSON, no markdown formatting or explanation`;

  const userPrompt = `Extract comprehensive information from this clinical trial protocol. Be thorough and extract ALL available data.

## REQUIRED OUTPUT FORMAT (JSON):

{
  "name": "Full official study title",
  "phase": "Phase 1, Phase 2, Phase 3, Phase 4, Phase 1/2, Phase 2/3, or Feasibility",
  "indication": "Medical condition/disease being studied",
  "target_enrollment": 0,

  "protocol_number": "Official protocol number/identifier from the document",
  "sponsor_name": "Sponsoring organization name",
  "nct_number": "NCT number if mentioned (format: NCT########)",

  "study_design": {
    "type": "Interventional or Observational",
    "randomization": "Randomized or Non-randomized or N/A",
    "blinding": "Open-label, Single-blind, Double-blind, or Triple-blind",
    "allocation_ratio": "e.g., 1:1, 2:1, or null if not specified"
  },

  "study_arms": [
    {
      "name": "Arm/group name",
      "type": "experimental, active_comparator, placebo, or no_intervention",
      "intervention": "Treatment description",
      "dose": "Dosing information if applicable"
    }
  ],

  "investigational_product": {
    "name": "Drug/device name",
    "formulation": "Tablet, injection, etc.",
    "dose": "Dose amount and unit",
    "route": "Oral, IV, SC, IM, etc.",
    "frequency": "Dosing frequency"
  },

  "treatment_duration": "Total treatment period",
  "comparator_type": "Placebo, Active comparator, or None",

  "inclusion_criteria": [
    "Each inclusion criterion as a separate string"
  ],

  "exclusion_criteria": [
    "Each exclusion criterion as a separate string"
  ],

  "primary_endpoints": [
    {
      "name": "Endpoint name",
      "description": "What is being measured",
      "timepoint": "When measured"
    }
  ],

  "secondary_endpoints": [
    {
      "name": "Endpoint name",
      "description": "What is being measured",
      "timepoint": "When measured"
    }
  ],

  "visit_schedule": [
    "Screening Visit",
    "Day 1 / Baseline",
    "Week 2",
    "etc."
  ],

  "concomitant_medications": {
    "allowed": ["List of allowed medications/classes"],
    "prohibited": ["List of prohibited medications/classes"],
    "washout_required": [
      {"medication": "Drug/class name", "washout_period": "Duration"}
    ]
  }
}

## DOCUMENT TEXT TO ANALYZE:

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

    const content = response.choices?.[0]?.message?.content;
    const resultText = typeof content === 'string' ? content : '';

    // Clean and parse JSON
    const cleaned = cleanJsonResponse(resultText);
    const rawData = JSON.parse(cleaned);

    // Build the structured ProtocolData object with proper defaults
    const data: ProtocolData = {
      // Basic fields (required)
      name: rawData.name || '',
      phase: rawData.phase || '',
      indication: rawData.indication || '',
      target_enrollment: parseInt(String(rawData.target_enrollment)) || 0,

      // Arrays (ensure they are arrays)
      inclusion_criteria: ensureArray(rawData.inclusion_criteria),
      exclusion_criteria: ensureArray(rawData.exclusion_criteria),
      visit_schedule: ensureArray(rawData.visit_schedule),

      // Administrative fields (extracted)
      protocol_number: rawData.protocol_number || undefined,
      sponsor_name: rawData.sponsor_name || undefined,
      nct_number: rawData.nct_number || undefined,

      // Study design
      study_design: rawData.study_design || undefined,
      study_arms: Array.isArray(rawData.study_arms) ? rawData.study_arms : undefined,
      investigational_product: rawData.investigational_product || undefined,
      treatment_duration: rawData.treatment_duration || undefined,
      comparator_type: rawData.comparator_type || undefined,

      // Endpoints
      primary_endpoints: Array.isArray(rawData.primary_endpoints) ? rawData.primary_endpoints : undefined,
      secondary_endpoints: Array.isArray(rawData.secondary_endpoints) ? rawData.secondary_endpoints : undefined,

      // Medications
      concomitant_medications: rawData.concomitant_medications || undefined,
    };

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
