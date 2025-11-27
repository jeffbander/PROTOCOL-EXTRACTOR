import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

// Check if user is admin
async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', status: 401 }
  }

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Admin access required', status: 403 }
  }

  return { user, serviceClient }
}

export async function GET() {
  const auth = await checkAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: invitations, error } = await auth.serviceClient
    .from('invitations')
    .select(`
      *,
      invited_by_user:users!invitations_invited_by_fkey(email, name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invitations: invitations || [] })
}

export async function POST(request: NextRequest) {
  const auth = await checkAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { email, role, studyId } = await request.json()

  if (!email || !role) {
    return NextResponse.json({ error: 'Email and role required' }, { status: 400 })
  }

  if (!['admin', 'pi', 'coordinator'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Check if user already exists
  const { data: existingUser } = await auth.serviceClient
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
  }

  // Check for existing pending invitation
  const { data: existingInvite } = await auth.serviceClient
    .from('invitations')
    .select('id')
    .eq('email', email)
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    return NextResponse.json({ error: 'Pending invitation already exists for this email' }, { status: 400 })
  }

  // Create invitation
  const token = randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

  const { data: invitation, error } = await auth.serviceClient
    .from('invitations')
    .insert({
      email,
      role,
      invited_by: auth.user.id,
      study_id: studyId || null,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invitation, inviteUrl: `/invite/${token}` })
}

export async function DELETE(request: NextRequest) {
  const auth = await checkAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const invitationId = searchParams.get('id')

  if (!invitationId) {
    return NextResponse.json({ error: 'Invitation ID required' }, { status: 400 })
  }

  const { error } = await auth.serviceClient
    .from('invitations')
    .delete()
    .eq('id', invitationId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
