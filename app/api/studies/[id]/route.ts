import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { STUDY_STATUSES } from '@/lib/mistral-ocr'

// Valid status values for validation
const validStatuses = STUDY_STATUSES.map(s => s.value)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please log in' }, { status: 401 })
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceClient()
    const studyId = params.id

    // Fetch study
    const { data: study, error: studyError } = await serviceClient
      .from('studies')
      .select('*')
      .eq('id', studyId)
      .single()

    if (studyError) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 })
    }

    // Fetch members with user info
    const { data: members } = await serviceClient
      .from('study_members')
      .select(`
        id,
        role,
        user_id,
        users (
          email,
          name,
          role
        )
      `)
      .eq('study_id', studyId)

    // Fetch patients
    const { data: patients } = await serviceClient
      .from('patients')
      .select('*')
      .eq('study_id', studyId)
      .order('enrolled_date', { ascending: false })

    return NextResponse.json({
      study,
      patients: patients || [],
      members: members || []
    })
  } catch (error: any) {
    console.error('Study fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch study' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please log in' }, { status: 401 })
    }

    const studyId = params.id
    const body = await request.json()

    // Build update object with only allowed fields
    const updateData: Record<string, any> = {}

    // Status update with validation
    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
      }
      updateData.status = body.status
    }

    // Administrative fields (can be updated later)
    if (body.gco_number !== undefined) updateData.gco_number = body.gco_number || null
    if (body.protocol_number !== undefined) updateData.protocol_number = body.protocol_number || null
    if (body.fund_number !== undefined) updateData.fund_number = body.fund_number || null
    if (body.sponsor_name !== undefined) updateData.sponsor_name = body.sponsor_name || null
    if (body.nct_number !== undefined) updateData.nct_number = body.nct_number || null
    if (body.target_enrollment !== undefined) updateData.target_enrollment = body.target_enrollment || null

    // Budget and CTA data (JSONB fields)
    if (body.budget_data !== undefined) updateData.budget_data = body.budget_data || null
    if (body.cta_data !== undefined) updateData.cta_data = body.cta_data || null

    // Only proceed if there's something to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString()

    // Use service client to bypass RLS
    const serviceClient = createServiceClient()

    const { data: study, error } = await serviceClient
      .from('studies')
      .update(updateData)
      .eq('id', studyId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ study })
  } catch (error: any) {
    console.error('Study update error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update study' },
      { status: 500 }
    )
  }
}
