import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const invitationToken = requestUrl.searchParams.get('invitation')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && session?.user) {
      const serviceClient = createServiceClient()

      // If there's an invitation token, mark it as accepted
      if (invitationToken) {
        await serviceClient
          .from('invitations')
          .update({ status: 'accepted' })
          .eq('token', invitationToken)
          .eq('email', session.user.email)
      }

      // Check if user profile exists, if not create one
      const { data: existingProfile } = await serviceClient
        .from('users')
        .select('id')
        .eq('id', session.user.id)
        .single()

      if (!existingProfile) {
        // Get role from invitation or user metadata
        let role = session.user.user_metadata?.role || 'coordinator'

        if (invitationToken) {
          const { data: invitation } = await serviceClient
            .from('invitations')
            .select('role, study_id')
            .eq('token', invitationToken)
            .single()

          if (invitation) {
            role = invitation.role

            // If invitation has a study_id, add user to that study
            if (invitation.study_id) {
              await serviceClient
                .from('study_members')
                .insert({
                  study_id: invitation.study_id,
                  user_id: session.user.id,
                  role: role === 'admin' ? 'pi' : role, // Admin becomes PI on study
                })
            }
          }
        }

        // Create user profile
        await serviceClient
          .from('users')
          .insert({
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || '',
            role,
          })
      }
    }
  }

  // Redirect to dashboard after successful login
  return NextResponse.redirect(`${origin}/dashboard`)
}
