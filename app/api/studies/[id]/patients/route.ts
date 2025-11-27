import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(
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

    const serviceClient = createServiceClient()
    const studyId = params.id
    const { name, enrolled_date } = await request.json()

    if (!name || !enrolled_date) {
      return NextResponse.json({ error: 'Name and enrollment date required' }, { status: 400 })
    }

    // Add patient
    const { data: patient, error } = await serviceClient
      .from('patients')
      .insert({
        study_id: studyId,
        name,
        enrolled_date,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ patient })
  } catch (error: any) {
    console.error('Add patient error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add patient' },
      { status: 500 }
    )
  }
}
