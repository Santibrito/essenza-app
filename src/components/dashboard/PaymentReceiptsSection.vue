<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/api'
import { Receipt, Download, Loader2, FileText, RotateCcw, AlertTriangle } from 'lucide-vue-next'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const payslips = ref<any[]>([])
const loading = ref(true)
const error = ref(false)

const fmtMoney = (v: number, c = 'USD') =>
  `${c || 'USD'} ${(Number(v) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const periodLabel = (p: any) => `${MONTHS[(p.periodMonth || 1) - 1]} ${p.periodYear || ''}`
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

async function load() {
  loading.value = true
  error.value = false
  try {
    const res = await api.get('/payroll/my-payslips')
    payslips.value = res.data || []
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function openPdf(url: string) {
  if (url) window.open(url, '_blank')
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
          <Receipt class="w-5 h-5 text-green-500" />
        </span>
        <div>
          <h1 class="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Comprobantes de Pago</h1>
          <p class="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Historial de tus comprobantes emitidos.</p>
        </div>
      </div>
      <button @click="load"
        class="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
        <RotateCcw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-3 text-zinc-400">
      <Loader2 class="w-7 h-7 animate-spin" />
      <p class="text-xs font-semibold uppercase tracking-widest">Cargando comprobantes…</p>
    </div>

    <!-- Error -->
    <div v-else-if="error"
      class="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
      <AlertTriangle class="w-5 h-5 text-rose-600 shrink-0" />
      <p class="text-sm text-rose-800 dark:text-rose-300">No se pudieron cargar tus comprobantes. Probá de nuevo.</p>
    </div>

    <!-- Empty -->
    <div v-else-if="payslips.length === 0"
      class="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <span class="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
        <FileText class="w-6 h-6 text-zinc-400" />
      </span>
      <p class="text-sm font-bold text-zinc-700 dark:text-zinc-300">Todavía no tenés comprobantes emitidos</p>
      <p class="text-xs text-zinc-400 max-w-xs">Cuando administración emita un comprobante de pago a tu nombre, va a aparecer acá para descargar.</p>
    </div>

    <!-- List -->
    <div v-else class="space-y-2.5">
      <div v-for="p in payslips" :key="p.id"
        class="flex items-center justify-between gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
        <div class="flex items-center gap-4 min-w-0">
          <span class="w-11 h-11 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <FileText class="w-5 h-5 text-green-600 dark:text-green-400" />
          </span>
          <div class="min-w-0">
            <p class="font-bold text-sm text-zinc-900 dark:text-zinc-50 truncate">{{ periodLabel(p) }}</p>
            <div class="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
              <span v-if="p.receiptCode" class="font-mono">{{ p.receiptCode }}</span>
              <span v-if="p.receiptCode && p.issuedAt">·</span>
              <span v-if="p.issuedAt">Emitido {{ fmtDate(p.issuedAt) }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4 shrink-0">
          <p class="text-sm font-black tabular-nums text-zinc-900 dark:text-zinc-50 hidden sm:block">
            {{ fmtMoney(p.netTotal, p.currency) }}
          </p>
          <button v-if="p.pdfUrl" @click="openPdf(p.pdfUrl)"
            class="flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-xs font-bold hover:opacity-90 transition-opacity">
            <Download class="w-3.5 h-3.5" /> PDF
          </button>
          <span v-else class="text-[10px] text-zinc-400 italic">Sin PDF</span>
        </div>
      </div>
    </div>
  </div>
</template>
