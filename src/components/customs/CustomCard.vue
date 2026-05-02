<script setup>
import { computed } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Video, Image, Mic, Clock, ExternalLink, History } from 'lucide-vue-next'

const props = defineProps({
  custom: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['click'])

const typeConfig = {
  VIDEO_CALL: {
    label: 'Videollamada',
    icon: Video,
    iconClass: 'text-sky-500',
    pillClass: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400',
    accentClass: 'before:bg-sky-400 dark:before:bg-sky-500',
  },
  IMAGE: {
    label: 'Imágenes/Videos',
    icon: Image,
    iconClass: 'text-violet-500',
    pillClass: 'bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400',
    accentClass: 'before:bg-violet-400 dark:before:bg-violet-500',
  },
  AUDIO: {
    label: 'Audio',
    icon: Mic,
    iconClass: 'text-amber-500',
    pillClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
    accentClass: 'before:bg-amber-400 dark:before:bg-amber-500',
  },
}

const priorityConfig = {
  LOW: { label: 'Baja', variant: 'secondary' },
  NORMAL: { label: 'Normal', variant: 'outline' },
  HIGH: { label: 'Alta', variant: 'default' },
  URGENT: { label: 'Urgente', variant: 'destructive' },
}

const templateDataParsed = computed(() => {
  try { return JSON.parse(props.custom.templateData || '{}') } catch { return {} }
})

const description = computed(() => {
  const d = templateDataParsed.value
  return d.description || d.fanName || d.duration || null
})

const type = computed(() => typeConfig[props.custom.type] ?? typeConfig.IMAGE)
const prio = computed(() => priorityConfig[props.custom.priority] ?? priorityConfig.NORMAL)
const initials = computed(() =>
  (props.custom.createdByUsername || props.custom.createdByUser?.username || 'U').charAt(0).toUpperCase()
)

function formatDateTime(date) {
  return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <Card class="card-custom group relative overflow-hidden cursor-pointer border transition-all duration-200
           hover:shadow-[0_4px_20px_-4px_hsl(var(--foreground)/0.12)]
           hover:-translate-y-0.5 active:translate-y-0 active:shadow-none select-none" :class="type.accentClass"
    @click="emit('click', custom)">
    <CardContent class="p-4 space-y-3">

      <!-- Top row: type pill + priority badge -->
      <div class="flex items-center justify-between gap-2">
        <div
          :class="['flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none', type.pillClass]">
          <component :is="type.icon" class="w-3.5 h-3.5" :class="type.iconClass" />
          {{ type.label }}
        </div>
        <Badge :variant="prio.variant" class="text-[11px] px-2 py-0.5 leading-none shrink-0">
          {{ prio.label }}
        </Badge>
      </div>

      <!-- Model name -->
      <p class="text-sm font-semibold text-foreground leading-snug truncate">
        {{ custom.model?.name || 'Sin modelo' }}
      </p>

      <!-- Description preview -->
      <p v-if="description" class="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {{ description }}
      </p>

      <!-- Divider -->
      <div class="h-px bg-border/60" />

      <!-- Footer: avatar + date + counters -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <Avatar class="w-6 h-6 shrink-0">
            <AvatarFallback class="text-[10px] font-bold bg-primary/10 text-primary">
              {{ initials }}
            </AvatarFallback>
          </Avatar>
          <span class="text-[11px] text-muted-foreground truncate">
            {{ custom.createdByUsername || custom.createdByUser?.username || 'Usuario' }}
          </span>
        </div>

        <div class="flex items-center gap-2.5 shrink-0 text-[11px] text-muted-foreground">
          <!-- history count -->
          <span v-if="custom.history?.length" class="flex items-center gap-1">
            <History class="w-3 h-3" />
            {{ custom.history.length }}
          </span>
          <!-- date -->
          <span class="flex items-center gap-1">
            <Clock class="w-3 h-3" />
            {{ formatDateTime(custom.createdAt) }}
          </span>
        </div>
      </div>

      <!-- Drive badge -->
      <div v-if="custom.driveLink" class="flex items-center gap-1.5 rounded-md border border-emerald-200 dark:border-emerald-800
               bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-medium
               text-emerald-700 dark:text-emerald-400 w-fit">
        <ExternalLink class="w-3 h-3" />
        Drive disponible
      </div>

    </CardContent>
  </Card>
</template>

<style scoped>
/* Left accent bar via ::before */
.card-custom::before {
  content: '';
  position: absolute;
  inset-block: 0;
  left: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  transition: width 0.15s ease;
}

.card-custom:hover::before {
  width: 4px;
}
</style>
