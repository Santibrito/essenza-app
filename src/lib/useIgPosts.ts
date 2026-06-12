import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL as apiUrl } from '@/config.js'

export interface IgAccountLite {
  id: number
  handle: string | null
  igUsername: string | null
  status: string
  profilePhotoUrl: string | null
  followers: number | null
}

export interface IgScheduleResult {
  count: number
  from: string
  to: string
  spreadMinutes: number
}

export function useIgPosts() {
  const auth = useAuthStore()
  const headers = () => ({ Authorization: `Bearer ${auth.user?.token}` })

  /** Cuentas IG de una modelo que ya tienen Instagram enganchado (con su estado). */
  async function getAccounts(modelId: number): Promise<IgAccountLite[]> {
    const res = await fetch(`${apiUrl}/automation/ig-accounts?modelId=${modelId}`, { headers: headers() })
    if (!res.ok) throw new Error('No se pudieron cargar las cuentas IG')
    const all = await res.json()
    return all.filter((a: any) => a.igUsername)
  }

  /** Propaga un contenido a N cuentas con horarios desparejos. */
  async function schedule(payload: {
    modelId: number | null
    accountIds: number[]
    contentType: string
    caption?: string
    hashtags?: string
    link?: string
    scheduledAt: string
    spreadMinutes: number
  }, file: File): Promise<IgScheduleResult> {
    const fd = new FormData()
    fd.append('media', file)
    fd.append('request', JSON.stringify(payload))
    const res = await fetch(`${apiUrl}/automation/ig-posts`, { method: 'POST', headers: headers(), body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Error al programar')
    return data
  }

  async function getCalendar(year: number, month: number): Promise<any[]> {
    const res = await fetch(`${apiUrl}/automation/ig-posts/calendar?year=${year}&month=${month}`, { headers: headers() })
    if (!res.ok) return []
    return res.json()
  }

  async function cancel(id: number): Promise<void> {
    await fetch(`${apiUrl}/automation/ig-posts/${id}`, { method: 'DELETE', headers: headers() })
  }

  return { getAccounts, schedule, getCalendar, cancel }
}
