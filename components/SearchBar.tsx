'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, FileText, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
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

  useEffect(() => {
    if (query.length > 2) {
      performSearch()
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [query])

  const performSearch = async () => {
    setLoading(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const searchQuery = `%${query}%`

    // Search invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, total, currency, client:clients(name)')
      .eq('user_id', user.id)
      .ilike('invoice_number', searchQuery)
      .limit(3)

    // Search clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('user_id', user.id)
      .or(`name.ilike.${searchQuery},email.ilike.${searchQuery}`)
      .limit(3)

    const searchResults: any[] = []

    invoices?.forEach((inv: any) => {
      searchResults.push({
        type: 'invoice',
        id: inv.id,
        title: inv.invoice_number,
        subtitle: inv.client?.name || 'Unknown Client',
        amount: `${inv.currency} ${Number(inv.total).toFixed(2)}`,
        link: `/dashboard/invoices/${inv.id}`,
        icon: FileText,
      })
    })

    clients?.forEach((client: any) => {
      searchResults.push({
        type: 'client',
        id: client.id,
        title: client.name,
        subtitle: client.email || 'No email',
        link: `/dashboard/clients/${client.id}/edit`,
        icon: Users,
      })
    })

    setResults(searchResults)
    setIsOpen(searchResults.length > 0)
    setLoading(false)
  }

  const handleResultClick = (link: string) => {
    router.push(link)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div className="relative hidden sm:block group" ref={searchRef}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
      <input
        type="text"
        placeholder="Search invoices, clients..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length > 2 && setIsOpen(true)}
        className="pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-72 text-sm font-medium placeholder:text-slate-400"
      />
      {query && (
        <button
          onClick={() => {
            setQuery('')
            setIsOpen(false)
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <X size={14} className="text-slate-400" />
        </button>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-96 overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Search Results ({results.length})
            </p>
          </div>
          <div className="overflow-y-auto max-h-80 custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : (
              results.map((result, idx) => {
                const Icon = result.icon
                return (
                  <button
                    key={idx}
                    onClick={() => handleResultClick(result.link)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                      <Icon size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-slate-900 truncate">{result.title}</p>
                      <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                      {result.amount && (
                        <p className="text-xs font-semibold text-indigo-600 mt-0.5">{result.amount}</p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

