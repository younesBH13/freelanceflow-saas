'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, isAfter, addDays } from 'date-fns'
import Link from 'next/link'
import {
  Bell,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  TrendingUp,
} from 'lucide-react'

interface Notification {
  id: string
  type: 'overdue' | 'due_soon' | 'paid' | 'new_client'
  title: string
  message: string
  link: string
  time: string
  read: boolean
}

export default function NotificationsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen])

  const loadNotifications = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date()
    const threeDaysFromNow = addDays(now, 3)

    // Get overdue invoices
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, due_date, total, currency, client:clients(name)')
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .lt('due_date', now.toISOString().split('T')[0])

    // Get invoices due soon
    const { data: dueSoonInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, due_date, total, currency, client:clients(name)')
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .gte('due_date', now.toISOString().split('T')[0])
      .lte('due_date', threeDaysFromNow.toISOString().split('T')[0])

    // Get recently paid invoices (last 24 hours)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const { data: paidInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, total, currency, client:clients(name)')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .gte('created_at', yesterday.toISOString())

    const notifs: Notification[] = []

    // Overdue notifications
    overdueInvoices?.forEach((inv: any) => {
      notifs.push({
        id: `overdue-${inv.id}`,
        type: 'overdue',
        title: 'Overdue Invoice',
        message: `${inv.client?.name || 'Client'} - ${inv.invoice_number} (${inv.currency} ${Number(inv.total).toFixed(2)})`,
        link: `/dashboard/invoices/${inv.id}`,
        time: format(new Date(inv.due_date), 'MMM dd'),
        read: false,
      })
    })

    // Due soon notifications
    dueSoonInvoices?.forEach((inv: any) => {
      notifs.push({
        id: `due-soon-${inv.id}`,
        type: 'due_soon',
        title: 'Invoice Due Soon',
        message: `${inv.client?.name || 'Client'} - ${inv.invoice_number} due ${format(new Date(inv.due_date), 'MMM dd')}`,
        link: `/dashboard/invoices/${inv.id}`,
        time: format(new Date(inv.due_date), 'MMM dd'),
        read: false,
      })
    })

    // Paid notifications
    paidInvoices?.slice(0, 3).forEach((inv: any) => {
      notifs.push({
        id: `paid-${inv.id}`,
        type: 'paid',
        title: 'Invoice Paid',
        message: `${inv.client?.name || 'Client'} paid ${inv.invoice_number} (${inv.currency} ${Number(inv.total).toFixed(2)})`,
        link: `/dashboard/invoices/${inv.id}`,
        time: 'Just now',
        read: false,
      })
    })

    // Sort by priority (overdue first, then due soon, then paid)
    notifs.sort((a, b) => {
      const priority = { overdue: 0, due_soon: 1, paid: 2, new_client: 3 }
      return priority[a.type] - priority[b.type]
    })

    setNotifications(notifs)
    setLoading(false)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return <AlertCircle className="text-red-500" size={20} />
      case 'due_soon':
        return <Clock className="text-amber-500" size={20} />
      case 'paid':
        return <CheckCircle2 className="text-emerald-500" size={20} />
      default:
        return <Bell className="text-indigo-500" size={20} />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'overdue':
        return 'bg-red-50 border-red-100'
      case 'due_soon':
        return 'bg-amber-50 border-amber-100'
      case 'paid':
        return 'bg-emerald-50 border-emerald-100'
      default:
        return 'bg-indigo-50 border-indigo-100'
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="absolute right-4 top-16 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-[600px] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Notifications</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {notifications.length} {notifications.length === 1 ? 'notification' : 'notifications'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-sm">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-sm text-slate-500 font-medium">No notifications</p>
              <p className="text-xs text-slate-400 mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notif) => (
                <Link
                  key={notif.id}
                  href={notif.link}
                  onClick={onClose}
                  className={`block p-4 rounded-xl border mb-2 transition-all hover:shadow-md ${getNotificationColor(notif.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900">{notif.title}</p>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{notif.time}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <Link
              href="/dashboard/invoices"
              onClick={onClose}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 text-center block"
            >
              View all invoices →
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

