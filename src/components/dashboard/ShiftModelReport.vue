<script setup lang="ts">
/**
 * ShiftModelReport.vue
 * Per-model block inside the shift end modal.
 * Loads historical content-tags and spenders from the API to power autocomplete.
 */
import { ref, watch, computed, onMounted } from 'vue'
import { X, Plus, Star, Tag, ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ModelLastReport from './ModelLastReport.vue'
import api from '@/api'

// ── Props / Emits ────────────────────────────────────────────────────────────

interface Spender {
  name: string
  username: string
  amount: string
}

const props = defineProps<{
  modelId: number
  modelName: string
  observations: string          // general observations (v-model)
  contentItems: string[]        // sold content tags (v-model)
  spenders: Spender[]           // spenders list (v-model)
}>()

const emit = defineEmits<{
  (e: 'update:observations', v: string): void
  (e: 'update:contentItems', v: string[]): void
  (e: 'update:spenders', v: Spender[]): void
}>()

// ── Remote suggestions ───────────────────────────────────────────────────────

const suggestedTags = ref<{ tag: string; count: number }[]>([])
const suggestedSpenders = ref<{ name: string; username: string; totalAmount: number; appearances: number }[]>([])
const loadingSuggestions = ref(false)

onMounted(async () => {
  if (!props.modelId) return
  loadingSuggestions.value = true
  try {
    const [tagsRes, spendersRes] = await Promise.all([
      api.get(`/admin/models/${props.modelId}/content-tags`),
      api.get(`/admin/models/${props.modelId}/spenders`),
    ])
    suggestedTags.value = tagsRes.data || []
    suggestedSpenders.value = spendersRes.data || []
  } catch { /* ignore */ } finally {
    loadingSuggestions.value = false
  }
})

// ── Content tags ─────────────────────────────────────────────────────────────

const contentInput = ref('')
const showTagDropdown = ref(false)

const filteredTags = computed(() => {
  const q = contentInput.value.trim().toLowerCase()
  // Show all suggestions if input empty, else fuzzy filter
  return suggestedTags.value
    .filter(t => !props.contentItems.includes(t.tag)) // already added
    .filter(t => !q || t.tag.includes(q))
    .slice(0, 8)
})

function addTag(tag: string) {
  const normalized = tag.trim().toLowerCase()
  if (!normalized || props.contentItems.includes(normalized)) return
  emit('update:contentItems', [...props.contentItems, normalized])
  contentInput.value = ''
  showTagDropdown.value = false
}

function addContentFromInput() {
  if (contentInput.value.trim()) addTag(contentInput.value)
}

function removeTag(tag: string) {
  emit('update:contentItems', props.contentItems.filter(t => t !== tag))
}

// ── Spenders ─────────────────────────────────────────────────────────────────

const spenderNameInput = ref('')
const spenderUsernameInput = ref('')
const activeSpenderIdx = ref<number | null>(null)
const showSpenderDropdown = ref(false)

const filteredSpenders = computed(() => {
  const q = (spenderNameInput.value + spenderUsernameInput.value).trim().toLowerCase()
  return suggestedSpenders.value
    .filter(s => {
      if (!q) return true
      return s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)
    })
    .slice(0, 6)
})

function applySuggestion(s: typeof suggestedSpenders.value[0]) {
  if (activeSpenderIdx.value === null) return
  const updated = [...props.spenders]
  updated[activeSpenderIdx.value] = {
    ...updated[activeSpenderIdx.value],
    name: s.name,
    username: s.username,
  }
  emit('update:spenders', updated)
  showSpenderDropdown.value = false
}

function addSpender() {
  emit('update:spenders', [...props.spenders, { name: '', username: '', amount: '' }])
}

function removeSpender(idx: number) {
  const updated = [...props.spenders]
  updated.splice(idx, 1)
  emit('update:spenders', updated)
}

function updateSpender(idx: number, field: keyof Spender, value: string) {
  const updated = [...props.spenders]
  updated[idx] = { ...updated[idx], [field]: value }
  emit('update:spenders', updated)
}

function onSpenderFocus(idx: number) {
  activeSpenderIdx.value = idx
  spenderNameInput.value = props.spenders[idx]?.name || ''
  spenderUsernameInput.value = props.spenders[idx]?.username || ''
  showSpenderDropdown.value = true
}

function onSpenderBlur() {
  // small delay so click on dropdown registers
  setTimeout(() => { showSpenderDropdown.value = false }, 200)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Current Report - 2 columns -->
    <div class="grid grid-cols-2 gap-6">

      <!-- LEFT COLUMN: Observaciones -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Observaciones del turno
        </label>
        <textarea :value="observations"
          @input="emit('update:observations', ($event.target as HTMLTextAreaElement).value)"
          placeholder="Notas generales sobre el turno con este modelo..." rows="12"
          class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>

      <!-- RIGHT COLUMN: Contenido + Spenders -->
      <div class="space-y-4">

        <!-- ── Contenido más vendido ─────────────────────────────────────────── -->
        <div class="space-y-2">
          <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Tag class="w-3 h-3" />
            Contenido más vendido
          </label>

          <!-- Tags already added -->
          <div v-if="contentItems.length" class="flex flex-wrap gap-1.5">
            <span v-for="tag in contentItems" :key="tag"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              {{ tag }}
              <button @click="removeTag(tag)" class="hover:text-destructive transition-colors">
                <X class="w-3 h-3" />
              </button>
            </span>
          </div>

          <!-- Input + dropdown -->
          <div class="relative">
            <div class="flex gap-2">
              <Input v-model="contentInput" placeholder="Ej: mixto, foto x4, video..." class="h-9 text-sm flex-1"
                @focus="showTagDropdown = true" @blur="setTimeout(() => (showTagDropdown = false), 150)"
                @keydown.enter.prevent="addContentFromInput" @keydown.comma.prevent="addContentFromInput" />
              <Button variant="outline" size="sm" class="h-9 px-3 shrink-0" @click="addContentFromInput">
                <Plus class="w-3.5 h-3.5" />
              </Button>
            </div>

            <!-- Suggestions dropdown -->
            <div v-if="showTagDropdown && (filteredTags.length || loadingSuggestions)"
              class="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden max-h-48 overflow-y-auto">
              <div v-if="loadingSuggestions" class="px-3 py-2 text-xs text-muted-foreground">
                Cargando sugerencias…
              </div>
              <template v-else>
                <button v-for="suggestion in filteredTags" :key="suggestion.tag"
                  class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent transition-colors"
                  @mousedown.prevent="addTag(suggestion.tag)">
                  <span class="text-sm capitalize">{{ suggestion.tag }}</span>
                  <span class="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                    ×{{ suggestion.count }}
                  </span>
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- ── Spenders ──────────────────────────────────────────────────────── -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label
              class="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Star class="w-3 h-3 text-amber-400" />
              Gastadores (Spenders)
            </label>
            <Button variant="ghost" size="sm" class="h-6 text-xs gap-1 px-2" @click="addSpender">
              <Plus class="w-3 h-3" />
              Agregar
            </Button>
          </div>

          <div class="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            <div v-for="(sp, idx) in spenders" :key="idx"
              class="relative rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <!-- Remove button -->
              <button v-if="spenders.length > 1" @click="removeSpender(idx)"
                class="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors">
                <X class="w-3.5 h-3.5" />
              </button>

              <!-- Name + username row -->
              <div class="grid grid-cols-2 gap-2 relative">
                <div class="space-y-1">
                  <label class="text-[10px] text-muted-foreground font-medium">Nombre</label>
                  <Input :value="sp.name" @input="updateSpender(idx, 'name', ($event.target as HTMLInputElement).value)"
                    placeholder="Nombre" class="h-8 text-xs" @focus="onSpenderFocus(idx)" @blur="onSpenderBlur" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] text-muted-foreground font-medium">Usuario</label>
                  <Input :value="sp.username"
                    @input="updateSpender(idx, 'username', ($event.target as HTMLInputElement).value)"
                    placeholder="@username" class="h-8 text-xs" @focus="onSpenderFocus(idx)" @blur="onSpenderBlur" />
                </div>

                <!-- Autocomplete dropdown for spenders -->
                <div v-if="showSpenderDropdown && activeSpenderIdx === idx && filteredSpenders.length"
                  class="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden col-span-2 max-h-48 overflow-y-auto">
                  <button v-for="s in filteredSpenders" :key="s.username || s.name"
                    class="w-full flex items-center justify-between px-3 py-2 hover:bg-accent transition-colors text-left"
                    @mousedown.prevent="applySuggestion(s)">
                    <div class="flex items-center gap-2 min-w-0">
                      <div
                        class="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                        <Star class="w-2.5 h-2.5 text-amber-400" />
                      </div>
                      <div class="min-w-0">
                        <p class="text-xs font-semibold text-foreground truncate">{{ s.name }}</p>
                        <p class="text-[10px] text-muted-foreground truncate">{{ s.username ? '@' + s.username : '' }}
                        </p>
                      </div>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                      <p class="text-xs font-black text-amber-500">${{ s.totalAmount.toFixed(0) }}</p>
                      <p class="text-[10px] text-muted-foreground">{{ s.appearances }}x</p>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Amount -->
              <div class="space-y-1">
                <label class="text-[10px] text-muted-foreground font-medium">Monto gastado ($)</label>
                <Input :value="sp.amount"
                  @input="updateSpender(idx, 'amount', ($event.target as HTMLInputElement).value)" placeholder="0"
                  type="number" class="h-8 text-xs font-bold" />
              </div>

              <!-- Historical badge if found in suggestions -->
              <div
                v-if="suggestedSpenders.find(s => s.username === sp.username.toLowerCase() || s.name.toLowerCase() === sp.name.toLowerCase())"
                class="flex items-center gap-1.5 text-[10px] text-amber-500">
                <Star class="w-3 h-3" />
                <span>
                  Total histórico:
                  <strong>${{suggestedSpenders.find(s => s.username === sp.username.toLowerCase() ||
                    s.name.toLowerCase()
                    ===
                    sp.name.toLowerCase())?.totalAmount.toFixed(0) }}</strong>
                  en {{suggestedSpenders.find(s => s.username === sp.username.toLowerCase() || s.name.toLowerCase() ===
                    sp.name.toLowerCase())?.appearances}} turno(s)
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Last Report Card -->
      <ModelLastReport :model-id="modelId" :model-name="modelName" />
    </div>
  </div>
</template>
