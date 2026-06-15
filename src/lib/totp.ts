// Generador de códigos 2FA (TOTP, RFC 6238) del lado del cliente.
// El seed NUNCA sale del dispositivo: se calcula localmente con Web Crypto (HMAC-SHA1).
// Esto evita exponer el secreto en el backend o en la red.

/** Decodifica un secreto Base32 (formato estándar de los seeds de 2FA). */
function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0
  let value = 0
  let index = 0
  const out = new Uint8Array(Math.ceil((clean.length * 5) / 8))
  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i])
    if (idx === -1) continue // ignora caracteres inválidos
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out[index++] = (value >>> (bits - 8)) & 0xff
      bits -= 8
    }
  }
  return out.slice(0, index)
}

export interface TotpResult {
  code: string
  /** Segundos que le quedan de validez al código actual. */
  secondsLeft: number
  period: number
}

/**
 * Genera el código TOTP actual a partir del seed Base32.
 * @param seed   secreto Base32 (ej: "OF4E...")
 * @param period ventana en segundos (Instagram usa 30)
 * @param digits cantidad de dígitos (Instagram usa 6)
 */
export async function generateTotp(seed: string, period = 30, digits = 6): Promise<TotpResult> {
  const key = base32Decode(seed)
  if (key.length === 0) throw new Error('Seed inválido')

  const epoch = Math.floor(Date.now() / 1000)
  const counter = Math.floor(epoch / period)
  const secondsLeft = period - (epoch % period)

  // counter → 8 bytes big-endian
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setUint32(0, Math.floor(counter / 0x100000000))
  view.setUint32(4, counter >>> 0)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  )
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, buf))

  // Truncación dinámica (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const code = (binary % 10 ** digits).toString().padStart(digits, '0')
  return { code, secondsLeft, period }
}
