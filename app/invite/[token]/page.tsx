'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [invitation, setInvitation] = useState<{ email: string; role: string } | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchInvitation()
  }, [token])

  const fetchInvitation = async () => {
    try {
      const response = await fetch(`/api/invitations/${token}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid invitation')
      }

      setInvitation(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      // Send magic link with invitation token in metadata
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: invitation!.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?invitation=${token}`,
          data: {
            name,
            role: invitation!.role,
            invitation_token: token,
          },
        },
      })

      if (authError) throw authError

      setMessage('Check your email for the secure sign-in link to complete your MSFHH Research App registration!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading invitation...</div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invitation</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/auth/login" className="text-primary-600 hover:text-primary-500">
            Go to login
          </a>
        </div>
      </div>
    )
  }

  if (message) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-green-50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-green-900 mb-2">Check Your Email</h2>
            <p className="text-green-700">{message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to MSFHH Research App
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You&apos;ve been invited to join as a{' '}
            <span className="font-medium text-primary-600">
              {invitation?.role === 'pi' ? 'Principal Investigator (PI)' :
               invitation?.role === 'admin' ? 'Administrator' : 'Study Coordinator'}
            </span>
          </p>
          <p className="mt-1 text-center text-xs text-gray-500">
            Clinical Trial Protocol Management Platform
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={invitation?.email || ''}
                disabled
                className="block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm px-3 py-2 border"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                placeholder="John Doe"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Accept Invitation'}
          </button>
        </form>
      </div>
    </div>
  )
}
