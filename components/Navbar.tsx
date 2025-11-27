'use client'

import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const { profile, loading } = useUser()
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    // Get user email from auth even if profile doesn't exist
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null)
    })
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // Always show navbar with sign out if we have a user email
  const displayEmail = profile?.email || userEmail
  const displayRole = profile?.role || 'pi' // Default to PI for new users

  if (loading && !userEmail) {
    return (
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-primary-600">Protocol Extractor</span>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-xl font-bold text-primary-600">
              Protocol Extractor
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              My Studies
            </Link>
            <Link
              href="/studies/upload"
              className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Upload Protocol
            </Link>
            {displayRole === 'admin' && (
              <Link
                href="/admin"
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {displayEmail && (
              <span className="text-sm text-gray-700">
                {displayEmail}
                <span className="ml-2 px-2 py-1 text-xs bg-primary-100 text-primary-800 rounded-full">
                  {displayRole === 'pi' ? 'PI' : displayRole === 'admin' ? 'Admin' : 'Coordinator'}
                </span>
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-red-600 hover:text-red-800 px-3 py-2 rounded-md font-medium border border-red-200 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
