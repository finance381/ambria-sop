import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import type { StaffMember, Department } from '../../lib/types'

export default function StaffManager() {
  const navigate = useNavigate()
  const { lang } = useStore()
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<StaffMember> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/admin'); return }
      loadData()
    })
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
    if (!editing.name?.trim()) { setError('Name is required'); return }
    if (!editing.pin?.trim() || editing.pin.length !== 4) { setError('PIN must be 4 digits'); return }
    if (!editing.department_id) { setError('Department is required'); return }

    setSaving(true)
    setError('')

    // Check PIN uniqueness
    const { data: existing } = await supabase
      .from('staff')
      .select('id')
      .eq('pin', editing.pin)
      .neq('id', editing.id || '')

    if (existing && existing.length > 0) {
      setError('This PIN is already in use')
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

  if (loading) {
    return <div className="min-h-screen bg-warm-50 flex items-center justify-center text-warm-300">{t('common.loading')}</div>
  }

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      <header className="bg-ambria-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/admin/dashboard')} className="text-ambria-300 text-2xl">←</button>
        <h1 className="text-lg font-bold flex-1">{lang === 'hi' ? 'स्टाफ प्रबंधन' : 'Staff Management'}</h1>
        <button onClick={startNew}
          className="bg-ambria-600 text-white text-sm rounded-lg px-3 py-1.5 font-medium">
          + {lang === 'hi' ? 'नया' : 'New'}
        </button>
      </header>

      {/* Staff List */}
      <main className="flex-1 p-4 space-y-2">
        {staffList.map(member => (
          <div key={member.id}
            className={`bg-white rounded-xl p-4 border flex items-center justify-between
              ${member.is_active ? 'border-warm-200' : 'border-red-200 bg-red-50 opacity-60'}`}>
            <div className="flex-1 min-w-0" onClick={() => startEdit(member)}>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800">{member.name_hi || member.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${member.role === 'admin' ? 'bg-purple-100 text-purple-700'
                    : member.role === 'head_chef' ? 'bg-amber-100 text-amber-700'
                    : member.role === 'section_head' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'}`}>
                  {roleLabels[member.role]?.[lang] || member.role}
                </span>
              </div>
              <p className="text-xs text-warm-300 mt-1">
                {localized(member.department?.name_hi, member.department?.name || '')}
                {member.pin && <span className="ml-2">PIN: {member.pin}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <button onClick={() => startEdit(member)} className="text-ambria-600 text-sm">✏️</button>
              <button onClick={() => toggleActive(member)}
                className={`text-sm ${member.is_active ? 'text-red-500' : 'text-green-600'}`}>
                {member.is_active ? '🚫' : '✅'}
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* Edit/New Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">
                {editing.id ? (lang === 'hi' ? 'स्टाफ एडिट करें' : 'Edit Staff') : (lang === 'hi' ? 'नया स्टाफ' : 'New Staff')}
              </h3>
              <button onClick={() => setEditing(null)} className="text-warm-300 text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Name (English)</label>
                <input type="text" value={editing.name || ''}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full border border-warm-200 rounded-lg px-3 py-2 outline-none focus:border-ambria-400" />
              </div>

              <div>
                <label className="text-sm text-gray-600 block mb-1">नाम (Hindi)</label>
                <input type="text" value={editing.name_hi || ''}
                  onChange={e => setEditing({ ...editing, name_hi: e.target.value })}
                  className="w-full border border-warm-200 rounded-lg px-3 py-2 outline-none focus:border-ambria-400" />
              </div>

              <div>
                <label className="text-sm text-gray-600 block mb-1">PIN (4 digits)</label>
                <input type="tel" maxLength={4} value={editing.pin || ''}
                  onChange={e => setEditing({ ...editing, pin: e.target.value.replace(/\D/g, '') })}
                  className="w-full border border-warm-200 rounded-lg px-3 py-2 outline-none focus:border-ambria-400 tracking-widest text-lg" />
              </div>

              <div>
                <label className="text-sm text-gray-600 block mb-1">{lang === 'hi' ? 'विभाग' : 'Department'}</label>
                <select value={editing.department_id || ''}
                  onChange={e => setEditing({ ...editing, department_id: e.target.value })}
                  className="w-full border border-warm-200 rounded-lg px-3 py-2 outline-none focus:border-ambria-400">
                  <option value="">{lang === 'hi' ? 'चुनें...' : 'Select...'}</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{localized(d.name_hi, d.name)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600 block mb-1">{lang === 'hi' ? 'भूमिका' : 'Role'}</label>
                <select value={editing.role || 'staff'}
                  onChange={e => setEditing({ ...editing, role: e.target.value as any })}
                  className="w-full border border-warm-200 rounded-lg px-3 py-2 outline-none focus:border-ambria-400">
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
                className="flex-1 border border-warm-200 rounded-lg py-2 text-warm-300 font-medium">
                {lang === 'hi' ? 'रद्द' : 'Cancel'}
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-ambria-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
                {saving ? '...' : (lang === 'hi' ? 'सेव करें' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}