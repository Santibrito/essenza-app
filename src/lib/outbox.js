// Outbox: cola persistente para POSTs no críticos que NO deben perderse si
// el servidor está caído justo al enviarlos (batch de marketing, logbook).
// Si el envío falla por una causa transitoria, el payload queda en
// localStorage y se reintenta con flushOutbox() (al montar el dashboard y
// cada 60s).
import api from '@/api'

const KEY = 'essenza_outbox'
const MAX_ITEMS = 50 // tope defensivo

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS))) } catch { }
}

// 4xx (salvo 401/408/429) = error permanente: reintentar no lo va a arreglar.
function isPermanent(e) {
  const s = e?.status
  return typeof s === 'number' && s >= 400 && s < 500 && s !== 401 && s !== 408 && s !== 429
}

export function enqueue(path, body) {
  const items = read()
  items.push({ path, body, queuedAt: new Date().toISOString() })
  write(items)
}

/**
 * POST con respaldo: si falla por causa transitoria (red, 5xx, sesión vencida),
 * encola el payload para reenviarlo después. Devuelve true si se envió ahora.
 */
export async function postWithOutbox(path, body) {
  try {
    await api.post(path, body)
    return true
  } catch (e) {
    if (isPermanent(e)) {
      console.error(`[Outbox] Error permanente en ${path}, no se encola:`, e)
      return false
    }
    enqueue(path, body)
    console.warn(`[Outbox] ${path} encolado para reintento`)
    return false
  }
}

let flushing = false

/** Reintenta los envíos pendientes en orden. Se frena al primer fallo transitorio. */
export async function flushOutbox() {
  if (flushing) return
  flushing = true
  try {
    let items = read()
    while (items.length > 0) {
      try {
        await api.post(items[0].path, items[0].body)
        items = items.slice(1)
        write(items)
      } catch (e) {
        if (isPermanent(e)) {
          // Item envenenado (p.ej. el shift ya no existe): lo descartamos
          // para que no bloquee al resto de la cola.
          console.error('[Outbox] Descartando item con error permanente:', items[0].path, e)
          items = items.slice(1)
          write(items)
          continue
        }
        break // server sigue caído: se reintenta en el próximo flush
      }
    }
  } finally {
    flushing = false
  }
}

export function outboxSize() {
  return read().length
}
