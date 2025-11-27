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
