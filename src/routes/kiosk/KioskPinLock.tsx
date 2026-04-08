import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'

export default function KioskPinLock() {
  const navigate = useNavigate()
  const { staff, station } = useStore()

  useEffect(() => {
    if (staff && station) {
      navigate('/kiosk/home', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [])

  return null
}