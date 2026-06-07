// Única fuente de verdad para la URL base del backend.
// Antes estaba duplicada (env + fallback hardcodeado) en ~12 archivos.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://crm-app.up.railway.app/api/v1'
