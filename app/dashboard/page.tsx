'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  ArrowUpRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    earnings: 0,
    expenses: 0,
    profit: 0,
    invoices: 0,
  })
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [nextRecurringDate, setNextRecurringDate] = useState<string | null>(null)
  const [clients, setClients] = useState<{ id: string; name: string; tag?: string | null }[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState('all')
  const [selectedProject, setSelectedProject] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFilterOptions()
    loadDashboardData()
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [selectedClient, selectedProject])

  const generateInvoiceNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `INV-${year}${month}-${random}`
  }

  const advanceRecurrenceDate = (dateStr: string, interval: string | null) => {
    const date = new Date(dateStr)
    const next = new Date(date)
    next.setMonth(date.getMonth() + (interval === 'quarterly' ? 3 : 1))
    return next.toISOString().split('T')[0]
  }

  const buildRecurringInvoices = async (userId: string) => {
    const supabase = createClient()
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const { data: templates } = await supabase
      .from('invoices')
      .select('*, items:invoice_items(*)')
      .eq('user_id', userId)
      .eq('is_recurring', true)
      .lte('next_invoice_date', todayStr)

    if (!templates || templates.length === 0) return

    for (const template of templates) {
      const issueDate = template.next_invoice_date || todayStr
      const issue = new Date(issueDate)
      const due = new Date(template.due_date)
      const originalIssue = new Date(template.issue_date)
      const dueOffsetDays = Math.max(0, Math.round((due.getTime() - originalIssue.getTime()) / (1000 * 60 * 60 * 24)))
      const newDueDate = new Date(issue)
      newDueDate.setDate(issue.getDate() + dueOffsetDays)

      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({
          user_id: userId,
          client_id: template.client_id,
          invoice_number: generateInvoiceNumber(),
          status: 'draft',
          issue_date: issueDate,
          due_date: newDueDate.toISOString().split('T')[0],
          currency: template.currency,
          subtotal: template.subtotal,
          tax: template.tax,
          total: template.total,
          base_currency: template.base_currency,
          exchange_rate_to_base: template.exchange_rate_to_base,
          base_subtotal: template.base_subtotal,
          base_tax: template.base_tax,
          base_total: template.base_total,
          is_recurring: false,
          recurrence_interval: null,
          next_invoice_date: null,
          last_generated_at: new Date().toISOString(),
          parent_invoice_id: template.id,
          notes: template.notes,
        })
        .select()
        .single()

      if (!error && newInvoice && template.items?.length) {
        const items = (template.items as any[]).map((item) => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        }))
        await supabase.from('invoice_items').insert(items)
      }

      const updatedNextDate = template.recurrence_interval
        ? advanceRecurrenceDate(template.next_invoice_date || todayStr, template.recurrence_interval)
        : null

      await supabase
        .from('invoices')
        .update({
          next_invoice_date: updatedNextDate,
          last_generated_at: new Date().toISOString(),
        })
        .eq('id', template.id)
    }
  }

  const loadFilterOptions = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: clientRows } = await supabase
      .from('clients')
      .select('id, name, tag')
      .eq('user_id', user.id)
      .order('name')

    setClients(clientRows || [])

    const { data: invoiceProjects } = await supabase
      .from('invoices')
      .select('project')
      .eq('user_id', user.id)
      .not('project', 'is', null)

    const { data: expenseProjects } = await supabase
      .from('expenses')
      .select('project')
      .eq('user_id', user.id)
      .not('project', 'is', null)

    const uniqueProjects = Array.from(new Set([
      ...(invoiceProjects || []).map((p: any) => p.project).filter(Boolean),
      ...(expenseProjects || []).map((p: any) => p.project).filter(Boolean),
    ])) as string[]

    setProjects(uniqueProjects)
  }

  const getInvoiceValue = (inv: any) => {
    const base = Number(inv?.base_total ?? 0)
    const fallback = Number(inv?.total ?? 0)
    if (!Number.isFinite(base) || base === 0) return Number.isFinite(fallback) ? fallback : 0
    return base
  }

  const getExpenseValue = (exp: any) => {
    const base = Number(exp?.base_amount ?? 0)
    const fallback = Number(exp?.amount ?? 0)
    if (!Number.isFinite(base) || base === 0) return Number.isFinite(fallback) ? fallback : 0
    return base
  }

  const loadDashboardData = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('default_currency')
      .eq('id', user.id)
      .single()

    const userBaseCurrency = profile?.default_currency || 'USD'
    setBaseCurrency(userBaseCurrency)

    await buildRecurringInvoices(user.id)

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const startOfCurrentMonth = startOfMonth(now)
    const endOfCurrentMonth = endOfMonth(now)

    // Build base invoice and expense queries for the current month
    let invoiceQuery = supabase
      .from('invoices')
      .select('total, base_total, currency, status, client_id, project')
      .eq('user_id', user.id)
      .gte('issue_date', startOfCurrentMonth.toISOString().split('T')[0])
      .lte('issue_date', endOfCurrentMonth.toISOString().split('T')[0])

    if (selectedClient !== 'all') {
      invoiceQuery = invoiceQuery.eq('client_id', selectedClient)
    }

    if (selectedProject !== 'all') {
      invoiceQuery = invoiceQuery.eq('project', selectedProject)
    }

    let expensesQuery = supabase
      .from('expenses')
      .select('amount, base_amount, currency, project')
      .eq('user_id', user.id)
      .gte('date', startOfCurrentMonth.toISOString().split('T')[0])
      .lte('date', endOfCurrentMonth.toISOString().split('T')[0])

    if (selectedProject !== 'all') {
      expensesQuery = expensesQuery.eq('project', selectedProject)
    }

    const monthOffsets = [5, 4, 3, 2, 1, 0]
    const fallbackMonth = (offset: number) => {
      const monthDate = subMonths(now, offset)
      return {
        month: format(monthDate, 'MMM'),
        fullMonth: format(monthDate, 'MMM yyyy'),
        earnings: 0,
        expenses: 0,
        profit: 0,
        invoiceCount: 0,
      }
    }

    const sixMonthStart = startOfMonth(subMonths(now, 5)).toISOString().split('T')[0]
    const sixMonthEnd = endOfCurrentMonth.toISOString().split('T')[0]

    let monthlyInvoicesQuery = supabase
      .from('invoices')
      .select('total, base_total, client_id, project, issue_date')
      .eq('user_id', user.id)
      .gte('issue_date', sixMonthStart)
      .lte('issue_date', sixMonthEnd)

    if (selectedClient !== 'all') {
      monthlyInvoicesQuery = monthlyInvoicesQuery.eq('client_id', selectedClient)
    }

    if (selectedProject !== 'all') {
      monthlyInvoicesQuery = monthlyInvoicesQuery.eq('project', selectedProject)
    }

    let monthlyExpensesQuery = supabase
      .from('expenses')
      .select('amount, base_amount, project, date')
      .eq('user_id', user.id)
      .gte('date', sixMonthStart)
      .lte('date', sixMonthEnd)

    if (selectedProject !== 'all') {
      monthlyExpensesQuery = monthlyExpensesQuery.eq('project', selectedProject)
    }

    let upcomingQuery = supabase
      .from('invoices')
      .select('next_invoice_date')
      .eq('user_id', user.id)
      .eq('is_recurring', true)
      .not('next_invoice_date', 'is', null)
      .gte('next_invoice_date', todayStr)

    if (selectedClient !== 'all') {
      upcomingQuery = upcomingQuery.eq('client_id', selectedClient)
    }

    if (selectedProject !== 'all') {
      upcomingQuery = upcomingQuery.eq('project', selectedProject)
    }

    let recentQuery = supabase
      .from('invoices')
      .select(`
        *,
        client:clients(name)
      `)
      .eq('user_id', user.id)

    if (selectedClient !== 'all') {
      recentQuery = recentQuery.eq('client_id', selectedClient)
    }

    if (selectedProject !== 'all') {
      recentQuery = recentQuery.eq('project', selectedProject)
    }

    const [
      { data: invoices },
      { data: expenses },
      { data: monthlyInvoices },
      { data: monthlyExpenses },
      { data: upcomingRecurring },
      { data: recentInvs },
    ] = await Promise.all([
      invoiceQuery,
      expensesQuery,
      monthlyInvoicesQuery,
      monthlyExpensesQuery,
      upcomingQuery.order('next_invoice_date', { ascending: true }).limit(1),
      recentQuery.order('created_at', { ascending: false }).limit(3),
    ])

    const earnings = invoices?.reduce((sum, inv) => sum + getInvoiceValue(inv), 0) || 0
    const expensesTotal = expenses?.reduce((sum, exp) => sum + getExpenseValue(exp), 0) || 0
    const profit = earnings - expensesTotal
    const totalInvoices = invoices?.length || 0

    setStats({ earnings, expenses: expensesTotal, profit, invoices: totalInvoices })
    const fallback = monthOffsets.map((offset) => fallbackMonth(offset))

    const monthlyAggregates = monthOffsets.map((offset) => {
      const monthDate = subMonths(now, offset)
      const monthKey = format(monthDate, 'yyyy-MM')

      const monthInvoiceRows = (monthlyInvoices || []).filter((inv: any) =>
        format(new Date(inv.issue_date), 'yyyy-MM') === monthKey
      )
      const monthExpenseRows = (monthlyExpenses || []).filter((exp: any) =>
        format(new Date(exp.date), 'yyyy-MM') === monthKey
      )

      const monthEarnings = monthInvoiceRows.reduce((sum: number, inv: any) => sum + getInvoiceValue(inv), 0)
      const monthExpensesTotal = monthExpenseRows.reduce((sum: number, exp: any) => sum + getExpenseValue(exp), 0)

      return {
        month: format(monthDate, 'MMM'),
        fullMonth: format(monthDate, 'MMM yyyy'),
        earnings: monthEarnings,
        expenses: monthExpensesTotal,
        profit: monthEarnings - monthExpensesTotal,
        invoiceCount: monthInvoiceRows.length,
      }
    })

    const safeMonthlyData = monthlyAggregates.map((entry, idx) => entry ?? fallback[idx])
    setMonthlyData(safeMonthlyData.length > 0 ? safeMonthlyData : fallback)
    setNextRecurringDate(upcomingRecurring?.[0]?.next_invoice_date || null)

    if (recentInvs) {
      setRecentInvoices(recentInvs.map((inv: any) => ({
        id: inv.invoice_number,
        client: inv.client?.name || 'Unknown',
        project: inv.project || '',
        amount: `${inv.currency} ${Number(inv.total).toFixed(2)}`,
        date: format(new Date(inv.issue_date), 'MMM dd'),
        status: inv.status,
      })))
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    )
  }

  const maxValue = Math.max(...monthlyData.map((d) => d.earnings), 1)

  const STATS = [
    {
      label: 'Total Revenue',
      value: `${baseCurrency} ${stats.earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Wallet,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Total Expenses',
      value: `${baseCurrency} ${stats.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    {
      label: 'Net Profit',
      value: `${baseCurrency} ${stats.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: stats.profit >= 0 ? 'text-blue-500' : 'text-amber-500',
      bg: stats.profit >= 0 ? 'bg-blue-500/10' : 'bg-amber-500/10',
    },
    {
      label: 'Total Invoices',
      value: stats.invoices.toString(),
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Next Invoice Date',
      value: nextRecurringDate ? format(new Date(nextRecurringDate), 'MMM dd, yyyy') : 'Not scheduled',
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ]

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
      paid: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      sent: 'bg-blue-50 text-blue-600 border-blue-100',
      draft: 'bg-amber-50 text-amber-600 border-amber-100',
      overdue: 'bg-red-50 text-red-600 border-red-100',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const SimpleChart = () => {
    return (
      <div className="h-64 flex items-end justify-between gap-4 pt-10 pb-2">
        {monthlyData.map((item, idx) => (
          <div key={idx} className="flex flex-col items-center gap-3 flex-1 group cursor-pointer">
            <div className="relative w-full flex justify-center h-full items-end">
              <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-10">
                ${item.earnings.toLocaleString()}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
              </div>
              <div
                className="w-full max-w-[48px] bg-gradient-to-t from-indigo-500 to-violet-400 opacity-80 group-hover:opacity-100 rounded-t-xl transition-all duration-500 relative overflow-hidden shadow-md hover:shadow-indigo-200"
                style={{ height: `${(item.earnings / maxValue) * 100}%` }}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-semibold group-hover:text-indigo-600 transition-colors">{item.month}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent tracking-tight">
            Dashboard
          </h1>
          <div className="text-slate-600 mt-2 font-medium flex items-center gap-2">
            <span>Welcome back! Here's your financial overview.</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
              Live
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <span className="hidden sm:inline">Last updated: </span>Just now
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="space-y-1">
          <label htmlFor="clientFilter" className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
            Filter by Client
          </label>
          <select
            id="clientFilter"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="all">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}{client.tag ? ` • ${client.tag}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="projectFilter" className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
            Filter by Project / Tag
          </label>
          <select
            id="projectFilter"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="all">All Projects</option>
            {projects.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => { setSelectedClient('all'); setSelectedProject('all') }}
            className="w-full inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>

        <div className="flex items-end">
          {selectedProject !== 'all' || selectedClient !== 'all' ? (
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg">
              Showing data for {selectedClient !== 'all' ? 'selected client' : 'all clients'}
              {selectedProject !== 'all' ? ' and project filter' : ''}
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg">
              No filters applied
            </span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {STATS.map((stat, idx) => (
          <div
            key={idx}
            className="group bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 cursor-default relative overflow-hidden ring-1 ring-slate-900/5 hover:ring-indigo-500/20"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div
              className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${
                stat.label.includes('Revenue')
                  ? 'from-emerald-400 via-emerald-500 to-teal-400'
                  : stat.label.includes('Expenses')
                  ? 'from-rose-400 via-rose-500 to-red-400'
                  : stat.label.includes('Profit')
                  ? 'from-blue-400 via-indigo-500 to-indigo-400'
                  : 'from-purple-400 via-purple-500 to-pink-400'
              } shadow-lg`}
            ></div>
            <div className="flex items-start justify-between mb-5">
              <div className={`p-3.5 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg shadow-slate-200/50`}>
                <stat.icon size={24} className="drop-shadow-sm" />
              </div>
            </div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">{stat.label}</h3>
            <div className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
              {stat.value}
            </div>
            <div
              className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-5 ${stat.bg.replace('/10', '')} blur-3xl group-hover:opacity-20 group-hover:scale-150 transition-all duration-700`}
            ></div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-slate-100/80 shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/5 hover:shadow-2xl transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
                Revenue Overview
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1 flex items-center gap-2">Performance over time</p>
            </div>
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner">
              <button className="px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-indigo-600 shadow-sm hover:shadow-md transition-shadow">
                6 Months
              </button>
              <button className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                Year
              </button>
            </div>
          </div>
          <SimpleChart />
        </div>

        {/* Recent Invoices */}
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-slate-100/80 shadow-xl shadow-slate-200/50 flex flex-col ring-1 ring-slate-900/5 hover:shadow-2xl transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
                Recent Invoices
              </h2>
              <p className="text-xs text-slate-500 mt-1">Latest activity</p>
            </div>
            <Link
              href="/dashboard/invoices"
              className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold transition-all hover:scale-105 flex items-center gap-1"
            >
              View All
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-5 flex-1">
            {recentInvoices.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No invoices yet</p>
              </div>
            ) : (
              recentInvoices.map((inv, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-md group-hover:text-indigo-600 transition-all duration-300">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{inv.client}</p>
                      {inv.project && (
                        <p className="text-xs font-semibold text-indigo-600 mt-0.5">{inv.project}</p>
                      )}
                      <p className="text-xs font-medium text-slate-400 mt-0.5">{inv.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{inv.amount}</p>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">{inv.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            href="/dashboard/invoices/new"
            className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white text-sm font-bold hover:from-indigo-600 hover:to-violet-600 flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/20 hover:shadow-indigo-600/30 hover:-translate-y-0.5 active:scale-95"
          >
            <Plus size={18} /> Create New Invoice
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/invoices/new"
          className="group bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-700 hover:via-violet-700 hover:to-purple-700 text-white px-6 py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 active:scale-95 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          <Plus size={18} className="relative z-10" /> 
          <span className="relative z-10">Create New Invoice</span>
        </Link>
        <Link
          href="/dashboard/expenses/new"
          className="group bg-white/80 backdrop-blur-sm border-2 border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 px-6 py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 active:scale-95 ring-1 ring-slate-900/5"
        >
          <Plus size={18} /> Add Expense
        </Link>
      </div>
    </div>
  )
}
