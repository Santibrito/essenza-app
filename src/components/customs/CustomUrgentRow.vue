<script setup>
import { computed, ref, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, User, CheckCircle2, Clock, AlertTriangle } from 'lucide-vue-next'
import { TYPE, STATUS, parseTemplate, fmt } from './customs.config.js'

const props = defineProps({ custom: { type: Object, required: true } })
const emit = defineEmits(['open'])

// User names cache
const userNamesCache = ref({})
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://service-production-1ef2.up.railway.app/api/v1'

// Función para obtener el nombre real de un usuario por username
async function fetchUserRealName(username) {
  if (!username) return username
  
  // Check cache first
  if (userNamesCache.value[username]) {
    return userNamesCache.value[username]
  }
  
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${apiUrl}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const users = await res.json()
      const user = users.find(u => u.username === username)
      if (user?.name) {
        userNamesCache.value[username] = user.name
        return user.name
      }
    }
  } catch (error) {
    console.log(`No se pudo obtener el nombre real para ${username}`)
  }
  
  // Fallback: mapeo manual para usuarios conocidos
  const knownUsers = {
    'yisus': 'Yisus',
    'admin': 'Administrador', 
    'marketing': 'Marketing',
    'support': 'Soporte',
  }
  
  const displayName = knownUsers[username] || username
  userNamesCache.value[username] = displayName
  return displayName
}

const statusColor = computed(() => {
  switch (props.custom.status) {
    case 'CREATED': return 'border-l-zinc-500/50 bg-zinc-500/5'
    case 'SENT': return 'border-l-blue-500/50 bg-blue-500/5'
    case 'READY_FOR_UPLOAD': return 'border-l-amber-500/50 bg-amber-500/5'
    case 'COMPLETED': return 'border-l-emerald-500/50 bg-emerald-500/5'
    default: return 'border-l-zinc-500/50'
  }
})

const displayCreatedBy = computed(() => {
  return userNamesCache.value[props.custom.createdByUsername] || props.custom.createdByUsername || '—'
})

const displayCompletedBy = computed(() => {
  return userNamesCache.value[props.custom.completedByUsername] || props.custom.completedByUsername || '—'
})

// Load user names on mount
onMounted(async () => {
  if (props.custom.createdByUsername) {
    await fetchUserRealName(props.custom.createdByUsername)
  }
  if (props.custom.completedByUsername) {
    await fetchUserRealName(props.custom.completedByUsername)
  }
})
</script>

<template>
  <div
    class="flex items-center gap-4 px-5 py-4 hover:bg-accent cursor-pointer transition-colors border-l-4"
    :class="statusColor"
    @click="emit('open', custom)">

    <!-- icon -->
    <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" :class="TYPE[custom.type]?.bg">
      <component :is="TYPE[custom.type]?.icon" class="w-4 h-4" :class="TYPE[custom.type]?.cls" />
    </div>

    <!-- info principal -->
    <div class="flex-1 min-w-0 space-y-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-bold truncate">{{ custom.model?.name }}</span>
        <Badge variant="outline" class="text-[10px] shrink-0" :class="STATUS[custom.status]?.cls">
          {{ STATUS[custom.status]?.label }}
        </Badge>
        <span class="text-xs text-muted-foreground shrink-0">· {{ TYPE[custom.type]?.label }}</span>
        <Badge v-if="custom.priority === 'URGENT'" variant="outline"
          class="text-[10px] shrink-0 bg-red-500/10 text-red-500 border-red-500/20 gap-1">
          <AlertTriangle class="w-3 h-3" />
          URGENTE
        </Badge>
      </div>
      
      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="flex items-center gap-1">
          <User class="w-3 h-3" />
          Reportó: {{ displayCreatedBy }}
        </span>
        <span v-if="custom.completedByUsername" class="flex items-center gap-1">
          <CheckCircle2 class="w-3 h-3" />
          Envió: {{ displayCompletedBy }}
        </span>
        <span class="flex items-center gap-1">
          <Clock class="w-3 h-3" />
          {{ fmt(custom.createdAt) }}
        </span>
      </div>

      <p class="text-xs text-muted-foreground/70 truncate">
        {{ parseTemplate(custom.templateData).nick
          || parseTemplate(custom.templateData).fanName
          || parseTemplate(custom.templateData).description
          || 'Sin descripción' }}
      </p>
    </div>

    <!-- actions -->
    <div class="flex items-center gap-2 shrink-0">
      <a v-if="custom.driveLink" :href="custom.driveLink" target="_blank" @click.stop>
        <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs">
          <ExternalLink class="w-3 h-3" /> Drive
        </Button>
      </a>

      <Button size="sm" class="h-8 gap-1.5 text-xs" @click.stop="emit('open', custom)">
        Ver detalles
      </Button>
    </div>
  </div>
</template>
