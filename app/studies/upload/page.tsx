'use client'

import { useState } from 'react'

export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

interface ExtractedData {
  name: string
  phase: string
  indication: string
  inclusion_criteria: string[]
  exclusion_criteria: string[]
  visit_schedule: string[]
  target_enrollment: number
}

export default function UploadProtocolPage() {
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB')
        return
      }
      if (selectedFile.type !== 'application/pdf') {
        setError('Only PDF files are allowed')
        return
      }
      setFile(selectedFile)
      setError('')
      setExtractedData(null)
    }
  }

  const handleExtract = async () => {
    if (!file) return

    setExtracting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/extract-protocol', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to extract protocol data')
      }

      const data = await response.json()
      setExtractedData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to extract protocol data')
    } finally {
      setExtracting(false)
    }
  }

  const handleCreateStudy = async () => {
    if (!extractedData) return

    setCreating(true)
    setError('')

    try {
      const response = await fetch('/api/studies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(extractedData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create study')
      }

      const { study } = await response.json()
      router.push(`/studies/${study.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create study')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Protocol</h1>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Protocol PDF (max 50MB)
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {file && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* Extract Button */}
              <div>
                <button
                  onClick={handleExtract}
                  disabled={!file || extracting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {extracting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Extracting protocol data...
                    </>
                  ) : (
                    'Extract Protocol Data'
                  )}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Extracted Data Review */}
              {extractedData && (
                <div className="border-t pt-6 space-y-6">
                  <h2 className="text-lg font-medium text-gray-900">Review Extracted Data</h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Study Name</label>
                    <input
                      type="text"
                      value={extractedData.name}
                      onChange={(e) => setExtractedData({ ...extractedData, name: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
                      <input
                        type="text"
                        value={extractedData.phase}
                        onChange={(e) => setExtractedData({ ...extractedData, phase: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Enrollment</label>
                      <input
                        type="number"
                        value={extractedData.target_enrollment}
                        onChange={(e) => setExtractedData({ ...extractedData, target_enrollment: parseInt(e.target.value) })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Indication</label>
                    <input
                      type="text"
                      value={extractedData.indication}
                      onChange={(e) => setExtractedData({ ...extractedData, indication: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inclusion Criteria</label>
                    <ul className="mt-2 border rounded-md p-4 bg-gray-50 space-y-1">
                      {extractedData.inclusion_criteria.map((criterion, index) => (
                        <li key={index} className="text-sm text-gray-700">• {criterion}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exclusion Criteria</label>
                    <ul className="mt-2 border rounded-md p-4 bg-gray-50 space-y-1">
                      {extractedData.exclusion_criteria.map((criterion, index) => (
                        <li key={index} className="text-sm text-gray-700">• {criterion}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visit Schedule</label>
                    <ul className="mt-2 border rounded-md p-4 bg-gray-50 space-y-1">
                      {extractedData.visit_schedule.map((visit, index) => (
                        <li key={index} className="text-sm text-gray-700">• {visit}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={handleCreateStudy}
                    disabled={creating}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Creating Study...' : 'Confirm & Create Study'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
