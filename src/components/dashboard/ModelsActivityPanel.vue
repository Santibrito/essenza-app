<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Clock, User, MessageSquare, DollarSign, Tag } from 'lucide-vue-next'
import api from '@/api'

interface Model {
  id: number
  name: string
  alias?: string
}

interface Spender {
  name: string
  username: string
  amount: string
}

interface ModelReport {
  handoffNotes: string
  spenders: Spender[]
}

interface HandoffEntry {
  message: string
  spenders: Spender[]
  soldContent: string[]
  createdAt: string
  fromUser?: string
}

const props = defineProps<{
  assignedModels: Model[]
  handoffData: Record<number, HandoffEntry[]>
}>()

const modelReports = defineModel<Record<number, ModelReport>>('modelReports', { default: {} })

const lastReports = ref<Record<number, any>>({})

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  return `${Math.floor(diffHours / 24)}d`
}

function getLastActivity(modelId: number): HandoffEntry | null {
  const entries = props.handoffData[modelId]
  return entries && entries.length > 0 ? entries[0] : null
}

function addSpender(modelId: number) {
  if (!modelReports.value[modelId]) {
    modelReports.value[modelId] = { handoffNotes: '', spenders: [] }
  }
  modelReports.value[modelId].spenders.push({ name: '', username: '', amount: '' })
}

function removeSpender(modelId: number, idx: number) {
  if (modelReports.value[modelId]?.spenders) {
    modelReports.value[modelId].spenders.splice(idx, 1)
  }
}

// Initialize reports for all models
watch(() => props.assignedModels, (models) => {
  models.forEach(m => {
    if (!(m.id in modelReports.value)) {
      modelReports.value[m.id] = {
        handoffNotes: '',
        spenders: [{ name: '', username: '', amount: '' }]
      }
    }
  })
}, { immediate: true })

// Load last reports
onMounted(async () => {
  for (const model of props.assignedModels) {
    try {
      const res = await api.get(`/admin/models/${model.id}/logbook/latest`)
      if (res.data) {
        lastReports.value[model.id] = res.data
      }
    } catch (err) {
      console.error(`Error loading last report for model ${model.id}:`, err)
    }
  }
})
</script>

<template>
  <div class="space-y-2">
    <h3 class="text-sm font-semibold text-foreground">Modelos Asignados</h3>
    
    <div class="border border-border rounded-lg overflow-hidden">
      <table class="w-full text-xs">
        <thead class="bg-muted/50 border-b border-border">
          <tr>
            <th class="text-left p-3 font-semibold text-muted-foreground w-48">Modelo</th>
            <th class="text-left p-3 font-semibold text-muted-foreground">Observaciones</th>
            <th class="text-left p-3 font-semibold text-muted-foreground w-96">Spenders</th>
            <th class="text-left p-3 font-semibold text-muted-foreground w-80">Último Reporte</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="model in assignedModels" :key="model.id" class="border-b border-border last:border-0">
            <!-- Model Info -->
            <td class="p-3 align-top">
              <div class="space-y-1">
                <p class="font-semibold text-foreground">{{ model.name }}</p>
                <p v-if="model.alias" class="text-muted-foreground text-[10px]">@{{ model.alias }}</p>
                
                <div v-if="getLastActivity(model.id)" class="text-[10px] text-muted-foreground pt-2 space-y-0.5">
                  <p><span class="font-medium">Último:</span> {{ formatRelativeTime(getLastActivity(model.id)!.createdAt) }}</p>
                  <p v-if="getLastActivity(model.id)!.fromUser">
                    <span class="font-medium">Por:</span> {{ getLastActivity(model.id)!.fromUser }}
                  </p>
                  <p v-if="getLastActivity(model.id)!.message" class="line-clamp-2 italic">
                    "{{ getLastActivity(model.id)!.message }}"
                  </p>
                </div>
              </div>
            </td>

            <!-- Observations -->
            <td class="p-3 align-top">
              <Textarea 
                v-model="modelReports[model.id].handoffNotes"
                placeholder="Notas..."
                class="min-h-[100px] text-xs resize-none"
              />
            </td>

            <!-- Spenders -->
            <td class="p-3 align-top">
              <div class="space-y-2">
                <div v-for="(sp, sIdx) in modelReports[model.id]?.spenders || []" :key="sIdx" class="flex gap-1.5">
                  <Input v-model="sp.name" placeholder="Nombre" class="h-8 text-xs flex-1" />
                  <Input v-model="sp.username" placeholder="@user" class="h-8 text-xs flex-1" />
                  <Input v-model="sp.amount" placeholder="$" class="h-8 text-xs w-16" />
                  <Button 
                    v-if="modelReports[model.id].spenders.length > 1"
                    @click="removeSpender(model.id, sIdx)" 
                    variant="ghost" 
                    size="icon"
                    class="h-8 w-8 shrink-0">
                    <X class="w-3 h-3" />
                  </Button>
                </div>
                <Button @click="addSpender(model.id)" variant="ghost" size="sm" class="h-7 text-[10px] w-full">
                  <Plus class="w-3 h-3 mr-1" /> Añadir spender
                </Button>
              </div>
            </td>

            <!-- Last Report -->
            <td class="p-3 align-top">
              <div v-if="lastReports[model.id]" class="space-y-2 text-[10px]">
                <!-- Metadata -->
                <div class="flex items-center gap-2 text-muted-foreground">
                  <User class="w-2.5 h-2.5" />
                  <span class="font-semibold">{{ lastReports[model.id].fromUser }}</span>
                  <Clock class="w-2.5 h-2.5 ml-1" />
                  <span>{{ formatRelativeTime(lastReports[model.id].createdAt) }}</span>
                </div>

                <!-- Message -->
                <div v-if="lastReports[model.id].message" class="space-y-1">
                  <p class="font-semibold text-muted-foreground flex items-center gap-1">
                    <MessageSquare class="w-2.5 h-2.5" />
                    Observaciones
                  </p>
                  <p class="text-foreground bg-muted/30 p-1.5 rounded text-[10px] line-clamp-3">
                    {{ lastReports[model.id].message }}
                  </p>
                </div>

                <!-- Content -->
                <div v-if="lastReports[model.id].soldContent?.length" class="space-y-1">
                  <p class="font-semibold text-muted-foreground flex items-center gap-1">
                    <Tag class="w-2.5 h-2.5" />
                    Contenido
                  </p>
                  <div class="flex flex-wrap gap-1">
                    <Badge v-for="(item, idx) in lastReports[model.id].soldContent.slice(0, 3)" 
                      :key="idx" variant="secondary" class="text-[9px] px-1.5 py-0">
                      {{ item }}
                    </Badge>
                  </div>
                </div>

                <!-- Spenders -->
                <div v-if="lastReports[model.id].spenders?.length" class="space-y-1">
                  <p class="font-semibold text-muted-foreground flex items-center gap-1">
                    <DollarSign class="w-2.5 h-2.5" />
                    Spenders
                  </p>
                  <div class="space-y-1">
                    <div v-for="(sp, idx) in lastReports[model.id].spenders.slice(0, 2)" 
                      :key="idx" 
                      class="flex items-center justify-between text-[9px] bg-muted/30 p-1 rounded">
                      <span class="font-semibold">{{ sp.name }}</span>
                      <span v-if="sp.amount" class="text-amber-500 font-bold">${{ sp.amount }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <p v-else class="text-[10px] text-muted-foreground italic">Sin reportes previos</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
