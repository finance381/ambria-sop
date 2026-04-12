import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import type { StaffMember, Department } from '../../lib/types'
import AdminLayout from './AdminLayout'

export default function StaffManager() {
  const navigate = useNavigate()
  const { lang } = useStore()
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<StaffMember> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const staff = useStore(s => s.staff)

  useEffect(() => {
    if (!staff || (staff.role !== 'admin' && staff.role !== 'head_chef')) {
      navigate('/', { replace: true })
      return
    }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [staffRes, deptRes] = await Promise.all([
      supabase.from('staff').select('*, department:departments(*)').order('name'),
      supabase.from('departments').select('*').order('name'),
    ])
    setStaffList(staffRes.data || [])
    setDepartments(deptRes.data || [])
    setLoading(false)
  }

  function startNew() {
    setEditing({ name: '', name_hi: '', role: 'staff', department_id: '', pin: '', is_active: true })
    setError('')
  }

  function startEdit(member: StaffMember) {
    setEditing({ ...member })
    setError('')
  }

  async function save() {
    if (!editing) return
    if (!editing.name?.trim()) { setError(lang === 'hi' ? 'नाम ज़रूरी है' : 'Name required'); return }
    if (!editing.pin?.trim() || editing.pin.length !== 4) { setError('PIN must be 4 digits'); return }
    if (!editing.department_id) { setError(lang === 'hi' ? 'विभाग चुनें' : 'Select department'); return }

    setSaving(true)
    setError('')

    const { data: existing } = await supabase
      .from('staff').select('id').eq('pin', editing.pin).neq('id', editing.id || '')
    if (existing && existing.length > 0) {
      setError(lang === 'hi' ? 'यह PIN पहले से उपयोग में है' : 'PIN already in use')
      setSaving(false)
      return
    }

    const record = {
      name: editing.name!.trim(),
      name_hi: editing.name_hi?.trim() || null,
      role: editing.role || 'staff',
      department_id: editing.department_id,
      pin: editing.pin!.trim(),
      is_active: editing.is_active ?? true,
    }

    if (editing.id) {
      const { error: err } = await supabase.from('staff').update(record).eq('id', editing.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('staff').insert(record)
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    setEditing(null)
    loadData()
  }

  async function toggleActive(member: StaffMember) {
    await supabase.from('staff').update({ is_active: !member.is_active }).eq('id', member.id)
    loadData()
  }

  const roleLabels: Record<string, Record<string, string>> = {
    admin: { hi: 'एडमिन', en: 'Admin' },
    head_chef: { hi: 'हेड शेफ', en: 'Head Chef' },
    section_head: { hi: 'सेक्शन हेड', en: 'Section Head' },
    staff: { hi: 'स्टाफ', en: 'Staff' },
  }

  const roleBadge: Record<string, string> = {
    admin: 'bg-purple-50 text-purple-600',
    head_chef: 'bg-amber-50 text-amber-600',
    section_head: 'bg-blue-50 text-blue-600',
    staff: 'bg-gray-100 text-gray-500',
  }

  if (loading) {
    return <div className="min-h-screen bg-warm-50 flex items-center justify-center text-gray-400">{t('common.loading')}</div>
  }

  const activeCount = staffList.filter(s => s.is_active).length

  return (
    <AdminLayout>
    <div className="bg-warm-50 min-h-screen">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{lang === 'hi' ? 'स्टाफ प्रबंधन' : 'Staff Management'}</h1>
          <p className="text-xs text-gray-400">{activeCount} {lang === 'hi' ? 'सक्रिय' : 'active'} / {staffList.length} {lang === 'hi' ? 'कुल' : 'total'}</p>
        </div>
        <button onClick={startNew}
          className="bg-admin text-white text-sm rounded-xl px-4 py-2 font-medium active:scale-[0.98]">
          + {lang === 'hi' ? 'नया' : 'New'}
        </button>
      </div>

      <div className="p-4 space-y-2">
        {staffList.map(member => (
          <div key={member.id}
            className={`card p-4 flex items-center gap-3 transition-opacity ${!member.is_active ? 'opacity-50' : ''}`}>
            {/* Avatar */}
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0
              ${member.role === 'admin' ? 'bg-purple-500'
                : member.role === 'head_chef' ? 'bg-amber-500'
                : member.role === 'section_head' ? 'bg-blue-500'
                : 'bg-gray-400'}`}>
              {(lang === 'hi' ? (member.name_hi || member.name) : member.name).charAt(0)}
            </div>

            <div className="flex-1 min-w-0" onClick={() => startEdit(member)}>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 truncate">{lang === 'hi' ? (member.name_hi || member.name) : member.name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleBadge[member.role] || ''}`}>
                  {roleLabels[member.role]?.[lang] || member.role}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {localized(member.department?.name_hi, member.department?.name || '')}
                <span className="mx-1.5">•</span>
                PIN: {member.pin || '—'}
              </p>
            </div>

            <div className="flex gap-1.5">
              <button onClick={() => startEdit(member)}
                className="w-9 h-9 rounded-full bg-warm-100 flex items-center justify-center text-sm text-gray-400 hover:bg-warm-200">✏️</button>
              <button onClick={() => toggleActive(member)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm
                  ${member.is_active ? 'bg-red-50 text-red-400 hover:bg-red-100' : 'bg-green-50 text-green-500 hover:bg-green-100'}`}>
                {member.is_active ? '🚫' : '✅'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setEditing(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg text-gray-900">
                {editing.id ? (lang === 'hi' ? 'स्टाफ एडिट' : 'Edit Staff') : (lang === 'hi' ? 'नया स्टाफ' : 'New Staff')}
              </h3>
              <button onClick={() => setEditing(null)}
                className="w-8 h-8 rounded-full bg-warm-100 flex items-center justify-center text-gray-400">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Name (English)</label>
                <input type="text" value={editing.name || ''}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">नाम (Hindi)</label>
                <input type="text" value={editing.name_hi || ''}
                  onChange={e => setEditing({ ...editing, name_hi: e.target.value })}
                  className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">PIN (4 digits)</label>
                <input type="tel" maxLength={4} value={editing.pin || ''}
                  onChange={e => setEditing({ ...editing, pin: e.target.value.replace(/\D/g, '') })}
                  className="w-full bg-warm-50 rounded-xl px-4 py-3 text-lg tracking-[0.3em] outline-none focus:ring-2 focus:ring-admin/20" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">{lang === 'hi' ? 'विभाग' : 'Department'}</label>
                <select value={editing.department_id || ''}
                  onChange={e => setEditing({ ...editing, department_id: e.target.value })}
                  className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20">
                  <option value="">{lang === 'hi' ? 'चुनें...' : 'Select...'}</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{localized(d.name_hi, d.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">{lang === 'hi' ? 'भूमिका' : 'Role'}</label>
                <select value={editing.role || 'staff'}
                  onChange={e => setEditing({ ...editing, role: e.target.value as any })}
                  className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20">
                  <option value="staff">{roleLabels.staff[lang]}</option>
                  <option value="section_head">{roleLabels.section_head[lang]}</option>
                  <option value="head_chef">{roleLabels.head_chef[lang]}</option>
                  <option value="admin">{roleLabels.admin[lang]}</option>
                </select>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditing(null)}
                className="flex-1 bg-warm-100 text-gray-500 rounded-xl py-3 font-medium">
                {lang === 'hi' ? 'रद्द' : 'Cancel'}
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-admin text-white rounded-xl py-3 font-medium disabled:opacity-50 active:scale-[0.98]">
                {saving ? '...' : (lang === 'hi' ? 'सेव करें' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  )
}