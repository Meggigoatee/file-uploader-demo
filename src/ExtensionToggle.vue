<script setup lang="ts">
import { nextTick } from 'vue';
const props = defineProps<{ extension: string; blocked: boolean; disabled: boolean; change: (blocked: boolean) => Promise<unknown> }>();
async function update(event: Event) {
  const input = event.target as HTMLInputElement;
  try { await props.change(input.checked); }
  finally { await nextTick(); input.checked = props.blocked; }
}
</script>

<template>
  <label class="fixed-item"><input type="checkbox" :checked="blocked" :disabled="disabled" @change="update"><span>{{ extension }}</span></label>
</template>
