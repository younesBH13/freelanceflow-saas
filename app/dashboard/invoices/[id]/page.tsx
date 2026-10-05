'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface Invoice {
  id: string
  invoice_number: string
  status: string
  issue_date: string
  due_date: string
  currency: string
  base_currency?: string
  exchange_rate_to_base?: number
  subtotal: number
  tax: number
  total: number
  base_subtotal?: number
  base_tax?: number
  base_total?: number
  is_recurring?: boolean
  recurrence_interval?: string | null
  next_invoice_date?: string | null
  project?: string | null
  notes: string | null
  client: {
    name: string
    email: string | null
    country: string | null
  }
  items: Array<{
    id: string
    description: string
    quantity: number
    unit_price: number
    line_total: number
  }>
}

export default function InvoicePage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  useEffect(() => {
    loadInvoice()
  }, [invoiceId])

  const loadInvoice = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(name, email, country),
        items:invoice_items(*)
      `)
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error loading invoice:', error)
      setLoading(false)
    } else {
      setInvoice(data as any)
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!invoice) return

    setGeneratingPDF(true)
    const element = document.getElementById('invoice-content')
    if (!element) {
      setGeneratingPDF(false)
      return
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
      })
      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const pageHeight = 295
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`invoice-${invoice.invoice_number}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return

    const supabase = createClient()
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoice.id)

    if (error) {
      alert('Error updating status: ' + error.message)
    } else {
      loadInvoice()
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading invoice...</div>
  }

  if (!invoice) {
    return <div className="text-center py-12">Invoice not found</div>
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoice {invoice.invoice_number}</h1>
          <p className="mt-2 text-sm text-gray-600">
            Status: <span className="font-medium capitalize">{invoice.status}</span>
            {invoice.is_recurring && invoice.next_invoice_date && (
              <span className="ml-3 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
                Recurring ({invoice.recurrence_interval}) • Next: {format(new Date(invoice.next_invoice_date), 'MMM dd, yyyy')}
              </span>
            )}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {generatingPDF ? 'Generating...' : 'Download PDF'}
          </button>
          <select
            value={invoice.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <button
            onClick={() => router.push(`/dashboard/invoices/${invoice.id}/edit`)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Edit
          </button>
        </div>
      </div>

      <div id="invoice-content" className="bg-white shadow rounded-lg p-8">
        <div className="mb-8">
        <div className="flex justify-between">
          <div>
            <h2 className="text-2xl font-bold">INVOICE</h2>
            <p className="text-gray-600 mt-2">Invoice #{invoice.invoice_number}</p>
            {invoice.base_currency && (
              <p className="text-xs text-gray-500 mt-1">
                Base currency: {invoice.base_currency} (1 {invoice.currency} = {invoice.exchange_rate_to_base || 1} {invoice.base_currency})
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Issue Date</p>
            <p className="font-medium">{format(new Date(invoice.issue_date), 'MMM dd, yyyy')}</p>
              <p className="text-sm text-gray-600 mt-2">Due Date</p>
              <p className="font-medium">{format(new Date(invoice.due_date), 'MMM dd, yyyy')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Bill To:</h3>
            <p className="text-gray-700">{invoice.client.name}</p>
            {invoice.client.email && (
              <p className="text-gray-600 text-sm">{invoice.client.email}</p>
            )}
            {invoice.client.country && (
              <p className="text-gray-600 text-sm">{invoice.client.country}</p>
            )}
            {invoice.project && (
              <p className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                Project: {invoice.project}
              </p>
            )}
          </div>
        </div>

        <div className="mb-8">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{item.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {invoice.currency} {Number(item.unit_price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {invoice.currency} {Number(item.line_total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{invoice.currency} {Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium">{invoice.currency} {Number(invoice.tax).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>{invoice.currency} {Number(invoice.total).toFixed(2)}</span>
            </div>
            {invoice.base_currency && (
              <div className="mt-3 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Base Subtotal:</span>
                  <span className="font-medium">{invoice.base_currency} {Number(invoice.base_subtotal || invoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Base Tax:</span>
                  <span className="font-medium">{invoice.base_currency} {Number(invoice.base_tax || invoice.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Base Total:</span>
                  <span>{invoice.base_currency} {Number(invoice.base_total || invoice.total).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 pt-8 border-t">
            <h3 className="font-semibold text-gray-900 mb-2">Notes:</h3>
            <p className="text-gray-600">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

