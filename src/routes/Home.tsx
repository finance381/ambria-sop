import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

const cards = [
  {
    id: 'kiosk',
    icon: '📖',
    title_hi: 'SOP किचन स्टेशन',
    title_en: 'Kitchen Station SOPs',
    desc_hi: 'टैबलेट पर रेसिपी और प्रक्रियाएं देखें',
    desc_en: 'View recipes & procedures on tablet',
    route: '/kiosk',
    color: 'bg-ambria-100 border-ambria-300',
  },
  {
    id: 'comply',
    icon: '📷',
    title_hi: 'कम्प्लायंस',
    title_en: 'Compliance',
    desc_hi: 'फ़ोटो प्रूफ जमा करें — ओपनिंग, क्लोज़िंग, तापमान',
    desc_en: 'Submit photo proof — opening, closing, temp logs',
    route: '/comply',
    color: 'bg-green-50 border-green-300',
  },
  {
    id: 'admin',
    icon: '📊',
    title_hi: 'एडमिन डैशबोर्ड',
    title_en: 'Admin Dashboard',
    desc_hi: 'कम्प्लायंस रिव्यू, स्टाफ और SOP प्रबंधन',
    desc_en: 'Review compliance, manage staff & SOPs',
    route: '/admin',
    color: 'bg-purple-50 border-purple-300',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const { lang, toggleLang } = useStore()

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      <header className="bg-ambria-900 text-white px-6 py-5 text-center">
        <h1 className="text-2xl font-bold tracking-wide">AMBRIA</h1>
        <p className="text-ambria-300 text-sm mt-1">
          {lang === 'hi' ? 'डिजिटल किचन SOP सिस्टम' : 'Digital Kitchen SOP System'}
        </p>
        <button onClick={toggleLang}
          className="absolute top-4 right-4 text-ambria-300 text-sm border border-ambria-600 rounded-lg px-3 py-1">
          {lang === 'hi' ? 'EN' : 'हिं'}
        </button>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full">
        <div className="space-y-4">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => navigate(card.route)}
              className={`w-full rounded-2xl p-5 border-2 text-left active:scale-[0.98] transition-transform ${card.color}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{card.icon}</span>
                <div>
                  <p className="font-bold text-gray-800 text-lg">
                    {lang === 'hi' ? card.title_hi : card.title_en}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {lang === 'hi' ? card.desc_hi : card.desc_en}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>

      <footer className="text-center py-4 text-warm-300 text-xs">
        Ambria Group — Digital SOP System
      </footer>
    </div>
  )
}