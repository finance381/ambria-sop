import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { staff } = useStore()

  useEffect(() => {
    if (staff && (staff.role === 'admin' || staff.role === 'head_chef')) {
      navigate('/admin/dashboard', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [])

  return null
}