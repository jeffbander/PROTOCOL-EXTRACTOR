import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-gray-300 hover:text-white text-sm">
                &larr; Back to Dashboard
              </Link>
              <span className="text-gray-500">|</span>
              <h1 className="text-lg font-semibold">Admin Panel</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm min-h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-1">
            <Link
              href="/admin"
              className="block px-4 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100"
            >
              Overview
            </Link>
            <Link
              href="/admin/users"
              className="block px-4 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100"
            >
              Users
            </Link>
            <Link
              href="/admin/invitations"
              className="block px-4 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-gray-100"
            >
              Invitations
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
