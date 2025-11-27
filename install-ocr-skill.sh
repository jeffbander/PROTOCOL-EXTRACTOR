#!/bin/bash
# OCR Extractor Skill Installer for Claude Code
# This skill teaches Claude Code how to implement OCR functionality in apps

set -e

echo "🔧 Installing OCR Extractor Skill for Claude Code..."
echo ""

# Determine installation location
if [ -d ".claude" ]; then
    INSTALL_DIR=".claude/skills/ocr-extractor"
    echo "📁 Installing to project: $INSTALL_DIR"
else
    INSTALL_DIR="$HOME/.claude/skills/ocr-extractor"
    echo "📁 Installing globally: $INSTALL_DIR"
fi

# Create directory structure
mkdir -p "$INSTALL_DIR/scripts"
mkdir -p "$INSTALL_DIR/references"

# =============================================================================
# SKILL.md - Main skill documentation
# =============================================================================
cat > "$INSTALL_DIR/SKILL.md" << 'SKILL_EOF'
---
name: ocr-extractor
description: |
  Implementation guide for adding OCR and document extraction to applications.
  Use this skill when building features that need to: extract text from PDFs,
  process forms (healthcare, financial, legal), parse invoices, or handle
  any document requiring OCR. Provides production-ready code patterns using
  Mistral AI with automatic OpenAI fallback for censored content (PHI).
---

# OCR Extractor Implementation Guide

When building applications that need OCR or document extraction, use this skill to implement robust, production-ready document processing.

## When to Use This Skill

Reference this skill when implementing:
- PDF text extraction features
- Form processing (intake forms, applications, enrollment)
- Invoice/receipt parsing
- Medical/healthcare document processing (with PHI handling)
- Contract or legal document analysis
- Any structured data extraction from documents

## Architecture Decision Guide

### Method Selection

| Use Case | Recommended Method | Why |
|----------|-------------------|-----|
| Full document text | Mistral OCR API | Best accuracy (94.9%), preserves layout |
| Specific field extraction | Mistral Chat Completion | Lower cost, schema-based |
| Healthcare/PHI forms | Chat Completion + OpenAI fallback | Mistral censors PHI |
| Complex tables | Mistral OCR API | Superior table handling |
| High volume batch | Mistral OCR API (batch mode) | 50% cost reduction |

### Cost Comparison (per 1,000 pages)

- Mistral OCR API: $1.00 (batch: $0.50)
- Mistral Chat: ~$3.00
- OpenAI GPT-4 fallback: ~$15.00

## Implementation Patterns

### Pattern 1: Basic Form Extraction

For simple forms where you need specific fields:

```python
from scripts.mistral_ocr import smart_extract

# Define the fields you need
schema = {
    "name": "",
    "date": "",
    "email": "",
    "phone": ""
}

result = smart_extract(
    pdf_path="form.pdf",
    extraction_schema=schema,
    system_prompt="Extract form data. Return only valid JSON."
)

if "error" not in result:
    print(f"Name: {result['name']}")
    print(f"Date: {result['date']}")
```

### Pattern 2: Healthcare Forms (PHI-Safe)

**Critical**: Always enable OpenAI fallback for healthcare documents because Mistral censors PHI.

```python
from scripts.mistral_ocr import smart_extract

# Healthcare-specific schema
schema = {
    "patient_first_name": "",
    "patient_last_name": "",
    "date_of_birth": "",
    "patient_address": "",
    "patient_city": "",
    "patient_state": "",
    "patient_zip": "",
    "patient_phone": "",
    "insurance_id": "",
    "diagnosis_code": "",
    "prescriber_name": "",
    "prescriber_npi": ""
}

result = smart_extract(
    pdf_path="patient_intake.pdf",
    extraction_schema=schema,
    system_prompt="""You are a medical data extraction expert. 
    Extract patient information accurately.
    Return only valid JSON without markdown formatting.
    Include all fields even if empty.""",
    enable_openai_fallback=True  # CRITICAL for PHI
)

# Check which method was used
if result.get("method") == "openai_fallback":
    print("⚠️ Mistral censored PHI, used OpenAI fallback")
```

### Pattern 3: Invoice Processing

```python
schema = {
    "invoice_number": "",
    "invoice_date": "",
    "due_date": "",
    "vendor_name": "",
    "vendor_address": "",
    "subtotal": "",
    "tax": "",
    "total": "",
    "line_items": []  # Array of items
}

result = smart_extract(
    pdf_path="invoice.pdf",
    extraction_schema=schema,
    system_prompt="""Extract invoice details accurately.
    Format dates as YYYY-MM-DD.
    Format currency as numbers without symbols.
    For line_items, extract: description, quantity, unit_price, total."""
)
```

### Pattern 4: Full Document Text (Complex Layouts)

When you need the entire document with layout preserved:

```python
from scripts.mistral_ocr import extract_with_ocr_api

result = extract_with_ocr_api(
    pdf_path="complex_document.pdf",
    include_images=True  # Extract embedded images as base64
)

# Result contains markdown-formatted text preserving structure
full_text = result["text"]
images = result.get("images", [])
```

### Pattern 5: Two-Stage Extraction (Complex Documents)

For documents needing both full text and structured extraction:

```python
from scripts.mistral_ocr import extract_with_ocr_api, extract_with_chat_completion

# Stage 1: Get full text with layout
ocr_result = extract_with_ocr_api("report.pdf")
full_text = ocr_result["text"]

# Stage 2: Extract specific fields
analysis_schema = {
    "title": "",
    "author": "",
    "date": "",
    "summary": "",
    "key_findings": [],
    "recommendations": []
}

structured = extract_with_chat_completion(
    "report.pdf",
    analysis_schema,
    system_prompt="Analyze this document and extract key information."
)
```

### Pattern 6: Batch Processing

For processing multiple documents:

```python
import os
from concurrent.futures import ThreadPoolExecutor
from scripts.mistral_ocr import smart_extract

def process_single_pdf(filepath):
    schema = {"name": "", "date": "", "amount": ""}
    result = smart_extract(filepath, schema)
    result["source_file"] = os.path.basename(filepath)
    return result

# Get all PDFs
pdf_dir = "./uploads"
pdf_files = [os.path.join(pdf_dir, f) for f in os.listdir(pdf_dir) if f.endswith(".pdf")]

# Process in parallel (limit workers to avoid rate limits)
with ThreadPoolExecutor(max_workers=5) as executor:
    results = list(executor.map(process_single_pdf, pdf_files))

# Filter errors
successful = [r for r in results if "error" not in r]
failed = [r for r in results if "error" in r]

print(f"✅ Processed: {len(successful)}")
print(f"❌ Failed: {len(failed)}")
```

## API Integration Patterns

### Express.js/Node.js API Endpoint

```typescript
import express from 'express';
import multer from 'multer';
import { smartExtract } from './lib/mistral_ocr';

const upload = multer({ dest: 'uploads/' });
const app = express();

app.post('/api/extract', upload.single('pdf'), async (req, res) => {
  try {
    const schema = JSON.parse(req.body.schema || '{}');
    
    const result = await smartExtract(req.file.path, schema, {
      systemPrompt: req.body.systemPrompt,
      enableFallback: true
    });
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Next.js API Route

```typescript
// app/api/extract/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { smartExtract } from '@/lib/mistral_ocr';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('pdf') as File;
  const schema = JSON.parse(formData.get('schema') as string || '{}');
  
  // Save temp file
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const tempPath = join('/tmp', `upload-${Date.now()}.pdf`);
  await writeFile(tempPath, buffer);
  
  try {
    const result = await smartExtract(tempPath, schema);
    return NextResponse.json(result);
  } finally {
    await unlink(tempPath);
  }
}
```

### React Upload Component

```tsx
import { useState, useCallback } from 'react';

interface ExtractionResult {
  [key: string]: any;
  method?: string;
  error?: string;
}

export function PDFUploader({ schema, onExtracted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('schema', JSON.stringify(schema));
    
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData
      });
      
      const result: ExtractionResult = await response.json();
      
      if (result.error) {
        setError(result.error);
      } else {
        onExtracted(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [schema, onExtracted]);

  return (
    <div>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        disabled={loading}
      />
      {loading && <p>Processing...</p>}
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
```

## Database Schema Suggestions

When storing extracted data:

```sql
-- Extracted documents table
CREATE TABLE extracted_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT NOT NULL,
  extraction_method TEXT, -- 'chat_completion', 'ocr_api', 'openai_fallback'
  extracted_data JSONB NOT NULL,
  raw_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  status TEXT DEFAULT 'pending' -- 'pending', 'processed', 'failed'
);

-- For Convex
// schema.ts
export default defineSchema({
  extractedDocuments: defineTable({
    originalFilename: v.string(),
    extractionMethod: v.optional(v.string()),
    extractedData: v.any(),
    rawText: v.optional(v.string()),
    status: v.string(),
    processedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),
});
```

## Environment Setup

Required environment variables:

```bash
# Required
MISTRAL_API_KEY=your_mistral_api_key

# Optional (for PHI fallback)
OPENAI_API_KEY=your_openai_api_key
```

Get Mistral key: https://console.mistral.ai/

## Dependencies

**Python:**
```bash
pip install mistralai openai --break-system-packages
```

**Node.js:**
```bash
npm install @mistralai/mistralai openai
```

## Error Handling Best Practices

```python
def safe_extract(pdf_path, schema):
    """Wrapper with comprehensive error handling"""
    try:
        result = smart_extract(pdf_path, schema, enable_openai_fallback=True)
        
        if "error" in result:
            # Log error but return partial data if available
            logger.error(f"Extraction error: {result['error']}")
            return {"success": False, "error": result["error"], "data": None}
        
        # Validate required fields
        missing = [k for k, v in result.items() if k in schema and not v]
        if missing:
            logger.warning(f"Missing fields: {missing}")
        
        return {"success": True, "data": result, "missing_fields": missing}
        
    except FileNotFoundError:
        return {"success": False, "error": "PDF file not found"}
    except Exception as e:
        logger.exception("Unexpected extraction error")
        return {"success": False, "error": str(e)}
```

## Testing Extraction

```python
# test_extraction.py
import json
from scripts.mistral_ocr import smart_extract

def test_basic_extraction():
    schema = {"name": "", "date": ""}
    result = smart_extract("test_form.pdf", schema)
    
    assert "error" not in result, f"Extraction failed: {result.get('error')}"
    assert result.get("name"), "Name not extracted"
    assert result.get("date"), "Date not extracted"
    print("✅ Basic extraction passed")

def test_phi_fallback():
    schema = {"patient_first_name": "", "patient_last_name": ""}
    result = smart_extract("test_medical_form.pdf", schema, enable_openai_fallback=True)
    
    assert "error" not in result
    # Should not contain placeholder names
    assert "john" not in result.get("patient_first_name", "").lower()
    assert "doe" not in result.get("patient_last_name", "").lower()
    print("✅ PHI fallback test passed")

if __name__ == "__main__":
    test_basic_extraction()
    test_phi_fallback()
```

## Scripts Location

Production-ready scripts are available in `scripts/`:
- `mistral_ocr.py` - Python implementation
- `mistral_ocr.ts` - TypeScript implementation

Copy these into your project's lib or utils directory.
SKILL_EOF

# =============================================================================
# Python Script
# =============================================================================
cat > "$INSTALL_DIR/scripts/mistral_ocr.py" << 'PYTHON_EOF'
#!/usr/bin/env python3
"""
Mistral OCR extraction script with fallback to OpenAI
Supports both dedicated OCR API and chat completion methods
"""

import os
import sys
import json
import base64
import re
from typing import Dict, Any, Optional, List

def extract_with_ocr_api(pdf_path: str, include_images: bool = False) -> Dict[str, Any]:
    """
    Extract text using Mistral's dedicated OCR API (mistral-ocr-latest)
    
    Args:
        pdf_path: Path to PDF file
        include_images: Whether to extract embedded images as base64
        
    Returns:
        Dict with 'text' (markdown) and optional 'images' list
    """
    try:
        from mistralai import Mistral
    except ImportError:
        return {"error": "mistralai package not installed. Run: pip install mistralai --break-system-packages"}
    
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        return {"error": "MISTRAL_API_KEY environment variable not set"}
    
    client = Mistral(api_key=api_key)
    
    # Read and encode PDF
    with open(pdf_path, "rb") as f:
        pdf_b64 = base64.b64encode(f.read()).decode("utf-8")
    
    # Process with OCR API
    response = client.ocr.process(
        model="mistral-ocr-latest",
        document={
            "type": "document_base64",
            "document_base64": pdf_b64
        },
        include_image_base64=include_images
    )
    
    # Combine all pages
    text = "\n\n".join(page.markdown for page in response.pages)
    
    result = {"text": text, "method": "ocr_api"}
    
    if include_images and hasattr(response, 'images'):
        result["images"] = response.images
    
    return result


def extract_with_chat_completion(
    pdf_path: str,
    extraction_schema: Dict[str, str],
    system_prompt: str = "Extract structured data from documents. Return valid JSON only.",
    temperature: float = 0.1
) -> Dict[str, Any]:
    """
    Extract structured data using Mistral chat completion with custom schema
    
    Args:
        pdf_path: Path to PDF file
        extraction_schema: Dict defining fields to extract
        system_prompt: Custom system prompt for extraction context
        temperature: Model temperature (lower = more deterministic)
        
    Returns:
        Dict with extracted data matching schema
    """
    try:
        from mistralai import Mistral
    except ImportError:
        return {"error": "mistralai package not installed. Run: pip install mistralai --break-system-packages"}
    
    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        return {"error": "MISTRAL_API_KEY environment variable not set"}
    
    client = Mistral(api_key=api_key)
    
    # First extract raw text
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
    
    pdf_text = extract_text_from_pdf_bytes(pdf_bytes)
    
    if not pdf_text.strip():
        return {"error": "No text could be extracted from PDF"}
    
    # Create prompt with schema
    schema_json = json.dumps(extraction_schema, indent=2)
    user_prompt = f"""Extract the following fields from this document text.

RETURN ONLY JSON with these exact fields:
{schema_json}

Document text:
{pdf_text}"""
    
    # Call Mistral
    response = client.chat.complete(
        model="mistral-large-latest",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=temperature,
        max_tokens=1000
    )
    
    result_text = response.choices[0].message.content
    cleaned = clean_json_response(result_text)
    
    try:
        extracted_data = json.loads(cleaned)
        extracted_data["method"] = "chat_completion"
        return extracted_data
    except json.JSONDecodeError as e:
        return {
            "error": f"Failed to parse JSON response: {str(e)}",
            "raw_response": result_text
        }


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extract raw text from PDF bytes using simple text marker extraction"""
    pdf_string = pdf_bytes.decode('latin-1', errors='ignore')
    
    text_matches = re.findall(r'BT[\s\S]*?ET', pdf_string)
    
    extracted_text = []
    for match in text_matches:
        text_commands = re.findall(r'\((.*?)\)\s*T[jJ]?', match)
        extracted_text.extend(text_commands)
    
    return ' '.join(extracted_text)


def clean_json_response(response: str) -> str:
    """Clean markdown formatting from JSON response"""
    cleaned = re.sub(r'```json\n?|\n?```', '', response)
    cleaned = re.sub(r'\*\*(.*?)\*\*', r'\1', cleaned)
    cleaned = re.sub(r'\*(.*?)\*', r'\1', cleaned)
    return cleaned.strip()


def is_placeholder_name(first_name: str, last_name: str) -> bool:
    """Check if extracted names are placeholders (censored by model)"""
    if not first_name or not last_name:
        return False
    
    placeholder_patterns = [
        "john", "jane", "doe", "smith",
        "patient", "redacted", "confidential",
        "example", "sample", "test"
    ]
    
    full_name = f"{first_name} {last_name}".lower()
    return any(pattern in full_name for pattern in placeholder_patterns)


def extract_with_openai_fallback(
    pdf_path: str,
    extraction_schema: Dict[str, str],
    system_prompt: str = "Extract structured data from documents. Return valid JSON only."
) -> Dict[str, Any]:
    """Fallback extraction using OpenAI when Mistral censors content"""
    try:
        from openai import OpenAI
    except ImportError:
        return {"error": "openai package not installed. Run: pip install openai --break-system-packages"}
    
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY environment variable not set"}
    
    client = OpenAI(api_key=api_key)
    
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
    pdf_text = extract_text_from_pdf_bytes(pdf_bytes)
    
    if not pdf_text.strip():
        return {"error": "No text could be extracted from PDF"}
    
    schema_json = json.dumps(extraction_schema, indent=2)
    user_prompt = f"""Extract the following fields from this document text.

RETURN ONLY JSON with these exact fields:
{schema_json}

Document text:
{pdf_text}"""
    
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.1,
        max_tokens=1000
    )
    
    result_text = response.choices[0].message.content
    cleaned = clean_json_response(result_text)
    
    try:
        extracted_data = json.loads(cleaned)
        extracted_data["method"] = "openai_fallback"
        return extracted_data
    except json.JSONDecodeError as e:
        return {
            "error": f"Failed to parse JSON response: {str(e)}",
            "raw_response": result_text
        }


def smart_extract(
    pdf_path: str,
    extraction_schema: Dict[str, str],
    system_prompt: str = "Extract structured data from documents. Return valid JSON only.",
    use_ocr_api: bool = False,
    enable_openai_fallback: bool = True
) -> Dict[str, Any]:
    """
    Smart extraction with automatic fallback
    
    Args:
        pdf_path: Path to PDF file
        extraction_schema: Dict defining fields to extract
        system_prompt: Custom system prompt
        use_ocr_api: If True, use OCR API instead of chat completion
        enable_openai_fallback: If True, fallback to OpenAI when names are censored
        
    Returns:
        Dict with extracted data
    """
    if use_ocr_api:
        result = extract_with_ocr_api(pdf_path)
        if "error" not in result:
            return result
        print(f"OCR API failed: {result['error']}", file=sys.stderr)
    
    result = extract_with_chat_completion(pdf_path, extraction_schema, system_prompt)
    
    if "error" in result:
        print(f"Mistral extraction failed: {result['error']}", file=sys.stderr)
        if enable_openai_fallback:
            print("Attempting OpenAI fallback...", file=sys.stderr)
            return extract_with_openai_fallback(pdf_path, extraction_schema, system_prompt)
        return result
    
    if enable_openai_fallback:
        first_name = result.get("patient_first_name") or result.get("first_name") or result.get("name", "").split()[0] if result.get("name") else ""
        last_name = result.get("patient_last_name") or result.get("last_name") or result.get("name", "").split()[-1] if result.get("name") else ""
        
        if first_name and last_name and is_placeholder_name(first_name, last_name):
            print("Detected placeholder names, attempting OpenAI fallback...", file=sys.stderr)
            return extract_with_openai_fallback(pdf_path, extraction_schema, system_prompt)
    
    return result


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Extract data from PDFs using Mistral OCR")
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("--schema", help="JSON string defining extraction schema", default='{"text": ""}')
    parser.add_argument("--system-prompt", help="Custom system prompt", default="Extract structured data from documents. Return valid JSON only.")
    parser.add_argument("--ocr-api", action="store_true", help="Use OCR API instead of chat completion")
    parser.add_argument("--no-fallback", action="store_true", help="Disable OpenAI fallback")
    parser.add_argument("--output", help="Output JSON file path (default: stdout)")
    
    args = parser.parse_args()
    
    try:
        schema = json.loads(args.schema)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON schema: {args.schema}", file=sys.stderr)
        sys.exit(1)
    
    result = smart_extract(
        args.pdf_path,
        schema,
        args.system_prompt,
        use_ocr_api=args.ocr_api,
        enable_openai_fallback=not args.no_fallback
    )
    
    output = json.dumps(result, indent=2)
    
    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"Results written to {args.output}", file=sys.stderr)
    else:
        print(output)
PYTHON_EOF

# =============================================================================
# TypeScript Script
# =============================================================================
cat > "$INSTALL_DIR/scripts/mistral_ocr.ts" << 'TS_EOF'
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
TS_EOF

# =============================================================================
# Reference: API Reference
# =============================================================================
cat > "$INSTALL_DIR/references/api_reference.md" << 'REF_EOF'
# OCR Extractor API Reference

## Python Functions

### smart_extract()
Main entry point with automatic method selection and fallback.

```python
smart_extract(
    pdf_path: str,
    extraction_schema: Dict[str, str],
    system_prompt: str = "Extract structured data...",
    use_ocr_api: bool = False,
    enable_openai_fallback: bool = True
) -> Dict[str, Any]
```

### extract_with_ocr_api()
Full document text extraction.

```python
extract_with_ocr_api(
    pdf_path: str,
    include_images: bool = False
) -> Dict[str, Any]
```

### extract_with_chat_completion()
Schema-based field extraction.

```python
extract_with_chat_completion(
    pdf_path: str,
    extraction_schema: Dict[str, str],
    system_prompt: str = "...",
    temperature: float = 0.1
) -> Dict[str, Any]
```

### extract_with_openai_fallback()
Direct OpenAI extraction for PHI documents.

```python
extract_with_openai_fallback(
    pdf_path: str,
    extraction_schema: Dict[str, str],
    system_prompt: str = "..."
) -> Dict[str, Any]
```

## TypeScript Functions

Same API as Python, exported from `mistral_ocr.ts`:

```typescript
import { 
  smartExtract, 
  extractWithOcrApi, 
  extractWithChatCompletion, 
  extractWithOpenAiFallback 
} from './mistral_ocr';
```
REF_EOF

# =============================================================================
# Reference: Examples
# =============================================================================
cat > "$INSTALL_DIR/references/examples.md" << 'EXAMPLES_EOF'
# OCR Extractor Examples

## Healthcare Enrollment Form

```python
schema = {
    "patient_first_name": "",
    "patient_last_name": "",
    "date_of_birth": "",
    "insurance_id": "",
    "diagnosis_code": "",
    "prescriber_npi": ""
}

result = smart_extract(
    "enrollment.pdf",
    schema,
    system_prompt="Extract patient enrollment data. Return valid JSON.",
    enable_openai_fallback=True
)
```

## Invoice Processing

```python
schema = {
    "invoice_number": "",
    "invoice_date": "",
    "vendor_name": "",
    "total": "",
    "line_items": []
}

result = smart_extract("invoice.pdf", schema)
```

## Full Document with Tables

```python
result = extract_with_ocr_api("report.pdf", include_images=True)
print(result["text"])  # Markdown with table formatting preserved
```
EXAMPLES_EOF

chmod +x "$INSTALL_DIR/scripts/mistral_ocr.py"

echo ""
echo "✅ OCR Extractor skill installed successfully!"
echo ""
echo "📍 Location: $INSTALL_DIR"
echo ""
echo "📋 Next steps:"
echo "   1. Set environment variables:"
echo "      export MISTRAL_API_KEY='your_key'"
echo "      export OPENAI_API_KEY='your_key'  # Optional, for PHI fallback"
echo ""
echo "   2. Install Python dependencies (when building apps):"
echo "      pip install mistralai openai --break-system-packages"
echo ""
echo "   3. Or Node.js dependencies:"
echo "      npm install @mistralai/mistralai openai"
echo ""
echo "🎯 Usage: When you ask Claude Code to build an app with OCR/form"
echo "   processing features, it will reference this skill for implementation"
echo "   patterns, code templates, and best practices."
echo ""
