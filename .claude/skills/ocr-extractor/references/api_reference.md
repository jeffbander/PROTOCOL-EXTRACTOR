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
