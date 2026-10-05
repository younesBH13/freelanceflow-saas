'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import StripeCheckout from '@/components/StripeCheckout'
import { currencyOptions } from '@/lib/currencies'

export default function SettingsPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [defaultTaxRate, setDefaultTaxRate] = useState('0')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setName(data.name || '')
      setEmail(data.email || user.email || '')
      setDefaultCurrency(data.default_currency || 'USD')
    }

    // Load subscription
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subData) {
      setSubscription(subData)
    }

    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('users')
      .update({
        name,
        default_currency: defaultCurrency,
      })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      setSuccess(true)
      setSaving(false)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading settings...</div>
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            Settings saved successfully!
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 sm:text-sm px-3 py-2 border"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed here</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            {subscription?.plan === 'pro' ? (
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Current Plan: <span className="text-indigo-600">Pro</span>
                </p>
                <p className="text-xs text-gray-600">
                  Status: <span className="capitalize">{subscription.status}</span>
                </p>
                {subscription.renewal_date && (
                  <p className="text-xs text-gray-600 mt-1">
                    Renewal Date: {new Date(subscription.renewal_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Current Plan: <span className="text-gray-600">Free</span>
                </p>
                <p className="text-xs text-gray-600 mb-4">
                  Upgrade to Pro for unlimited invoices, expenses, and advanced features.
                </p>
                <StripeCheckout />
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Defaults</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="defaultCurrency" className="block text-sm font-medium text-gray-700">
                Default Currency
              </label>
              <select
                id="defaultCurrency"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="defaultTaxRate" className="block text-sm font-medium text-gray-700">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                id="defaultTaxRate"
                min="0"
                max="100"
                step="0.01"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
              <p className="mt-1 text-xs text-gray-500">This will be used as default when creating new invoices</p>
            </div>

            <div>
              <label htmlFor="paymentTerms" className="block text-sm font-medium text-gray-700">
                Payment Terms
              </label>
              <input
                type="text"
                id="paymentTerms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="e.g., Net 30, Due on receipt"
              />
              <p className="mt-1 text-xs text-gray-500">Default payment terms text for invoices</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

