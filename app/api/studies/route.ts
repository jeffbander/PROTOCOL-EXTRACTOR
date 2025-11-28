import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please log in to create studies' }, { status: 401 })
    }

    // Use service client to bypass RLS for database operations
    const serviceClient = createServiceClient()

    // Ensure user profile exists (create if missing)
    const { data: existingProfile } = await serviceClient
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingProfile) {
      await serviceClient
        .from('users')
        .insert({
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name || '',
          role: 'pi'
        })
    }

    // Get the study data
    const data = await request.json()

    // Create the study using service client (bypasses RLS)
    const { data: study, error } = await serviceClient
      .from('studies')
      .insert({
        // Basic fields
        name: data.name,
        phase: data.phase,
        indication: data.indication,
        target_enrollment: data.target_enrollment,
        owner_id: user.id,

        // Administrative fields
        gco_number: data.gco_number || null,
        protocol_number: data.protocol_number || null,
        fund_number: data.fund_number || null,
        sponsor_name: data.sponsor_name || null,
        nct_number: data.nct_number || null,

        // Status (default to pending_irb_submission)
        status: data.status || 'pending_irb_submission',

        // Extended protocol data stored as JSONB
        protocol_data: {
          inclusion_criteria: data.inclusion_criteria || [],
          exclusion_criteria: data.exclusion_criteria || [],
          visit_schedule: data.visit_schedule || [],
        },

        // Study design
        study_design: data.study_design || null,
        study_arms: data.study_arms || null,
        investigational_product: data.investigational_product || null,
        treatment_duration: data.treatment_duration || null,
        comparator_type: data.comparator_type || null,

        // Endpoints
        primary_endpoints: data.primary_endpoints || null,
        secondary_endpoints: data.secondary_endpoints || null,

        // Medications
        concomitant_medications: data.concomitant_medications || null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ study })
  } catch (error: any) {
    console.error('Study creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create study' },
      { status: 500 }
    )
  }
}
