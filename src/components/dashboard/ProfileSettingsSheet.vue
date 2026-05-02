<script setup lang="ts">
/**
 * ProfileSettingsSheet.vue
 * Slide-in panel for user profile settings — timezone, profile picture, etc.
 * Opened from DashboardSidebar or Topbar.
 */
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import api from '@/api'
import { Globe, User, Clock, CheckCircle2, Camera, Upload, Loader2 } from 'lucide-vue-next'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from '@/components/ui/command'
import { TIMEZONE_OPTIONS } from '@/lib/useTimezone'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const auth = useAuthStore()

// ── Timezone selection ─────────────────────────────────────────────────────
const selectedTz = ref(auth.user?.timezone || 'America/Argentina/Buenos_Aires')
const saving = ref(false)
const comboboxOpen = ref(false)

// Keep in sync if user object changes (e.g. after login)
watch(() => auth.user?.timezone, (tz) => { if (tz) selectedTz.value = tz })

const selectedLabel = computed(() => {
  const found = TIMEZONE_OPTIONS.find(t => t.value === selectedTz.value)
  return found?.label || selectedTz.value
})

const currentLocalTime = computed(() => {
  if (!selectedTz.value) return ''
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: selectedTz.value,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
    }).format(new Date())
  } catch { return '' }
})

function selectTimezone(tz: string) {
  selectedTz.value = tz
  comboboxOpen.value = false
}

async function saveTimezone() {
  if (selectedTz.value === auth.user?.timezone) {
    toast.info('Ya estás usando ese horario')
    return
  }
  saving.value = true
  try {
    await api.put('/admin/users/me/timezone', { timezone: selectedTz.value })
    auth.updateTimezone(selectedTz.value)
    toast.success('Zona horaria actualizada', {
      description: `Ahora usás ${selectedLabel.value}`
    })
  } catch {
    toast.error('Error al guardar la zona horaria')
  } finally {
    saving.value = false
  }
}

// ── Profile Picture ────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref<string | null>(null)
const uploadingPicture = ref(false)

const currentPicture = computed(() =>
  previewUrl.value || auth.user?.profilePictureUrl || auth.user?.profilePictureBase64 || null
)

function triggerFileInput() {
  fileInput.value?.click()
}

function onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.error('Solo se aceptan imágenes (JPG, PNG, WebP)')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('La imagen no puede superar los 5 MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    previewUrl.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

async function uploadProfilePicture() {
  if (!previewUrl.value) return
  uploadingPicture.value = true
  try {
    const res = await api.put('/admin/users/me/picture', {
      profilePictureBase64: previewUrl.value
    })
    const newUrl = res.data?.profilePictureUrl || previewUrl.value
    auth.updateProfilePicture(newUrl)
    previewUrl.value = null
    toast.success('Foto de perfil actualizada')
  } catch {
    toast.error('Error al subir la foto de perfil')
  } finally {
    uploadingPicture.value = false
    // Reset file input so the same file can be re-selected if needed
    if (fileInput.value) fileInput.value.value = ''
  }
}

function cancelPreview() {
  previewUrl.value = null
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="w-[360px] sm:w-[420px] flex flex-col gap-0 p-0 overflow-hidden">

      <!-- Header -->
      <SheetHeader class="px-6 pt-6 pb-4 border-b border-border">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full overflow-hidden border border-border shrink-0">
            <img v-if="currentPicture"
              :src="currentPicture"
              class="w-full h-full object-cover" />
            <div v-else class="w-full h-full bg-primary/10 flex items-center justify-center">
              <User class="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <SheetTitle class="text-base leading-none">{{ auth.user?.name }}</SheetTitle>
            <SheetDescription class="text-xs mt-0.5">@{{ auth.user?.username }}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        <!-- ── Foto de Perfil ───────────────────────────────────────────────── -->
        <section class="space-y-3">
          <div class="flex items-center gap-2">
            <Camera class="w-4 h-4 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">Foto de Perfil</h3>
          </div>

          <!-- Avatar preview area -->
          <div class="flex items-center gap-4">
            <div
              class="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border bg-muted shrink-0 group cursor-pointer"
              @click="triggerFileInput"
            >
              <img v-if="currentPicture" :src="currentPicture" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <User class="w-8 h-8 text-muted-foreground/40" />
              </div>
              <!-- Hover overlay -->
              <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera class="w-5 h-5 text-white" />
              </div>
            </div>

            <div class="flex-1 space-y-2">
              <p class="text-xs text-muted-foreground leading-relaxed">
                JPG, PNG o WebP. Máximo 5 MB.
              </p>
              <Button variant="outline" size="sm" class="gap-2 h-8 text-xs" @click="triggerFileInput">
                <Upload class="w-3.5 h-3.5" />
                Elegir imagen
              </Button>
            </div>
          </div>

          <!-- Hidden file input -->
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="onFileSelected"
          />

          <!-- Preview confirm/cancel -->
          <div v-if="previewUrl" class="flex gap-2 pt-1">
            <Button
              class="flex-1 gap-2 h-9 text-xs font-bold"
              :disabled="uploadingPicture"
              @click="uploadProfilePicture"
            >
              <Loader2 v-if="uploadingPicture" class="w-3.5 h-3.5 animate-spin" />
              <CheckCircle2 v-else class="w-3.5 h-3.5" />
              {{ uploadingPicture ? 'Subiendo...' : 'Confirmar foto' }}
            </Button>
            <Button variant="ghost" size="sm" class="h-9 text-xs" :disabled="uploadingPicture" @click="cancelPreview">
              Cancelar
            </Button>
          </div>
        </section>

        <Separator />

        <!-- ── Zona Horaria ─────────────────────────────────────────────── -->
        <section class="space-y-3">
          <div class="flex items-center gap-2">
            <Globe class="w-4 h-4 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">Zona Horaria</h3>
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed">
            Los turnos del admin se convierten automáticamente a tu horario local.
            Elegí el país/ciudad donde trabajás.
          </p>

          <!-- Live clock preview -->
          <div class="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
            <Clock class="w-3.5 h-3.5 text-primary shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-[10px] text-muted-foreground uppercase tracking-wide">Tu hora actual</p>
              <p class="text-sm font-bold text-foreground capitalize">{{ currentLocalTime }}</p>
            </div>
          </div>

          <!-- Timezone Combobox -->
          <Popover v-model:open="comboboxOpen">
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                role="combobox"
                :aria-expanded="comboboxOpen"
                class="w-full justify-between h-10 font-medium text-sm"
              >
                <span class="truncate">{{ selectedLabel }}</span>
                <svg class="ml-2 h-4 w-4 shrink-0 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[var(--reka-popper-anchor-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar país o ciudad..." />
                <CommandEmpty>Sin resultados.</CommandEmpty>
                <CommandList>
                  <CommandGroup>
                    <CommandItem
                      v-for="tz in TIMEZONE_OPTIONS"
                      :key="tz.value"
                      :value="tz.label"
                      @select="selectTimezone(tz.value)"
                    >
                      <CheckCircle2
                        class="mr-2 h-4 w-4 shrink-0"
                        :class="selectedTz === tz.value ? 'opacity-100 text-primary' : 'opacity-0'"
                      />
                      <span class="truncate">{{ tz.label }}</span>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <!-- Current saved vs selected -->
          <div v-if="auth.user?.timezone !== selectedTz" class="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Cambio pendiente de guardar
          </div>

          <Button
            class="w-full gap-2"
            :disabled="saving || selectedTz === auth.user?.timezone"
            @click="saveTimezone"
          >
            <Globe class="w-3.5 h-3.5" />
            {{ saving ? 'Guardando...' : 'Guardar zona horaria' }}
          </Button>
        </section>

      </div>

    </SheetContent>
  </Sheet>
</template>
