import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import type { Checklist, ChecklistItem, Department } from '../../lib/types'

const typeLabels: Record<string, Record<string, string>> = {
  opening: { hi: 'ओपनिंग', en: 'Opening' },
  closing: { hi: 'क्लोज़िंग', en: 'Closing' },
  temp_log: { hi: 'तापमान लॉग', en: 'Temp Log' },
  prep_confirm: { hi: 'तैयारी पुष्टि', en: 'Prep Confirm' },
  deep_clean: { hi: 'डीप क्लीन', en: 'Deep Clean' },
}

const itemTypeLabels: Record<string, Record<string, string>> = {
  photo: { hi: 'फ़ोटो', en: 'Photo' },
  check: { hi: 'चेक', en: 'Check' },
  temp: { hi: 'तापमान', en: 'Temperature' },
  text: { hi: 'टेक्स्ट', en: 'Text' },
}

const typeBadge: Record<string, string> = {
  opening: 'bg-amber-50 text-amber-600',
  closing: 'bg-purple-50 text-purple-600',
  temp_log: 'bg-blue-50 text-blue-600',
  prep_confirm: 'bg-green-50 text-green-600',
  deep_clean: 'bg-red-50 text-red-600',
}

function emptyItem(): ChecklistItem {
  return { label: '', label_hi: '', requires_photo: false, type: 'check' }
}

export default function ChecklistBuilder() {
  const navigate = useNavigate()
  const { lang } = useStore()
  const staff = useStore(s => s.staff)

  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Checklist> | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!staff || (staff.role !== 'admin' && staff.role !== 'head_chef')) {
      navigate('/', { replace: true })
      return
    }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [clRes, deptRes] = await Promise.all([
      supabase.from('checklists').select('*, department:departments(*)').order('type').order('scheduled_time'),
      supabase.from('departments').select('*').order('name'),
    ])
    setChecklists(clRes.data || [])
    setDepartments(deptRes.data || [])
    setLoading(false)
  }

  function startNew() {
    setEditing({
      name: '', name_hi: '', type: 'opening',
      department_id: '', scheduled_time: '08:00',
      items: [], is_active: true,
    })
    setItems([emptyItem()])
    setError('')
  }

  function startEdit(cl: Checklist) {
    setEditing({ ...cl })
    setItems(cl.items && cl.items.length > 0 ? [...cl.items] : [emptyItem()])
    setError('')
  }

  function updateItem(idx: number, field: keyof ChecklistItem, value: any) {
    setItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      if (field === 'type') {
        next[idx].requires_photo = value === 'photo' || value === 'temp'
      }
      return next
    })
  }

  function addItem() {
    setItems(prev => [...prev, emptyItem()])
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= items.length) return
    setItems(prev => {
      const next = [...prev]
      const temp = next[idx]
      next[idx] = next[newIdx]
      next[newIdx] = temp
      return next
    })
  }

  async function save() {
    if (!editing) return
    if (!editing.name?.trim()) { setError(lang === 'hi' ? 'नाम ज़रूरी है' : 'Name required'); return }
    if (!editing.department_id) { setError(lang === 'hi' ? 'विभाग चुनें' : 'Select department'); return }

    const validItems = items.filter(i => i.label.trim() || i.label_hi.trim())
    if (validItems.length === 0) { setError(lang === 'hi' ? 'कम से कम 1 आइटम जोड़ें' : 'Add at least 1 item'); return }

    setSaving(true)
    setError('')

    const record = {
      name: editing.name!.trim(),
      name_hi: editing.name_hi?.trim() || null,
      type: editing.type || 'opening',
      department_id: editing.department_id,
      scheduled_time: editing.scheduled_time || '08:00',
      items: validItems,
      is_active: editing.is_active ?? true,
    }

    if (editing.id) {
      const { error: err } = await supabase.from('checklists').update(record).eq('id', editing.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('checklists').insert(record)
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    setEditing(null)
    loadData()
  }

  async function toggleActive(cl: Checklist) {
    await supabase.from('checklists').update({ is_active: !cl.is_active }).eq('id', cl.id)
    loadData()
  }

  if (loading) {
    return <div className="min-h-screen bg-warm-50 flex items-center justify-center text-gray-400">{t('common.loading')}</div>
  }

  const activeCount = checklists.filter(c => c.is_active).length

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')}
            className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-gray-500">←</button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{lang === 'hi' ? 'चेकलिस्ट बिल्डर' : 'Checklist Builder'}</h1>
            <p className="text-xs text-gray-400">{activeCount} {lang === 'hi' ? 'सक्रिय' : 'active'} / {checklists.length} {lang === 'hi' ? 'कुल' : 'total'}</p>
          </div>
          <button onClick={startNew}
            className="bg-admin text-white text-sm rounded-xl px-4 py-2 font-medium active:scale-[0.98]">
            + {lang === 'hi' ? 'नया' : 'New'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-2">
        {checklists.map(cl => (
          <div key={cl.id}
            className={`card p-4 flex items-center gap-3 transition-opacity ${!cl.is_active ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0" onClick={() => startEdit(cl)}>
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-gray-900 truncate">{localized(cl.name_hi, cl.name)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadge[cl.type] || 'bg-gray-100 text-gray-500'}`}>
                  {typeLabels[cl.type]?.[lang] || cl.type}
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate">
                {localized((cl as any).department?.name_hi, (cl as any).department?.name || '')}
                <span className="mx-1.5">•</span>
                {cl.scheduled_time?.slice(0, 5)}
                <span className="mx-1.5">•</span>
                {cl.items.length} {lang === 'hi' ? 'आइटम' : 'items'}
              </p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => startEdit(cl)}
                className="w-9 h-9 rounded-full bg-warm-100 flex items-center justify-center text-sm text-gray-400">✏️</button>
              <button onClick={() => toggleActive(cl)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm
                  ${cl.is_active ? 'bg-red-50 text-red-400' : 'bg-green-50 text-green-500'}`}>
                {cl.is_active ? '🚫' : '✅'}
              </button>
            </div>
          </div>
        ))}

        {checklists.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-400">{lang === 'hi' ? 'कोई चेकलिस्ट नहीं' : 'No checklists yet'}</p>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setEditing(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-warm-100 z-10">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-900">
                  {editing.id ? (lang === 'hi' ? 'चेकलिस्ट एडिट' : 'Edit Checklist') : (lang === 'hi' ? 'नई चेकलिस्ट' : 'New Checklist')}
                </h3>
                <button onClick={() => setEditing(null)}
                  className="w-8 h-8 rounded-full bg-warm-100 flex items-center justify-center text-gray-400">✕</button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-3">
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
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">{lang === 'hi' ? 'प्रकार' : 'Type'}</label>
                  <select value={editing.type || 'opening'}
                    onChange={e => setEditing({ ...editing, type: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20">
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v[lang]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">{lang === 'hi' ? 'समय' : 'Time'}</label>
                  <input type="time" value={editing.scheduled_time || '08:00'}
                    onChange={e => setEditing({ ...editing, scheduled_time: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">{lang === 'hi' ? 'विभाग' : 'Dept'}</label>
                  <select value={editing.department_id || ''}
                    onChange={e => setEditing({ ...editing, department_id: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20">
                    <option value="">—</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{localized(d.name_hi, d.name)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400 font-medium">
                    {lang === 'hi' ? 'आइटम' : 'Items'} ({items.length})
                  </label>
                  <button onClick={addItem}
                    className="text-admin text-xs font-medium">
                    + {lang === 'hi' ? 'आइटम जोड़ें' : 'Add Item'}
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-warm-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-300 font-medium w-5">{idx + 1}</span>
                        <div className="flex-1" />
                        <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                          className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-xs text-gray-400 disabled:opacity-30">↑</button>
                        <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}
                          className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-xs text-gray-400 disabled:opacity-30">↓</button>
                        <button onClick={() => removeItem(idx)} disabled={items.length <= 1}
                          className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-xs text-red-400 disabled:opacity-30">✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input type="text" value={item.label} placeholder="Label (EN)"
                          onChange={e => updateItem(idx, 'label', e.target.value)}
                          className="bg-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                        <input type="text" value={item.label_hi} placeholder="लेबल (HI)"
                          onChange={e => updateItem(idx, 'label_hi', e.target.value)}
                          className="bg-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                      </div>
                      <select value={item.type}
                        onChange={e => updateItem(idx, 'type', e.target.value)}
                        className="bg-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-admin/20 w-full">
                        {Object.entries(itemTypeLabels).map(([k, v]) => (
                          <option key={k} value={k}>{v[lang]} {k === 'photo' || k === 'temp' ? '(📷)' : ''}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-warm-100 flex gap-2">
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
  )
}