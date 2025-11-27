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
