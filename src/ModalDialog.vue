<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
const props = defineProps<{ open: boolean; title: string; busy: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
watch(() => props.open, async open => {
  await nextTick();
  if (open && !dialog.value?.open) dialog.value?.showModal();
  else if (!open && dialog.value?.open) dialog.value.close();
}, { immediate: true });
</script>

<template>
  <dialog ref="dialog" class="modal" :aria-label="title" @cancel.prevent="!busy && emit('close')">
    <div class="modal-heading"><h3>{{ title }}</h3><button type="button" class="subtle icon-button" aria-label="닫기" :disabled="busy" @click="emit('close')">×</button></div>
    <slot />
  </dialog>
</template>
