'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export interface UserProfile {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'pi' | 'coordinator'
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchOrCreateProfile = async (authUser: User) => {
      // Try to get existing profile
      let { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      // Auto-create profile if missing
      if (!profileData) {
        const { data: newProfile } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email!,
            name: authUser.user_metadata?.name || '',
            role: authUser.user_metadata?.role || 'pi' // Default to PI
          })
          .select()
          .single()

        profileData = newProfile
      }

      return profileData
    }

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const profileData = await fetchOrCreateProfile(user)
        setProfile(profileData)
      }

      setLoading(false)
    }

    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)

        if (session?.user) {
          const profileData = await fetchOrCreateProfile(session.user)
          setProfile(profileData)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, profile, loading }
}
