/**
 * useTimezone — Global timezone composable for Essenza APP
 *
 * Reads the user's configured timezone from the auth store and provides
 * formatting helpers that convert UTC/server timestamps to the user's local time.
 *
 * The shift schedule reference timezone comes from UserSchedule.timezone
 * (the admin/company timezone). This composable also provides a conversion
 * helper from company timezone → user timezone.
 */
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

// IANA timezone identifier list with display labels (most used in LatAm / Spain)
export const TIMEZONE_OPTIONS = [
  // 🇪🇸 España
  { value: 'Europe/Madrid',              label: 'España (Madrid) — CET/CEST' },
  // 🇦🇷 Argentina
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires) — ART UTC-3' },
  // 🇻🇪 Venezuela
  { value: 'America/Caracas',            label: 'Venezuela (Caracas) — VET UTC-4' },
  // 🇨🇴 Colombia
  { value: 'America/Bogota',             label: 'Colombia (Bogotá) — COT UTC-5' },
  // 🇲🇽 México
  { value: 'America/Mexico_City',        label: 'México (Ciudad de México) — CST/CDT' },
  // 🇵🇪 Perú
  { value: 'America/Lima',               label: 'Perú (Lima) — PET UTC-5' },
  // 🇨🇱 Chile
  { value: 'America/Santiago',           label: 'Chile (Santiago) — CLT/CLST' },
  // 🇺🇾 Uruguay
  { value: 'America/Montevideo',         label: 'Uruguay (Montevideo) — UYT UTC-3' },
  // 🇪🇨 Ecuador
  { value: 'America/Guayaquil',          label: 'Ecuador (Guayaquil) — ECT UTC-5' },
  // 🇵🇦 Panamá
  { value: 'America/Panama',             label: 'Panamá — EST UTC-5' },
  // 🇺🇸 USA (ET)
  { value: 'America/New_York',           label: 'EE.UU. Este (New York) — ET' },
  // UTC
  { value: 'UTC',                        label: 'UTC — Universal' },
]

export function useTimezone() {
  const auth = useAuthStore()

  /** The user's configured IANA timezone string */
  const userTz = computed(() => auth.user?.timezone || 'America/Argentina/Buenos_Aires')

  /**
   * Format a server timestamp string (LocalDateTime without offset, i.e. server clock)
   * into the user's local timezone.
   *
   * The server runs on UTC (Railway). Backend sends ISO strings WITHOUT offset
   * e.g. "2026-04-18T22:38:00". We treat them as UTC and convert to userTz.
   */
  function formatLocal(ts, opts = {}) {
    if (!ts) return '—'
    // Backend sends ISO 8601 without Z or offset → treat as UTC
    const utcStr = ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z'
    try {
      return new Intl.DateTimeFormat('es-AR', {
        timeZone: userTz.value,
        day: '2-digit',
        month: '2-digit',
        year: opts.year ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit',
        weekday: opts.weekday ? 'short' : undefined,
        ...opts,
      }).format(new Date(utcStr))
    } catch {
      return ts
    }
  }

  /**
   * Format just the time part of a timestamp in the user's timezone.
   */
  function formatTime(ts) {
    if (!ts) return '—'
    const utcStr = ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z'
    try {
      return new Intl.DateTimeFormat('es-AR', {
        timeZone: userTz.value,
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(utcStr))
    } catch {
      return ts
    }
  }

  /**
   * Convert a shift template time (HH:mm in company/admin timezone)
   * to the user's local timezone and return the formatted time string.
   *
   * @param timeStr  - "HH:mm" string as defined by the admin (in companyTz)
   * @param companyTz - IANA timezone string of the company/admin (from UserSchedule.timezone)
   * @param baseDate  - ISO date string to use as date anchor (defaults to today)
   */
  function convertShiftTime(timeStr, companyTz, baseDate) {
    if (!timeStr || !companyTz) return timeStr
    try {
      const [hours, minutes] = timeStr.split(':').map(Number)
      const today = baseDate ? baseDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
      // Build a datetime string in the company timezone
      const dateInCompanyTz = new Date(`${today}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
      // Format that as-is from company tz into UTC equivalent, then display in userTz
      return new Intl.DateTimeFormat('es-AR', {
        timeZone: userTz.value,
        hour: '2-digit',
        minute: '2-digit',
      }).format(dateInCompanyTz)
    } catch {
      return timeStr
    }
  }

  /**
   * Returns a human-readable relative time string (e.g. "hace 3h")
   * anchored to the user's timezone.
   */
  function formatRelative(ts) {
    if (!ts) return '—'
    const utcStr = ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z'
    const diffMs = Date.now() - new Date(utcStr).getTime()
    const mins = Math.floor(Math.abs(diffMs) / 60000)
    if (mins < 60) return `Hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Hace ${hrs}h`
    return `Hace ${Math.floor(hrs / 24)}d`
  }

  return {
    userTz,
    formatLocal,
    formatTime,
    formatRelative,
    convertShiftTime,
  }
}
