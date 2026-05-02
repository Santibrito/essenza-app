import { Video, ImageIcon, Mic, Plus, ChevronRight, MessageSquare, CheckCircle2 } from 'lucide-vue-next'

export const TYPE = {
  VIDEO_CALL: {
    label: 'Videollamada',
    icon: Video,
    cls: 'text-sky-400',
    bg: 'bg-sky-500/10',
    pill: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  },
  IMAGE: {
    label: 'Imágenes/Videos',
    icon: ImageIcon,
    cls: 'text-violet-400',
    bg: 'bg-violet-500/10',
    pill: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  },
  AUDIO: {
    label: 'Audio',
    icon: Mic,
    cls: 'text-amber-400',
    bg: 'bg-amber-500/10',
    pill: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  },
}

export const STATUS = {
  CREATED:          { label: 'Creado',         cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  SENT:             { label: 'Enviado',         cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  READY_FOR_UPLOAD: { label: 'Listo ↑',         cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  COMPLETED:        { label: 'Completado',      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
}

export const STATUS_LABEL = {
  CREATED: 'Creado',
  SENT: 'Enviado',
  READY_FOR_UPLOAD: 'Listo para subir',
  COMPLETED: 'Completado',
}

export const PRIO = {
  LOW:    { label: 'Baja',    cls: 'text-zinc-400' },
  NORMAL: { label: 'Normal',  cls: 'text-blue-400' },
  HIGH:   { label: 'Alta',    cls: 'text-orange-400' },
  URGENT: { label: 'URGENTE', cls: 'text-red-400 font-bold' },
}

export const HISTORY_ACTION = {
  CREATED:        { icon: Plus,          cls: 'text-emerald-400', label: 'Creado' },
  STATUS_CHANGED: { icon: ChevronRight,  cls: 'text-blue-400',    label: 'Estado cambiado' },
  COMMENT_ADDED:  { icon: MessageSquare, cls: 'text-zinc-400',    label: 'Comentario' },
  COMPLETED:      { icon: CheckCircle2,  cls: 'text-emerald-400', label: 'Completado' },
}

export const FIELD_LABELS = {
  // Información del fan
  ofUser: 'Usuario de OnlyFans',
  fanName: 'Nombre del fan',
  nick: 'Apodo',
  telegram: 'Usuario de Telegram',
  age: 'Edad',
  location: 'Ubicación',
  
  // Detalles del custom
  price: 'Precio',
  payment: 'Pago',
  time: 'Tiempo',
  duration: 'Duración',
  language: 'Idioma',
  quantity: 'Cantidad',
  
  // Contexto y expectativas
  chatContext: 'Contexto de la conversación',
  expectations: 'Expectativas',
  description: 'Descripción',
  notes: 'Notas adicionales',
}

export function parseTemplate(raw) {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

export function fmt(raw) {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}
