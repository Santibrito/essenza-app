// Customs API - uses the same base URL as the main api but with /api/customs path
const customsBase = (import.meta.env.VITE_API_BASE_URL || 'https://service-production-1ef2.up.railway.app/api/v1')
  .replace('/api/v1', '/api/customs')

function getToken() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.token || null
  } catch { return null }
}

async function req(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${customsBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    try { throw JSON.parse(errText) } catch { throw { message: errText || 'Error de red' } }
  }
  if (res.status === 204) return null
  
  const text = await res.text().catch(() => '')
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

export const customsApi = {
  create: (data) => req('', { method: 'POST', body: JSON.stringify(data) }),
  list: (params = {}) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) {
        if (Array.isArray(value)) {
          value.forEach(v => q.append(key, v.toString()))
        } else {
          q.append(key, value.toString())
        }
      }
    })
    return req(`/detailed?${q}`)
  },
  get: (id) => req(`/${id}`),
  updateStatus: (id, data) => req(`/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  complete: (id, data) => req(`/${id}/complete`, { method: 'PATCH', body: JSON.stringify(data) }),
  addComment: (id, comment) => req(`/${id}/comment`, { method: 'POST', body: JSON.stringify({ comment }) }),
  getHistory: (id) => req(`/${id}/history`),
  getPendingForUser: (modelIds) => req(`/pending-for-user?${modelIds.map(id => `modelIds=${id}`).join('&')}`),
  uploadAttachment: async (customId, file) => {
    const token = getToken()
    const form = new FormData()
    form.append('file', file)
    form.append('customId', customId)
    const res = await fetch(`${customsBase}/attachments/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    })
    if (!res.ok) throw await res.json().catch(() => ({}))
    return res.json()
  }
}
