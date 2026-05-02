<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import {
  Sparkles, User, Ruler, Heart, BookOpen, Flame,
  ShieldAlert, Star, MessageSquare, Tag, Crown,
  DollarSign, Instagram, Send, Share2, Check, X,
  ChevronRight, Camera
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  assignedModels: any[]
}>()

const auth = useAuthStore()
const models = ref<any[]>([])
const selectedModel = ref<any>(null)
const loading = ref(true)

// Analytics data
const contentTags = ref<any[]>([])
const spenders = ref<any[]>([])
const logbookEntries = ref<any[]>([])
const loadingAnalytics = ref(false)
const userNamesCache = ref<Record<string, string>>({})

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://service-production-1ef2.up.railway.app/api/v1'

// Función para obtener el nombre real de un usuario por username
async function fetchUserRealName(username: string): Promise<string> {
  if (!username) return username
  
  // Check cache first
  if (userNamesCache.value[username]) {
    return userNamesCache.value[username]
  }
  
  try {
    const res = await fetch(`${apiUrl}/admin/users`, {
      headers: { 'Authorization': `Bearer ${auth.user?.token}` }
    })
    if (res.ok) {
      const users = await res.json()
      const user = users.find((u: any) => u.username === username)
      if (user?.name) {
        userNamesCache.value[username] = user.name
        return user.name
      }
    }
  } catch (error) {
    console.log(`No se pudo obtener el nombre real para ${username}`)
  }
  
  // Fallback: mapeo manual para usuarios conocidos
  const knownUsers: Record<string, string> = {
    'yisus': 'Yisus',
    'admin': 'Administrador', 
    'marketing': 'Marketing',
    'support': 'Soporte',
  }
  
  const displayName = knownUsers[username] || username
  userNamesCache.value[username] = displayName
  return displayName
}

async function fetchModels() {
  loading.value = true
  try {
    const res = await fetch(`${apiUrl}/admin/models/active`, {
      headers: { 'Authorization': `Bearer ${auth.user?.token}` }
    })
    if (res.ok) {
      const data = await res.json()

      // Filtrar solo las modelos que el chatter tiene asignadas según la prop
      if (props.assignedModels && props.assignedModels.length > 0) {
        const assignedIds = props.assignedModels.map(m => m.id)
        models.value = data.filter((m: any) => assignedIds.includes(m.id))
      } else {
        models.value = []
      }

      if (models.value.length > 0) {
        selectedModel.value = models.value[0]
      } else {
        selectedModel.value = null
      }
    }
  } catch (err) {
    console.error('Error fetching models:', err)
  } finally {
    loading.value = false
  }
}

async function loadModelAnalytics(modelId: number) {
  loadingAnalytics.value = true
  try {
    const headers = { 'Authorization': `Bearer ${auth.user?.token}` }
    const [tagsRes, spendersRes, logbookRes] = await Promise.all([
      fetch(`${apiUrl}/admin/models/${modelId}/content-tags`, { headers }),
      fetch(`${apiUrl}/admin/models/${modelId}/spenders`, { headers }),
      fetch(`${apiUrl}/admin/models/${modelId}/logbook/latest`, { headers })
    ])

    if (tagsRes.ok) contentTags.value = await tagsRes.json()
    if (spendersRes.ok) spenders.value = await spendersRes.json()
    if (logbookRes.ok) {
      const entries = await logbookRes.json()
      // Process author names to show real names instead of usernames
      logbookEntries.value = await Promise.all(
        entries.map(async (entry: any) => ({
          ...entry,
          displayAuthorName: await fetchUserRealName(entry.authorName)
        }))
      )
    }
  } catch (err) {
    console.error('Error loading analytics:', err)
  } finally {
    loadingAnalytics.value = false
  }
}

watch(selectedModel, (newVal) => {
  if (newVal?.id) loadModelAnalytics(newVal.id)
})

onMounted(fetchModels)

const lastEntryLabel = computed(() => {
  if (logbookEntries.value.length === 0) return '---'
  const entry = logbookEntries.value[0]
  const diffMins = Math.floor((Date.now() - new Date(entry.timestamp).getTime()) / 60000)
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  return `${Math.floor(diffHours / 24)}d`
})

const avatarColors = [
  'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-blue-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
]
function getAvatarColor(name: string) {
  if (!name) return 'bg-zinc-500'
  const idx = name.charCodeAt(0) % avatarColors.length
  return avatarColors[idx]
}
</script>

<template>
  <div class="flex-1 h-full flex flex-col lg:flex-row bg-background overflow-hidden">
    <!-- Sidebar: Model List -->
    <aside class="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-muted/20 flex flex-col">
      <div class="p-4 border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles class="w-4 h-4 text-primary" />
          </div>
          <span class="text-sm font-bold tracking-tight">Portfolio Models</span>
        </div>
        <Badge variant="outline" class="text-[10px] font-bold">{{ models.length }}</Badge>
      </div>

      <ScrollArea class="flex-1">
        <div class="p-2 space-y-1">
          <button v-for="model in models" :key="model.id" @click="selectedModel = model"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group" :class="selectedModel?.id === model.id
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'hover:bg-muted text-foreground'">

            <Avatar class="h-9 w-9 shrink-0 shadow-sm border border-white/10">
              <AvatarImage v-if="model.profilePictureUrl" :src="model.profilePictureUrl" :alt="model.name"
                class="object-cover" />
              <AvatarFallback :class="[
                getAvatarColor(model.name),
                'w-full h-full flex items-center justify-center rounded-full text-white text-sm font-bold shadow-inner'
              ]">
                {{ model.name.charAt(0) }}
              </AvatarFallback>
            </Avatar>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold truncate leading-none mb-1">{{ model.name }}</p>
              <p class="text-[10px] font-medium truncate opacity-70">
                {{ model.alias || 'Modelo Activa' }}
              </p>
            </div>
            <ChevronRight class="w-4 h-4 opacity-40" />
          </button>
        </div>
      </ScrollArea>
    </aside>

    <!-- Main Content: Model Details -->
    <main v-if="selectedModel" class="flex-1 flex flex-col overflow-hidden bg-card">
      <header class="p-6 border-b border-border bg-gradient-to-r from-muted/30 to-transparent">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="flex items-center gap-5">
            <Avatar class="h-20 w-20 ring-4 ring-background shadow-xl border border-border/50">
              <AvatarImage v-if="selectedModel.profilePictureUrl" :src="selectedModel.profilePictureUrl"
                :alt="selectedModel.name" class="object-cover" />
              <AvatarFallback :class="[
                getAvatarColor(selectedModel.name),
                'w-full h-full flex items-center justify-center rounded-full text-white text-3xl font-bold shadow-inner'
              ]">
                {{ selectedModel.name.charAt(0) }}
              </AvatarFallback>
            </Avatar>
            <div class="space-y-1.5">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-3xl font-black tracking-tight text-foreground">{{ selectedModel.name }}</h2>
                <Badge variant="secondary" class="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold">
                  ACTIVA</Badge>
              </div>
              <div class="flex items-center gap-3 text-sm font-medium text-muted-foreground flex-wrap">
                <span v-if="selectedModel.alias" class="italic text-primary">"{{ selectedModel.alias }}"</span>
                <span v-if="selectedModel.location" class="flex items-center gap-1"><span
                    class="w-1 h-1 rounded-full bg-border" /> {{ selectedModel.location }}</span>
                <span v-if="selectedModel.age" class="flex items-center gap-1"><span
                    class="w-1 h-1 rounded-full bg-border" /> {{ selectedModel.age }} años</span>
              </div>

            </div>
          </div>
        </div>
      </header>

      <div class="flex-1 overflow-hidden">
        <ScrollArea class="h-full">
          <div class="p-6 space-y-6">
            <!-- Model Performance Cards (Matching Tracker Style) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <!-- Spenders Count -->
              <Card class="border-border/50 relative overflow-hidden group shadow-none">
                <CardContent class="p-5">
                  <div class="flex items-start justify-between mb-3">
                    <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Spenders Totales
                    </p>
                    <div class="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Crown class="w-4 h-4 text-amber-600" />
                    </div>
                  </div>
                  <p class="text-2xl font-black text-foreground">{{ spenders.length }}</p>
                </CardContent>
                <div class="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
              </Card>

              <!-- Top Content Tag -->
              <Card class="border-border/50 relative overflow-hidden group shadow-none">
                <CardContent class="p-5">
                  <div class="flex items-start justify-between mb-3">
                    <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Top Content</p>
                    <div class="w-9 h-9 rounded-full bg-violet-500/10 flex items-center justify-center">
                      <Tag class="w-4 h-4 text-violet-600" />
                    </div>
                  </div>
                  <p class="text-2xl font-black text-foreground truncate">{{ contentTags[0]?.tag || '---' }}</p>
                </CardContent>
                <div class="absolute bottom-0 left-0 right-0 h-1 bg-violet-500" />
              </Card>

              <!-- Last Entry Time -->
              <Card class="border-border/50 relative overflow-hidden group shadow-none">
                <CardContent class="p-5">
                  <div class="flex items-start justify-between mb-3">
                    <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Último Relevo</p>
                    <div class="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <MessageSquare class="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <p class="text-2xl font-black text-foreground">{{ lastEntryLabel }}</p>
                </CardContent>
                <div class="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
              </Card>
            </div>

            <Tabs default-value="bio" class="space-y-6">
              <TabsList class="w-full justify-start h-14 p-1 bg-muted/30 rounded-xl border border-border/50">
                <TabsTrigger value="bio"
                  class="px-8 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Bio & Personaje</TabsTrigger>
                <TabsTrigger value="body"
                  class="px-8 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Atributos</TabsTrigger>
                <TabsTrigger value="sop"
                  class="px-8 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  SOP & Ventas</TabsTrigger>
                <TabsTrigger value="spenders"
                  class="px-8 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Compradores</TabsTrigger>
                <TabsTrigger value="history"
                  class="px-8 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2">
                  <MessageSquare class="w-3.5 h-3.5" /> Bitácora
                </TabsTrigger>
              </TabsList>

              <!-- BIO & PERSONALITY (WEB MATCH) -->
              <TabsContent value="bio" class="space-y-6">
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <!-- Column 1: Datos Personales -->
                  <Card class="xl:col-span-4 border-border/50 shadow-none bg-background">
                    <CardHeader class="pb-4">
                      <CardTitle
                        class="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <User class="w-4 h-4" /> Datos personales
                      </CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-0">
                      <div v-for="(item, i) in [
                        { label: 'Edad', value: selectedModel.age ? selectedModel.age + ' años' : '---' },
                        { label: 'Cumpleaños', value: selectedModel.birthday || '---' },
                        { label: 'Ciudad natal', value: selectedModel.hometown || '---' },
                        { label: 'Ubicación', value: selectedModel.location || '---' },
                        { label: 'Pareja', value: selectedModel.hasPartner ? 'Sí' : 'No' },
                        { label: 'Hijos', value: selectedModel.hasChildren ? 'Sí' : 'No' },
                        { label: 'Mascotas', value: selectedModel.pets || '---' },
                        { label: 'Coche', value: selectedModel.car || '---' },
                      ]" :key="i"
                        class="flex justify-between items-center py-3 border-b border-border/40 last:border-0">
                        <span class="text-xs text-muted-foreground font-medium">{{ item.label }}</span>
                        <span class="text-xs font-bold text-foreground text-right">{{ item.value }}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <!-- Column 2: Historia de marca -->
                  <Card class="xl:col-span-4 border-border/50 shadow-none bg-background">
                    <CardHeader class="pb-4">
                      <CardTitle
                        class="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <BookOpen class="w-4 h-4" /> Historia de marca
                      </CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-6">
                      <div class="space-y-2">
                        <p class="text-xs text-muted-foreground italic leading-relaxed">
                          {{ selectedModel.bio || 'Sin bio registrada.' }}
                        </p>
                      </div>
                      <div class="space-y-4">
                        <div class="p-4 bg-muted/30 rounded-xl space-y-1">
                          <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rutina</p>
                          <p class="text-xs font-bold text-foreground leading-relaxed">{{ selectedModel.routine || '---'
                          }}</p>
                        </div>
                        <div class="p-4 bg-muted/30 rounded-xl space-y-1">
                          <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Estudios</p>
                          <p class="text-xs font-bold text-foreground leading-relaxed">{{ selectedModel.studies || '---'
                          }}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <!-- Column 3: Gustos, Flags & Notes -->
                  <div class="xl:col-span-4 space-y-6">
                    <!-- Gustos & Vicios -->
                    <Card class="border-border/50 shadow-none bg-background">
                      <CardHeader class="pb-4">
                        <CardTitle
                          class="text-sm font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                          <Heart class="w-4 h-4" /> Gustos & Vicios
                        </CardTitle>
                      </CardHeader>
                      <CardContent class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                          <div class="space-y-1.5 p-3 bg-muted/20 rounded-lg">
                            <p class="text-[9px] font-black text-muted-foreground uppercase">Comida</p>
                            <p class="text-xs font-bold leading-tight">{{ selectedModel.food || '---' }}</p>
                          </div>
                          <div class="space-y-1.5 p-3 bg-muted/20 rounded-lg">
                            <p class="text-[9px] font-black text-muted-foreground uppercase">Música</p>
                            <p class="text-xs font-bold leading-tight">{{ selectedModel.music || '---' }}</p>
                          </div>
                        </div>
                        <div class="space-y-1.5 p-3 bg-muted/20 rounded-lg">
                          <p class="text-[9px] font-black text-muted-foreground uppercase">Hobbies</p>
                          <p class="text-xs font-bold leading-tight">{{ selectedModel.hobbies || '---' }}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <!-- Red Flags -->
                    <div class="p-5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                      <div class="flex items-center gap-2 text-rose-600">
                        <ShieldAlert class="w-4 h-4" />
                        <p class="text-[10px] font-black uppercase tracking-widest">RED FLAGS</p>
                      </div>
                      <p class="text-xs font-bold text-rose-600/90 leading-relaxed">{{ selectedModel.hates || 'Sin datos.' }}</p>
                    </div>

                    <!-- Special Notes -->
                    <div class="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                      <div class="flex items-center gap-2 text-amber-600">
                        <Star class="w-4 h-4" />
                        <p class="text-[10px] font-black uppercase tracking-widest">NOTAS ESPECIALES</p>
                      </div>
                      <p class="text-xs font-bold text-amber-600/90 leading-relaxed italic">{{
                        selectedModel.specialNotes || 'Sin notas.' }}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <!-- BODY & ATTRIBUTES (WEB MATCH) -->
              <TabsContent value="body" class="space-y-6">
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <!-- Dimensiones -->
                  <Card class="xl:col-span-4 border-border/50 shadow-none bg-background">
                    <CardHeader class="pb-4">
                      <CardTitle
                        class="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Ruler class="w-4 h-4" /> Dimensiones
                      </CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-0">
                      <div v-for="(item, i) in [
                        { label: 'Altura', value: selectedModel.height || '---' },
                        { label: 'Peso', value: selectedModel.weight || '---' },
                        { label: 'Pecho', value: selectedModel.breastSize ? selectedModel.breastSize + ' (' + (selectedModel.breastType || 'Nat') + ')' : '---' },
                        { label: 'Culo', value: selectedModel.buttSize || '---' },
                        { label: 'Ojos', value: selectedModel.eyes || '---' },
                        { label: 'Pelo', value: selectedModel.hair || '---' },
                        { label: 'Cirugías', value: selectedModel.surgeries || '---' },
                      ]" :key="i"
                        class="flex justify-between items-center py-3 border-b border-border/40 last:border-0">
                        <span class="text-xs text-muted-foreground font-medium">{{ item.label }}</span>
                        <span class="text-xs font-bold text-foreground text-right">{{ item.value }}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <!-- Identificadores Físicos -->
                  <Card class="xl:col-span-8 border-border/50 shadow-none bg-background flex flex-col">
                    <CardHeader class="pb-4">
                      <CardTitle
                        class="text-sm font-black uppercase tracking-widest text-violet-500 flex items-center gap-2">
                        <Camera class="w-4 h-4" /> Identificadores físicos
                      </CardTitle>
                    </CardHeader>
                    <CardContent class="flex-1">
                      <div
                        class="p-6 rounded-2xl bg-muted/20 border border-dashed border-border/60 min-h-[200px] flex flex-col justify-center">
                        <div class="space-y-3">
                          <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tatuajes &
                            Marcas</p>
                          <p class="text-sm font-bold text-foreground/80 leading-relaxed italic">
                            {{ selectedModel.tattoos || 'No se han registrado tatuajes o marcas específicas para esta modelo.' }}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <!-- SOP & SALES (WEB MATCH) -->
              <TabsContent value="sop" class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Preferencias sexuales -->
                  <Card class="border-rose-500/20 bg-rose-500/5 shadow-none">
                    <CardHeader class="pb-4">
                      <CardTitle
                        class="text-sm font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
                        <Flame class="w-4 h-4" /> Preferencias sexuales
                      </CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-4">
                      <div class="p-4 bg-background/60 rounded-xl border border-rose-500/10 space-y-1.5">
                        <p class="text-[9px] font-black text-rose-500 uppercase">Estímulo & Posición</p>
                        <p class="text-xs font-bold leading-relaxed">{{ selectedModel.sexualPreferences || '---' }}</p>
                      </div>
                      <div class="p-4 bg-background/60 rounded-xl border border-rose-500/10 space-y-1.5">
                        <p class="text-[9px] font-black text-rose-500 uppercase">Juguetes Favoritos</p>
                        <p class="text-xs font-bold leading-relaxed">{{ selectedModel.toys || '---' }}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <!-- Custom Content Rules -->
                  <Card class="border-emerald-500/20 bg-emerald-500/5 shadow-none">
                    <CardHeader class="pb-4">
                      <CardTitle
                        class="text-sm font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                        <Check class="w-4 h-4" /> Custom Content Rules
                      </CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-6">
                      <p
                        class="text-xs font-medium text-emerald-800/70 dark:text-emerald-400/70 leading-relaxed italic">
                        {{ selectedModel.customContentRules || 'Sin reglas específicas registradas para contenido personalizado.' }}
                      </p>

                      <Separator class="bg-emerald-500/20" />

                      <div class="grid grid-cols-2 gap-y-4 gap-x-8">
                        <div v-for="item in [
                          { label: 'Anal', key: 'allowedAnal' },
                          { label: 'Boy/Girl', key: 'allowedBoyGirl' },
                          { label: 'Girl/Girl', key: 'allowedGirlGirl' },
                          { label: 'Live Call', key: 'allowedLiveCall' },
                          { label: 'JOI', key: 'allowedJOI' },
                          { label: 'Striptease', key: 'allowedStriptease' },
                        ]" :key="item.key" class="flex items-center gap-3">
                          <component :is="selectedModel[item.key] ? Check : X" class="w-4 h-4"
                            :class="selectedModel[item.key] ? 'text-emerald-500' : 'text-rose-500'" />
                          <span class="text-xs font-bold uppercase tracking-tight"
                            :class="selectedModel[item.key] ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground/60'">
                            {{ item.label }}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <!-- Best Selling Content Tags (Bottom Card) -->
                <Card class="border-border/50 shadow-none bg-background">
                  <CardHeader class="pb-4">
                    <CardTitle
                      class="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Tag class="w-4 h-4" /> Etiquetas de Contenido más vendido
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div class="flex flex-wrap gap-2">
                      <Badge v-for="tag in contentTags" :key="tag.tag" variant="secondary"
                        class="px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-full bg-muted/50 border-border/50">
                        {{ tag.tag }} <span class="ml-2 opacity-40">×{{ tag.count }}</span>
                      </Badge>
                      <p v-if="contentTags.length === 0" class="text-xs font-medium text-muted-foreground italic">No hay
                        registros de ventas recientes.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <!-- COMPRADORES (SPENDERS) -->
              <TabsContent value="spenders" class="space-y-6">
                <Card class="border-border/50 shadow-none overflow-hidden bg-background">
                  <CardHeader class="pb-4">
                    <CardTitle
                      class="text-sm font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                      <Crown class="w-4 h-4" /> Listado de Compradores
                    </CardTitle>
                    <CardDescription class="text-[11px]">Identifica a los clientes más importantes de la modelo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent class="p-0">
                    <div v-if="loadingAnalytics" class="p-12 flex justify-center">
                      <div class="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                    <div v-else-if="spenders.length === 0"
                      class="p-12 text-center text-muted-foreground italic text-xs font-medium">
                      No hay compradores registrados aún.
                    </div>
                    <div v-else class="divide-y divide-border/40">
                      <div v-for="sp in spenders" :key="sp.username || sp.name"
                        class="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                        <div class="flex items-center gap-3 min-w-0">
                          <Avatar class="h-9 w-9 border border-border/50 shadow-sm">
                            <AvatarFallback class="text-[10px] font-black bg-primary/10 text-primary uppercase">
                              {{ (sp.name || sp.username || '?').charAt(0) }}
                            </AvatarFallback>
                          </Avatar>
                          <div class="min-w-0">
                            <p class="text-xs font-bold truncate leading-tight text-foreground">{{ sp.name || '---' }}
                            </p>
                            <p class="text-[10px] text-muted-foreground font-medium truncate">@{{ sp.username || '---'
                            }}</p>
                          </div>
                        </div>
                        <div class="flex items-center gap-6 shrink-0">
                          <div class="text-right">
                            <p class="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">
                              Apariciones</p>
                            <Badge variant="secondary"
                              class="text-[10px] font-bold py-0 h-5 border-none bg-muted/60 text-foreground">{{
                                sp.appearances }}×</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <!-- BITACORA / HISTORY -->
              <TabsContent value="history" class="space-y-6">
                <div v-if="logbookEntries.length > 0" class="space-y-4">
                  <div v-for="entry in logbookEntries" :key="entry.id"
                    class="p-4 rounded-xl border border-border bg-muted/5 space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <div
                          class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                          {{ entry.displayAuthorName?.charAt(0) }}
                        </div>
                        <span class="text-xs font-bold">{{ entry.displayAuthorName }}</span>
                        <span class="text-[10px] text-muted-foreground font-medium">• {{ new
                          Date(entry.timestamp).toLocaleString() }}</span>
                      </div>
                      <Badge v-if="entry.priority === 'HIGH'" variant="destructive" class="text-[9px] font-black">
                        URGENTE</Badge>
                    </div>
                    <p class="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{{ entry.message }}</p>
                  </div>
                </div>
                <div v-else
                  class="flex flex-col items-center justify-center py-20 text-center gap-4 border-2 border-dashed border-border rounded-2xl">
                  <div class="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <MessageSquare class="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm font-bold">Sin novedades registradas</p>
                    <p class="text-xs text-muted-foreground">Las actualizaciones de tus compañeros aparecerán aquí.</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </main>

    <!-- Empty State -->
    <div v-else class="flex-1 flex flex-col items-center justify-center p-12 text-center bg-muted/5">
      <div
        class="w-24 h-24 rounded-[2.5rem] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-6 shadow-inner">
        <ShieldAlert class="w-10 h-10 text-zinc-400" />
      </div>
      <div class="max-w-md space-y-3">
        <h3 class="text-2xl font-black tracking-tight text-foreground uppercase">Sin Modelos Asignadas</h3>
        <p class="text-sm text-muted-foreground leading-relaxed">
          No tienes modelos vinculadas a tu perfil en este momento.
          Por favor, contacta con tu <span class="text-primary font-bold">Manager</span> para que se te asigne el
          portfolio correspondiente.
        </p>
        <div class="pt-6">
          <Button variant="outline" class="rounded-full font-bold px-8" @click="fetchModels">
            Reintentar Sincronización
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Transiciones suaves para los tabs */
.tabs-content {
  animation: slide-up 0.3s ease-out;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
