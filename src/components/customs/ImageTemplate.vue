<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const props = defineProps<{ modelValue: Record<string, string> }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: Record<string, string>): void }>()

const fields = [
  { key: 'ofUser', label: 'Usuario', placeholder: '@usuario' },
  { key: 'nick', label: 'Nick / Edad / Idioma', placeholder: 'Ej: Greg / 42YO INGLÉS' },
  { key: 'price', label: 'Precio', placeholder: 'Ej: 100' },
  { key: 'time', label: 'Time', placeholder: 'Ej: 5' },
  { key: 'language', label: 'Lenguaje', placeholder: 'Ej: INGLÉS' },
  { key: 'quantity', label: 'Cantidad de imágenes', placeholder: 'Ej: 5' },
  { key: 'notes', label: 'Notas / Descripción', placeholder: 'Descripción detallada del contenido...' },
]

function update(key: string, value: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="field in fields" :key="field.key" class="space-y-1.5">
      <Label class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{{ field.label }}</Label>
      <Textarea v-if="field.key === 'notes'"
        :model-value="modelValue[field.key] || ''"
        @update:model-value="update(field.key, $event as string)"
        :placeholder="field.placeholder"
        rows="3"
        class="resize-none" />
      <Input v-else
        :model-value="modelValue[field.key] || ''"
        @update:model-value="update(field.key, $event as string)"
        :placeholder="field.placeholder" />
    </div>
  </div>
</template>
