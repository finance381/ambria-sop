import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getSopPdfUrl } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import type { Sop, SopCategory, Department } from '../../lib/types'
import AdminLayout from './AdminLayout'

export default function SopManager() {
  const navigate = useNavigate()
  const { lang } = useStore()
  const staff = useStore(s => s.staff)

  const [sops, setSops] = useState<Sop[]>([])
  const [categories, setCategories] = useState<SopCategory[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Sop> | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')

  useEffect(() => {
    if (!staff || (staff.role !== 'admin' && staff.role !== 'head_chef')) {
      navigate('/', { replace: true })
      return
    }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [sopRes, catRes, deptRes] = await Promise.all([
      supabase.from('sops').select('*, category:sop_categories(*), department:departments(*)').order('title'),
      supabase.from('sop_categories').select('*').order('sort_order'),
      supabase.from('departments').select('*').order('name'),
    ])
    setSops(sopRes.data || [])
    setCategories(catRes.data || [])
    setDepartments(deptRes.data || [])
    setLoading(false)
  }

  function startNew() {
    setEditing({
      title: '', title_hi: '', category_id: '', department_id: '',
      pdf_path: '', pax_count: 100, prep_time_minutes: undefined,
      tags: [], is_active: true, version: 1,
    })
    setPdfFile(null)
    setError('')
  }

  function startEdit(sop: Sop) {
    setEditing({ ...sop })
    setPdfFile(null)
    setError('')
  }

  async function save() {
    if (!editing) return
    if (!editing.title?.trim()) { setError(lang === 'hi' ? 'Title ज़रूरी है' : 'Title required'); return }
    if (!editing.department_id) { setError(lang === 'hi' ? 'विभाग चुनें' : 'Select department'); return }
    if (!editing.category_id) { setError(lang === 'hi' ? 'कैटेगरी चुनें' : 'Select category'); return }
    if (!editing.id && !pdfFile && !editing.pdf_path) { setError(lang === 'hi' ? 'PDF फ़ाइल चुनें' : 'Select PDF file'); return }

    setSaving(true)
    setError('')

    let pdf_path = editing.pdf_path || ''

    // Upload PDF if new file selected
    if (pdfFile) {
      const dept = departments.find(d => d.id === editing.department_id)
      const folder = (dept?.name || 'general').toLowerCase().replace(/[^a-z0-9]/g, '-')
      const fileName = pdfFile.name.toLowerCase().replace(/[^a-z0-9.]/g, '-')
      const path = `${folder}/${Date.now()}-${fileName}`

      const { error: uploadErr } = await supabase.storage
        .from('sop-pdfs')
        .upload(path, pdfFile, { contentType: 'application/pdf' })

      if (uploadErr) {
        setError('Upload failed: ' + uploadErr.message)
        setSaving(false)
        return
      }
      pdf_path = path
    }

    const record = {
      title: editing.title!.trim(),
      title_hi: editing.title_hi?.trim() || null,
      category_id: editing.category_id,
      department_id: editing.department_id,
      pdf_path,
      pax_count: editing.pax_count || null,
      prep_time_minutes: editing.prep_time_minutes || null,
      tags: editing.tags || [],
      is_active: editing.is_active ?? true,
      version: editing.version || 1,
    }

    if (editing.id) {
      const { error: err } = await supabase.from('sops').update(record).eq('id', editing.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('sops').insert(record)
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    setEditing(null)
    setPdfFile(null)
    loadData()
  }

  async function toggleActive(sop: Sop) {
    await supabase.from('sops').update({ is_active: !sop.is_active }).eq('id', sop.id)
    loadData()
  }

  const filtered = sops.filter(s => {
    if (filterDept && s.department_id !== filterDept) return false
    if (!search) return true
    const q = search.toLowerCase()
    return s.title.toLowerCase().includes(q) || (s.title_hi && s.title_hi.includes(q))
  })

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-warm-50 flex items-center justify-center text-gray-400">{t('common.loading')}</div>
      </AdminLayout>
    )
  }

  const activeCount = sops.filter(s => s.is_active).length

  return (
    <AdminLayout>
    <div className="bg-warm-50 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{lang === 'hi' ? 'SOP प्रबंधन' : 'SOP Management'}</h1>
          <p className="text-xs text-gray-400">{activeCount} {lang === 'hi' ? 'सक्रिय' : 'active'} / {sops.length} {lang === 'hi' ? 'कुल' : 'total'}</p>
        </div>
        <button onClick={startNew}
          className="bg-admin text-white text-sm rounded-xl px-4 py-2 font-medium active:scale-[0.98]">
          + {lang === 'hi' ? 'नया SOP' : 'New SOP'}
        </button>
      </div>

      {/* Filters */}
      <div className="px-5 pb-3 flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('common.search') + '...'}
            className="w-full bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none shadow-[var(--shadow-card)] focus:ring-2 focus:ring-admin/20" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="bg-white rounded-xl px-3 py-2.5 text-sm outline-none shadow-[var(--shadow-card)] focus:ring-2 focus:ring-admin/20">
          <option value="">{lang === 'hi' ? 'सभी विभाग' : 'All Depts'}</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{localized(d.name_hi, d.name)}</option>
          ))}
        </select>
      </div>

      {/* SOP List */}
      <div className="px-4 pb-6 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📄</p>
            <p className="text-gray-400">{search ? (lang === 'hi' ? 'कोई SOP नहीं मिला' : 'No SOPs found') : (lang === 'hi' ? 'कोई SOP नहीं' : 'No SOPs yet')}</p>
          </div>
        ) : filtered.map(sop => (
          <div key={sop.id}
            className={`card p-4 flex items-center gap-3 transition-opacity ${!sop.is_active ? 'opacity-50' : ''}`}>
            {/* Icon */}
            <div className="w-11 h-11 rounded-xl bg-kiosk-light flex items-center justify-center text-xl flex-shrink-0">📄</div>

            {/* Info */}
            <div className="flex-1 min-w-0" onClick={() => startEdit(sop)}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-gray-900 truncate">{localized(sop.title_hi, sop.title)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-warm-100 text-gray-500">
                  {localized((sop as any).department?.name_hi, (sop as any).department?.name || '')}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-warm-100 text-gray-500">
                  {localized((sop as any).category?.name_hi, (sop as any).category?.name || '')}
                </span>
                {sop.pax_count && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-warm-100 text-gray-500">{sop.pax_count} Pax</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1.5">
              {sop.pdf_path && (
                <a href={getSopPdfUrl(sop.pdf_path)} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-sm text-blue-500">👁</a>
              )}
              <button onClick={() => startEdit(sop)}
                className="w-9 h-9 rounded-full bg-warm-100 flex items-center justify-center text-sm text-gray-400">✏️</button>
              <button onClick={() => toggleActive(sop)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm
                  ${sop.is_active ? 'bg-red-50 text-red-400' : 'bg-green-50 text-green-500'}`}>
                {sop.is_active ? '🚫' : '✅'}
              </button>
            </div>
          </div>
        ))}
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
                  {editing.id ? (lang === 'hi' ? 'SOP एडिट' : 'Edit SOP') : (lang === 'hi' ? 'नया SOP' : 'New SOP')}
                </h3>
                <button onClick={() => setEditing(null)}
                  className="w-8 h-8 rounded-full bg-warm-100 flex items-center justify-center text-gray-400">✕</button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Title */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Title (English)</label>
                  <input type="text" value={editing.title || ''}
                    onChange={e => setEditing({ ...editing, title: e.target.value })}
                    placeholder="Dates Chaat"
                    className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">शीर्षक (Hindi)</label>
                  <input type="text" value={editing.title_hi || ''}
                    onChange={e => setEditing({ ...editing, title_hi: e.target.value })}
                    placeholder="खजूर दी चाट"
                    className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
              </div>

              {/* Department + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">{lang === 'hi' ? 'विभाग' : 'Department'}</label>
                  <select value={editing.department_id || ''}
                    onChange={e => setEditing({ ...editing, department_id: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20">
                    <option value="">—</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{localized(d.name_hi, d.name)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">{lang === 'hi' ? 'कैटेगरी' : 'Category'}</label>
                  <select value={editing.category_id || ''}
                    onChange={e => setEditing({ ...editing, category_id: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20">
                    <option value="">—</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{localized(c.name_hi, c.name)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pax + Prep time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Pax Count</label>
                  <input type="number" value={editing.pax_count || ''}
                    onChange={e => setEditing({ ...editing, pax_count: parseInt(e.target.value) || undefined })}
                    placeholder="100"
                    className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">{lang === 'hi' ? 'तैयारी (मिनट)' : 'Prep (min)'}</label>
                  <input type="number" value={editing.prep_time_minutes || ''}
                    onChange={e => setEditing({ ...editing, prep_time_minutes: parseInt(e.target.value) || undefined })}
                    placeholder="60"
                    className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
              </div>

              {/* PDF Upload */}
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">
                  PDF {editing.pdf_path ? (lang === 'hi' ? '(बदलें)' : '(replace)') : ''}
                </label>
                {editing.pdf_path && !pdfFile && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-medium">
                      ✓ {lang === 'hi' ? 'PDF अपलोड है' : 'PDF uploaded'}
                    </span>
                    <a href={getSopPdfUrl(editing.pdf_path)} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-admin font-medium">{lang === 'hi' ? 'देखें' : 'View'} →</a>
                  </div>
                )}
                <label className="block">
                  <div className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all
                    ${pdfFile ? 'border-admin bg-admin-light' : 'border-gray-200 hover:border-gray-300'}`}>
                    {pdfFile
                      ? <span className="text-admin font-medium">📄 {pdfFile.name}</span>
                      : <span className="text-gray-400">📎 {lang === 'hi' ? 'PDF फ़ाइल चुनें' : 'Choose PDF file'}</span>}
                  </div>
                  <input type="file" accept=".pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f) }} />
                </label>
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
                {saving ? (lang === 'hi' ? 'अपलोड हो रहा...' : 'Uploading...') : (lang === 'hi' ? 'सेव करें' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  )
}