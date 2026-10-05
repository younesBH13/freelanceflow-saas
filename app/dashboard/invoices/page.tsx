'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { format } from 'date-fns'

interface Invoice {
  id: string
  invoice_number: string
  status: string
  issue_date: string
  due_date: string
  total: number
  currency: string
  base_total?: number
  base_currency?: string
  is_recurring?: boolean
  next_invoice_date?: string | null
  recurrence_interval?: string | null
  project?: string | null
  client: {
    name: string
  }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [baseCurrency, setBaseCurrency] = useState('USD')

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('default_currency')
      .eq('id', user.id)
      .single()

    if (profile?.default_currency) {
      setBaseCurrency(profile.default_currency)
    }

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        base_total,
        base_currency,
        is_recurring,
        next_invoice_date,
        recurrence_interval,
        client:clients(name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading invoices:', error)
    } else {
      setInvoices(data || [])
    }
    setLoading(false)
  }

  const downloadCSV = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportInvoices = (fileFormat: 'csv' | 'excel') => {
    const headers = [
      'Invoice #',
      'Client',
      'Project',
      'Issue Date',
      'Due Date',
      'Status',
      'Amount',
      'Currency',
      'Base Total',
      'Base Currency',
      'Recurring',
      'Next Invoice Date',
    ]

    const escapeValue = (value: string | number | null | undefined) =>
      `"${String(value ?? '').replace(/"/g, '""')}"`

    const formatDate = (value?: string | null) =>
      value ? format(new Date(value), 'yyyy-MM-dd') : ''

    const rows = invoices.map((inv) => [
      escapeValue(inv.invoice_number),
      escapeValue((inv.client as any)?.name || ''),
      escapeValue(inv.project || ''),
      escapeValue(formatDate(inv.issue_date)),
      escapeValue(formatDate(inv.due_date)),
      escapeValue(inv.status),
      escapeValue(Number(inv.total).toFixed(2)),
      escapeValue(inv.currency),
      escapeValue(Number(inv.base_total ?? inv.total).toFixed(2)),
      escapeValue(inv.base_currency || baseCurrency),
      escapeValue(inv.is_recurring ? inv.recurrence_interval || 'yes' : 'no'),
      escapeValue(formatDate(inv.next_invoice_date)),
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const filename = fileFormat === 'csv' ? 'invoices.csv' : 'invoices.xls'
    const mimeType = fileFormat === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel'
    downloadCSV(csvContent, filename, mimeType)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'sent':
        return 'bg-blue-100 text-blue-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading invoices...</div>
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center mb-8">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create and manage your invoices
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center gap-3">
          <button
            onClick={() => exportInvoices('csv')}
            className="rounded-md border px-3 py-2 text-sm font-semibold text-gray-700 bg-white shadow-sm hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportInvoices('excel')}
            className="rounded-md border px-3 py-2 text-sm font-semibold text-gray-700 bg-white shadow-sm hover:bg-gray-50"
          >
            Export Excel
          </button>
          <Link
            href="/dashboard/invoices/new"
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Create invoice
          </Link>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No invoices yet</p>
          <Link
            href="/dashboard/invoices/new"
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Create your first invoice
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issue Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base Total ({baseCurrency})
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoice_number}
                  </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <div className="flex flex-col">
              <span>{(invoice.client as any)?.name || 'N/A'}</span>
              {invoice.project && (
                <span className="mt-1 inline-flex w-fit items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {invoice.project}
                </span>
              )}
            </div>
          </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(invoice.issue_date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.currency} {Number(invoice.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.base_currency || baseCurrency} {Number(invoice.base_total ?? invoice.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {invoice.is_recurring && invoice.next_invoice_date
                      ? format(new Date(invoice.next_invoice_date), 'MMM dd, yyyy')
                      : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/dashboard/invoices/${invoice.id}`}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      View
                    </Link>
                    <Link
                      href={`/dashboard/invoices/${invoice.id}/edit`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

