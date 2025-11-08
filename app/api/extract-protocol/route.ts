import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'pi' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the uploaded file
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')

    // Call Claude API with the PDF
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document' as any,
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract the following information from this clinical trial protocol:

1. Study name/title
2. Phase (e.g., Phase 1, Phase 2, Phase 3, Phase 4)
3. Medical condition or indication being studied
4. ALL inclusion criteria (as a list)
5. ALL exclusion criteria (as a list)
6. Visit schedule or study timepoints (list each visit/timepoint)
7. Target enrollment number

Return the data in JSON format with these exact keys:
{
  "name": "",
  "phase": "",
  "indication": "",
  "inclusion_criteria": [],
  "exclusion_criteria": [],
  "visit_schedule": [],
  "target_enrollment": 0
}

Important: Return ONLY the JSON object, no additional text or explanation.`,
            },
          ],
        },
      ],
    })

    // Extract the text content from Claude's response
    const textContent = message.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response')
    }

    // Parse the JSON response
    let extractedData
    try {
      // Try to find JSON in the response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0])
      } else {
        extractedData = JSON.parse(textContent.text)
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text)
      throw new Error('Failed to parse extracted data')
    }

    return NextResponse.json(extractedData)
  } catch (error: any) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract protocol data' },
      { status: 500 }
    )
  }
}
