<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  BarChart3, Video, UserPlus, Instagram, 
  Send, Share2, ClipboardList, TrendingUp, 
  Lightbulb, Mail, Target, Plus, Search, Globe,
  MessageSquare, Heart, MessageCircle, Users, RefreshCw, Zap,
  Trophy, Play, Eye
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import api from '@/api'
import { toast } from 'vue-sonner'

const props = defineProps<{
  shiftId: number | null
}>()

const shiftObservations = ref('')
const report = ref({
   reelsEdited: 0,
   ideasGenerated: 1,
   modelsContacted: 0,
   socialActivity: [] as any[]
})

const socialAccounts = ref<any[]>([])
const models = ref<any[]>([])
const loadingAccounts = ref(true)
const syncingAccount = ref<number | null>(null)

const fetchModels = async () => {
    try {
        const res = await api.get('/admin/models')
        models.value = res.data
    } catch {}
}

const fetchSocialAccounts = async () => {
    loadingAccounts.value = true
    try {
        const res = await api.get('/marketing/accounts')
        socialAccounts.value = res.data
        report.value.socialActivity = res.data.map((acc: any) => ({
            accountId: acc.id,
            handle: acc.handle,
            platform: acc.platform,
            modelName: acc.ofModel?.name,
            posts: 0,
            stories: 0,
            reels: 0,
            likes: 0,
            comments: 0,
            followersCount: 0,
            reelsCount: 0,
            topMedia: [] as any[],
            comment: '',
            socialDataJson: ''
        }))
    } catch (err) {
        toast.error('Error al cargar cuentas sociales')
    } finally {
        loadingAccounts.value = false
    }
}

const syncStats = async (activity: any) => {
    syncingAccount.value = activity.accountId
    try {
        const res = await api.get(`/marketing/reports/accounts/${activity.accountId}/sync`)
        activity.followersCount = res.data.followers
        activity.likes = res.data.avgLikes
        activity.comments = res.data.avgComments
        activity.reelsCount = res.data.reels_count
        activity.topMedia = res.data.top_media
        activity.socialDataJson = JSON.stringify({
            top_media: res.data.top_media,
            total_media: res.data.media_count,
            reels_count: res.data.reels_count
        })
        toast.success(`Datos de ${activity.handle} sincronizados`)
    } catch {
        toast.error('Error en sincronización automática')
    } finally {
        syncingAccount.value = null
    }
}

const leads = ref<any[]>([])
const showAddLead = ref(false)
const newLead = ref({
   name: '', instagram: '', source: 'INSTAGRAM', followers: '', notes: ''
})

const saveLead = async () => {
    if (!newLead.value.name || !newLead.value.instagram) return
    try {
        const res = await api.post('/model-leads', { ...newLead.value, shiftId: props.shiftId })
        leads.value.unshift(res.data)
        showAddLead.value = false
        newLead.value = { name: '', instagram: '', source: 'INSTAGRAM', followers: '', notes: '' }
    } catch {}
}

const getPlatformIcon = (platform: string) => {
    switch (platform.toUpperCase()) {
        case 'IG': case 'INSTAGRAM': return Instagram
        case 'TELEGRAM': return Send
        case 'X': case 'TWITTER': return Globe
        default: return Share2
    }
}

defineExpose({
    getMarketingData: () => ({
        reelsEdited: report.value.reelsEdited,
        modelsContacted: report.value.modelsContacted, 
        activities: report.value.socialActivity,
        observations: shiftObservations.value
    })
})

onMounted(() => {
    fetchSocialAccounts()
    fetchModels()
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
    
    <Tabs default-value="p3" class="w-full">
       <TabsList class="bg-muted/30 p-1.5 rounded-[1.5rem] w-full justify-start gap-2 h-14 mb-8 border border-border/50 backdrop-blur-sm">
          <TabsTrigger value="p3" class="rounded-xl px-4 flex-1 h-11 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 shadow-sm">Tráfico & Métricas</TabsTrigger>
          <TabsTrigger value="p2" class="rounded-xl px-4 flex-1 h-11 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 shadow-sm">Captación</TabsTrigger>
          <TabsTrigger value="p1" class="rounded-xl px-4 flex-1 h-11 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 shadow-sm">Producción</TabsTrigger>
       </TabsList>

       <!-- METRICAS DETALLADAS -->
       <TabsContent value="p3" class="space-y-6">
          <Card class="rounded-[3rem] border-none shadow-2xl p-10 bg-card/40 backdrop-blur-xl">
             <div class="flex items-center justify-between mb-10">
                <div class="flex items-center gap-4">
                   <div class="w-14 h-14 rounded-[1.5rem] bg-indigo-600 text-white flex items-center justify-center shadow-lg"><Target class="w-7 h-7" /></div>
                   <div>
                      <h4 class="font-black text-2xl tracking-tight uppercase italic leading-none">Control de Cuentas</h4>
                      <p class="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Sincronización profunda para análisis de IA</p>
                   </div>
                </div>
             </div>

             <div class="space-y-12">
                <div v-for="acc in report.socialActivity" :key="acc.accountId" class="bg-muted/30 rounded-[2.5rem] border border-border/50 p-8 space-y-8 hover:border-primary/20 transition-all">
                   <div class="flex items-center justify-between border-b border-border/30 pb-4">
                      <div class="flex items-center gap-4">
                         <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                            <component :is="getPlatformIcon(acc.platform)" class="w-6 h-6 text-primary" />
                         </div>
                         <div>
                            <p class="text-[10px] font-black text-primary uppercase tracking-widest">{{ acc.modelName }}</p>
                            <h5 class="text-lg font-black tracking-tight">{{ acc.handle }}</h5>
                         </div>
                      </div>
                      <Button @click="syncStats(acc)" :disabled="syncingAccount === acc.accountId" variant="outline" class="h-10 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-sm gap-2">
                         <RefreshCw :class="['w-3 h-3', syncingAccount === acc.accountId ? 'animate-spin' : '']" />
                         {{ syncingAccount === acc.accountId ? 'Sincronizando Todo...' : 'Sync Profundo' }}
                      </Button>
                   </div>

                   <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div class="p-4 bg-background/50 rounded-2xl border border-border/30 flex items-center gap-3">
                         <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Users class="w-4 h-4" /></div>
                         <div class="flex-1 min-w-0">
                            <p class="text-[8px] font-black uppercase text-zinc-400">Seguidores</p>
                            <Input v-model.number="acc.followersCount" type="number" class="h-7 p-0 border-none bg-transparent font-black text-sm focus-visible:ring-0" />
                         </div>
                      </div>
                      <div class="p-4 bg-background/50 rounded-2xl border border-border/30 flex items-center gap-3">
                         <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Play class="w-4 h-4" /></div>
                         <div class="flex-1 min-w-0">
                            <p class="text-[8px] font-black uppercase text-zinc-400">Total Reels</p>
                            <Input v-model.number="acc.reelsCount" type="number" class="h-7 p-0 border-none bg-transparent font-black text-sm focus-visible:ring-0" />
                         </div>
                      </div>
                      <div class="p-4 bg-background/50 rounded-2xl border border-border/30 flex items-center gap-3">
                         <div class="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center"><Heart class="w-4 h-4" /></div>
                         <div class="flex-1 min-w-0">
                            <p class="text-[8px] font-black uppercase text-zinc-400">Likes (Avg)</p>
                            <Input v-model.number="acc.likes" type="number" class="h-7 p-0 border-none bg-transparent font-black text-sm focus-visible:ring-0" />
                         </div>
                      </div>
                      <div class="p-4 bg-background/50 rounded-2xl border border-border/30 flex items-center gap-3">
                         <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><MessageCircle class="w-4 h-4" /></div>
                         <div class="flex-1 min-w-0">
                            <p class="text-[8px] font-black uppercase text-zinc-400">Cmts (Avg)</p>
                            <Input v-model.number="acc.comments" type="number" class="h-7 p-0 border-none bg-transparent font-black text-sm focus-visible:ring-0" />
                         </div>
                      </div>
                   </div>

                   <!-- TOP PERFORMING MEDIA -->
                   <div v-if="acc.topMedia && acc.topMedia.length > 0" class="space-y-4">
                      <div class="flex items-center gap-2">
                         <Trophy class="w-4 h-4 text-amber-500" />
                         <span class="text-[10px] font-black uppercase tracking-widest italic">Contenido Más Viral (Analizado)</span>
                      </div>
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                         <div v-for="item in acc.topMedia" :key="item.shortcode" class="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex flex-col gap-2">
                            <div class="flex items-center justify-between">
                               <Badge class="bg-amber-100 text-amber-700 text-[8px] border-none font-black h-5">{{ item.is_reel ? 'REEL' : 'POST' }}</Badge>
                               <span class="text-[9px] font-bold text-amber-900/40">#{{ item.shortcode }}</span>
                            </div>
                            <div class="flex items-center gap-4 mt-1">
                               <div class="flex items-center gap-1.5"><Heart class="w-3 h-3 text-pink-500" /><span class="text-[10px] font-black">{{ item.likes }}</span></div>
                               <div v-if="item.views" class="flex items-center gap-1.5"><Eye class="w-3 h-3 text-blue-500" /><span class="text-[10px] font-black">{{ item.views }}</span></div>
                            </div>
                         </div>
                      </div>
                   </div>

                   <!-- MANUAL ENTRY -->
                   <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div v-for="type in ['posts', 'stories', 'reels']" :key="type" class="space-y-1">
                         <label class="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">{{ type === 'posts' ? 'Posteos Hoy' : type === 'stories' ? 'Stories Hoy' : 'Reels Hoy' }}</label>
                         <div class="flex items-center bg-background rounded-2xl p-1 shadow-inner border border-border/50 h-14">
                            <Button @click="acc[type] = Math.max(0, acc[type] - 1)" variant="ghost" class="h-10 w-10 text-lg font-black">-</Button>
                            <Input v-model.number="acc[type]" type="number" class="w-full text-center border-none font-black text-xl tabular-nums bg-transparent focus-visible:ring-0" />
                            <Button @click="acc[type]++" variant="ghost" class="h-10 w-10 text-lg font-black">+</Button>
                         </div>
                      </div>
                   </div>

                   <div class="space-y-1">
                      <label class="text-[9px] font-black uppercase text-zinc-400 tracking-widest ml-1">Observaciones Específicas</label>
                      <Input v-model="acc.comment" placeholder="Alguna novedad sobre esta cuenta..." class="h-12 rounded-2xl bg-background border-none text-xs font-bold px-6" />
                   </div>
                </div>
             </div>
          </Card>
       </TabsContent>

       <!-- OTROS -->
       <TabsContent value="p2">
           <Card class="rounded-[3rem] border-none shadow-xl p-8 bg-emerald-500/5 backdrop-blur-xl">
             <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-4"><div class="w-14 h-14 rounded-[1.5rem] bg-emerald-500 text-white flex items-center justify-center shadow-lg"><UserPlus class="w-7 h-7" /></div><h4 class="font-black text-2xl tracking-tight uppercase italic leading-none">Prospección</h4></div>
                <Button @click="showAddLead = !showAddLead" class="rounded-xl h-10 bg-emerald-500 text-white uppercase font-black text-[9px]">+ Nuevo Lead</Button>
             </div>
             <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <div v-for="lead in leads" :key="lead.id" class="p-6 bg-white/40 dark:bg-zinc-900/40 rounded-[2rem] border border-emerald-100/50">
                    <p class="text-[10px] font-black uppercase">{{ lead.name }}</p><p class="text-[9px] font-bold text-muted-foreground">{{ lead.instagram }}</p>
                 </div>
             </div>
          </Card>
       </TabsContent>
       
       <TabsContent value="p1">
          <Card class="rounded-[3rem] border-none shadow-xl p-10 bg-blue-500/5 backdrop-blur-xl h-[400px] flex items-center justify-center">
             <div class="grid grid-cols-1 md:grid-cols-2 gap-10 w-full">
                <div class="space-y-4 text-center">
                   <p class="text-[10px] font-black uppercase text-blue-800/60 tracking-widest">Reels Editados</p>
                   <Input type="number" v-model="report.reelsEdited" class="h-24 text-6xl font-black text-center border-none bg-transparent tabular-nums" />
                </div>
                <div class="space-y-4 text-center">
                   <p class="text-[10px] font-black uppercase text-amber-800/60 tracking-widest">Ideas Generadas</p>
                   <Input type="number" v-model="report.ideasGenerated" class="h-24 text-6xl font-black text-center border-none bg-transparent tabular-nums" />
                </div>
             </div>
          </Card>
       </TabsContent>
    </Tabs>
  </div>
</template>
