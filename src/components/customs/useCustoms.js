import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { customsApi } from '@/lib/customsApi'

export function useCustoms(modelIds) {
  const customs = ref([])
  const loading = ref(false)

  const urgent = computed(() =>
    customs.value.filter(c => c.status === 'READY_FOR_UPLOAD')
  )

  const byModel = computed(() => {
    const active = customs.value.filter(
      c => c.status !== 'COMPLETED' && c.status !== 'READY_FOR_UPLOAD'
    )
    const map = {}
    for (const c of active) {
      const name = c.model?.name ?? 'Sin modelo'
      if (!map[name]) map[name] = []
      map[name].push(c)
    }
    return map
  })

  const completed = computed(() =>
    customs.value.filter(c => c.status === 'COMPLETED')
  )

  async function load() {
    const ids = typeof modelIds === 'function' ? modelIds() : modelIds?.value ?? modelIds
    loading.value = true
    try {
      // If no modelIds provided (e.g., Manager role), fetch all customs
      if (!ids || ids.length === 0) {
        console.log('[useCustoms] Loading all customs (no model filter)')
        customs.value = (await customsApi.list()) || []
      } else {
        console.log('[useCustoms] Loading customs for models:', ids)
        customs.value = (await customsApi.list({ modelIds: ids })) || []
      }
      console.log('[useCustoms] Loaded customs:', customs.value.length)
    } catch (error) {
      console.error('[useCustoms] Error loading customs:', error)
      toast.error('Error al cargar customs: ' + (error.message || 'Error desconocido'))
    } finally {
      loading.value = false
    }
  }

  async function refreshOne(id) {
    try {
      const updated = await customsApi.get(id)
      const idx = customs.value.findIndex(c => c.id === id)
      if (idx !== -1) customs.value[idx] = updated
      return updated
    } catch {
      return null
    }
  }

  return { customs, loading, urgent, byModel, completed, load, refreshOne }
}
