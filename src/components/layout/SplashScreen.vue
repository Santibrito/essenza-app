<script setup>
import { ref, onMounted } from 'vue'

const progress = ref(0)
const label = ref('Iniciando')

onMounted(() => {
  const steps = [
    { target: 30, delay: 400, label: 'Iniciando' },
    { target: 60, delay: 900, label: 'Cargando' },
    { target: 85, delay: 1500, label: 'Preparando' },
    { target: 100, delay: 2300, label: 'Listo' },
  ]
  steps.forEach(({ target, delay, label: lbl }) => {
    setTimeout(() => {
      progress.value = target
      label.value = lbl
    }, delay)
  })
})
</script>

<template>
  <div class="splash">
    <!-- Textura de grilla sutil -->
    <svg class="grid-texture" viewBox="0 0 400 400" preserveAspectRatio="none">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" stroke-width="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>

    <div class="accent-top" />

    <div class="content">
      <!-- Logo: reemplazá el span por <img src="logo.svg"> si tenés imagen -->
      <img class="logo-wrap" src="../../assets/img/isologo.png">

      <h1 class="brand-name">Essenza</h1>

      <div class="divider-row">
        <span class="dline" />
        <span class="sub-brand">Models</span>
        <span class="dline" />
      </div>

      <p class="tagline">Management Platform</p>

      <div class="progress-wrap">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progress + '%' }">
            <div class="shimmer" />
          </div>
        </div>
        <p class="progress-label">{{ label }}</p>
      </div>
    </div>

    <div class="accent-bottom" />
  </div>
</template>

<style scoped>
/* ─── Tokens de color ─────────────────────────────────────────── */
.splash {
  --gold: #c9a96e;
  --gold-light: #e8d5a3;
  --gold-dim: rgba(201, 169, 110, 0.35);
}

/* ─── Layout base ────────────────────────────────────────────── */
.splash {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: 'Georgia', serif;

  /* shadcn/vue: se adapta solo al modo claro/oscuro */
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}

/* ─── Textura ────────────────────────────────────────────────── */
.grid-texture {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.04;
  color: hsl(var(--foreground));
}

/* ─── Líneas de acento dorado ────────────────────────────────── */
.accent-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg,
      transparent,
      var(--gold) 30%,
      var(--gold-light) 50%,
      var(--gold) 70%,
      transparent);
}

.accent-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg,
      transparent,
      var(--gold-dim) 50%,
      transparent);
}

/* ─── Contenido central ──────────────────────────────────────── */
.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: fadeUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

/* ─── Logo ───────────────────────────────────────────────────── */
.logo-wrap {
  width: 80px;
  height: 80px;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: logoPop 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.corner {
  position: absolute;
  width: 10px;
  height: 10px;
}

.tl {
  top: -4px;
  left: -4px;
  border-top: 2px solid var(--gold);
  border-left: 2px solid var(--gold);
}

.tr {
  top: -4px;
  right: -4px;
  border-top: 2px solid var(--gold);
  border-right: 2px solid var(--gold);
}

.bl {
  bottom: -4px;
  left: -4px;
  border-bottom: 2px solid var(--gold);
  border-left: 2px solid var(--gold);
}

.br {
  bottom: -4px;
  right: -4px;
  border-bottom: 2px solid var(--gold);
  border-right: 2px solid var(--gold);
}

.monogram {
  font-size: 28px;
  color: var(--gold);
  font-style: italic;
}

/* ─── Tipografía ─────────────────────────────────────────────── */
.brand-name {
  margin: 0 0 6px;
  font-weight: 400;
  font-size: 22px;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  /* hereda hsl(--foreground) del padre */
}

.divider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.dline {
  width: 28px;
  height: 1px;
  background: var(--gold);
  opacity: 0.7;
}

.sub-brand {
  font-size: 11px;
  letter-spacing: 0.55em;
  color: var(--gold);
  text-transform: uppercase;
}

.tagline {
  margin: 0 0 48px;
  font-size: 10px;
  font-style: italic;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
  opacity: 0.6;
}

/* ─── Barra de progreso ──────────────────────────────────────── */
.progress-wrap {
  width: 160px;
}

.progress-track {
  height: 1px;
  background: hsl(var(--border));
  position: relative;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #8a6b3a, var(--gold-light), var(--gold));
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 40px;
  height: 100%;
  background: linear-gradient(90deg,
      transparent,
      rgba(255, 255, 255, 0.6),
      transparent);
  animation: shimmer 1.8s infinite;
}

.progress-label {
  text-align: center;
  font-size: 9px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  margin: 10px 0 0;
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
}

/* ─── Animaciones ────────────────────────────────────────────── */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes logoPop {
  0% {
    opacity: 0;
    transform: scale(0.75);
  }

  70% {
    opacity: 1;
    transform: scale(1.04);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(500%);
  }
}
</style>