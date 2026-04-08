import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../../store/useStore'

const navItems = [
  { path: '/admin/dashboard', icon: '📊', label_hi: 'डैशबोर्ड', label_en: 'Dashboard' },
  { path: '/admin/checklists', icon: '📋', label_hi: 'चेकलिस्ट', label_en: 'Checklists' },
  { path: '/admin/staff', icon: '👥', label_hi: 'स्टाफ', label_en: 'Staff' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, toggleLang } = useStore()
  const staff = useStore(s => s.staff)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-warm-50 lg:flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 bg-white border-r border-warm-200">
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">AMBRIA</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{lang === 'hi' ? 'एडमिन पैनल' : 'Admin Panel'}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${active ? 'bg-admin-light text-admin' : 'text-gray-500 hover:bg-warm-100'}`}>
                <span className="text-base">{item.icon}</span>
                {lang === 'hi' ? item.label_hi : item.label_en}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 space-y-1">
          <button onClick={toggleLang}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-warm-100">
            <span className="text-base">🌐</span>
            {lang === 'hi' ? 'English' : 'हिंदी'}
          </button>
          <button onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-warm-100">
            <span className="text-base">←</span>
            {lang === 'hi' ? 'होम' : 'Home'}
          </button>
        </div>

        {/* User */}
        {staff && (
          <div className="px-4 py-3 border-t border-warm-200">
            <p className="text-sm font-medium text-gray-900 truncate">{staff.name_hi || staff.name}</p>
            <p className="text-[11px] text-gray-400">{staff.role === 'admin' ? 'Admin' : 'Head Chef'}</p>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-30"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-gray-500 text-lg">
            {mobileOpen ? '✕' : '☰'}
          </button>
          <h1 className="text-base font-bold text-gray-900">AMBRIA</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleLang}
            className="w-9 h-9 rounded-full bg-warm-100 flex items-center justify-center text-xs text-gray-500 font-medium">
            {lang === 'hi' ? 'EN' : 'हिं'}
          </button>
          <button onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full bg-warm-100 flex items-center justify-center text-sm text-gray-500">←</button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-b border-warm-200 px-4 pb-3 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path
            return (
              <button key={item.path}
                onClick={() => { navigate(item.path); setMobileOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  ${active ? 'bg-admin-light text-admin' : 'text-gray-500'}`}>
                <span>{item.icon}</span>
                {lang === 'hi' ? item.label_hi : item.label_en}
              </button>
            )
          })}
        </div>
      )}

      {/* Main content */}
      <main className="lg:ml-56 flex-1 min-h-screen">
        {children}
      </main>
    </div>
  )
}