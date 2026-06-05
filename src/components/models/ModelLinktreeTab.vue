<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">

    <!-- Editor Panel -->
    <div class="space-y-5 overflow-y-auto pr-1">
      <div>
        <h3 class="text-sm font-semibold text-foreground mb-4">Configuración de Perfil Público</h3>
      </div>

      <!-- Slug -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL del perfil</label>
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground text-sm shrink-0">essenzamodels.com/p/</span>
          <input
            v-model="form.slug"
            type="text"
            placeholder="nombre-modelo"
            class="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            @input="form.slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '')"
          />
        </div>
        <p v-if="slugError" class="text-xs text-destructive">{{ slugError }}</p>
      </div>

      <!-- Display Name -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre a mostrar</label>
        <input
          v-model="form.displayName"
          type="text"
          placeholder="Rosalya"
          class="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <!-- Title/Tagline -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Título / Tagline</label>
        <input
          v-model="form.title"
          type="text"
          placeholder="Model & Content Creator"
          class="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <!-- Bio -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descripción</label>
        <textarea
          v-model="form.bioPublic"
          placeholder="Una descripción breve para los fans..."
          rows="3"
          class="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <!-- Photo URL -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL de foto de perfil</label>
        <input
          v-model="form.profilePhotoUrl"
          type="url"
          placeholder="https://..."
          class="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <!-- Social Links -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Redes sociales</label>
          <button @click="addSocialLink" class="text-xs text-primary hover:underline">+ Agregar</button>
        </div>
        <div
          v-for="(link, i) in socialLinks"
          :key="i"
          class="flex items-center gap-2"
        >
          <select
            v-model="link.icon"
            @change="link.label = link.icon"
            class="px-2 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none w-32 shrink-0"
          >
            <option value="instagram">Instagram</option>
            <option value="telegram">Telegram</option>
            <option value="twitter">Twitter/X</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
            <option value="website">Sitio web</option>
          </select>
          <input
            v-model="link.url"
            type="url"
            placeholder="https://..."
            class="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button @click="removeSocialLink(i)" class="text-muted-foreground hover:text-destructive p-1">
            <X :size="14" />
          </button>
        </div>
      </div>

      <!-- Custom Links -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Links personalizados</label>
          <button @click="addCustomLink" class="text-xs text-primary hover:underline">+ Agregar</button>
        </div>
        <div
          v-for="(link, i) in customLinks"
          :key="i"
          class="flex items-center gap-2"
        >
          <input
            v-model="link.emoji"
            placeholder="🔥"
            class="w-10 px-2 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none text-center shrink-0"
          />
          <input
            v-model="link.label"
            placeholder="Texto del botón"
            class="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            v-model="link.url"
            type="url"
            placeholder="https://..."
            class="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button @click="removeCustomLink(i)" class="text-muted-foreground hover:text-destructive p-1">
            <X :size="14" />
          </button>
        </div>
      </div>

      <!-- Active Toggle -->
      <div class="flex items-center justify-between py-3 border-t border-border">
        <div>
          <p class="text-sm font-medium">Perfil activo</p>
          <p class="text-xs text-muted-foreground">El perfil será visible públicamente</p>
        </div>
        <button
          @click="form.isActive = !form.isActive"
          :class="form.isActive ? 'bg-green-500' : 'bg-border'"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
        >
          <span
            :class="form.isActive ? 'translate-x-6' : 'translate-x-1'"
            class="inline-block h-4 w-4 rounded-full bg-white transition-transform"
          />
        </button>
      </div>

      <!-- Save Button -->
      <div class="flex gap-3 pt-2">
        <button
          @click="saveProfile"
          :disabled="saving"
          class="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {{ saving ? 'Guardando...' : 'Guardar cambios' }}
        </button>
        <a
          v-if="form.slug && form.isActive"
          :href="`${webBaseUrl}/p/${form.slug}`"
          target="_blank"
          class="px-4 py-2.5 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
        >
          <ExternalLink :size="14" />
          Ver
        </a>
      </div>

      <!-- Stats -->
      <div v-if="stats" class="space-y-3 pt-2">
        <!-- Métricas generales -->
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-muted/50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold">{{ stats.totalVisits }}</p>
            <p class="text-xs text-muted-foreground mt-1">Visitas</p>
          </div>
          <div class="bg-muted/50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold">{{ stats.ageConfirmedVisits }}</p>
            <p class="text-xs text-muted-foreground mt-1">Confirmaron edad</p>
          </div>
          <div class="bg-muted/50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold">{{ stats.totalClicks }}</p>
            <p class="text-xs text-muted-foreground mt-1">Clicks totales</p>
          </div>
        </div>

        <!-- Clicks por link -->
        <div v-if="stats.clicksByLink && stats.clicksByLink.length" class="bg-muted/30 rounded-xl p-4 space-y-3">
          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clicks por link</p>
          <div
            v-for="item in stats.clicksByLink"
            :key="item.linkLabel"
            class="space-y-1"
          >
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5">
                <span
                  :class="item.linkType === 'social' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'"
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
                >
                  {{ item.linkType }}
                </span>
                <span class="font-medium capitalize">{{ item.linkLabel }}</span>
              </div>
              <span class="font-bold tabular-nums">{{ item.clicks }}</span>
            </div>
            <!-- Barra de progreso -->
            <div class="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="item.linkType === 'social' ? 'bg-blue-500' : 'bg-purple-500'"
                :style="{ width: `${Math.round((item.clicks / stats.totalClicks) * 100)}%` }"
              />
            </div>
          </div>
        </div>
        <p v-else-if="stats.totalVisits > 0" class="text-xs text-muted-foreground text-center py-2">
          Aún no hay clicks registrados
        </p>
      </div>
    </div>

    <!-- Preview Panel -->
    <div class="hidden lg:flex flex-col items-center justify-start pt-4">
      <div class="flex items-center justify-between w-full max-w-[320px] mb-3">
        <p class="text-xs text-muted-foreground font-medium">Preview en vivo</p>
        <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      <!-- Phone Frame -->
      <div class="w-[320px] h-[620px] rounded-[2.5rem] bg-black border-4 border-zinc-800 overflow-hidden relative shadow-2xl">
        <div class="absolute inset-0 overflow-y-auto scrollbar-none" style="scrollbar-width: none;">

          <!-- Hero photo area -->
          <div class="relative w-full h-56">
            <img
              v-if="form.profilePhotoUrl"
              :src="form.profilePhotoUrl"
              class="absolute inset-0 w-full h-full object-cover object-top"
            />
            <div
              v-else
              class="absolute inset-0 bg-zinc-800 flex items-center justify-center"
            >
              <span class="text-zinc-600 text-xs">Sin foto</span>
            </div>
            <div
              class="absolute inset-0"
              style="background: linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.5) 55%, #000 100%);"
            />
          </div>

          <!-- Content -->
          <div class="-mt-4 px-4 pb-8 bg-black">
            <!-- Name + title -->
            <div class="text-center mb-4">
              <h3 class="text-white font-bold text-xl">{{ form.displayName || 'Nombre' }}</h3>
              <p class="text-zinc-400 text-xs mt-0.5">{{ form.title || 'Título' }}</p>
            </div>

            <!-- Bio -->
            <p v-if="form.bioPublic" class="text-zinc-500 text-xs text-center mb-4 leading-relaxed line-clamp-3">
              {{ form.bioPublic }}
            </p>

            <!-- Social icons -->
            <div v-if="socialLinks.filter(l => l.url).length" class="flex justify-center gap-3 mb-4">
              <div
                v-for="(link, i) in socialLinks.filter(l => l.url)"
                :key="i"
                class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <component :is="getSocialIconPreview(link.icon)" :size="14" class="text-white" />
              </div>
            </div>

            <!-- Custom links -->
            <div class="space-y-2">
              <div
                v-for="(link, i) in customLinks.filter(l => l.label)"
                :key="i"
                class="flex items-center justify-center gap-1.5 w-full py-3 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-medium"
              >
                <span v-if="link.emoji">{{ link.emoji }}</span>
                <span>{{ link.label }}</span>
              </div>
            </div>

            <!-- Footer -->
            <p class="text-center text-zinc-700 text-xs mt-6">Essenza Models</p>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { X, ExternalLink, Instagram, Send, Twitter, Music2, Youtube, Facebook, Globe } from 'lucide-vue-next'

interface SocialLink { label: string; url: string; icon: string }
interface CustomLink { label: string; url: string; emoji: string }
interface ProfileForm {
  id: number | null
  slug: string
  displayName: string
  title: string
  bioPublic: string
  profilePhotoUrl: string
  isActive: boolean
}
interface Stats {
  totalVisits: number
  ageConfirmedVisits: number
  totalClicks: number
  clicksByLink: Array<{ linkLabel: string; linkType: string; clicks: number }>
}

const props = defineProps<{ modelId: number }>()

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://crm-app.up.railway.app/api/v1'
const webBaseUrl = import.meta.env.VITE_WEB_URL ?? 'https://essenzamodels.com'
const token = computed(() => localStorage.getItem('token') ?? '')

const form = ref<ProfileForm>({
  id: null,
  slug: '',
  displayName: '',
  title: '',
  bioPublic: '',
  profilePhotoUrl: '',
  isActive: false,
})
const socialLinks = ref<SocialLink[]>([])
const customLinks = ref<CustomLink[]>([])
const saving = ref(false)
const slugError = ref('')
const stats = ref<Stats | null>(null)

const headers = computed(() => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token.value}`,
}))

const loadProfile = async () => {
  const res = await fetch(`${API_BASE}/admin/models/${props.modelId}/profile`, { headers: headers.value })
  if (!res.ok) return
  const profiles = await res.json()
  if (profiles.length > 0) {
    const p = profiles[0]
    form.value = {
      id: p.id,
      slug: p.slug ?? '',
      displayName: p.displayName ?? '',
      title: p.title ?? '',
      bioPublic: p.bioPublic ?? '',
      profilePhotoUrl: p.profilePhotoUrl ?? '',
      isActive: p.active ?? false,
    }
    try { socialLinks.value = JSON.parse(p.socialLinksJson ?? '[]') } catch { socialLinks.value = [] }
    try { customLinks.value = JSON.parse(p.customLinksJson ?? '[]') } catch { customLinks.value = [] }

    // Load stats
    const statsRes = await fetch(`${API_BASE}/admin/models/${props.modelId}/profile/${p.id}/stats`, { headers: headers.value })
    if (statsRes.ok) stats.value = await statsRes.json()
  }
}

const saveProfile = async () => {
  slugError.value = ''
  if (!form.value.slug) { slugError.value = 'El slug es requerido'; return }

  saving.value = true
  try {
    const payload = {
      ...form.value,
      active: form.value.isActive,   // el backend usa "active", no "isActive"
      socialLinksJson: JSON.stringify(socialLinks.value.filter(l => l.url)),
      customLinksJson: JSON.stringify(customLinks.value.filter(l => l.label)),
    }

    const isNew = !form.value.id
    const url = isNew
      ? `${API_BASE}/admin/models/${props.modelId}/profile`
      : `${API_BASE}/admin/models/${props.modelId}/profile/${form.value.id}`
    const method = isNew ? 'POST' : 'PUT'

    const res = await fetch(url, { method, headers: headers.value, body: JSON.stringify(payload) })
    if (res.status === 400) {
      slugError.value = 'Este slug ya está en uso, elegí otro'
      return
    }
    if (res.ok) {
      const saved = await res.json()
      form.value.id = saved.id
    }
  } finally {
    saving.value = false
  }
}

const addSocialLink = () => socialLinks.value.push({ label: 'instagram', url: '', icon: 'instagram' })
const removeSocialLink = (i: number) => socialLinks.value.splice(i, 1)
const addCustomLink = () => customLinks.value.push({ label: '', url: '', emoji: '' })
const removeCustomLink = (i: number) => customLinks.value.splice(i, 1)

const ICON_MAP: Record<string, unknown> = {
  instagram: Instagram, telegram: Send, twitter: Twitter,
  tiktok: Music2, youtube: Youtube, facebook: Facebook, website: Globe,
}
const getSocialIconPreview = (icon: string) => ICON_MAP[icon] ?? Globe

onMounted(loadProfile)
</script>
