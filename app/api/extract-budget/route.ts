import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractBudget } from '@/lib/mistral-budget-cta'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please log in to extract budget data' }, { status: 401 })
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

    console.log(`Processing Budget PDF: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    // Extract budget using Mistral OCR pipeline
    const result = await extractBudget(base64)

    if (result.method === 'error' || !result.data) {
      console.error('Budget extraction failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to extract budget data' },
        { status: 500 }
      )
    }

    console.log('Budget extraction successful:', {
      currency: result.data.currency,
      procedureCount: result.data.procedure_payments.length,
      visitCount: result.data.visit_payments.length,
      milestoneCount: result.data.milestone_payments.length,
    })

    return NextResponse.json(result.data)
  } catch (error: any) {
    console.error('Budget extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract budget data' },
      { status: 500 }
    )
  }
}
