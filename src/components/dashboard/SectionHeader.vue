<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-black tracking-tight">
          {{ title }}
        </h2>
        <p v-if="subtitle" class="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.28em] mt-1">
          {{ subtitle }}
        </p>
      </div>

      <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
        <slot name="actions" />
      </div>
    </div>
    
    <div v-if="$slots.controls">
      <slot name="controls" />
    </div>
  </div>
</template>
