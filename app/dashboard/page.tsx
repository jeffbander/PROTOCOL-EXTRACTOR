import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

interface Study {
  id: string
  name: string
  phase: string | null
  indication: string | null
  target_enrollment: number | null
  created_at: string
  owner_id: string
  isOwned?: boolean
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const serviceClient = createServiceClient()

  // Get user profile - create if doesn't exist
  let { data: profile } = await serviceClient
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  // Auto-create profile if missing (user logged in via magic link but trigger didn't fire)
  if (!profile) {
    const { data: newProfile, error: createError } = await serviceClient
      .from('users')
      .insert({
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name || '',
        role: user.user_metadata?.role || 'coordinator' // Default to coordinator for new users
      })
      .select()
      .single()

    if (!createError) {
      profile = newProfile
    }
  }

  // Default role to 'coordinator' for permissions if profile still doesn't exist
  const userRole = profile?.role || 'coordinator'
  const canCreateStudies = userRole === 'admin' || userRole === 'pi'

  // Get studies owned by this user
  const { data: ownedStudies } = await serviceClient
    .from('studies')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Get studies user is assigned to (but doesn't own)
  const { data: memberStudies } = await serviceClient
    .from('study_members')
    .select('study_id, studies(*)')
    .eq('user_id', user.id)

  // Combine and deduplicate studies
  const ownedSet = new Set((ownedStudies || []).map(s => s.id))
  const assignedStudies = (memberStudies || [])
    .filter(m => m.studies && !ownedSet.has((m.studies as Study).id))
    .map(m => ({ ...(m.studies as Study), isOwned: false }))

  const allOwnedStudies = (ownedStudies || []).map(s => ({ ...s, isOwned: true }))
  const studies = [...allOwnedStudies, ...assignedStudies]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userEmail={user.email} userRole={userRole} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Studies</h1>
            {canCreateStudies && (
              <Link
                href="/studies/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                + Upload New Protocol
              </Link>
            )}
          </div>

          {!studies || studies.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No studies yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                {canCreateStudies
                  ? 'Get started by uploading a clinical trial protocol PDF.'
                  : 'You will see studies here once you are assigned to them.'}
              </p>
              {canCreateStudies && (
                <div className="mt-6">
                  <Link
                    href="/studies/upload"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Upload Protocol
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {studies.map((study: Study & { isOwned?: boolean }) => (
                <Link
                  key={study.id}
                  href={`/studies/${study.id}`}
                  className="block"
                >
                  <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
                    <div className="px-4 py-5 sm:p-6">
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-medium text-gray-900 truncate flex-1">
                          {study.name}
                        </h3>
                        {!study.isOwned && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Assigned
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        {study.phase && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                            {study.phase}
                          </span>
                        )}
                      </div>
                      {study.indication && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                          {study.indication}
                        </p>
                      )}
                      <div className="mt-4 text-sm text-gray-500">
                        <span className="font-medium text-gray-700">
                          {study.target_enrollment || 0}
                        </span>{' '}
                        target enrollment
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
