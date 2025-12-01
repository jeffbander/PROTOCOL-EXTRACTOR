import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { sendInviteEmail } from '@/lib/email'

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
    const { email, role } = await request.json()

    // Find user by email
    const { data: userData } = await serviceClient
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    // If user exists, add them directly
    if (userData) {
      // Check if already a member
      const { data: existingMember } = await serviceClient
        .from('study_members')
        .select('id')
        .eq('study_id', studyId)
        .eq('user_id', userData.id)
        .single()

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of this study' }, { status: 400 })
      }

      // Add member
      const { data: member, error: memberError } = await serviceClient
        .from('study_members')
        .insert({
          study_id: studyId,
          user_id: userData.id,
          role: role || 'coordinator',
        })
        .select()
        .single()

      if (memberError) {
        throw memberError
      }

      return NextResponse.json({ member, message: 'User added to study' })
    }

    // User doesn't exist - create an invitation
    // Check for existing pending invitation for this email and study
    const { data: existingInvite } = await serviceClient
      .from('invitations')
      .select('id')
      .eq('email', email)
      .eq('study_id', studyId)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return NextResponse.json({ error: 'Invitation already sent to this email for this study' }, { status: 400 })
    }

    // Get study name and inviter name for the email
    const { data: studyData } = await serviceClient
      .from('studies')
      .select('name')
      .eq('id', studyId)
      .single()

    const { data: inviterData } = await serviceClient
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single()

    // Create invitation with study_id
    const token = randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    const { data: invitation, error: inviteError } = await serviceClient
      .from('invitations')
      .insert({
        email,
        role: role || 'coordinator',
        invited_by: user.id,
        study_id: studyId,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (inviteError) {
      throw inviteError
    }

    // Send invitation email
    const inviteUrl = `${request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`
    const emailResult = await sendInviteEmail({
      to: email,
      inviteUrl,
      role: role || 'coordinator',
      inviterName: inviterData?.name || inviterData?.email || undefined,
      studyName: studyData?.name || undefined,
    })

    if (!emailResult.success) {
      console.warn('Failed to send invite email:', emailResult.error)
    }

    return NextResponse.json({
      invitation,
      inviteUrl: `/invite/${token}`,
      emailSent: emailResult.success,
      message: emailResult.success
        ? 'Invitation email sent successfully!'
        : 'Invitation created. Share the invite link with them (email sending failed).',
    })
  } catch (error: any) {
    console.error('Add member error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add member' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID required' }, { status: 400 })
    }

    // Delete member
    const { error } = await serviceClient
      .from('study_members')
      .delete()
      .eq('id', memberId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Remove member error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove member' },
      { status: 500 }
    )
  }
}
