'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { format } from 'date-fns'

interface Expense {
  id: string
  category: string
  amount: number
  currency: string
  base_amount?: number
  base_currency?: string
  date: string
  note: string | null
  project?: string | null
  created_at: string
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterProject, setFilterProject] = useState('all')
  const [baseCurrency, setBaseCurrency] = useState('USD')

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
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
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (error) {
      console.error('Error loading expenses:', error)
    } else {
      setExpenses(data || [])
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)

    if (error) {
      alert('Error deleting expense: ' + error.message)
    } else {
      loadExpenses()
    }
  }

  const categories = Array.from(new Set(expenses.map(e => e.category)))
  const projects = Array.from(new Set(expenses.map(e => e.project).filter(Boolean))) as string[]
  const filteredExpenses = expenses.filter(e => {
    const categoryMatch = filterCategory === 'all' || e.category === filterCategory
    const projectMatch = filterProject === 'all' || e.project === filterProject
    return categoryMatch && projectMatch
  })

  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + Number(exp.base_amount || exp.amount), 0)

  const downloadCSV = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportExpenses = (fileFormat: 'csv' | 'excel') => {
    const headers = [
      'Category',
      'Project',
      'Amount',
      'Currency',
      'Base Amount',
      'Base Currency',
      'Date',
      'Note',
    ]

    const escapeValue = (value: string | number | null | undefined) =>
      `"${String(value ?? '').replace(/"/g, '""')}"`

    const formatDate = (value?: string | null) =>
      value ? format(new Date(value), 'yyyy-MM-dd') : ''

    const rows = expenses.map((exp) => [
      escapeValue(exp.category),
      escapeValue(exp.project || ''),
      escapeValue(Number(exp.amount).toFixed(2)),
      escapeValue(exp.currency),
      escapeValue(Number(exp.base_amount || exp.amount).toFixed(2)),
      escapeValue(exp.base_currency || baseCurrency),
      escapeValue(formatDate(exp.date)),
      escapeValue(exp.note || ''),
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const filename = fileFormat === 'csv' ? 'expenses.csv' : 'expenses.xls'
    const mimeType = fileFormat === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel'
    downloadCSV(csvContent, filename, mimeType)
  }

  if (loading) {
    return <div className="text-center py-12">Loading expenses...</div>
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center mb-8">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track your business expenses
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center gap-3">
          <button
            onClick={() => exportExpenses('csv')}
            className="rounded-md border px-3 py-2 text-sm font-semibold text-gray-700 bg-white shadow-sm hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportExpenses('excel')}
            className="rounded-md border px-3 py-2 text-sm font-semibold text-gray-700 bg-white shadow-sm hover:bg-gray-50"
          >
            Export Excel
          </button>
          <Link
            href="/dashboard/expenses/new"
            className="rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Add expense
          </Link>
        </div>
      </div>

      {expenses.length > 0 && (
        <div className="mb-6 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="category" className="text-sm font-medium text-gray-700">
                Category:
              </label>
              <select
                id="category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="all">All</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="project" className="text-sm font-medium text-gray-700">
                Project:
              </label>
              <select
                id="project"
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="all">All</option>
                {projects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-lg font-semibold">
            Total ({baseCurrency}): {totalAmount.toFixed(2)}
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No expenses yet</p>
          <Link
            href="/dashboard/expenses/new"
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Add your first expense
          </Link>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No expenses in this category</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredExpenses.map((expense) => (
              <li key={expense.id}>
                <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                  <div className="flex-1">
                  <div className="flex items-center">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-indigo-600">
                        {expense.category}
                      </p>
                      {expense.project && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          {expense.project}
                        </span>
                      )}
                    </div>
                    <span className="ml-4 text-sm font-semibold text-gray-900">
                      {expense.currency} {Number(expense.amount).toFixed(2)}
                    </span>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          {format(new Date(expense.date), 'MMM dd, yyyy')}
                        </p>
                        {expense.note && (
                          <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                            {expense.note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

