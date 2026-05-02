<script setup lang="ts">
import { ref } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import { Link } from 'lucide-vue-next'
import { customsApi } from '@/lib/customsApi'

const props = defineProps<{ open: boolean; customId: number | null }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'completed'): void
}>()

const driveLink = ref('')
const comment = ref('')
const saving = ref(false)

async function submit() {
  if (!props.customId || !driveLink.value.trim()) return
  saving.value = true
  try {
    await customsApi.complete(props.customId, { driveLink: driveLink.value, comment: comment.value || undefined })
    toast.success('Custom completado')
    emit('completed')
    emit('update:open', false)
    driveLink.value = ''
    comment.value = ''
  } catch {
    toast.error('Error al completar el custom')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base font-black tracking-tight">Completar Custom</DialogTitle>
      </DialogHeader>
      <div class="space-y-4 py-2">
        <div>
          <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Link de Drive *</label>
          <div class="relative mt-1">
            <Link class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input v-model="driveLink" placeholder="https://drive.google.com/..."
              class="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Comentario (opcional)</label>
          <textarea v-model="comment" placeholder="Notas sobre la entrega..." rows="2"
            class="mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">Cancelar</Button>
        <Button @click="submit" :disabled="!driveLink.trim() || saving">
          {{ saving ? 'Guardando...' : 'Marcar como Completado' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
