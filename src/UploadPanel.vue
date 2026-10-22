<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { Policies } from '../shared/types';
import { appendFiles, precheck, retryable, type QueueItem } from './queue';
import { sendFile } from './upload';

const props = defineProps<{policies?: Policies; locked: boolean; refresh: () => Promise<boolean>}>();
const emit = defineEmits<{processing:[value:boolean]}>();
const items = ref<QueueItem[]>([]);
const running = ref(false);
const notice = ref('');
const dragging = ref(false);
const picker = ref<HTMLInputElement>();
const disabled = computed(() => props.locked || running.value);
const allowed = (item: QueueItem) => !!props.policies && !precheck(item.file,props.policies);
const canUpload = (item: QueueItem) => allowed(item) && (['pending','preblocked'].includes(item.state) || retryable(item));
const pending = computed(() => items.value.filter(item => ['pending','preblocked'].includes(item.state) && allowed(item)));
const failures = computed(() => items.value.filter(item => retryable(item) && allowed(item)));
const successes = computed(() => items.value.filter(item=>item.state==='success').length);
const rejected = computed(() => items.value.filter(item=>item.state==='preblocked').length);

watch(() => props.policies, policies => {
  if (!policies) return;
  for (const item of items.value) if (['pending','preblocked'].includes(item.state)) {
    const reason = precheck(item.file,policies);
    item.state = reason ? 'preblocked' : 'pending'; item.reason = reason ?? '';
  }
}, {deep:true});

function add(files: File[]) {
  if (disabled.value || !props.policies || !files.length) return;
  try { items.value = appendFiles(items.value,files,props.policies); notice.value = ''; }
  catch (error) { notice.value = (error as Error).message; }
}
function choose(event: Event) { const input = event.target as HTMLInputElement; add([...input.files ?? []]); input.value=''; }
function drop(event: DragEvent) {
  dragging.value = false;
  if (disabled.value || !event.dataTransfer) return;
  const entries = [...event.dataTransfer.items];
  if (!entries.length || entries.some(item => item.kind !== 'file' || item.webkitGetAsEntry?.()?.isDirectory)) { notice.value='파일만 선택해 주세요. 폴더·URL·문자열은 지원하지 않습니다.'; return; }
  add([...event.dataTransfer.files]);
}
function remove(id: string) { if (!disabled.value) items.value=items.value.filter(item=>item.id!==id); }

async function start(retry = false, id?: string) {
  if (disabled.value) return;
  running.value = true; emit('processing',true); notice.value = '';
  try {
    if (!await props.refresh()) return;
    await nextTick();
    const targets = items.value.filter(item => (id === undefined || item.id === id) && (retry ? retryable(item) : ['pending','preblocked'].includes(item.state)));
    for (const item of targets) {
      if (!allowed(item)) continue;
      item.state='sending'; item.progress=undefined; item.reason='';
      const result = await sendFile(item.file, percent=>item.progress=percent, ()=>{item.state='confirming';});
      item.state=result.state; item.reason=result.message;
      if (result.stop) { notice.value=result.message + ' 다음 전송을 중단했습니다.'; break; }
      if (result.state==='rejected') {
        if (!await props.refresh()) { notice.value='정책 재조회에 실패해 다음 전송을 중단했습니다.'; break; }
        await nextTick();
      }
    }
  } finally { running.value=false; emit('processing',false); }
}
function stateLabel(item: QueueItem) {
  if (item.state==='pending') return '전송 가능';
  if (item.state==='preblocked') return '사전 차단';
  if (item.state==='sending') return '전송 중' + (item.progress === undefined ? '' : ` ${item.progress}%`);
  if (item.state==='confirming') return '전송 완료 · 서버 확인 중';
  return {success:'업로드 완료',rejected:'서버 거절',failed:'업로드 실패',unconfirmed:'완료 확인 실패'}[item.state];
}
</script>

<template>
  <section class="panel" aria-labelledby="upload-title">
    <p class="eyebrow">01 · UPLOAD</p><h2 id="upload-title">파일 업로드</h2><p class="muted">파일당 최대 5 MiB · 목록 최대 10개</p>
    <div data-testid="drop-zone" class="drop-zone" :class="{dragging,disabled}" @dragover.prevent="dragging=!disabled" @dragleave.prevent="dragging=false" @drop.prevent="drop">
      <span class="upload-icon" aria-hidden="true">↑</span><p>파일을 여기에 놓아 주세요</p><span class="help">또는</span><button type="button" :disabled="disabled" @click="picker?.click()">파일 선택</button>
      <input ref="picker" hidden type="file" multiple aria-label="파일 선택" :disabled="disabled" @change="choose">
    </div>
    <p v-if="!policies" class="help">정책을 불러온 뒤 파일을 선택할 수 있습니다.</p>
    <div class="queue-heading"><h3>전송 목록 {{ items.length }}/10</h3><span class="help">완료 {{ successes }} · 사전 차단 {{ rejected }}</span></div>
    <p v-if="!items.length" class="empty-queue">선택한 파일을 확인한 뒤 업로드를 시작하세요.</p>
    <ul class="queue-list" aria-label="전송 목록"><li v-for="item in items" :key="item.id" class="queue-item" :class="item.state">
      <div class="file-info"><strong>{{ item.file.name }}</strong><span class="help">{{ item.file.size.toLocaleString() }} B</span></div>
      <div class="file-state"><span class="state-label">{{ stateLabel(item) }}</span><progress v-if="['sending','confirming'].includes(item.state)" :value="item.state==='confirming' ? 100 : item.progress" max="100" :aria-label="item.file.name + ' 전송률'"/><p v-if="item.reason && item.state!=='success'" class="help">{{ item.reason }}</p><p v-if="retryable(item) && !allowed(item)" class="help">현재 정책에서는 다시 전송할 수 없습니다.</p></div>
      <div class="row-actions"><button class="subtle" :disabled="disabled || !canUpload(item)" :aria-label="item.file.name + (retryable(item) ? ' 재시도' : ' 업로드')" @click="start(retryable(item),item.id)">{{ retryable(item) ? '재시도' : '업로드' }}</button><button class="subtle" :disabled="disabled" :aria-label="item.file.name + ' 목록에서 제거'" @click="remove(item.id)">제거</button></div>
    </li></ul>
    <div class="upload-actions"><button :disabled="disabled || !pending.length" @click="start()">업로드 시작 ({{ pending.length }})</button><button class="subtle" :disabled="disabled || !failures.length" @click="start(true)">실패 파일 재시도 ({{ failures.length }})</button></div>
    <p v-if="!pending.length && items.length && !running" class="help">현재 전송 가능한 대기 파일이 없습니다.</p>
    <p role="status" class="notice" v-if="notice">{{ notice }}</p>
    <p class="footnote">새로고침하면 파일 목록은 초기화됩니다. 목록에서 제거해도 저장된 파일은 삭제되지 않습니다. 서버 검사 이후의 정책 변경은 다음 업로드에 적용됩니다.</p>
  </section>
</template>
