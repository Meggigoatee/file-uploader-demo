<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { LIMITS, normalizeExtension } from '../shared/rules';
import type { Policy } from '../shared/types';
import { usePolicies } from './policies';
import UploadPanel from './UploadPanel.vue';
import './style.css';

const { data, ready, busy, message, refresh, save } = usePolicies();
const uploading = ref(false);
const input = ref('');
const lookupInput = ref('');
const inputElement = ref<HTMLInputElement>();
const normalized = computed(() => normalizeExtension(input.value));
const lookupNormalized = computed(() => normalizeExtension(lookupInput.value));
const findPolicy = (extension: string | null) => [...(data.value?.fixed ?? []), ...(data.value?.custom ?? [])].find(p => p.extension === extension);
const registered = computed(() => findPolicy(normalized.value));
const lookupRegistered = computed(() => findPolicy(lookupNormalized.value));
const locked = computed(() => !ready.value || busy.value || uploading.value);
const canAdd = computed(() => !locked.value && !!normalized.value && !registered.value && (data.value?.customCount ?? 0) < LIMITS.custom);
const inputHint = computed(() => {
  if (!input.value) return '영문·숫자 확장자를 입력해 주세요. 예: .PDF → pdf';
  if (!normalized.value) return '원문 20자 이내의 영문·숫자를 입력해 주세요. 점은 앞에 하나만 허용합니다.';
  if (!ready.value) return '정책을 먼저 불러와 주세요.';
  if (registered.value?.kind === 'fixed') return `고정 확장자 · 현재 ${registered.value.blocked ? '차단' : '해제'}`;
  if (registered.value) return '이미 커스텀 차단 목록에 등록되어 있습니다.';
  return `등록된 확장자가 없습니다. 저장할 값: ${normalized.value}`;
});
const lookupHint = computed(() => {
  if (!lookupInput.value) return '확장자를 입력하면 현재 등록 여부를 확인합니다.';
  if (!lookupNormalized.value) return '원문 20자 이내의 영문·숫자를 입력해 주세요. 점은 앞에 하나만 허용합니다.';
  if (!ready.value) return '정책을 먼저 불러와 주세요.';
  if (lookupRegistered.value?.kind === 'fixed') return `고정 확장자 · 현재 ${lookupRegistered.value.blocked ? '차단' : '해제'}`;
  return lookupRegistered.value ? '이미 커스텀 차단 목록에 등록되어 있습니다.' : '등록된 확장자가 없습니다.';
});
const groups = [
  { name:'사진', extensions:['jpg','jpeg','png','webp'] }, { name:'영상', extensions:['mp4','webm'] },
  { name:'음성', extensions:['mp3','wav'] }, { name:'문서', extensions:['pdf','txt','docx','xlsx','pptx'] },
];

async function changeFixed(policy: Policy, event: Event) {
  const target = event.target as HTMLInputElement;
  const result = await save('/fixed/' + policy.extension, 'PATCH', { blocked: target.checked });
  if (result && typeof result !== 'boolean' && data.value) data.value.fixed = data.value.fixed.map(p => p.extension === policy.extension ? result : p);
  target.checked = data.value?.fixed.find(p => p.extension === policy.extension)?.blocked ?? policy.blocked;
}
async function add() {
  if (!canAdd.value || !data.value) return;
  const result = await save('/custom', 'POST', {extension:input.value});
  if (result && typeof result !== 'boolean') {
    data.value.custom = [...data.value.custom, result].sort((a,b) => a.extension.localeCompare(b.extension));
    data.value.customCount = data.value.custom.length;
    input.value = '';
  }
  await nextTick(); inputElement.value?.focus();
}
async function remove(extension: string) {
  if (locked.value || !data.value) return;
  if (await save('/custom/' + extension, 'DELETE')) {
    data.value.custom = data.value.custom.filter(p => p.extension !== extension);
    data.value.customCount = data.value.custom.length;
  }
  await nextTick(); inputElement.value?.focus();
}
function fill(extension: string) { input.value = extension; inputElement.value?.focus(); }
onMounted(refresh);
</script>

<template>
  <main class="shell">
    <header class="page-header"><div><p class="eyebrow">FILE UPLOAD DEMO</p><h1>파일 업로드 정책 관리</h1><p class="muted">변경한 정책은 모든 방문자에게 적용됩니다.</p></div><span class="badge">공유 데모</span></header>
    <div class="sections">
      <UploadPanel :policies="data" :locked="locked" :refresh="refresh" @processing="uploading=$event" />
      <section class="panel" aria-labelledby="policy-title">
        <div class="section-heading"><div><p class="eyebrow">02 · POLICY</p><h2 id="policy-title">확장자 차단 정책</h2></div><button class="subtle" :disabled="busy || uploading" @click="refresh">정책 새로고침</button></div>
        <p role="status" class="notice">{{ busy ? '정책 처리 중…' : message }}</p>
        <h3>고정 확장자</h3><p class="help">체크하면 즉시 차단 정책을 저장합니다.</p>
        <div class="fixed-list"><label v-for="policy in data?.fixed" :key="policy.extension" class="fixed-item"><input type="checkbox" :checked="policy.blocked" :disabled="locked" @change="changeFixed(policy, $event)"><span>{{ policy.extension }}</span></label></div>
        <div class="divider"></div>
        <h3>커스텀 추가</h3>
        <form @submit.prevent="add"><label class="sr-only" for="extension">커스텀 확장자</label><div class="input-row"><input id="extension" ref="inputElement" v-model="input" autocomplete="off" spellcheck="false" placeholder="예: pdf" aria-describedby="extension-hint extension-count" :aria-invalid="!!input && !normalized"><span id="extension-count" class="counter">{{ input.length }}/20</span><button type="submit" :disabled="!canAdd">추가</button></div><p id="extension-hint" class="help">{{ inputHint }}</p></form>
        <h3>커스텀 차단 {{ data?.customCount ?? '—' }}/200</h3>
        <div class="tag-list"><span v-for="policy in data?.custom" :key="policy.extension" class="tag" :class="{highlight:lookupRegistered?.extension === policy.extension}">{{ policy.extension }}<button :aria-label="policy.extension + ' 차단 해제'" :disabled="locked" @click="remove(policy.extension)">×</button></span><p v-if="ready && !data?.customCount" class="help">등록된 커스텀 확장자가 없습니다.</p></div>
        <section aria-labelledby="lookup-title">
          <h3 id="lookup-title">등록 여부 확인</h3>
          <label class="sr-only" for="extension-lookup">등록 여부 확인할 확장자</label>
          <input id="extension-lookup" v-model="lookupInput" autocomplete="off" spellcheck="false" placeholder="확인할 확장자 입력" aria-describedby="lookup-hint" :aria-invalid="!!lookupInput && !lookupNormalized">
          <p id="lookup-hint" class="help">{{ lookupHint }}</p>
        </section>
        <div class="divider"></div><h3>자주 쓰는 확장자 안내</h3><p class="help">선택하면 입력창에 채워집니다. 추가 버튼으로 차단을 등록하세요.</p>
        <div v-for="group in groups" :key="group.name" class="guide-row"><span>{{ group.name }}</span><div><button v-for="extension in group.extensions" :key="extension" class="guide" @click="fill(extension)">{{ extension }}</button></div></div>
      </section>
    </div>
  </main>
</template>
