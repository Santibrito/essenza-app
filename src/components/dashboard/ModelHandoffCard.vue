<script setup lang="ts">
import { ref } from 'vue'
import { Clock, Star, DollarSign, AlertCircle, MessageSquare, ArrowRight, ChevronDown } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const props = defineProps<{
  model: { name: string; alias?: string }
  entries: any[]
}>()

const isOpen = ref(false)

function parseJson(str: string | null | undefined) {
  if (!str) return []
  try { return JSON.parse(str) } catch { return [] }
}

function fmtDateOnly(ts: string) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function fmtTimeOnly(ts: string) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function authorInitial(name: string) {
  return (name || '?').charAt(0).toUpperCase()
}

function getGradient(idx: number) {
  const gradients = [
    'from-violet-500 to-indigo-600',
    'from-rose-500 to-pink-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-sky-500 to-blue-600',
  ]
  return gradients[idx % gradients.length]
}
</script>

<template>
  <Collapsible v-model:open="isOpen" class="w-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm transition-all duration-300">
    <!-- Model Header -->
    <CollapsibleTrigger class="w-full px-5 py-4 bg-gradient-to-r from-primary/5 to-transparent flex items-center gap-4 hover:bg-primary/10 transition-colors text-left">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-violet-500/20 shrink-0">
        {{ model.name.charAt(0).toUpperCase() }}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-black text-foreground leading-none tracking-tight">{{ model.name }}</p>
        <p v-if="model.alias" class="text-[11px] text-muted-foreground mt-1 font-medium">{{ model.alias }}</p>
      </div>
      <div class="flex items-center gap-3">
        <Badge variant="secondary" class="text-[10px] font-black tabular-nums px-2.5 py-0.5">
          {{ entries.length }} {{ entries.length === 1 ? 'relevo' : 'relevos' }}
        </Badge>
        <ChevronDown class="w-4 h-4 text-muted-foreground transition-transform duration-300" :class="{ 'rotate-180': isOpen }" />
      </div>
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div class="border-t border-border/50 max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 divide-y divide-border/50">
        <!-- Empty State -->
        <div v-if="!entries.length" class="flex flex-col items-center justify-center gap-3 text-center py-10 px-6 bg-zinc-50/50 dark:bg-zinc-900/30">
          <MessageSquare class="w-8 h-8 text-muted-foreground/20" />
          <p class="text-xs font-bold text-muted-foreground/50 uppercase tracking-wider">Sin historial de relevos</p>
        </div>

        <div
          v-for="(entry, idx) in entries"
          :key="entry.id"
          class="px-5 py-5 hover:bg-muted/30 transition-colors duration-200"
        >
          <!-- Entry header -->
          <div class="flex items-center gap-3 mb-3">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm"
              :class="getGradient(idx)"
            >
              {{ authorInitial(entry.authorName) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <p class="text-[12px] font-bold text-foreground leading-none">{{ entry.authorName || 'Operador' }}</p>
                <p class="text-[10px] text-muted-foreground font-medium capitalize">{{ fmtDateOnly(entry.timestamp) }} · {{ fmtTimeOnly(entry.timestamp) }}</p>
              </div>
            </div>
          </div>

          <!-- Message / handoff notes -->
          <div v-if="entry.message" class="mb-3 ml-11">
            <p class="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{{ entry.message }}</p>
          </div>

          <!-- Content items -->
          <div v-if="parseJson(entry.soldContentJson).length" class="ml-11 mb-3">
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="(tag, i) in parseJson(entry.soldContentJson)"
                :key="i"
                class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- Spenders -->
          <div v-if="parseJson(entry.spendersJson).length" class="ml-11 space-y-1.5">
            <div
              v-for="(sp, i) in parseJson(entry.spendersJson)"
              :key="i"
              class="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Star class="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span class="text-xs font-bold text-foreground truncate">{{ sp.name }}</span>
                <span v-if="sp.username" class="text-[10px] text-muted-foreground truncate">{{ sp.username }}</span>
              </div>
              <span class="text-xs font-black text-amber-600 dark:text-amber-400 tabular-nums ml-2">${{ sp.amount }}</span>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
late>