<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, User, MessageSquare, Tag, DollarSign } from 'lucide-vue-next'
import api from '@/api'

interface Spender {
  name: string
  username: string
  amount: string
}

interface LastReport {
  message: string
  soldContent: string[]
  spenders: Spender[]
  createdAt: string
  fromUser: string
  shiftId: number
}

const props = defineProps<{
  modelId: number
  modelName: string
}>()

const lastReport = ref<LastReport | null>(null)
const loading = ref(true)

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('es-AR', { 
    day: '2-digit', 
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

onMounted(async () => {
  try {
    const res = await api.get(`/admin/models/${props.modelId}/logbook/latest`)
    if (res.data) {
      lastReport.value = res.data
    }
  } catch (err) {
    console.error('Error loading last report:', err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <Card class="border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
    <CardHeader class="pb-3">
      <CardTitle class="text-sm font-bold text-foreground flex items-center gap-2">
        <Clock class="w-4 h-4 text-muted-foreground" />
        Último Reporte
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div v-if="loading" class="text-xs text-muted-foreground">
        Cargando...
      </div>
      
      <div v-else-if="!lastReport" class="text-xs text-muted-foreground italic">
        No hay reportes anteriores para esta modelo
      </div>

      <div v-else class="space-y-3">
        <!-- Metadata -->
        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          <div v-if="lastReport.fromUser" class="flex items-center gap-1.5">
            <User class="w-3 h-3" />
            <span class="font-semibold">{{ lastReport.fromUser }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <Clock class="w-3 h-3" />
            <span>{{ formatDateTime(lastReport.createdAt) }}</span>
          </div>
        </div>

        <!-- Observations -->
        <div v-if="lastReport.message" class="space-y-1">
          <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare class="w-3 h-3" />
            Observaciones
          </p>
          <p class="text-xs text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{{ lastReport.message }}</p>
        </div>

        <!-- Sold Content -->
        <div v-if="lastReport.soldContent?.length > 0" class="space-y-1">
          <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Tag class="w-3 h-3" />
            Contenido Vendido
          </p>
          <div class="flex flex-wrap gap-1.5">
            <Badge v-for="(item, idx) in lastReport.soldContent" :key="idx" variant="secondary" class="text-xs">
              {{ item }}
            </Badge>
          </div>
        </div>

        <!-- Spenders -->
        <div v-if="lastReport.spenders?.length > 0" class="space-y-1">
          <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign class="w-3 h-3" />
            Spenders
          </p>
          <div class="space-y-1.5">
            <div v-for="(sp, idx) in lastReport.spenders" :key="idx" 
              class="flex items-center justify-between p-2 rounded-md bg-muted/30 text-xs">
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <DollarSign class="w-2.5 h-2.5 text-amber-400" />
                </div>
                <div>
                  <p class="font-semibold text-foreground">{{ sp.name }}</p>
                  <p v-if="sp.username" class="text-muted-foreground text-[10px]">@{{ sp.username }}</p>
                </div>
              </div>
              <p v-if="sp.amount" class="font-bold text-amber-500">${{ sp.amount }}</p>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
