import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
