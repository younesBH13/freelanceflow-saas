'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { currencyOptions } from '@/lib/currencies'

interface Client {
  id: string
  name: string
  currency: string | null
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string

  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('draft')
  const [project, setProject] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [exchangeRate, setExchangeRate] = useState(1)
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<'monthly' | 'quarterly'>('monthly')
  const [nextInvoiceDate, setNextInvoiceDate] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [invoiceId])

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('default_currency')
      .eq('id', user.id)
      .single()

    // Load clients
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name, currency')
      .eq('user_id', user.id)
      .order('name')
    if (clientsData) setClients(clientsData)

    // Load invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        items:invoice_items(*)
      `)
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      setError('Invoice not found')
      setLoading(false)
      return
    }

    setSelectedClientId(invoice.client_id)
    setInvoiceNumber(invoice.invoice_number)
    setIssueDate(format(new Date(invoice.issue_date), 'yyyy-MM-dd'))
    setDueDate(format(new Date(invoice.due_date), 'yyyy-MM-dd'))
    setStatus(invoice.status)
    setProject(invoice.project || '')
    setCurrency(invoice.currency)
    setBaseCurrency(invoice.base_currency || profile?.default_currency || invoice.currency)
    setExchangeRate(invoice.exchange_rate_to_base || 1)
    setIsRecurring(Boolean(invoice.is_recurring))
    setRecurrenceInterval((invoice.recurrence_interval as 'monthly' | 'quarterly') || 'monthly')
    setNextInvoiceDate(invoice.next_invoice_date ? format(new Date(invoice.next_invoice_date), 'yyyy-MM-dd') : '')
    const calculatedTaxRate = Number(invoice.subtotal) > 0 ? (Number(invoice.tax) / Number(invoice.subtotal)) * 100 : 0
    setTaxRate(calculatedTaxRate)
    setNotes(invoice.notes || '')
    setItems((invoice.items as any[]) || [])
    setLoading(false)
  }

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unit_price') {
          updated.line_total = updated.quantity * updated.unit_price
        }
        return updated
      }
      return item
    }))
  }

  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0,
    }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  const calculateNextInvoiceDate = (startDate: string, interval: 'monthly' | 'quarterly') => {
    const baseDate = new Date(startDate)
    const next = new Date(baseDate)
    next.setMonth(baseDate.getMonth() + (interval === 'monthly' ? 1 : 3))
    return next
  }

  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)
  const tax = subtotal * (taxRate / 100)
  const total = subtotal + tax
  const baseSubtotal = subtotal * exchangeRate
  const baseTax = tax * exchangeRate
  const baseTotal = total * exchangeRate

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (currency !== baseCurrency && (!exchangeRate || exchangeRate <= 0)) {
      setError('Please provide a valid exchange rate to your base currency')
      return
    }

    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Update invoice
    const { error: invoiceError } = await supabase
      .from('invoices')
      .update({
        client_id: selectedClientId,
        invoice_number: invoiceNumber,
        status,
        issue_date: issueDate,
        due_date: dueDate,
        project: project || null,
        currency,
        subtotal,
        tax,
        total,
        base_currency: baseCurrency,
        exchange_rate_to_base: exchangeRate,
        base_subtotal: baseSubtotal,
        base_tax: baseTax,
        base_total: baseTotal,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? recurrenceInterval : null,
        next_invoice_date: isRecurring ? nextInvoiceDate : null,
        notes: notes || null,
      })
      .eq('id', invoiceId)
      .eq('user_id', user.id)

    if (invoiceError) {
      setError(invoiceError.message)
      setSaving(false)
      return
    }

    // Delete existing items
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)

    // Insert new items
    const invoiceItems = items.map(item => ({
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    }))

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems)

    if (itemsError) {
      setError(itemsError.message)
      setSaving(false)
    } else {
      router.push(`/dashboard/invoices/${invoiceId}`)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Edit Invoice</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="client" className="block text-sm font-medium text-gray-700">
              Client *
            </label>
            <select
              id="client"
              required
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            >
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
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
              placeholder="e.g. Website redesign"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700">
              Invoice Number *
            </label>
            <input
              type="text"
              id="invoiceNumber"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="issueDate" className="block text-sm font-medium text-gray-700">
              Issue Date *
            </label>
            <input
              type="date"
              id="issueDate"
              required
              value={issueDate}
              onChange={(e) => {
                setIssueDate(e.target.value)
                if (isRecurring) {
                  const nextDate = calculateNextInvoiceDate(e.target.value, recurrenceInterval)
                  setNextInvoiceDate(format(nextDate, 'yyyy-MM-dd'))
                }
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">
              Due Date *
            </label>
            <input
              type="date"
              id="dueDate"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
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
              Base Total: {baseCurrency} {baseTotal.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 border rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <input
              id="isRecurring"
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => {
                setIsRecurring(e.target.checked)
                if (e.target.checked) {
                  const nextDate = calculateNextInvoiceDate(issueDate, recurrenceInterval)
                  setNextInvoiceDate(format(nextDate, 'yyyy-MM-dd'))
                }
              }}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
            <div>
              <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700">
                Make this a recurring invoice
              </label>
              <p className="text-xs text-gray-500">Automatically generate new invoices using this schedule.</p>
            </div>
          </div>

          {isRecurring && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="recurrenceInterval" className="block text-sm font-medium text-gray-700">
                  Recurrence
                </label>
                <select
                  id="recurrenceInterval"
                  value={recurrenceInterval}
                  onChange={(e) => {
                    const value = e.target.value as 'monthly' | 'quarterly'
                    setRecurrenceInterval(value)
                    const nextDate = calculateNextInvoiceDate(issueDate, value)
                    setNextInvoiceDate(format(nextDate, 'yyyy-MM-dd'))
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div>
                <label htmlFor="nextInvoiceDate" className="block text-sm font-medium text-gray-700">
                  Next Invoice Date
                </label>
                <input
                  type="date"
                  id="nextInvoiceDate"
                  value={nextInvoiceDate}
                  onChange={(e) => setNextInvoiceDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    placeholder="Qty"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  />
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    placeholder="Unit Price"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  />
                </div>
                <div className="w-32 flex items-center">
                  <span className="text-sm font-medium">{currency} {item.line_total.toFixed(2)}</span>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              + Add Item
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700">
              Tax Rate (%)
            </label>
            <input
              type="number"
              id="taxRate"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-end space-x-4 text-sm">
            <div>
              <span className="text-gray-600">Subtotal:</span>
              <span className="ml-2 font-medium">{currency} {subtotal.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Tax:</span>
              <span className="ml-2 font-medium">{currency} {tax.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Total:</span>
              <span className="ml-2 font-bold text-lg">{currency} {total.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-end space-x-4 text-xs text-gray-500 mt-2">
            <div>Base Subtotal: {baseCurrency} {baseSubtotal.toFixed(2)}</div>
            <div>Base Tax: {baseCurrency} {baseTax.toFixed(2)}</div>
            <div className="font-semibold">Base Total: {baseCurrency} {baseTotal.toFixed(2)}</div>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
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
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

