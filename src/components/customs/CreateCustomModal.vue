<script setup lang="ts">
import { ref, computed } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'vue-sonner'
import { Video, Image, Mic, Upload, X } from 'lucide-vue-next'
import VideoCallTemplate from './VideoCallTemplate.vue'
import ImageTemplate from './ImageTemplate.vue'
import AudioTemplate from './AudioTemplate.vue'
import { customsApi } from '@/lib/customsApi'

const props = defineProps<{
  open: boolean
  models: { id: number; name: string }[]
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'created'): void
}>()

const step = ref<'type' | 'form'>('type')
const type = ref<'VIDEO_CALL' | 'IMAGE' | 'AUDIO' | null>(null)
const selectedModelId = ref<number | null>(null)
const priority = ref('NORMAL')
const templateData = ref<Record<string, string>>({})
const attachments = ref<{ url: string; description: string }[]>([])
const uploading = ref(false)
const saving = ref(false)

const typeOptions = [
  { id: 'VIDEO_CALL', label: 'Videollamada', desc: 'Ficha completa para videollamada con fan', icon: Video, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { id: 'IMAGE', label: 'Imágenes/Videos', desc: 'Custom de fotos o videos para el fan', icon: Image, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { id: 'AUDIO', label: 'Audio', desc: 'Mensaje de voz o audio personalizado', icon: Mic, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
]

const priorityOptions = [
  { id: 'LOW', label: 'Baja' },
  { id: 'NORMAL', label: 'Normal' },
  { id: 'HIGH', label: 'Alta' },
  { id: 'URGENT', label: 'Urgente' },
]

const canSubmit = computed(() => type.value && selectedModelId.value && Object.keys(templateData.value).some(k => templateData.value[k]))

function selectType(t: 'VIDEO_CALL' | 'IMAGE' | 'AUDIO') {
  type.value = t
  templateData.value = {}
  step.value = 'form'
}

async function handleFileUpload(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files?.length) return
  uploading.value = true
  try {
    for (const file of Array.from(files)) {
      const result = await customsApi.uploadAttachment(0, file)
      attachments.value.push({ url: result.url, description: '' })
    }
  } catch {
    toast.error('Error al subir imagen')
  } finally {
    uploading.value = false
  }
}

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  try {
    await customsApi.create({
      type: type.value,
      modelId: selectedModelId.value,
      priority: priority.value,
      templateData: JSON.stringify(templateData.value),
      attachments: attachments.value.length ? JSON.stringify(attachments.value) : null
    })
    toast.success('Custom creado')
    emit('created')
    emit('update:open', false)
    reset()
  } catch {
    toast.error('Error al crear el custom')
  } finally {
    saving.value = false
  }
}

function reset() {
  step.value = 'type'
  type.value = null
  selectedModelId.value = null
  priority.value = 'NORMAL'
  templateData.value = {}
  attachments.value = []
}

function handleClose(v: boolean) {
  if (!v) reset()
  emit('update:open', v)
}
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="max-w-2xl p-0 gap-0 overflow-hidden">
      <DialogHeader class="px-6 pt-5 pb-4 border-b border-border">
        <div class="flex items-center gap-3">
          <button v-if="step === 'form'" @click="step = 'type'"
            class="text-xs text-muted-foreground hover:text-foreground transition-colors">← Volver</button>
          <DialogTitle class="text-base font-black tracking-tight">
            {{ step === 'type' ? 'Nuevo Custom' : typeOptions.find(t => t.id === type)?.label }}
          </DialogTitle>
        </div>
      </DialogHeader>

      <!-- STEP 1: Type selection -->
      <div v-if="step === 'type'" class="p-6 space-y-3">
        <p class="text-sm text-muted-foreground mb-4">¿Qué tipo de custom querés crear?</p>
        <button v-for="t in typeOptions" :key="t.id" @click="selectType(t.id as any)"
          class="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:border-primary/40 hover:bg-accent"
          :class="type === t.id ? `${t.border} ${t.bg}` : 'border-border'">
          <span class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="t.bg">
            <component :is="t.icon" class="w-5 h-5" :class="t.color" />
          </span>
          <div>
            <p class="font-semibold text-sm text-foreground">{{ t.label }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ t.desc }}</p>
          </div>
        </button>
      </div>

      <!-- STEP 2: Form -->
      <template v-else>
        <ScrollArea class="max-h-[65vh]">
          <div class="p-6 space-y-5">
            <!-- Model + Priority row -->
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>Modelo</Label>
                <Select :model-value="selectedModelId?.toString()" @update:model-value="selectedModelId = $event ? parseInt($event) : null">
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="m in models" :key="m.id" :value="m.id.toString()">{{ m.name }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-2">
                <Label>Prioridad</Label>
                <Select v-model="priority">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="p in priorityOptions" :key="p.id" :value="p.id">{{ p.label }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <!-- Template form -->
            <div class="space-y-1">
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Datos del Custom</p>
              <VideoCallTemplate v-if="type === 'VIDEO_CALL'" v-model="templateData" />
              <ImageTemplate v-else-if="type === 'IMAGE'" v-model="templateData" />
              <AudioTemplate v-else-if="type === 'AUDIO'" v-model="templateData" />
            </div>

            <Separator />

            <!-- Attachments -->
            <div class="space-y-3">
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Imágenes de referencia</p>
              <div class="flex flex-wrap gap-2">
                <div v-for="(att, i) in attachments" :key="i"
                  class="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                  <img :src="att.url" class="w-full h-full object-cover" />
                  <button @click="attachments.splice(i, 1)"
                    class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X class="w-3 h-3 text-white" />
                  </button>
                </div>
                <label class="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                  <Upload class="w-4 h-4 text-muted-foreground" />
                  <span class="text-[10px] text-muted-foreground mt-1">{{ uploading ? '...' : 'Subir' }}</span>
                  <input type="file" class="hidden" accept="image/*" multiple @change="handleFileUpload" :disabled="uploading" />
                </label>
              </div>
              <div v-for="(att, i) in attachments" :key="`d-${i}`">
                <Input v-model="att.description" :placeholder="`Descripción imagen ${i + 1}`" class="text-xs h-8" />
              </div>
            </div>
          </div>
        </ScrollArea>

        <div class="px-6 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" @click="handleClose(false)">Cancelar</Button>
          <Button @click="submit" :disabled="!canSubmit || saving">
            {{ saving ? 'Creando...' : 'Crear Custom' }}
          </Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
