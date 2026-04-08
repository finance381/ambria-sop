import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, getSopPdfUrl } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { localized } from '../../lib/i18n'
import type { Sop } from '../../lib/types'

export default function KioskSopViewer() {
  const { sopId } = useParams()
  const navigate = useNavigate()
  const { station } = useStore()
  const [sop, setSop] = useState<Sop | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!station) { navigate('/kiosk'); return }
    if (!sopId) return
    supabase
      .from('sops')
      .select('*')
      .eq('id', sopId)
      .single()
      .then(({ data }) => { setSop(data); setLoading(false) })
  }, [sopId])

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <p className="text-warm-300 text-lg">लोड हो रहा है...</p>
      </div>
    )
  }

  if (!sop) {
    return (
      <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center p-6">
        <p className="text-warm-300 mb-4">SOP नहीं मिला</p>
        <button onClick={() => navigate(-1)} className="text-ambria-600 font-medium">← वापस</button>
      </div>
    )
  }

  const pdfUrl = getSopPdfUrl(sop.pdf_path)

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      <header className="bg-ambria-900 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="text-ambria-300 text-2xl leading-none">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{localized(sop.title_hi, sop.title)}</h1>
          <div className="flex gap-3 text-xs text-ambria-300">
            {sop.pax_count && <span>{sop.pax_count} Pax</span>}
            {sop.prep_time_minutes && <span>{sop.prep_time_minutes} min</span>}
          </div>
        </div>
      </header>

      <div className="flex-1 relative">
        {sop.pdf_path ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full absolute inset-0 border-0"
            title={sop.title}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-warm-300">
            <p>PDF उपलब्ध नहीं है</p>
          </div>
        )}
      </div>
    </div>
  )
}