'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Wallet,
  Users,
  Settings,
  Bell,
  Menu,
  X,
  ArrowUpRight,
  FileText,
  TrendingUp,
} from 'lucide-react'
import NotificationsPanel from './NotificationsPanel'
import UserMenu from './UserMenu'
import SearchBar from './SearchBar'

const SidebarItem = ({ icon: Icon, label, active, href, onClick }: any) => (
  <Link
    href={href}
    onClick={onClick}
    className={`relative w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${
      active
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon size={20} className={`${active ? 'text-white' : 'group-hover:text-white transition-colors'}`} />
    <span className="font-medium tracking-wide text-sm">{label}</span>
    {active && (
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full"></div>
    )}
    {active && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
    )}
  </Link>
)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        loadUserProfile(user.id)
        loadNotificationCount(user.id)
      } else {
        router.push('/auth/login')
      }
    })
  }, [router])

  const loadUserProfile = async (userId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    setUserProfile(data)
    setLoading(false)
  }

  const loadNotificationCount = async (userId: string) => {
    const supabase = createClient()
    const now = new Date()

    // Count overdue invoices
    const { data: overdue } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .lt('due_date', now.toISOString().split('T')[0])

    // Count invoices due soon (next 3 days)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const { data: dueSoon } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .gte('due_date', now.toISOString().split('T')[0])
      .lte('due_date', threeDaysFromNow.toISOString().split('T')[0])

    const count = (overdue?.length || 0) + (dueSoon?.length || 0)
    setNotificationCount(count)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="text-lg text-slate-600 font-medium">Loading...</div>
        </div>
      </div>
    )
  }

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || 'U'
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/clients', label: 'Clients', icon: Users },
    { href: '/dashboard/invoices', label: 'Invoices', icon: Wallet },
    { href: '/dashboard/expenses', label: 'Expenses', icon: TrendingUp },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed lg:static inset-y-0 left-0 z-40 w-[280px] bg-gradient-to-b from-[#0F172A] to-[#1e293b] text-slate-300 transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        shadow-2xl lg:shadow-none border-r border-slate-800/50
      `}
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="h-20 flex items-center px-2 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-indigo-900/50 ring-2 ring-indigo-500/20">
              <ArrowUpRight className="text-white" size={24} strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
              FreelanceFlow
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
            >
              <X size={24} />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar">
            <div className="mb-8">
              <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Overview</p>
              {navItems.map((item) => (
                <div key={item.href} className="mb-1.5">
                  <SidebarItem
                    icon={item.icon}
                    label={item.label}
                    active={isActive(item.href)}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                  />
                </div>
              ))}
            </div>
          </nav>

          {/* Bottom User Profile */}
          <div className="pt-6 border-t border-slate-800/50 mt-auto">
            <div className="mt-6 flex items-center gap-4 px-4 py-3.5 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:bg-slate-800/70 transition-all cursor-pointer group backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 p-[2px] group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">
                    {getInitials(userProfile?.name || '', user?.email || '')}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{userProfile?.name || 'User'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F8FAFC]">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors active:scale-95"
              >
                <Menu size={20} />
              </button>
              <SearchBar />
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all active:scale-95 group"
                >
                  <Bell size={20} className="group-hover:scale-110 transition-transform" />
                  {notificationCount > 0 && (
                    <span className="absolute top-2 right-2.5 min-w-[18px] h-[18px] bg-gradient-to-r from-rose-500 to-pink-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white shadow-lg animate-pulse">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>
                <NotificationsPanel
                  isOpen={notificationsOpen}
                  onClose={() => setNotificationsOpen(false)}
                />
              </div>
              <UserMenu user={user} userProfile={userProfile} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-10 scroll-smooth bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
