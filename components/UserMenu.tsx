'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  User,
  Settings,
  LogOut,
  CreditCard,
  ChevronDown,
  X,
} from 'lucide-react'

export default function UserMenu({ user, userProfile }: { user: any; userProfile: any }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || 'U'
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-100 transition-all group"
      >
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 p-[2px] cursor-pointer shadow-lg shadow-indigo-200">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-violet-600 font-bold text-sm">
              {getInitials(userProfile?.name || '', user?.email || '')}
            </span>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 top-14 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 p-[2px]">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-violet-600 font-bold">
                      {getInitials(userProfile?.name || '', user?.email || '')}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{userProfile?.name || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            <div className="p-2">
              <Link
                href="/dashboard/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <User size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                <span className="text-sm font-medium text-slate-700">Profile</span>
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <Settings size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                <span className="text-sm font-medium text-slate-700">Settings</span>
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <CreditCard size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                <span className="text-sm font-medium text-slate-700">Billing</span>
              </Link>
            </div>

            <div className="p-2 border-t border-slate-200">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition-colors group"
              >
                <LogOut size={18} className="text-slate-400 group-hover:text-red-600 transition-colors" />
                <span className="text-sm font-medium text-slate-700 group-hover:text-red-600 transition-colors">Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

