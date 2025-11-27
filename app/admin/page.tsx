import { createServiceClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const serviceClient = createServiceClient()

  // Get counts
  const [usersResult, studiesResult, patientsResult] = await Promise.all([
    serviceClient.from('users').select('id', { count: 'exact', head: true }),
    serviceClient.from('studies').select('id', { count: 'exact', head: true }),
    serviceClient.from('patients').select('id', { count: 'exact', head: true }),
  ])

  const stats = {
    users: usersResult.count || 0,
    studies: studiesResult.count || 0,
    patients: patientsResult.count || 0,
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Overview</h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.users}</dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Studies</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.studies}</dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Patients</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.patients}</dd>
          </div>
        </div>
      </div>
    </div>
  )
}
