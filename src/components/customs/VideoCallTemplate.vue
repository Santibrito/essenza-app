<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const props = defineProps<{ modelValue: Record<string, string> }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: Record<string, string>): void }>()

function update(key: string, value: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Información del fan -->
    <div class="space-y-3">
      <p class="text-xs font-semibold text-muted-foreground">Información del fan</p>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <Label class="text-xs">Usuario OnlyFans</Label>
          <Input
            :model-value="modelValue.ofUser || ''"
            @update:model-value="update('ofUser', $event as string)"
            placeholder="@usuario_only"
          />
        </div>
        <div class="space-y-1.5">
          <Label class="text-xs">Nombre del fan</Label>
          <Input
            :model-value="modelValue.fanName || ''"
            @update:model-value="update('fanName', $event as string)"
            placeholder="Nombre"
          />
        </div>
        <div class="space-y-1.5">
          <Label class="text-xs">Usuario Telegram</Label>
          <Input
            :model-value="modelValue.telegram || ''"
            @update:model-value="update('telegram', $event as string)"
            placeholder="@usuario_telegram"
          />
        </div>
        <div class="space-y-1.5">
          <Label class="text-xs">Edad</Label>
          <Input
            type="number"
            :model-value="modelValue.age || ''"
            @update:model-value="update('age', $event as string)"
            placeholder="Ej: 25"
            min="18"
          />
        </div>
        <div class="space-y-1.5 col-span-2">
          <Label class="text-xs">Ubicación</Label>
          <Input
            :model-value="modelValue.location || ''"
            @update:model-value="update('location', $event as string)"
            placeholder="País / Ciudad"
          />
        </div>
      </div>
    </div>

    <!-- Detalles de la videollamada -->
    <div class="space-y-3">
      <p class="text-xs font-semibold text-muted-foreground">Detalles de la videollamada</p>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <Label class="text-xs">Duración (minutos)</Label>
          <Input
            type="number"
            :model-value="modelValue.duration || ''"
            @update:model-value="update('duration', $event as string)"
            placeholder="Ej: 15"
            min="1"
          />
        </div>
        <div class="space-y-1.5">
          <Label class="text-xs">Pago realizado</Label>
          <Input
            :model-value="modelValue.payment || ''"
            @update:model-value="update('payment', $event as string)"
            placeholder="Ej: $50 USD"
          />
        </div>
      </div>
    </div>

    <!-- Contexto y expectativas -->
    <div class="space-y-3">
      <p class="text-xs font-semibold text-muted-foreground">Contexto y expectativas</p>
      <div class="space-y-3">
        <div class="space-y-1.5">
          <Label class="text-xs">Contexto del chat</Label>
          <Textarea
            :model-value="modelValue.chatContext || ''"
            @update:model-value="update('chatContext', $event as string)"
            placeholder="Resumen de la conversación previa..."
            rows="3"
            class="resize-none"
          />
        </div>
        <div class="space-y-1.5">
          <Label class="text-xs">Lo que espera en la videollamada</Label>
          <Textarea
            :model-value="modelValue.expectations || ''"
            @update:model-value="update('expectations', $event as string)"
            placeholder="Descripción de la dinámica esperada..."
            rows="3"
            class="resize-none"
          />
        </div>
        <div class="space-y-1.5">
          <Label class="text-xs">Notas importantes</Label>
          <Textarea
            :model-value="modelValue.notes || ''"
            @update:model-value="update('notes', $event as string)"
            placeholder="Límites, cosas que NO le gustan, potencial de upsell..."
            rows="3"
            class="resize-none"
          />
        </div>
      </div>
    </div>
  </div>
</template>
