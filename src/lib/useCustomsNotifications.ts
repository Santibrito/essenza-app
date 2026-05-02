import { ref, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { customsApi } from './customsApi'

export function useCustomsNotifications(getModelIds: () => number[]) {
  const pendingCount = ref(0)
  const knownReadyIds = ref<Set<number>>(new Set())
  let interval: ReturnType<typeof setInterval> | null = null

  async function check() {
    const modelIds = getModelIds()
    if (!modelIds.length) return
    try {
      const pending = await customsApi.getPendingForUser(modelIds)
      if (!Array.isArray(pending)) return

      // Find newly ready customs (not previously known)
      const newReady = pending.filter((c: any) => !knownReadyIds.value.has(c.id))
      newReady.forEach((c: any) => {
        knownReadyIds.value.add(c.id)
        toast.info(`Custom listo para subir`, {
          description: `${c.model?.name || 'Modelo'} — ${c.type === 'VIDEO_CALL' ? 'Videollamada' : c.type === 'IMAGE' ? 'Imágenes' : 'Audio'}`,
          duration: 8000,
        })
      })

      pendingCount.value = pending.length
    } catch { }
  }

  function start() {
    check()
    interval = setInterval(check, 30000)
  }

  function stop() {
    if (interval) clearInterval(interval)
  }

  onUnmounted(stop)

  return { pendingCount, start, stop }
}
