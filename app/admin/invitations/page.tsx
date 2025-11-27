'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Invitation {
  id: string
  email: string
  role: 'admin' | 'pi' | 'coordinator'
  status: 'pending' | 'accepted' | 'expired'
  token: string
  expires_at: string
  created_at: string
  invited_by_user: {
    email: string
    name: string | null
  } | null
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  useEffect(() => {
    fetchInvitations()
  }, [])

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/admin/invitations')
      if (!response.ok) {
        throw new Error('Failed to fetch invitations')
      }
      const data = await response.json()
      setInvitations(data.invitations)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invitation?')) return

    try {
      const response = await fetch(`/api/admin/invitations?id=${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete invitation')
      }
      await fetchInvitations()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const copyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const getStatusBadgeColor = (status: string, expiresAt: string) => {
    if (status === 'accepted') return 'bg-green-100 text-green-800'
    if (status === 'expired' || new Date(expiresAt) < new Date()) return 'bg-gray-100 text-gray-800'
    return 'bg-yellow-100 text-yellow-800'
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'pi':
        return 'bg-blue-100 text-blue-800'
      case 'coordinator':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading invitations...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invitations</h1>
        <Link
          href="/admin/invitations/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          + New Invitation
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invitations.map((invite) => (
              <tr key={invite.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{invite.email}</div>
                  <div className="text-xs text-gray-500">
                    by {invite.invited_by_user?.name || invite.invited_by_user?.email || 'Unknown'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(invite.role)}`}>
                    {invite.role === 'pi' ? 'PI' : invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(invite.status, invite.expires_at)}`}>
                    {invite.status === 'pending' && new Date(invite.expires_at) < new Date()
                      ? 'Expired'
                      : invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(invite.expires_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  {invite.status === 'pending' && new Date(invite.expires_at) > new Date() && (
                    <button
                      onClick={() => copyInviteLink(invite.token)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      {copiedToken === invite.token ? 'Copied!' : 'Copy Link'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(invite.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {invitations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No invitations yet
          </div>
        )}
      </div>
    </div>
  )
}
