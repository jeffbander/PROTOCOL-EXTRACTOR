'use client'

import { useState, useEffect } from 'react'
export const dynamic = 'force-dynamic'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { BudgetData, CTAData, formatCurrency } from '@/lib/mistral-budget-cta'

type DocumentType = 'budget' | 'cta'

export default function UploadBudgetCTAPage() {
  const params = useParams()
  const router = useRouter()
  const studyId = params.id as string
  const supabase = createClient()

  // User state
  const [userEmail, setUserEmail] = useState<string | undefined>()
  const [userRole, setUserRole] = useState<string | undefined>()
  const [studyName, setStudyName] = useState<string>('')

  // Upload state
  const [documentType, setDocumentType] = useState<DocumentType>('budget')
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Extracted data
  const [extractedBudget, setExtractedBudget] = useState<BudgetData | null>(null)
  const [extractedCTA, setExtractedCTA] = useState<CTAData | null>(null)

  useEffect(() => {
    fetchUserAndStudy()
  }, [studyId])

  const fetchUserAndStudy = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserEmail(user.email)
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || 'pi')
    }

    // Fetch study name
    const response = await fetch(`/api/studies/${studyId}`)
    if (response.ok) {
      const data = await response.json()
      setStudyName(data.study?.name || 'Unknown Study')
    }
  }

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
      setExtractedBudget(null)
      setExtractedCTA(null)
      setSuccessMessage('')
    }
  }

  const handleExtract = async () => {
    if (!file) return

    setExtracting(true)
    setError('')
    setSuccessMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const endpoint = documentType === 'budget' ? '/api/extract-budget' : '/api/extract-cta'
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to extract ${documentType} data`)
      }

      const data = await response.json()

      if (documentType === 'budget') {
        setExtractedBudget(data)
        setExtractedCTA(null)
      } else {
        setExtractedCTA(data)
        setExtractedBudget(null)
      }
    } catch (err: any) {
      setError(err.message || `Failed to extract ${documentType} data`)
    } finally {
      setExtracting(false)
    }
  }

  const handleSave = async () => {
    if (!extractedBudget && !extractedCTA) return

    setSaving(true)
    setError('')

    try {
      const updateData: Record<string, any> = {}

      if (documentType === 'budget' && extractedBudget) {
        updateData.budget_data = extractedBudget
      } else if (documentType === 'cta' && extractedCTA) {
        updateData.cta_data = extractedCTA
      }

      const response = await fetch(`/api/studies/${studyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save data')
      }

      setSuccessMessage(`${documentType === 'budget' ? 'Budget' : 'CTA'} data saved successfully!`)

      // Redirect back to study page after short delay
      setTimeout(() => {
        router.push(`/studies/${studyId}`)
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to save data')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Breadcrumb */}
          <div className="mb-4">
            <button
              onClick={() => router.push(`/studies/${studyId}`)}
              className="text-primary-600 hover:text-primary-800 text-sm flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to {studyName || 'Study'}
            </button>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Budget or CTA Document</h1>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="space-y-6">
              {/* Document Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentType('budget')
                      setFile(null)
                      setExtractedBudget(null)
                      setExtractedCTA(null)
                      setError('')
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      documentType === 'budget'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Budget Document
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentType('cta')
                      setFile(null)
                      setExtractedBudget(null)
                      setExtractedCTA(null)
                      setError('')
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      documentType === 'cta'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    CTA (Clinical Trial Agreement)
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {documentType === 'budget'
                    ? 'Upload a budget document to extract payment amounts, procedures, and reimbursement details.'
                    : 'Upload a Clinical Trial Agreement to extract payment terms, invoice requirements, and key contacts.'}
                </p>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {documentType === 'budget' ? 'Budget' : 'CTA'} PDF (max 50MB)
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
                      Extracting {documentType === 'budget' ? 'budget' : 'CTA'} data...
                    </>
                  ) : (
                    `Extract ${documentType === 'budget' ? 'Budget' : 'CTA'} Data`
                  )}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="rounded-md bg-green-50 p-4">
                  <p className="text-sm text-green-800">{successMessage}</p>
                </div>
              )}

              {/* Budget Data Review */}
              {extractedBudget && (
                <div className="border-t pt-6 space-y-6">
                  <h2 className="text-lg font-medium text-gray-900">Review Extracted Budget Data</h2>

                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {extractedBudget.per_patient_total && (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Per Patient Total</p>
                        <p className="text-xl font-bold text-green-700">
                          {formatCurrency(extractedBudget.per_patient_total, extractedBudget.currency)}
                        </p>
                      </div>
                    )}
                    {extractedBudget.screen_failure_payment && (
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Screen Failure</p>
                        <p className="text-xl font-bold text-yellow-700">
                          {formatCurrency(extractedBudget.screen_failure_payment, extractedBudget.currency)}
                        </p>
                      </div>
                    )}
                    {extractedBudget.startup_costs && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Startup Costs</p>
                        <p className="text-xl font-bold text-blue-700">
                          {formatCurrency(extractedBudget.startup_costs, extractedBudget.currency)}
                        </p>
                      </div>
                    )}
                    {extractedBudget.closeout_costs && (
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Closeout Costs</p>
                        <p className="text-xl font-bold text-purple-700">
                          {formatCurrency(extractedBudget.closeout_costs, extractedBudget.currency)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Visit Payments */}
                  {extractedBudget.visit_payments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Visit Payments ({extractedBudget.visit_payments.length})</h3>
                      <div className="border rounded-md overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Visit</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Payment</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Procedures</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {extractedBudget.visit_payments.map((visit, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 text-sm text-gray-900">{visit.visit_name}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                                  {formatCurrency(visit.total_payment, visit.currency)}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500">
                                  {visit.procedures_included.slice(0, 3).join(', ')}
                                  {visit.procedures_included.length > 3 && '...'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Procedure Payments */}
                  {extractedBudget.procedure_payments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Procedure Payments ({extractedBudget.procedure_payments.length})</h3>
                      <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Procedure</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Payment</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Visit</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {extractedBudget.procedure_payments.map((proc, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 text-sm text-gray-900">{proc.procedure_name}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                                  {formatCurrency(proc.payment_amount, proc.currency)}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500">{proc.visit_associated || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Milestone Payments */}
                  {extractedBudget.milestone_payments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Milestone Payments</h3>
                      <ul className="border rounded-md p-4 bg-gray-50 space-y-2">
                        {extractedBudget.milestone_payments.map((milestone, index) => (
                          <li key={index} className="flex justify-between text-sm">
                            <span className="text-gray-700">{milestone.milestone_name}</span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(milestone.payment_amount, milestone.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Payment Terms */}
                  {extractedBudget.payment_terms && Object.keys(extractedBudget.payment_terms).some(k => extractedBudget.payment_terms[k as keyof typeof extractedBudget.payment_terms]) && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Terms</h3>
                      <div className="border rounded-md p-4 bg-gray-50 grid grid-cols-2 gap-4">
                        {extractedBudget.payment_terms.payment_frequency && (
                          <div>
                            <p className="text-xs text-gray-500">Frequency</p>
                            <p className="text-sm text-gray-900">{extractedBudget.payment_terms.payment_frequency}</p>
                          </div>
                        )}
                        {extractedBudget.payment_terms.payment_timeline && (
                          <div>
                            <p className="text-xs text-gray-500">Timeline</p>
                            <p className="text-sm text-gray-900">{extractedBudget.payment_terms.payment_timeline}</p>
                          </div>
                        )}
                        {extractedBudget.payment_terms.invoice_process && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">Invoice Process</p>
                            <p className="text-sm text-gray-900">{extractedBudget.payment_terms.invoice_process}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Budget Data to Study'}
                  </button>
                </div>
              )}

              {/* CTA Data Review */}
              {extractedCTA && (
                <div className="border-t pt-6 space-y-6">
                  <h2 className="text-lg font-medium text-gray-900">Review Extracted CTA Data</h2>

                  {/* Agreement Info */}
                  <div className="grid grid-cols-2 gap-4">
                    {extractedCTA.agreement_number && (
                      <div>
                        <p className="text-xs text-gray-500">Agreement Number</p>
                        <p className="text-sm font-medium text-gray-900">{extractedCTA.agreement_number}</p>
                      </div>
                    )}
                    {extractedCTA.sponsor_name && (
                      <div>
                        <p className="text-xs text-gray-500">Sponsor</p>
                        <p className="text-sm font-medium text-gray-900">{extractedCTA.sponsor_name}</p>
                      </div>
                    )}
                    {extractedCTA.site_name && (
                      <div>
                        <p className="text-xs text-gray-500">Site</p>
                        <p className="text-sm font-medium text-gray-900">{extractedCTA.site_name}</p>
                      </div>
                    )}
                    {extractedCTA.references_budget_amendment && (
                      <div>
                        <p className="text-xs text-gray-500">Budget Reference</p>
                        <p className="text-sm font-medium text-gray-900">{extractedCTA.references_budget_amendment}</p>
                      </div>
                    )}
                  </div>

                  {/* Payment Information */}
                  {extractedCTA.payment_info && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Information</h3>
                      <div className="border rounded-md p-4 bg-gray-50 grid grid-cols-2 gap-4">
                        {extractedCTA.payment_info.payment_method && (
                          <div>
                            <p className="text-xs text-gray-500">Payment Method</p>
                            <p className="text-sm text-gray-900">{extractedCTA.payment_info.payment_method}</p>
                          </div>
                        )}
                        {extractedCTA.payment_info.payment_currency && (
                          <div>
                            <p className="text-xs text-gray-500">Currency</p>
                            <p className="text-sm text-gray-900">{extractedCTA.payment_info.payment_currency}</p>
                          </div>
                        )}
                        {extractedCTA.payment_info.billing_address && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">Billing Address</p>
                            <p className="text-sm text-gray-900">{extractedCTA.payment_info.billing_address}</p>
                          </div>
                        )}
                        {extractedCTA.payment_info.tax_requirements && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">Tax Requirements</p>
                            <p className="text-sm text-gray-900">{extractedCTA.payment_info.tax_requirements}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Invoice Requirements */}
                  {extractedCTA.invoice_requirements && extractedCTA.invoice_requirements.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Invoice Requirements</h3>
                      <ul className="border rounded-md p-4 bg-gray-50 space-y-1">
                        {extractedCTA.invoice_requirements.map((req, index) => (
                          <li key={index} className="text-sm text-gray-700">• {req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Invoice Submission */}
                  {(extractedCTA.invoice_submission_method || extractedCTA.invoice_submission_address) && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Invoice Submission</h3>
                      <div className="border rounded-md p-4 bg-gray-50">
                        {extractedCTA.invoice_submission_method && (
                          <p className="text-sm text-gray-900">
                            <span className="text-gray-500">Method:</span> {extractedCTA.invoice_submission_method}
                          </p>
                        )}
                        {extractedCTA.invoice_submission_address && (
                          <p className="text-sm text-gray-900 mt-1">
                            <span className="text-gray-500">Submit to:</span> {extractedCTA.invoice_submission_address}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Key Contacts */}
                  {(extractedCTA.sponsor_contact_name || extractedCTA.financial_contact_name) && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Key Contacts</h3>
                      <div className="border rounded-md p-4 bg-gray-50 space-y-2">
                        {extractedCTA.sponsor_contact_name && (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{extractedCTA.sponsor_contact_name}</p>
                            <p className="text-sm text-gray-500">{extractedCTA.sponsor_contact_email || 'Sponsor Contact'}</p>
                          </div>
                        )}
                        {extractedCTA.financial_contact_name && (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{extractedCTA.financial_contact_name}</p>
                            <p className="text-sm text-gray-500">{extractedCTA.financial_contact_email || 'Financial Contact'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Important Notes */}
                  {extractedCTA.important_notes && extractedCTA.important_notes.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Important Notes</h3>
                      <ul className="border rounded-md p-4 bg-yellow-50 space-y-1">
                        {extractedCTA.important_notes.map((note, index) => (
                          <li key={index} className="text-sm text-gray-700">• {note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save CTA Data to Study'}
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
