'use client'

import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { STUDY_STATUSES, StudyStatus } from '@/lib/mistral-ocr'

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
  // Administrative fields
  gco_number: string | null
  protocol_number: string | null
  fund_number: string | null
  sponsor_name: string | null
  nct_number: string | null
  status: StudyStatus | null
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
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'patients'>('overview')
  const [study, setStudy] = useState<Study | null>(null)
  const [members, setMembers] = useState<StudyMember[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [addMemberEmail, setAddMemberEmail] = useState('')
  const [addMemberRole, setAddMemberRole] = useState<'pi' | 'coordinator'>('coordinator')
  const [addingMember, setAddingMember] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientDate, setNewPatientDate] = useState('')
  const [addingPatient, setAddingPatient] = useState(false)
  const [error, setError] = useState('')
  const [userEmail, setUserEmail] = useState<string | undefined>()
  const [userRole, setUserRole] = useState<string | undefined>()
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    target_enrollment: 0,
    gco_number: '',
    protocol_number: '',
    fund_number: '',
    sponsor_name: '',
    nct_number: '',
  })

  const supabase = createClient()
  const studyId = params.id as string

  // Check if user is PI (can edit)
  const canEdit = userRole === 'pi' || userRole === 'admin'

  useEffect(() => {
    fetchStudyData()
    fetchUserData()
  }, [studyId])

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserEmail(user.email)
      // Try to get user profile for role
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'pi')
    }
  }

  const fetchStudyData = async () => {
    try {
      // Fetch via API to bypass RLS issues
      const response = await fetch(`/api/studies/${studyId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch study')
      }

      const data = await response.json()
      setStudy(data.study)
      setMembers(data.members || [])
      setPatients(data.patients || [])
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
    setInviteUrl('')
    setSuccessMessage('')

    try {
      const response = await fetch(`/api/studies/${studyId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addMemberEmail, role: addMemberRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add member')
      }

      // Check if an invitation was created (user doesn't exist)
      if (data.inviteUrl) {
        setInviteUrl(`${window.location.origin}${data.inviteUrl}`)
        setSuccessMessage(data.message)
      } else {
        setSuccessMessage('User added to study successfully!')
        await fetchStudyData()
      }

      setAddMemberEmail('')
      setAddMemberRole('coordinator')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingMember(false)
    }
  }

  const copyInviteLink = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setSuccessMessage('Invite link copied to clipboard!')
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return

    try {
      const response = await fetch(`/api/studies/${studyId}/members?memberId=${memberId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove member')
      }

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
      const response = await fetch(`/api/studies/${studyId}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPatientName, enrolled_date: newPatientDate }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add patient')
      }

      await fetchStudyData()
      setNewPatientName('')
      setNewPatientDate('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingPatient(false)
    }
  }

  const handleStatusChange = async (newStatus: StudyStatus) => {
    setUpdatingStatus(true)
    setError('')

    try {
      const response = await fetch(`/api/studies/${studyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update status')
      }

      // Update local state
      setStudy(prev => prev ? { ...prev, status: newStatus } : null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUpdatingStatus(false)
    }
  }

  // Get status label helper
  const getStatusLabel = (status: StudyStatus | null) => {
    if (!status) return 'Not set'
    const found = STUDY_STATUSES.find(s => s.value === status)
    return found ? found.label : status
  }

  // Start editing - populate form with current values
  const handleStartEdit = () => {
    if (study) {
      setEditForm({
        target_enrollment: study.target_enrollment || 0,
        gco_number: study.gco_number || '',
        protocol_number: study.protocol_number || '',
        fund_number: study.fund_number || '',
        sponsor_name: study.sponsor_name || '',
        nct_number: study.nct_number || '',
      })
      setIsEditing(true)
    }
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false)
    setError('')
  }

  // Save edits
  const handleSaveEdit = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/studies/${studyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_enrollment: editForm.target_enrollment || null,
          gco_number: editForm.gco_number || null,
          protocol_number: editForm.protocol_number || null,
          fund_number: editForm.fund_number || null,
          sponsor_name: editForm.sponsor_name || null,
          nct_number: editForm.nct_number || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save changes')
      }

      const { study: updatedStudy } = await response.json()

      // Update local state
      setStudy(prev => prev ? {
        ...prev,
        target_enrollment: updatedStudy.target_enrollment,
        gco_number: updatedStudy.gco_number,
        protocol_number: updatedStudy.protocol_number,
        fund_number: updatedStudy.fund_number,
        sponsor_name: updatedStudy.sponsor_name,
        nct_number: updatedStudy.nct_number,
      } : null)

      setIsEditing(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    )
  }

  if (!study) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Study not found</div>
        </div>
      </div>
    )
  }

  // Allow team management for all authenticated users (simplified)
  const canManageTeam = true

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{study.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  {study.phase && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      {study.phase}
                    </span>
                  )}
                  {study.indication && <span>{study.indication}</span>}
                  {study.protocol_number && (
                    <span className="text-gray-400">|</span>
                  )}
                  {study.protocol_number && (
                    <span>Protocol: {study.protocol_number}</span>
                  )}
                </div>
              </div>
              {/* Status Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Status:</label>
                <select
                  value={study.status || 'pending_irb_submission'}
                  onChange={(e) => handleStatusChange(e.target.value as StudyStatus)}
                  disabled={updatingStatus}
                  className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-1.5 border disabled:opacity-50"
                >
                  {STUDY_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                {updatingStatus && (
                  <svg className="animate-spin h-4 w-4 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </div>
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
                {/* Administrative Information Section */}
                <div className="pb-6 border-b">
                  {/* Edit/Save/Cancel buttons */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Study Information</h3>
                    {canEdit && !isEditing && (
                      <button
                        onClick={handleStartEdit}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>
                    )}
                    {isEditing && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          {saving ? (
                            <>
                              <svg className="animate-spin -ml-0.5 mr-1.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </>
                          ) : 'Save Changes'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Display mode */}
                  {!isEditing ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Target Enrollment</h3>
                        <p className="mt-1 text-lg text-gray-900">{study.target_enrollment || 'Not specified'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">GCO Number</h3>
                        <p className="mt-1 text-lg text-gray-900">{study.gco_number || 'Not set'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">PI Fund Number</h3>
                        <p className="mt-1 text-lg text-gray-900">{study.fund_number || 'Not set'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Protocol Number</h3>
                        <p className="mt-1 text-lg text-gray-900">{study.protocol_number || 'Not set'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Sponsor</h3>
                        <p className="mt-1 text-lg text-gray-900">{study.sponsor_name || 'Not set'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">NCT Number</h3>
                        <p className="mt-1 text-lg text-gray-900">
                          {study.nct_number ? (
                            <a
                              href={`https://clinicaltrials.gov/study/${study.nct_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-800 underline"
                            >
                              {study.nct_number}
                            </a>
                          ) : (
                            'Not set'
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Edit mode */
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Target Enrollment</label>
                        <input
                          type="number"
                          value={editForm.target_enrollment}
                          onChange={(e) => setEditForm({ ...editForm, target_enrollment: parseInt(e.target.value) || 0 })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">GCO Number</label>
                        <input
                          type="text"
                          value={editForm.gco_number}
                          onChange={(e) => setEditForm({ ...editForm, gco_number: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                          placeholder="Enter GCO number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">PI Fund Number</label>
                        <input
                          type="text"
                          value={editForm.fund_number}
                          onChange={(e) => setEditForm({ ...editForm, fund_number: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                          placeholder="Enter fund number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Protocol Number</label>
                        <input
                          type="text"
                          value={editForm.protocol_number}
                          onChange={(e) => setEditForm({ ...editForm, protocol_number: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                          placeholder="e.g., ABC-001-2024"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Sponsor</label>
                        <input
                          type="text"
                          value={editForm.sponsor_name}
                          onChange={(e) => setEditForm({ ...editForm, sponsor_name: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                          placeholder="Enter sponsor name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">NCT Number</label>
                        <input
                          type="text"
                          value={editForm.nct_number}
                          onChange={(e) => setEditForm({ ...editForm, nct_number: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                          placeholder="e.g., NCT12345678"
                        />
                      </div>
                    </div>
                  )}
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

                    {/* Success message */}
                    {successMessage && !inviteUrl && (
                      <div className="rounded-md bg-green-50 p-3">
                        <p className="text-sm text-green-800">{successMessage}</p>
                      </div>
                    )}

                    {/* Invite URL display */}
                    {inviteUrl && (
                      <div className="rounded-md bg-blue-50 p-4 space-y-2">
                        <p className="text-sm text-blue-800">{successMessage}</p>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value={inviteUrl}
                            className="flex-1 text-sm bg-white border border-blue-200 rounded px-3 py-2"
                          />
                          <button
                            type="button"
                            onClick={copyInviteLink}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
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
