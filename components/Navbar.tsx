'use client'

import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Navbar() {
  const { profile, loading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
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

  if (!profile) {
    return null
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
            {(profile.role === 'pi' || profile.role === 'admin') && (
              <Link
                href="/studies/upload"
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Upload Protocol
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">
              {profile.email}
              <span className="ml-2 px-2 py-1 text-xs bg-primary-100 text-primary-800 rounded-full">
                {profile.role === 'pi' ? 'PI' : profile.role === 'admin' ? 'Admin' : 'Coordinator'}
              </span>
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
