<script setup>
import { TYPE, STATUS, PRIO, parseTemplate, fmt } from './customs.config.js'

defineProps({
  modelName: { type: String, required: true },
  items:     { type: Array,  required: true },
})
const emit = defineEmits(['open'])
</script>

<template>
  <div class="rounded-lg border bg-card overflow-hidden">
    <!-- model header -->
    <div class="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/40">
      <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span class="text-[10px] font-semibold text-primary">{{ modelName.charAt(0).toUpperCase() }}</span>
      </div>
      <span class="text-sm font-semibold">{{ modelName }}</span>
      <span class="ml-auto text-xs text-muted-foreground">{{ items.length }}</span>
    </div>

    <!-- rows -->
    <div class="divide-y divide-border">
      <div v-for="c in items" :key="c.id"
        class="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors"
        @click="emit('open', c)">

        <div class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-muted">
          <component :is="TYPE[c.type]?.icon" class="w-3.5 h-3.5 text-muted-foreground" />
        </div>

        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ TYPE[c.type]?.label }}</p>
          <p class="text-xs text-muted-foreground truncate">
            {{ parseTemplate(c.templateData).nick
              || parseTemplate(c.templateData).fanName
              || parseTemplate(c.templateData).description
              || '—' }}
          </p>
        </div>

        <div class="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          <span :class="['font-medium', PRIO[c.priority]?.cls]">
            {{ PRIO[c.priority]?.label }}
          </span>
          <span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
            :class="STATUS[c.status]?.cls">
            {{ STATUS[c.status]?.label }}
          </span>
          <span>{{ fmt(c.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
