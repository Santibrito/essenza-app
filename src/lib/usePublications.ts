import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import { API_BASE_URL as apiUrl } from '@/config.js'

export type SocialPlatform = 'INSTAGRAM' | 'TIKTOK'
export type ContentType = 'REEL' | 'STORY' | 'TIKTOK' | 'POST'
export type PublicationStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED'

export interface ScheduledPublication {
  id: number
  modelName: string
  platform: SocialPlatform
  contentType: ContentType
  caption: string
  hashtags: string
  customLink: string
  scheduledAt: string
  status: PublicationStatus
  mediaUrl: string
  originalFilename: string
  createdAt: string
  errorMessage: string
}

export interface CreatePublicationPayload {
  modelName: string
  platform: SocialPlatform
  contentType: ContentType
  caption?: string
  hashtags?: string
  customLink?: string
  accountId?: number // ID de la cuenta de AdsPower vinculada
  scheduledAt: string // ISO datetime
}

// Tipos de contenido válidos por plataforma
export const PLATFORM_CONTENT_TYPES: Record<SocialPlatform, ContentType[]> = {
  INSTAGRAM: ['REEL', 'STORY', 'POST'],
  TIKTOK:    ['TIKTOK', 'STORY'],
}

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK:    'TikTok',
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  REEL:   'Reel',
  STORY:  'Historia',
  TIKTOK: 'Video TikTok',
  POST:   'Post',
}

export const STATUS_LABELS: Record<PublicationStatus, string> = {
  PENDING:    'Pendiente',
  PROCESSING: 'Ejecutando',
  PUBLISHED:  'Publicado',
  FAILED:     'Fallido',
  CANCELLED:  'Cancelado',
}

export const STATUS_COLORS: Record<PublicationStatus, string> = {
  PENDING:    'bg-amber-500/10 text-amber-500 border-amber-500/20',
  PROCESSING: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PUBLISHED:  'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  FAILED:     'bg-red-500/10 text-red-500 border-red-500/20',
  CANCELLED:  'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
}

export function usePublications() {
  const auth = useAuthStore()
  const loading = ref(false)

  function authHeaders() {
    return { Authorization: `Bearer ${auth.user?.token}` }
  }

  async function getCalendar(year: number, month: number): Promise<ScheduledPublication[]> {
    const res = await fetch(
      `${apiUrl}/automation/publications/calendar?year=${year}&month=${month}`,
      { headers: authHeaders() }
    )
    if (!res.ok) throw new Error('Error al cargar el calendario')
    return res.json()
  }

  async function getAccountsByModel(modelId: number): Promise<any[]> {
    const res = await fetch(`${apiUrl}/automation/profiles/by-model/${modelId}/accounts`, {
      headers: authHeaders()
    })
    if (!res.ok) throw new Error('Error al cargar perfiles/cuentas de la modelo')
    return res.json()
  }

  async function create(
    payload: CreatePublicationPayload,
    file: File
  ): Promise<ScheduledPublication> {
    loading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('request', JSON.stringify(payload))

      const res = await fetch(`${apiUrl}/automation/publications`, {
        method: 'POST',
        headers: authHeaders(), // NO Content-Type — el browser lo pone con boundary
        body: formData,
      })

      if (res.status === 409) {
        const err = await res.json()
        throw new Error(err.error || 'Conflicto de horario')
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al programar la publicación')
      }

      return res.json()
    } finally {
      loading.value = false
    }
  }

  /**
   * Publicación INMEDIATA (test). Sube el archivo + cuenta al endpoint de test,
   * que abre el perfil de AdsPower y publica al instante. dryRun=true audita sin publicar.
   */
  async function publishNow(
    payload: {
      accountId: number
      platform: SocialPlatform
      contentType: ContentType
      caption?: string
      hashtags?: string
      customLink?: string
      dryRun: boolean
    },
    file: File
  ): Promise<{ success: boolean; dryRun: boolean; message: string; profileId?: string }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('request', JSON.stringify(payload))

    const res = await fetch(`${apiUrl}/automation/test/publish-now`, {
      method: 'POST',
      headers: authHeaders(), // sin Content-Type — boundary automático
      body: formData,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Error en la publicación inmediata')
    }
    return data
  }

  async function cancel(id: number): Promise<ScheduledPublication> {
    const res = await fetch(`${apiUrl}/automation/publications/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.status === 409) {
      const err = await res.json()
      throw new Error(err.error)
    }
    if (!res.ok) throw new Error('Error al cancelar la publicación')
    return res.json()
  }

  return { loading, getCalendar, getAccountsByModel, create, publishNow, cancel }
}
