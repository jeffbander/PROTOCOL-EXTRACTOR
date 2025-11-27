import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractProtocol } from '@/lib/mistral-ocr'

export async function POST(request: NextRequest) {
  try {
    // Check authentication (simplified - just check if user is logged in)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please log in to extract protocols' }, { status: 401 })
    }

    // Get the uploaded file
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    // Validate file size (50MB max)
    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size must be less than 50MB' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')

    console.log(`Processing PDF: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    // Extract protocol using Mistral OCR pipeline
    const result = await extractProtocol(base64)

    if (result.method === 'error' || !result.data) {
      console.error('Extraction failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to extract protocol data' },
        { status: 500 }
      )
    }

    console.log('Extraction successful:', {
      name: result.data.name,
      phase: result.data.phase,
      inclusionCount: result.data.inclusion_criteria.length,
      exclusionCount: result.data.exclusion_criteria.length,
      visitCount: result.data.visit_schedule.length
    })

    return NextResponse.json(result.data)
  } catch (error: any) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract protocol data' },
      { status: 500 }
    )
  }
}
