'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { currencyOptions } from '@/lib/currencies'

const EXPENSE_CATEGORIES = [
  'Software',
  'Travel',
  'Tools',
  'Office Supplies',
  'Marketing',
  'Professional Services',
  'Internet',
  'Phone',
  'Equipment',
  'Other',
]

export default function NewExpensePage() {
  const router = useRouter()
  const [category, setCategory] = useState('Software')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState(1)
  const [project, setProject] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadUserSettings()
  }, [])

  const loadUserSettings = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('users')
      .select('default_currency')
      .eq('id', user.id)
      .single()

    if (data?.default_currency) {
      setCurrency(data.default_currency)
      setBaseCurrency(data.default_currency)
      setExchangeRate(1)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (currency !== baseCurrency && (!exchangeRate || exchangeRate <= 0)) {
      setError('Please provide a valid exchange rate to your base currency')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const baseAmount = parseFloat(amount || '0') * exchangeRate

    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      category,
      amount: parseFloat(amount),
      currency,
      base_currency: baseCurrency,
      exchange_rate_to_base: exchangeRate,
      base_amount: baseAmount,
      date,
      project: project || null,
      note: note || null,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard/expenses')
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Add New Expense</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category *
          </label>
          <select
            id="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
          >
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="project" className="block text-sm font-medium text-gray-700">
            Project / Tag
          </label>
          <input
            type="text"
            id="project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="e.g. ACME - Website redesign"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount *
            </label>
            <input
              type="number"
              id="amount"
              required
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
              Currency
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => {
                const nextCurrency = e.target.value
                setCurrency(nextCurrency)
                if (nextCurrency === baseCurrency) {
                  setExchangeRate(1)
                }
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            >
              {currencyOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Base currency: {baseCurrency}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="exchangeRate" className="block text-sm font-medium text-gray-700">
              Exchange Rate to {baseCurrency}
            </label>
            <input
              type="number"
              id="exchangeRate"
              min="0"
              step="0.000001"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              disabled={currency === baseCurrency}
            />
            <p className="mt-1 text-xs text-gray-500">1 {currency} = {exchangeRate || 0} {baseCurrency}</p>
          </div>
          <div className="flex items-end text-xs text-gray-500">
            <div>
              Base Amount: {baseCurrency} {(parseFloat(amount || '0') * exchangeRate).toFixed(2)}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
            Date *
          </label>
          <input
            type="date"
            id="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
          />
        </div>

        <div>
          <label htmlFor="note" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            placeholder="Optional notes about this expense"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  )
}

