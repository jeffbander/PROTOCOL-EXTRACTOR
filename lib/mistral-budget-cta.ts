/**
 * Mistral OCR extraction library for Budget and CTA (Clinical Trial Agreement) documents
 * Extracts payment information, procedures, and reimbursement details
 */

import { Mistral } from '@mistralai/mistralai';
import { extractTextWithOCR } from './mistral-ocr';

// ============================================
// BUDGET DATA TYPES
// ============================================

// Individual procedure/service with its payment
export interface ProcedurePayment {
  procedure_name: string;         // Name of the procedure/service
  payment_amount: number;         // Payment amount for this procedure
  currency: string;               // Currency (USD, EUR, etc.)
  per_patient: boolean;           // Is this per patient or one-time?
  visit_associated?: string;      // Which visit this is associated with (if any)
  notes?: string;                 // Additional notes
}

// Visit-based payment structure
export interface VisitPayment {
  visit_name: string;             // e.g., "Screening Visit", "Week 4", "End of Study"
  visit_number?: number;          // Visit sequence number
  total_payment: number;          // Total payment for this visit
  currency: string;
  procedures_included: string[];  // List of procedures included in this visit payment
}

// Milestone/lump sum payments
export interface MilestonePayment {
  milestone_name: string;         // e.g., "First Patient Enrolled", "Study Completion"
  payment_amount: number;
  currency: string;
  trigger_condition: string;      // What triggers this payment
}

// Payment schedule/terms
export interface PaymentTerms {
  payment_frequency?: string;     // How often payments are made (monthly, quarterly, per visit)
  invoice_process?: string;       // How to submit invoices
  payment_timeline?: string;      // How long until payment after invoice (e.g., "Net 30")
  holdback_percentage?: number;   // Any holdback amount
  holdback_conditions?: string;   // When holdback is released
}

// Full budget data structure
export interface BudgetData {
  // Summary information
  total_budget?: number;
  currency: string;
  budget_type?: string;           // "per-patient", "fixed", "hybrid"

  // Per-patient budget breakdown
  per_patient_total?: number;     // Total payment per patient completing study
  screen_failure_payment?: number; // Payment for screen failures
  early_termination_payment?: number; // Payment for early terminations

  // Detailed breakdowns
  procedure_payments: ProcedurePayment[];
  visit_payments: VisitPayment[];
  milestone_payments: MilestonePayment[];

  // Administrative costs
  startup_costs?: number;         // Site initiation/startup fees
  annual_maintenance?: number;    // Annual maintenance fees
  closeout_costs?: number;        // Study closeout fees

  // Payment terms
  payment_terms: PaymentTerms;

  // Additional costs that may be reimbursed
  pass_through_costs?: string[];  // Items that can be invoiced separately (lab fees, etc.)

  // Raw notes or important items extracted
  important_notes?: string[];
}

// ============================================
// CTA DATA TYPES
// ============================================

// Payment-related CTA terms
export interface CTAPaymentInfo {
  payment_method?: string;        // Wire, check, ACH, etc.
  payment_currency: string;
  billing_address?: string;
  payment_contact?: string;       // Who to contact about payments
  tax_requirements?: string;      // W-9, tax documentation needed
}

// Key dates and deadlines
export interface CTATimeline {
  agreement_effective_date?: string;
  study_start_date?: string;
  estimated_end_date?: string;
  invoice_submission_deadline?: string;  // When invoices must be submitted by
}

// Full CTA data structure (payment-focused, no legal jargon)
export interface CTAData {
  // Document identification
  document_title?: string;
  agreement_number?: string;
  sponsor_name: string;
  site_name?: string;

  // Payment information
  payment_info: CTAPaymentInfo;

  // Budget reference
  references_budget_amendment?: string;  // Which budget version this CTA references

  // Timeline
  timeline: CTATimeline;

  // Payment process
  invoice_requirements?: string[];  // What must be included in invoices
  invoice_submission_method?: string;  // Email, portal, mail
  invoice_submission_address?: string;

  // Important payment-related terms (simplified)
  payment_hold_conditions?: string[];  // What can cause payment delays
  audit_requirements?: string;  // Payment audit info

  // Key contacts
  sponsor_contact_name?: string;
  sponsor_contact_email?: string;
  financial_contact_name?: string;
  financial_contact_email?: string;

  // Important notes
  important_notes?: string[];
}

// ============================================
// EXTRACTION RESULTS
// ============================================

interface BudgetExtractionResult {
  data?: BudgetData;
  rawText?: string;
  method: 'mistral_ocr' | 'mistral_chat' | 'error';
  error?: string;
}

interface CTAExtractionResult {
  data?: CTAData;
  rawText?: string;
  method: 'mistral_ocr' | 'mistral_chat' | 'error';
  error?: string;
}

// ============================================
// BUDGET EXTRACTION
// ============================================

/**
 * Extract structured budget data using Mistral chat completion
 */
export async function extractBudgetData(documentText: string): Promise<BudgetExtractionResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { method: 'error', error: 'MISTRAL_API_KEY not configured' };
  }

  const client = new Mistral({ apiKey });

  const systemPrompt = `You are a clinical trial budget extraction expert. Extract payment and reimbursement information from budget documents.

FOCUS ON:
- How much the site gets paid
- What they get paid FOR (specific procedures, visits, milestones)
- When and how payments are made
- Any per-patient amounts

DO NOT include:
- Legal terminology or contract language
- Indemnification or liability clauses
- Regulatory compliance language

IMPORTANT RULES:
- Extract ALL payment amounts found with their associated procedure/service
- Identify visit-based payment structures
- Note any milestone or lump-sum payments
- Capture screen failure and early termination payments
- Extract payment timing and invoice requirements
- Use USD as default currency if not specified
- Return ONLY valid JSON, no markdown formatting`;

  const userPrompt = `Extract all payment and reimbursement information from this clinical trial budget document. Focus on practical payment details.

## REQUIRED OUTPUT FORMAT (JSON):

{
  "total_budget": null,
  "currency": "USD",
  "budget_type": "per-patient or fixed or hybrid",

  "per_patient_total": null,
  "screen_failure_payment": null,
  "early_termination_payment": null,

  "procedure_payments": [
    {
      "procedure_name": "Name of procedure/test/service",
      "payment_amount": 0,
      "currency": "USD",
      "per_patient": true,
      "visit_associated": "Visit name if applicable",
      "notes": "Any relevant notes"
    }
  ],

  "visit_payments": [
    {
      "visit_name": "Screening Visit",
      "visit_number": 1,
      "total_payment": 0,
      "currency": "USD",
      "procedures_included": ["List of procedures included"]
    }
  ],

  "milestone_payments": [
    {
      "milestone_name": "First Patient Enrolled",
      "payment_amount": 0,
      "currency": "USD",
      "trigger_condition": "What triggers this payment"
    }
  ],

  "startup_costs": null,
  "annual_maintenance": null,
  "closeout_costs": null,

  "payment_terms": {
    "payment_frequency": "Monthly, quarterly, per visit, etc.",
    "invoice_process": "How to submit invoices",
    "payment_timeline": "Net 30, Net 45, etc.",
    "holdback_percentage": null,
    "holdback_conditions": "When holdback is released"
  },

  "pass_through_costs": ["Items that can be billed separately"],

  "important_notes": ["Any critical payment-related information"]
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
    const cleaned = cleanJsonResponse(resultText);

    let rawData;
    try {
      rawData = JSON.parse(cleaned);
    } catch (parseError: any) {
      console.error('Budget JSON parse error, attempting repair:', parseError.message);
      // Try more aggressive cleaning
      const repaired = cleaned
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
        .replace(/'/g, '"')      // Replace single quotes with double
        .replace(/(\w+):/g, '"$1":') // Quote unquoted keys
        .replace(/""+/g, '"');   // Fix double quotes
      rawData = JSON.parse(repaired);
    }

    // Build structured BudgetData with defaults
    const data: BudgetData = {
      total_budget: rawData.total_budget || undefined,
      currency: rawData.currency || 'USD',
      budget_type: rawData.budget_type || undefined,

      per_patient_total: rawData.per_patient_total || undefined,
      screen_failure_payment: rawData.screen_failure_payment || undefined,
      early_termination_payment: rawData.early_termination_payment || undefined,

      procedure_payments: ensureProcedurePayments(rawData.procedure_payments),
      visit_payments: ensureVisitPayments(rawData.visit_payments),
      milestone_payments: ensureMilestonePayments(rawData.milestone_payments),

      startup_costs: rawData.startup_costs || undefined,
      annual_maintenance: rawData.annual_maintenance || undefined,
      closeout_costs: rawData.closeout_costs || undefined,

      payment_terms: rawData.payment_terms || {},
      pass_through_costs: Array.isArray(rawData.pass_through_costs) ? rawData.pass_through_costs : [],
      important_notes: Array.isArray(rawData.important_notes) ? rawData.important_notes : [],
    };

    return {
      data,
      rawText: documentText,
      method: 'mistral_chat'
    };
  } catch (error: any) {
    console.error('Budget extraction error:', error);
    return {
      method: 'error',
      error: error.message || 'Failed to extract budget data',
      rawText: documentText
    };
  }
}

/**
 * Full budget extraction pipeline: OCR -> Structured Extraction
 */
export async function extractBudget(pdfBase64: string): Promise<BudgetExtractionResult> {
  // Step 1: Extract text using OCR
  console.log('Step 1: Extracting text with Mistral OCR (Budget)...');
  const ocrResult = await extractTextWithOCR(pdfBase64);

  if (ocrResult.error || !ocrResult.text.trim()) {
    return {
      method: 'error',
      error: ocrResult.error || 'No text could be extracted from the document'
    };
  }

  console.log(`OCR extracted ${ocrResult.text.length} characters from budget document`);

  // Step 2: Extract structured data
  console.log('Step 2: Extracting structured budget data...');
  return await extractBudgetData(ocrResult.text);
}

// ============================================
// CTA EXTRACTION
// ============================================

/**
 * Extract structured CTA data using Mistral chat completion
 */
export async function extractCTAData(documentText: string): Promise<CTAExtractionResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { method: 'error', error: 'MISTRAL_API_KEY not configured' };
  }

  const client = new Mistral({ apiKey });

  const systemPrompt = `You are a clinical trial agreement extraction expert. Extract ONLY payment-related and practical administrative information from CTA documents.

FOCUS ON:
- Payment methods and processes
- Invoice requirements and submission details
- Key contacts for payment inquiries
- Important dates and timelines
- What budget/payment schedule is referenced

DO NOT include:
- Legal terminology or contract clauses
- Indemnification language
- Liability provisions
- Regulatory compliance clauses
- Confidentiality provisions

Keep everything practical and focused on "how do I get paid" information.
Return ONLY valid JSON, no markdown formatting`;

  const userPrompt = `Extract payment-related and administrative information from this Clinical Trial Agreement. Focus on practical details about how payments work.

## REQUIRED OUTPUT FORMAT (JSON):

{
  "document_title": "Title of the agreement",
  "agreement_number": "Agreement/contract number",
  "sponsor_name": "Sponsor organization name",
  "site_name": "Institution/site name",

  "payment_info": {
    "payment_method": "Wire, ACH, check, etc.",
    "payment_currency": "USD",
    "billing_address": "Where to send invoices",
    "payment_contact": "Contact for payment questions",
    "tax_requirements": "W-9 or other tax docs needed"
  },

  "references_budget_amendment": "Which budget version this references",

  "timeline": {
    "agreement_effective_date": "When agreement starts",
    "study_start_date": "Study start date if mentioned",
    "estimated_end_date": "Estimated completion",
    "invoice_submission_deadline": "When invoices must be submitted"
  },

  "invoice_requirements": ["What must be on invoices", "PO numbers", "Study reference", "etc"],
  "invoice_submission_method": "Email, portal, mail",
  "invoice_submission_address": "Email or physical address for invoices",

  "payment_hold_conditions": ["What can delay payments"],
  "audit_requirements": "Payment audit information",

  "sponsor_contact_name": "Main sponsor contact",
  "sponsor_contact_email": "Contact email",
  "financial_contact_name": "Finance/payment contact",
  "financial_contact_email": "Finance contact email",

  "important_notes": ["Key payment-related information to remember"]
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
    const cleaned = cleanJsonResponse(resultText);

    let rawData;
    try {
      rawData = JSON.parse(cleaned);
    } catch (parseError: any) {
      console.error('CTA JSON parse error, attempting repair:', parseError.message);
      // Try more aggressive cleaning
      const repaired = cleaned
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
        .replace(/'/g, '"')      // Replace single quotes with double
        .replace(/(\w+):/g, '"$1":') // Quote unquoted keys
        .replace(/""+/g, '"');   // Fix double quotes
      rawData = JSON.parse(repaired);
    }

    // Build structured CTAData with defaults
    const data: CTAData = {
      document_title: rawData.document_title || undefined,
      agreement_number: rawData.agreement_number || undefined,
      sponsor_name: rawData.sponsor_name || 'Unknown Sponsor',
      site_name: rawData.site_name || undefined,

      payment_info: {
        payment_method: rawData.payment_info?.payment_method || undefined,
        payment_currency: rawData.payment_info?.payment_currency || 'USD',
        billing_address: rawData.payment_info?.billing_address || undefined,
        payment_contact: rawData.payment_info?.payment_contact || undefined,
        tax_requirements: rawData.payment_info?.tax_requirements || undefined,
      },

      references_budget_amendment: typeof rawData.references_budget_amendment === 'string' ? rawData.references_budget_amendment : undefined,

      timeline: {
        agreement_effective_date: rawData.timeline?.agreement_effective_date || undefined,
        study_start_date: rawData.timeline?.study_start_date || undefined,
        estimated_end_date: rawData.timeline?.estimated_end_date || undefined,
        invoice_submission_deadline: rawData.timeline?.invoice_submission_deadline || undefined,
      },

      invoice_requirements: Array.isArray(rawData.invoice_requirements) ? rawData.invoice_requirements : [],
      invoice_submission_method: rawData.invoice_submission_method || undefined,
      invoice_submission_address: rawData.invoice_submission_address || undefined,

      payment_hold_conditions: Array.isArray(rawData.payment_hold_conditions) ? rawData.payment_hold_conditions : [],
      audit_requirements: rawData.audit_requirements || undefined,

      sponsor_contact_name: rawData.sponsor_contact_name || undefined,
      sponsor_contact_email: rawData.sponsor_contact_email || undefined,
      financial_contact_name: rawData.financial_contact_name || undefined,
      financial_contact_email: rawData.financial_contact_email || undefined,

      important_notes: Array.isArray(rawData.important_notes) ? rawData.important_notes : [],
    };

    return {
      data,
      rawText: documentText,
      method: 'mistral_chat'
    };
  } catch (error: any) {
    console.error('CTA extraction error:', error);
    return {
      method: 'error',
      error: error.message || 'Failed to extract CTA data',
      rawText: documentText
    };
  }
}

/**
 * Full CTA extraction pipeline: OCR -> Structured Extraction
 */
export async function extractCTA(pdfBase64: string): Promise<CTAExtractionResult> {
  // Step 1: Extract text using OCR
  console.log('Step 1: Extracting text with Mistral OCR (CTA)...');
  const ocrResult = await extractTextWithOCR(pdfBase64);

  if (ocrResult.error || !ocrResult.text.trim()) {
    return {
      method: 'error',
      error: ocrResult.error || 'No text could be extracted from the document'
    };
  }

  console.log(`OCR extracted ${ocrResult.text.length} characters from CTA document`);

  // Step 2: Extract structured data
  console.log('Step 2: Extracting structured CTA data...');
  return await extractCTAData(ocrResult.text);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Clean markdown/formatting from JSON response and fix common escape issues
 */
function cleanJsonResponse(response: string): string {
  // Remove markdown code blocks
  let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  // Try to find JSON object in response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  // Fix common JSON escape issues that Mistral sometimes produces
  // Replace invalid escape sequences (like \_ or \# or unescaped control chars)
  cleaned = cleaned
    // Fix invalid backslash escapes - replace \X with X for non-standard escapes
    .replace(/\\([^"\\\/bfnrtu])/g, '$1')
    // Remove control characters that break JSON parsing
    .replace(/[\x00-\x1F\x7F]/g, (char) => {
      // Keep valid whitespace
      if (char === '\n' || char === '\r' || char === '\t') {
        return char;
      }
      return ' ';
    })
    // Fix unescaped newlines inside strings (common issue)
    .replace(/(?<!\\)\\n(?=[^"]*"[,}\]])/g, '\\n');

  return cleaned.trim();
}

/**
 * Ensure procedure payments array is valid
 */
function ensureProcedurePayments(value: any): ProcedurePayment[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    procedure_name: item.procedure_name || 'Unknown Procedure',
    payment_amount: parseFloat(item.payment_amount) || 0,
    currency: item.currency || 'USD',
    per_patient: item.per_patient !== false,
    visit_associated: item.visit_associated || undefined,
    notes: item.notes || undefined,
  })).filter(p => p.procedure_name && p.payment_amount > 0);
}

/**
 * Ensure visit payments array is valid
 */
function ensureVisitPayments(value: any): VisitPayment[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    visit_name: item.visit_name || 'Unknown Visit',
    visit_number: parseInt(item.visit_number) || undefined,
    total_payment: parseFloat(item.total_payment) || 0,
    currency: item.currency || 'USD',
    procedures_included: Array.isArray(item.procedures_included) ? item.procedures_included : [],
  })).filter(v => v.visit_name && v.total_payment > 0);
}

/**
 * Ensure milestone payments array is valid
 */
function ensureMilestonePayments(value: any): MilestonePayment[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    milestone_name: item.milestone_name || 'Unknown Milestone',
    payment_amount: parseFloat(item.payment_amount) || 0,
    currency: item.currency || 'USD',
    trigger_condition: item.trigger_condition || '',
  })).filter(m => m.milestone_name && m.payment_amount > 0);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number | undefined, currency: string = 'USD'): string {
  if (amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}
