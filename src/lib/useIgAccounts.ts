import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL as apiUrl } from '@/config.js'

// Port del composable del CRM a la app de marketing (fetch en vez de axios).
// Misma API del backend; el de marketing tiene las mismas funcionalidades que el admin.

export interface IgAccount {
  id: number
  modelId: number
  handle: string | null
  igUsername: string | null
  hasEmail: boolean
  has2fa: boolean
  proxy?: string
  proxyCountry: string | null
  proxyValid?: boolean | null
  proxyCheckedAt?: string | null
  proxyCheckDetail?: string | null
  adsPowerId: string | null
  status: string
  loginVerified: boolean
  photoApplied: boolean
  bioApplied: boolean
  warmupDay: number
  fullName: string | null
  bio: string | null
  externalUrl: string | null
  profilePhotoUrl: string | null
  followers: number | null
  following: number | null
  posts: number | null
  lastStatsAt: string | null
  lastError: string | null
  createdAt: string | null
}

export interface IgAccountEvent {
  id: number
  type: string
  detail: string
  success: boolean
  createdAt: string
}

export function useIgAccounts() {
  const auth = useAuthStore()
  const authHeader = () => ({ Authorization: `Bearer ${auth.user?.token}` })
  const jsonHeaders = () => ({ ...authHeader(), 'Content-Type': 'application/json' })

  const accounts = ref<IgAccount[]>([])
  const loading = ref(false)
  const busyId = ref<number | null>(null)

  async function parseErr(res: Response): Promise<string> {
    const data = await res.json().catch(() => ({} as any))
    return data?.error || `Error ${res.status}`
  }

  async function fetchByModel(modelId: number) {
    loading.value = true
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts?modelId=${modelId}`, { headers: authHeader() })
      if (!res.ok) throw new Error(await parseErr(res))
      accounts.value = await res.json()
    } catch {
      toast.error('Error al cargar las cuentas')
    } finally {
      loading.value = false
    }
  }

  /** Fase 1: crear slot con solo el proxy */
  async function createProxySlot(data: { modelId: number; country: string; handle?: string }): Promise<IgAccount | null> {
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/proxy-slot`, {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await parseErr(res))
      const acc = await res.json()
      accounts.value.unshift(acc)
      toast.success('Proxy generado ✨ — copialo a AdsPower')
      return acc
    } catch (e: any) {
      toast.error('No se pudo generar el proxy', { description: e.message })
      return null
    }
  }

  /** Importar una cuenta YA LISTA con su proxy propio (sin generar uno nuevo). */
  async function importAccount(data: {
    modelId: number; igUsername: string; igPassword: string; totpSeed?: string; backupCodes?: string;
    email?: string; emailPassword?: string; proxy: string; proxyCountry?: string; status?: string;
    fullName?: string; bio?: string; externalUrl?: string;
  }): Promise<IgAccount | null> {
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/import`, {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await parseErr(res))
      const acc = await res.json()
      accounts.value.unshift(acc)
      toast.success(`@${acc.igUsername} importada como ${acc.status} ✨`, {
        description: acc.proxyValid === false ? 'OJO: el proxy no pasó la validación, revisalo.' : 'Proxy validado, lista para el calendario.',
      })
      return acc
    } catch (e: any) {
      toast.error('No se pudo importar la cuenta', { description: e.message })
      return null
    }
  }

  /** Fase 2: enganchar el Instagram a un slot existente (multipart por la foto). */
  async function attachInstagram(id: number, data: { bundle: string; fullName?: string; bio?: string; externalUrl?: string; status?: string }, photo: File | null): Promise<IgAccount | null> {
    busyId.value = id
    try {
      const fd = new FormData()
      if (photo) fd.append('photo', photo)
      fd.append('request', JSON.stringify(data))
      // No seteamos Content-Type: el browser pone el boundary del multipart.
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}/attach`, {
        method: 'POST', headers: authHeader(), body: fd,
      })
      if (!res.ok) throw new Error(await parseErr(res))
      const acc = await res.json()
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = acc
      toast.success('Instagram enganchado — empieza el warmup automático')
      return acc
    } catch (e: any) {
      toast.error('No se pudo enganchar el Instagram', { description: e.message })
      return null
    } finally {
      busyId.value = null
    }
  }

  async function refreshStats(id: number, silent = false) {
    busyId.value = id
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}/refresh-stats`, { method: 'POST', headers: authHeader() })
      const body = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(body?.error || `Error ${res.status}`)
      const data = body.account || body
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = data
      if (body.success === false) {
        if (!silent) toast.error('No se pudieron traer stats', { description: body.error })
      } else if (!silent) {
        toast.success('Stats actualizadas')
      }
    } catch (e: any) {
      if (!silent) toast.error('Error al traer stats', { description: e.message })
    } finally {
      busyId.value = null
    }
  }

  async function runStep(id: number) {
    busyId.value = id
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}/run-step`, { method: 'POST', headers: authHeader() })
      if (!res.ok) throw new Error(await parseErr(res))
      const acc = await res.json()
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = acc
      toast.success('Paso ejecutado')
    } catch (e: any) {
      toast.error('Error al ejecutar paso', { description: e.message })
    } finally {
      busyId.value = null
    }
  }

  async function mark(id: number, status: string) {
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}/mark`, {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(await parseErr(res))
      const acc = await res.json()
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = acc
      toast.success(`Marcada como ${status}`)
    } catch (e: any) {
      toast.error('Error al marcar', { description: e.message })
    }
  }

  /** Credenciales completas (usuario/pass/email/seed/backup/proxy) para ver/copiar/editar. */
  async function getCredentials(id: number): Promise<any | null> {
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}/credentials`, { headers: authHeader() })
      if (!res.ok) throw new Error(await parseErr(res))
      return await res.json()
    } catch {
      toast.error('No se pudieron cargar las credenciales')
      return null
    }
  }

  /** Guarda cualquier subconjunto de campos de la cuenta (incluye credenciales). */
  async function updateAccount(id: number, fields: Record<string, any>): Promise<boolean> {
    busyId.value = id
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}`, {
        method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(fields),
      })
      if (!res.ok) throw new Error(await parseErr(res))
      const acc = await res.json()
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = acc
      toast.success('Configuración guardada')
      return true
    } catch (e: any) {
      toast.error('No se pudo guardar', { description: e.message })
      return false
    } finally { busyId.value = null }
  }

  /** Regenera el proxy Floppydata de la cuenta. */
  async function regenerateProxy(id: number): Promise<boolean> {
    busyId.value = id
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}/regenerate-proxy`, { method: 'POST', headers: authHeader() })
      if (!res.ok) throw new Error(await parseErr(res))
      const acc = await res.json()
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = acc
      toast.success('Proxy regenerado ✨ — usalo en AdsPower con la MISMA cuenta')
      return true
    } catch (e: any) {
      toast.error('No se pudo regenerar el proxy', { description: e.message })
      return false
    } finally { busyId.value = null }
  }

  /** Valida AHORA el proxy de la cuenta (mobile + país + limpio). NO cambia la IP. */
  async function validateProxy(id: number): Promise<boolean> {
    busyId.value = id
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}/validate-proxy`, { method: 'POST', headers: authHeader() })
      const body = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(body?.error || `Error ${res.status}`)
      const acc = body.account || body
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = acc
      if (body.ok) toast.success('Proxy OK ✅', { description: body.detail })
      else toast.error('Proxy inválido ❌ — no se publicará', { description: body.detail })
      return !!body.ok
    } catch (e: any) {
      toast.error('No se pudo validar el proxy', { description: e.message })
      return false
    } finally { busyId.value = null }
  }

  /** Cambia el USUARIO de login (cuando se cambió el @ en IG por AdsPower). */
  async function setUsername(id: number, igUsername: string): Promise<boolean> {
    busyId.value = id
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}`, {
        method: 'PUT', headers: jsonHeaders(), body: JSON.stringify({ igUsername }),
      })
      if (!res.ok) throw new Error(await parseErr(res))
      const acc = await res.json()
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = acc
      toast.success('Usuario de login actualizado')
      return true
    } catch (e: any) {
      toast.error('No se pudo actualizar el usuario', { description: e.message })
      return false
    } finally {
      busyId.value = null
    }
  }

  /** Cambia el sitio web (link de la bio) del perfil por API. */
  async function setWebsite(id: number, externalUrl: string): Promise<boolean> {
    busyId.value = id
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}/set-website`, {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ externalUrl }),
      })
      if (!res.ok) throw new Error(await parseErr(res))
      const acc = await res.json()
      const idx = accounts.value.findIndex(a => a.id === id)
      if (idx !== -1) accounts.value[idx] = acc
      toast.success('Sitio web actualizado en Instagram ✨')
      return true
    } catch (e: any) {
      toast.error('No se pudo cambiar el sitio web', { description: e.message })
      return false
    } finally {
      busyId.value = null
    }
  }

  async function remove(id: number) {
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}`, { method: 'DELETE', headers: authHeader() })
      if (!res.ok) throw new Error(await parseErr(res))
      accounts.value = accounts.value.filter(a => a.id !== id)
      toast.success('Cuenta eliminada')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  async function fetchEvents(id: number): Promise<IgAccountEvent[]> {
    try {
      const res = await fetch(`${apiUrl}/automation/ig-accounts/${id}/events`, { headers: authHeader() })
      if (!res.ok) throw new Error(await parseErr(res))
      return await res.json()
    } catch {
      toast.error('Error al cargar la auditoría')
      return []
    }
  }

  return {
    accounts, loading, busyId,
    fetchByModel, createProxySlot, attachInstagram,
    refreshStats, runStep, mark, remove, fetchEvents, setWebsite, setUsername,
    getCredentials, updateAccount, regenerateProxy, validateProxy, importAccount,
  }
}
