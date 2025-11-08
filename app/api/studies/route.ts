import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Get the study data
    const data = await request.json()

    // Create the study
    const { data: study, error } = await supabase
      .from('studies')
      .insert({
        name: data.name,
        phase: data.phase,
        indication: data.indication,
        target_enrollment: data.target_enrollment,
        protocol_data: {
          inclusion_criteria: data.inclusion_criteria,
          exclusion_criteria: data.exclusion_criteria,
          visit_schedule: data.visit_schedule,
        },
        owner_id: user.id,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Add the creator as a PI member of the study
    await supabase
      .from('study_members')
      .insert({
        study_id: study.id,
        user_id: user.id,
        role: 'pi',
      })

    return NextResponse.json({ study })
  } catch (error: any) {
    console.error('Study creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create study' },
      { status: 500 }
    )
  }
}
