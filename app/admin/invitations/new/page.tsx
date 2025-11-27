'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewInvitationPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'coordinator' | 'pi' | 'admin'>('coordinator')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invitation')
      }

      // Show the invite URL
      setInviteUrl(`${window.location.origin}${data.inviteUrl}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(inviteUrl)
  }

  if (inviteUrl) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Invitation Created</h1>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800 mb-2">
            Send this link to <strong>{email}</strong>:
          </p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 text-sm bg-white border border-green-300 rounded px-3 py-2"
            />
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={() => {
              setEmail('')
              setInviteUrl('')
            }}
            className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
          >
            Create Another
          </button>
          <Link
            href="/admin/invitations"
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
          >
            View All Invitations
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Invitation</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                id="role-coordinator"
                name="role"
                type="radio"
                value="coordinator"
                checked={role === 'coordinator'}
                onChange={(e) => setRole(e.target.value as 'coordinator')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <label htmlFor="role-coordinator" className="ml-3 block text-sm text-gray-700">
                <span className="font-medium">Coordinator</span>
                <span className="text-gray-500"> - Can view assigned studies and add patients</span>
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="role-pi"
                name="role"
                type="radio"
                value="pi"
                checked={role === 'pi'}
                onChange={(e) => setRole(e.target.value as 'pi')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <label htmlFor="role-pi" className="ml-3 block text-sm text-gray-700">
                <span className="font-medium">PI</span>
                <span className="text-gray-500"> - Can create studies and manage teams</span>
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="role-admin"
                name="role"
                type="radio"
                value="admin"
                checked={role === 'admin'}
                onChange={(e) => setRole(e.target.value as 'admin')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <label htmlFor="role-admin" className="ml-3 block text-sm text-gray-700">
                <span className="font-medium">Admin</span>
                <span className="text-gray-500"> - Full system access</span>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <Link
            href="/admin/invitations"
            className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Invitation'}
          </button>
        </div>
      </form>
    </div>
  )
}
