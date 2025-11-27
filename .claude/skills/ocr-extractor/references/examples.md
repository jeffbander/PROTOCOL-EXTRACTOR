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
