<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { FIXED, LIMITS, normalizeExtension } from '../shared/rules';
import { usePolicies } from './policies';
import UploadPanel from './UploadPanel.vue';
import CategoryPanel from './CategoryPanel.vue';
import ExtensionToggle from './ExtensionToggle.vue';
import { BUILTIN_CATEGORIES, type Category } from '../shared/categories';
import './style.css';

const { data, ready, busy, message, refresh, save } = usePolicies();
const uploading = ref(false);
const categoryBusy = ref(false);
const categories = ref<Category[]>(BUILTIN_CATEGORIES);
const categoryFilter = ref('all');
const visibleCustom = computed(() => {
  const policies = data.value?.custom ?? [];
  if (categoryFilter.value === 'all') return policies;
  const members = new Set(categoryFilter.value === 'other' ? categories.value.flatMap(c => c.extensions) : categories.value.find(c => c.id === categoryFilter.value)?.extensions ?? []);
  return policies.filter(p => categoryFilter.value === 'other' ? !members.has(p.extension) : members.has(p.extension));
});
function loadedCategories(value: Category[]) {
  categories.value = value;
  if (!['all', 'other'].includes(categoryFilter.value) && !value.some(c => c.id === categoryFilter.value)) categoryFilter.value = 'all';
}
const input = ref('');
const lookupInput = ref('');
const inputElement = ref<HTMLInputElement>();
const normalized = computed(() => normalizeExtension(input.value));
const lookupNormalized = computed(() => normalizeExtension(lookupInput.value));
const findPolicy = (extension: string | null) => [...(data.value?.fixed ?? []), ...(data.value?.custom ?? [])].find(p => p.extension === extension);
const registered = computed(() => findPolicy(normalized.value));
const lookupRegistered = computed(() => findPolicy(lookupNormalized.value));
const locked = computed(() => !ready.value || busy.value || uploading.value || categoryBusy.value);
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

async function changeExtension(extension: string, blocked: boolean) {
  const fixed = (FIXED as readonly string[]).includes(extension);
  const result = await save(fixed ? '/fixed/' + extension : blocked ? '/custom' : '/custom/' + extension, fixed ? 'PATCH' : blocked ? 'POST' : 'DELETE', fixed ? { blocked } : blocked ? { extension } : undefined);
  if (!result || !data.value) return;
  if (fixed && typeof result !== 'boolean') data.value.fixed = data.value.fixed.map(p => p.extension === extension ? result : p);
  else if (!fixed) {
    data.value.custom = blocked && typeof result !== 'boolean' ? [...data.value.custom, result].sort((a,b) => a.extension.localeCompare(b.extension)) : data.value.custom.filter(p => p.extension !== extension);
    data.value.customCount = data.value.custom.length;
  }
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
  await changeExtension(extension, false);
  await nextTick(); inputElement.value?.focus();
}
onMounted(refresh);
</script>

<template>
  <main class="shell">
    <header class="page-header"><div><p class="eyebrow">FILE UPLOAD DEMO</p><h1>파일 업로드 정책 관리</h1><p class="muted">정책은 현재 브라우저 세션에 저장되며 새로고침해도 유지됩니다.</p></div><span class="badge">익명 세션 데모</span></header>
    <div class="sections">
      <UploadPanel :policies="data" :locked="locked" :refresh="refresh" @processing="uploading=$event" />
      <section class="panel" aria-labelledby="policy-title">
        <div class="section-heading"><div><p class="eyebrow">02 · POLICY</p><h2 id="policy-title">확장자 차단 정책</h2></div><button class="subtle" :disabled="busy || uploading || categoryBusy" @click="refresh">정책 새로고침</button></div>
        <p role="status" class="notice">{{ busy ? '정책 처리 중…' : message }}</p>
        <h3>고정 확장자</h3><p class="help">체크하면 즉시 차단 정책을 저장합니다.</p>
        <div class="fixed-list"><ExtensionToggle v-for="policy in data?.fixed" :key="policy.extension" :extension="policy.extension" :blocked="policy.blocked" :disabled="locked" :change="value => changeExtension(policy.extension, value)" /></div>
        <div class="divider"></div>
        <h3>커스텀 추가</h3>
        <form @submit.prevent="add"><label class="sr-only" for="extension">커스텀 확장자</label><div class="input-row"><input id="extension" ref="inputElement" v-model="input" autocomplete="off" spellcheck="false" placeholder="예: pdf" aria-describedby="extension-hint extension-count" :aria-invalid="!!input && !normalized"><span id="extension-count" class="counter">{{ input.length }}/20</span><button type="submit" :disabled="!canAdd">추가</button></div><p id="extension-hint" class="help">{{ inputHint }}</p></form>
        <h3>커스텀 차단 {{ data?.customCount ?? '—' }}/200</h3>
        <div class="category-filter"><label for="category-filter">카테고리별 조회 필터</label><select id="category-filter" v-model="categoryFilter"><option value="all">전체</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option><option value="other">기타</option></select></div>
        <p class="help">표시 {{ visibleCustom.length }}개 · 전체 {{ data?.customCount ?? '—' }}/200</p>
        <div class="tag-list"><span v-for="policy in visibleCustom" :key="policy.extension" class="tag fixed-item" :class="{highlight:lookupRegistered?.extension === policy.extension}"><span>{{ policy.extension }}</span><button class="member-remove" :aria-label="policy.extension + ' 차단 해제'" :disabled="locked" @click="remove(policy.extension)">×</button></span><p v-if="ready && !visibleCustom.length" class="help">{{ data?.customCount ? '이 카테고리에 차단된 확장자가 없습니다.' : '등록된 커스텀 확장자가 없습니다.' }}</p></div>
        <section aria-labelledby="lookup-title">
          <h3 id="lookup-title">등록 여부 확인</h3>
          <label class="sr-only" for="extension-lookup">등록 여부 확인할 확장자</label>
          <input id="extension-lookup" v-model="lookupInput" autocomplete="off" spellcheck="false" placeholder="확인할 확장자 입력" aria-describedby="lookup-hint" :aria-invalid="!!lookupInput && !lookupNormalized">
          <p id="lookup-hint" class="help">{{ lookupHint }}</p>
        </section>
        <CategoryPanel :policies="data" :locked="locked" :refresh="refresh" :toggle="changeExtension" @loaded="loadedCategories" @processing="categoryBusy=$event" @uncertain="ready=false" />
      </section>
    </div>
  </main>
</template>
