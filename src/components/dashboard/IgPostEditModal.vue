<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2, Save, Film, Sparkles, Camera, Clock, PlayCircle, Image as ImageIcon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useIgPosts } from '@/lib/useIgPosts'
import { useTimezone } from '@/lib/useTimezone'

const props = defineProps<{ open: boolean; post: any | null }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'saved'): void }>()

const { edit, getAccounts } = useIgPosts()
const { dateKeyInUserTz, zonedToUtcISO, tzAbbrev, userTz } = useTimezone()

const form = ref({ contentType: 'REEL', date: '', time: '12:00', caption: '', hashtags: '', link: '', accountId: null as number | null })
const accounts = ref<any[]>([])
const saving = ref(false)

function hhmm(iso: string) {
  const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z'
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: (userTz as any).value, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(utc))
  const g = (t: string) => p.find(x => x.type === t)?.value || '00'
  let h = g('hour'); if (h === '24') h = '00'
  return `${h}:${g('minute')}`
}

watch(() => props.open, async (o) => {
  if (!o || !props.post) return
  const p = props.post
  form.value = {
    contentType: p.contentType || 'REEL',
    date: dateKeyInUserTz(p.scheduledAt),
    time: hhmm(p.scheduledAt),
    caption: p.caption || '',
    hashtags: p.hashtags || '',
    link: p.link || '',
    accountId: p.igAccountId ?? null,
  }
  accounts.value = []
  if (p.modelId) {
    try {
      const all = await getAccounts(p.modelId)
      accounts.value = all.filter((a: any) => a.status === 'READY' || a.id === p.igAccountId)
    } catch { /* sin cuentas */ }
  }
})

const isImage = computed(() => !!props.post?.mediaUrl && /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(props.post.mediaUrl))
const TYPES = [
  { id: 'REEL', label: 'Reel', icon: Film },
  { id: 'STORY', label: 'Historia', icon: Sparkles },
  { id: 'POST', label: 'Post', icon: Camera },
]

async function save() {
  if (!props.post) return
  saving.value = true
  try {
    await edit(props.post.rawId, {
      caption: form.value.caption,
      hashtags: form.value.hashtags,
      link: form.value.link,
      contentType: form.value.contentType,
      scheduledAt: zonedToUtcISO(form.value.date, form.value.time),
      accountId: form.value.accountId ?? undefined,
    })
    toast.success('Publicación actualizada ✨')
    emit('saved')
    emit('update:open', false)
  } catch (e: any) {
    toast.error('No se pudo guardar', { description: e.message })
  } finally { saving.value = false }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg p-0 gap-0 overflow-hidden">
      <DialogHeader class="px-5 pt-5 pb-3">
        <DialogTitle class="text-base font-black flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white"><Save class="w-3.5 h-3.5" /></span>
          Editar publicación
        </DialogTitle>
      </DialogHeader>

      <div class="px-5 pb-2 space-y-4 max-h-[64vh] overflow-y-auto">
        <!-- preview + tipo -->
        <div class="flex gap-3">
          <div class="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative ring-1 ring-black/5">
            <img v-if="isImage" :src="post?.mediaUrl" class="w-full h-full object-cover" />
            <template v-else-if="post?.mediaUrl">
              <video :src="post?.mediaUrl" class="w-full h-full object-cover" muted preload="metadata" />
              <PlayCircle class="w-6 h-6 text-white/90 absolute drop-shadow" />
            </template>
            <ImageIcon v-else class="w-6 h-6 text-zinc-400" />
          </div>
          <div class="flex-1 min-w-0">
            <Label class="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tipo</Label>
            <div class="grid grid-cols-3 gap-1.5 mt-1.5">
              <button v-for="t in TYPES" :key="t.id" type="button" @click="form.contentType = t.id"
                :class="['flex flex-col items-center gap-1 py-2 rounded-xl border text-[11px] font-bold transition-all',
                         form.contentType === t.id ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-sm' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50']">
                <component :is="t.icon" class="w-4 h-4" />{{ t.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- cuenta -->
        <div v-if="accounts.length" class="space-y-1.5">
          <Label class="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cuenta</Label>
          <select v-model="form.accountId" class="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/30">
            <option v-for="a in accounts" :key="a.id" :value="a.id">@{{ a.igUsername }}{{ a.status !== 'READY' ? ' (actual)' : '' }}</option>
          </select>
        </div>

        <!-- fecha / hora -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fecha</Label>
            <Input type="date" v-model="form.date" class="h-10 rounded-xl" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-[10px] font-black uppercase tracking-widest text-zinc-400">Hora ({{ tzAbbrev() }})</Label>
            <Input type="time" v-model="form.time" class="h-10 rounded-xl" />
          </div>
        </div>

        <!-- descripción -->
        <div class="space-y-1.5">
          <Label class="text-[10px] font-black uppercase tracking-widest text-zinc-400">Descripción</Label>
          <Textarea v-model="form.caption" rows="3" placeholder="Texto del posteo…" class="resize-none text-sm rounded-xl" />
        </div>

        <!-- hashtags / link -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label class="text-[10px] font-black uppercase tracking-widest text-zinc-400">Hashtags</Label>
            <Input v-model="form.hashtags" placeholder="#x #y" class="h-10 text-sm rounded-xl" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-[10px] font-black uppercase tracking-widest text-zinc-400">Link (historia)</Label>
            <Input v-model="form.link" placeholder="https://onlyfans.com/…" class="h-10 text-sm rounded-xl" />
          </div>
        </div>

        <p class="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Clock class="w-3 h-3" /> El contenido (foto/video) no se cambia acá. Para cambiarlo, eliminá y creá de nuevo.
        </p>
      </div>

      <DialogFooter class="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
        <Button variant="outline" @click="emit('update:open', false)" :disabled="saving">Cancelar</Button>
        <Button @click="save" :disabled="saving" class="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-0 hover:from-violet-700 hover:to-fuchsia-700">
          <Loader2 v-if="saving" class="w-4 h-4 animate-spin" /><Save v-else class="w-4 h-4" />
          {{ saving ? 'Guardando…' : 'Guardar cambios' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
