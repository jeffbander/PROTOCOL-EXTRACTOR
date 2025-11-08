import { createClient } from '@/lib/supabase/server'
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
  study_members: { count: number }[]
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get studies based on role
  let query = supabase
    .from('studies')
    .select(`
      *,
      study_members(count)
    `)

  // Apply role-based filtering
  if (profile?.role === 'coordinator') {
    // Coordinators only see studies they're assigned to
    const { data: memberStudies } = await supabase
      .from('study_members')
      .select('study_id')
      .eq('user_id', user.id)

    const studyIds = memberStudies?.map(m => m.study_id) || []

    query = query.in('id', studyIds.length > 0 ? studyIds : ['00000000-0000-0000-0000-000000000000'])
  } else if (profile?.role === 'pi') {
    // PIs see studies they own OR are assigned to
    const { data: memberStudies } = await supabase
      .from('study_members')
      .select('study_id')
      .eq('user_id', user.id)

    const studyIds = memberStudies?.map(m => m.study_id) || []

    if (studyIds.length > 0) {
      query = query.or(`owner_id.eq.${user.id},id.in.(${studyIds.join(',')})`)
    } else {
      query = query.eq('owner_id', user.id)
    }
  }
  // Admin sees all studies (no filter)

  const { data: studies } = await query.order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Studies</h1>
            {(profile?.role === 'pi' || profile?.role === 'admin') && (
              <Link
                href="/studies/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Upload New Protocol
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">No studies</h3>
              <p className="mt-1 text-sm text-gray-500">
                {profile?.role === 'coordinator'
                  ? 'You have not been assigned to any studies yet.'
                  : 'Get started by uploading a protocol.'}
              </p>
              {(profile?.role === 'pi' || profile?.role === 'admin') && (
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
              {studies.map((study: Study) => (
                <Link
                  key={study.id}
                  href={`/studies/${study.id}`}
                  className="block"
                >
                  <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {study.name}
                      </h3>
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
                      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                        <div>
                          <span className="font-medium text-gray-700">
                            {study.target_enrollment || 0}
                          </span>{' '}
                          target enrollment
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">
                            {study.study_members[0]?.count || 0}
                          </span>{' '}
                          team members
                        </div>
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
