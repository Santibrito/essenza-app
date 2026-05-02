<script setup lang="ts">
import { ClipboardList, Info } from 'lucide-vue-next'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <ClipboardList class="w-4 h-4 text-purple-500" />
        </div>
        <div>
          <p class="text-sm font-bold text-foreground leading-none">Bitácora</p>
          <p class="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Notas de turno</p>
        </div>
      </div>

      <TooltipProvider :delay-duration="100">
        <Tooltip>
          <TooltipTrigger as-child>
            <button class="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
              <Info class="w-3.5 h-3.5 text-muted-foreground/40" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" class="max-w-[180px] text-[10px] font-medium leading-relaxed bg-zinc-900 border-zinc-800 text-white">
            Escribe aquí las novedades relevantes. Al finalizar el turno, estas notas se autocompletarán en tu reporte.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <div class="flex-1 min-h-[140px] relative">
      <Textarea
        :model-value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        placeholder="¿Algo importante que reportar? Escríbelo aquí..."
        class="h-full min-h-[140px] resize-none bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary/20 transition-all text-xs leading-relaxed"
      />
      <div v-if="!modelValue" class="absolute bottom-3 right-3 pointer-events-none opacity-20">
        <ClipboardList class="w-10 h-10 text-muted-foreground" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Estilo sutil para que parezca una bitácora física premium */
textarea {
  scrollbar-width: thin;
  scrollbar-color: rgba(155, 155, 155, 0.1) transparent;
}
</style>
