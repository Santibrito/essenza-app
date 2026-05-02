<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Eye, EyeOff, Loader2, MoveRight } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.js'
import { Input as UiInput } from '@/components/ui/input'
import { Button as UiButton } from '@/components/ui/button'
import { Label as UiLabel } from '@/components/ui/label'
import { toast } from 'vue-sonner'
import { useThemeStore } from '@/stores/theme'
import darkLogo from '@/assets/img/logo-full-white.png'
import lightLogo from '@/assets/img/logo-full-dark.png'

const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()

const currentLogo = computed(() => themeStore.isDark ? darkLogo : lightLogo)

const form = reactive({ username: '', password: '' })
const showPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const shakeError = ref(false)

const canSubmit = computed(() => form.username.trim() && form.password.trim())
const mustChangePasswordMode = ref(false)
const tempUser = ref(null)
const resetForm = reactive({ newPassword: '', confirmPassword: '' })
const canSubmitReset = computed(() =>
  resetForm.newPassword.length >= 4 &&
  resetForm.newPassword === resetForm.confirmPassword
)

async function handleLogin() {
  if (!canSubmit.value || authStore.isLoading) return
  authStore.clearError()
  const res = await authStore.login(form.username, form.password)
  if (res.success) {
    if (res.mustChangePassword) {
      tempUser.value = res.tempUser
      mustChangePasswordMode.value = true
    } else {
      router.push({ name: 'dashboard' })
    }
  } else {
    shakeError.value = true
    setTimeout(() => (shakeError.value = false), 650)
  }
}

async function handlePasswordReset() {
  if (!canSubmitReset.value || authStore.isLoading) return
  const res = await authStore.changePassword(
    tempUser.value.id,
    tempUser.value.token,
    resetForm.newPassword
  )
  if (res.success) {
    toast.success('Contraseña actualizada. Ya podés ingresar.')
    mustChangePasswordMode.value = false
    form.password = resetForm.newPassword // Pre-fill for convenience
  } else {
    toast.error('Error al actualizar contraseña')
  }
}
</script>

<template>
  <div class="h-full flex items-center justify-center bg-background relative overflow-hidden">

    <!-- Background blobs -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                  w-[700px] h-[700px] rounded-full
                  bg-primary/[0.06] dark:bg-primary/[0.10] blur-[120px]" />
      <div class="absolute top-[15%] left-[60%]
                  w-64 h-64 rounded-full
                  bg-primary/[0.04] dark:bg-primary/[0.07] blur-[80px]" />
    </div>

    <!-- Card wrapper -->
    <div class="relative z-10 w-full max-w-[440px] mx-6 animate-fade-up" :class="{ shake: shakeError }">
      <!-- Top gradient stripe -->
      <div class="h-[3px] rounded-t-2xl bg-gradient-to-r from-primary/0 via-primary to-primary/0" />

      <!-- Card -->
      <div class="rounded-b-2xl border border-t-0 border-border bg-card
                  shadow-xl shadow-black/[0.06] dark:shadow-black/30">

        <!-- Card header -->
        <div class="px-8 pt-8 pb-6 border-b border-border">
          <div class="flex items-center gap-4">
            <div class="w-11 h-11  flex items-center justify-center
                        flex-shrink-0 shadow-md overflow-hidden p-1">
              <img src="../assets/img/isologo.png" alt="Logo" class="w-full h-full object-contain" />
            </div>
            <div>
              <h1 class="text-[15px] font-bold text-foreground leading-tight tracking-tight">
                ESSENZAMODELS
              </h1>
              <p class="text-xs text-muted-foreground mt-0.5">
                Ingresá para acceder al sistema
              </p>
            </div>
          </div>
        </div>

        <!-- Form body (Standard) -->
        <div v-if="!mustChangePasswordMode" class="px-8 py-7 space-y-5 animate-fade-in">

          <!-- Username -->
          <div class="space-y-2">
            <UiLabel for="username">Usuario</UiLabel>
            <UiInput id="username" v-model="form.username" type="text" placeholder="Ingrese su usuario"
              autocomplete="username" :disabled="authStore.isLoading" />
          </div>

          <!-- Password -->
          <div class="space-y-2">
            <UiLabel for="password">Contraseña</UiLabel>
            <div class="relative">
              <UiInput id="password" v-model="form.password" :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••" autocomplete="current-password" :disabled="authStore.isLoading" class="pr-10" />
              <button type="button" @click="showPassword = !showPassword" tabindex="-1" class="absolute right-3 top-1/2 -translate-y-1/2
                       text-muted-foreground hover:text-foreground transition-colors">
                <Eye v-if="!showPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Error -->
          <Transition name="err">
            <p v-if="authStore.error" class="text-sm text-destructive pl-3 border-l-2 border-destructive leading-snug">
              {{ authStore.error }}
            </p>
          </Transition>

          <!-- Submit -->
          <div class="pt-1">
            <UiButton id="btn-login" class="w-full h-11 gap-2 font-medium" :disabled="!canSubmit || authStore.isLoading"
              @click="handleLogin">
              <Loader2 v-if="authStore.isLoading" class="w-4 h-4 animate-spin" />
              <template v-else>
                Ingresar
                <MoveRight class="w-4 h-4" />
              </template>
            </UiButton>
          </div>

        </div>

        <!-- Form body (Reset Password Required) -->
        <div v-else class="px-8 py-7 space-y-5 animate-fade-in">
          <div class="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p class="text-[11px] text-primary font-bold uppercase tracking-wider text-center">
              Cambio de Contraseña Obligatorio
            </p>
            <p class="text-[10px] text-muted-foreground text-center mt-1">
              Es necesario establecer una clave nueva en tu primer ingreso.
            </p>
          </div>

          <div class="space-y-2">
            <UiLabel for="newPassword">Nueva Contraseña</UiLabel>
            <div class="relative">
              <UiInput id="newPassword" v-model="resetForm.newPassword" :type="showNewPassword ? 'text' : 'password'" placeholder="Mínimo 4 caracteres"
                :disabled="authStore.isLoading" class="pr-10" />
              <button type="button" @click="showNewPassword = !showNewPassword" tabindex="-1" class="absolute right-3 top-1/2 -translate-y-1/2
                       text-muted-foreground hover:text-foreground transition-colors">
                <Eye v-if="!showNewPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <UiLabel for="confirmPassword">Confirmar Contraseña</UiLabel>
            <div class="relative">
              <UiInput id="confirmPassword" v-model="resetForm.confirmPassword" :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Repetí tu nueva clave" :disabled="authStore.isLoading" class="pr-10" />
              <button type="button" @click="showConfirmPassword = !showConfirmPassword" tabindex="-1" class="absolute right-3 top-1/2 -translate-y-1/2
                       text-muted-foreground hover:text-foreground transition-colors">
                <Eye v-if="!showConfirmPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="pt-1 space-y-3">
            <UiButton class="w-full h-11 gap-2 font-medium" :disabled="!canSubmitReset || authStore.isLoading"
              @click="handlePasswordReset">
              <Loader2 v-if="authStore.isLoading" class="w-4 h-4 animate-spin" />
              <template v-else>
                Confirmar y Entrar
              </template>
            </UiButton>
            <button @click="mustChangePasswordMode = false"
              class="w-full text-[10px] text-muted-foreground hover:text-foreground">
              Volver al Inicio
            </button>
          </div>
        </div>

        <!-- Card footer -->
        <div class="px-8 py-4 rounded-b-2xl border-t border-border bg-muted/30">
          <p class="text-[11px] text-muted-foreground text-center tracking-wide">
            Acceso corporativo · uso exclusivo del equipo
          </p>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.shake {
  animation: shake 0.55s cubic-bezier(.36, .07, .19, .97) both;
}

@keyframes shake {

  10%,
  90% {
    transform: translateX(-2px);
  }

  20%,
  80% {
    transform: translateX(4px);
  }

  30%,
  50%,
  70% {
    transform: translateX(-5px);
  }

  40%,
  60% {
    transform: translateX(5px);
  }

  100% {
    transform: translateX(0);
  }
}

.err-enter-active,
.err-leave-active {
  transition: all 0.2s ease;
}

.err-enter-from,
.err-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
