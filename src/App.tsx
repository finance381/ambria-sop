import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import Home from './routes/Home'
import KioskPinLock from './routes/kiosk/KioskPinLock'
import KioskHome from './routes/kiosk/KioskHome'
import KioskSopList from './routes/kiosk/KioskSopList'
import KioskSopViewer from './routes/kiosk/KioskSopViewer'
import ComplyHome from './routes/comply/ComplyHome'
import AdminLogin from './routes/admin/AdminLogin'
import Dashboard from './routes/admin/Dashboard'
import StaffManager from './routes/admin/StaffManager'

function OfflineBanner() {
  const isOnline = useStore(s => s.isOnline)
  if (isOnline) return null
  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center text-sm py-1 z-50 font-medium">
      ऑफलाइन मोड
    </div>
  )
}

export default function App() {
  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kiosk" element={<KioskPinLock />} />
        <Route path="/kiosk/home" element={<KioskHome />} />
        <Route path="/kiosk/category/:categoryId" element={<KioskSopList />} />
        <Route path="/kiosk/sop/:sopId" element={<KioskSopViewer />} />
        <Route path="/comply" element={<ComplyHome />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/staff" element={<StaffManager />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}