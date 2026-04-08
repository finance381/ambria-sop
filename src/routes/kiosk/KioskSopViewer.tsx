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
    if (!station) { navigate('/'); return }
    if (!sopId) return
    supabase.from('sops').select('*').eq('id', sopId).single()
      .then(({ data }) => { setSop(data); setLoading(false) })
  }, [sopId])

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <p className="text-gray-400">लोड हो रहा है...</p>
      </div>
    )
  }

  if (!sop) {
    return (
      <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center p-6">
        <p className="text-4xl mb-3">🤷</p>
        <p className="text-gray-400 mb-4">SOP नहीं मिला</p>
        <button onClick={() => navigate(-1)} className="text-ambria-600 font-medium">← वापस</button>
      </div>
    )
  }

  const pdfUrl = getSopPdfUrl(sop.pdf_path)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 pt-5 pb-4 flex items-center gap-3" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-gray-500">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {localized(sop.title_hi, sop.title)}
          </h1>
          <div className="flex gap-2 mt-0.5">
            {sop.pax_count && (
              <span className="text-xs bg-warm-100 text-gray-500 px-2 py-0.5 rounded-full">{sop.pax_count} Pax</span>
            )}
            {sop.prep_time_minutes && (
              <span className="text-xs bg-warm-100 text-gray-500 px-2 py-0.5 rounded-full">⏱ {sop.prep_time_minutes} min</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {sop.pdf_path ? (
          <iframe src={pdfUrl} className="w-full h-full absolute inset-0 border-0" title={sop.title} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">PDF उपलब्ध नहीं है</div>
        )}
      </div>
    </div>
  )
}