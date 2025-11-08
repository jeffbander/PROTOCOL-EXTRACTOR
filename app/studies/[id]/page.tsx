'use client'

import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'

interface Study {
  id: string
  name: string
  phase: string | null
  indication: string | null
  target_enrollment: number | null
  protocol_data: {
    inclusion_criteria: string[]
    exclusion_criteria: string[]
    visit_schedule: string[]
  } | null
  created_at: string
}

interface StudyMember {
  id: string
  role: string
  user_id: string
  users: {
    email: string
    name: string | null
    role: string
  } | null
}

interface Patient {
  id: string
  name: string
  enrolled_date: string
}

export default function StudyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile, loading: userLoading } = useUser()
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'patients'>('overview')
  const [study, setStudy] = useState<Study | null>(null)
  const [members, setMembers] = useState<StudyMember[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [addMemberEmail, setAddMemberEmail] = useState('')
  const [addMemberRole, setAddMemberRole] = useState<'pi' | 'coordinator'>('coordinator')
  const [addingMember, setAddingMember] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientDate, setNewPatientDate] = useState('')
  const [addingPatient, setAddingPatient] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()
  const studyId = params.id as string

  useEffect(() => {
    if (!userLoading) {
      fetchStudyData()
    }
  }, [userLoading, studyId])

  const fetchStudyData = async () => {
    try {
      // Fetch study
      const { data: studyData, error: studyError } = await supabase
        .from('studies')
        .select('*')
        .eq('id', studyId)
        .single()

      if (studyError) throw studyError

      setStudy(studyData)

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('study_members')
        .select(`
          id,
          role,
          user_id,
          users!inner (
            email,
            name,
            role
          )
        `)
        .eq('study_id', studyId)

      if (membersError) throw membersError
      setMembers(membersData as any || [])

      // Fetch patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .eq('study_id', studyId)
        .order('enrolled_date', { ascending: false })

      if (patientsError) throw patientsError
      setPatients(patientsData || [])
    } catch (err: any) {
      console.error('Error fetching study data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingMember(true)
    setError('')

    try {
      // Find user by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', addMemberEmail)
        .single()

      if (userError || !userData) {
        throw new Error('User not found with that email')
      }

      // Add member
      const { error: memberError } = await supabase
        .from('study_members')
        .insert({
          study_id: studyId,
          user_id: userData.id,
          role: addMemberRole,
        })

      if (memberError) throw memberError

      // Refresh members list
      await fetchStudyData()
      setAddMemberEmail('')
      setAddMemberRole('coordinator')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return

    try {
      const { error } = await supabase
        .from('study_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      await fetchStudyData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingPatient(true)
    setError('')

    try {
      const { error } = await supabase
        .from('patients')
        .insert({
          study_id: studyId,
          name: newPatientName,
          enrolled_date: newPatientDate,
        })

      if (error) throw error

      await fetchStudyData()
      setNewPatientName('')
      setNewPatientDate('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingPatient(false)
    }
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    )
  }

  if (!study) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Study not found</div>
        </div>
      </div>
    )
  }

  const canManageTeam = profile?.role === 'pi' || profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{study.name}</h1>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              {study.phase && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {study.phase}
                </span>
              )}
              {study.indication && <span>{study.indication}</span>}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`${
                  activeTab === 'overview'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('team')}
                className={`${
                  activeTab === 'team'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Team
              </button>
              <button
                onClick={() => setActiveTab('patients')}
                className={`${
                  activeTab === 'patients'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Patients
              </button>
            </nav>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Tab Content */}
          <div className="bg-white shadow rounded-lg">
            {activeTab === 'overview' && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Target Enrollment</h3>
                  <p className="mt-1 text-lg text-gray-900">{study.target_enrollment || 'Not specified'}</p>
                </div>

                {study.protocol_data?.inclusion_criteria && study.protocol_data.inclusion_criteria.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Inclusion Criteria</h3>
                    <ul className="border rounded-md p-4 bg-gray-50 space-y-2">
                      {study.protocol_data.inclusion_criteria.map((criterion, index) => (
                        <li key={index} className="text-sm text-gray-700">• {criterion}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {study.protocol_data?.exclusion_criteria && study.protocol_data.exclusion_criteria.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Exclusion Criteria</h3>
                    <ul className="border rounded-md p-4 bg-gray-50 space-y-2">
                      {study.protocol_data.exclusion_criteria.map((criterion, index) => (
                        <li key={index} className="text-sm text-gray-700">• {criterion}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {study.protocol_data?.visit_schedule && study.protocol_data.visit_schedule.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Visit Schedule</h3>
                    <ul className="border rounded-md p-4 bg-gray-50 space-y-2">
                      {study.protocol_data.visit_schedule.map((visit, index) => (
                        <li key={index} className="text-sm text-gray-700">• {visit}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <div className="p-6 space-y-6">
                {canManageTeam && (
                  <form onSubmit={handleAddMember} className="space-y-4 border-b pb-6">
                    <h3 className="text-lg font-medium text-gray-900">Add Team Member</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          required
                          value={addMemberEmail}
                          onChange={(e) => setAddMemberEmail(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                          placeholder="user@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                          value={addMemberRole}
                          onChange={(e) => setAddMemberRole(e.target.value as 'pi' | 'coordinator')}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                        >
                          <option value="coordinator">Coordinator</option>
                          <option value="pi">PI</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={addingMember}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      {addingMember ? 'Adding...' : 'Add Member'}
                    </button>
                  </form>
                )}

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Team Members ({members.length})</h3>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 border rounded-md">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {member.users?.name || member.users?.email || 'Unknown User'}
                          </p>
                          <p className="text-sm text-gray-500">{member.users?.email || 'No email'}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                            {member.role === 'pi' ? 'PI' : 'Coordinator'}
                          </span>
                          {canManageTeam && (
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-sm text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No team members yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'patients' && (
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Enrolled: {patients.length} / {study.target_enrollment || 0}
                  </h3>
                </div>

                <form onSubmit={handleAddPatient} className="space-y-4 border-b pb-6">
                  <h3 className="text-lg font-medium text-gray-900">Add Patient</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
                      <input
                        type="text"
                        required
                        value={newPatientName}
                        onChange={(e) => setNewPatientName(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date</label>
                      <input
                        type="date"
                        required
                        value={newPatientDate}
                        onChange={(e) => setNewPatientDate(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={addingPatient}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {addingPatient ? 'Adding...' : 'Add Patient'}
                  </button>
                </form>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Patients</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Enrollment Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {patients.map((patient) => (
                          <tr key={patient.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {patient.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(patient.enrolled_date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {patients.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-8">No patients enrolled yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
