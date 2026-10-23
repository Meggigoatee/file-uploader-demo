<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CATEGORY_LIMITS, categoryInput, isCategory, type Category } from '../shared/categories';
import { normalizeExtension } from '../shared/rules';
import type { Policies } from '../shared/types';
import { api, ApiError } from './api';
import ExtensionToggle from './ExtensionToggle.vue';
import ModalDialog from './ModalDialog.vue';

const props = defineProps<{ policies?: Policies; locked: boolean; refresh: () => Promise<boolean>; toggle: (extension: string, blocked: boolean) => Promise<unknown> }>();
const emit = defineEmits<{ loaded: [categories: Category[]]; processing: [value: boolean]; uncertain: [] }>();
const categories = ref<Category[]>([]);
const loaded = ref(false), loading = ref(false), mutating = ref(false);
const message = ref('');
const removing = ref<string>();
const dialog = ref<'create' | 'rename' | 'delete' | 'extension'>();
const selectedId = ref<string>();
const draft = ref('');
const selected = computed(() => categories.value.find(c => c.id === selectedId.value));
const disabled = computed(() => props.locked || loading.value || mutating.value || !loaded.value);
const blocked = computed(() => new Set([...(props.policies?.fixed ?? []), ...(props.policies?.custom ?? [])].filter(p => p.blocked).map(p => p.extension)));
const blockedCount = (category: Category) => category.extensions.filter(e => blocked.value.has(e)).length;
const allBlocked = (category: Category) => !!category.extensions.length && blockedCount(category) === category.extensions.length;
const normalized = computed(() => normalizeExtension(draft.value));
const duplicate = computed(() => selected.value?.extensions.includes(normalized.value ?? ''));
const nameValid = computed(() => !!categoryInput(draft.value, []) && !categories.value.some(c => c.id !== selectedId.value && c.name.toLowerCase() === draft.value.trim().toLowerCase()));
const canSubmit = computed(() => !disabled.value && (dialog.value === 'delete' ? !!selected.value : dialog.value === 'extension' ? !!selected.value && !!normalized.value && !duplicate.value && selected.value.extensions.length < CATEGORY_LIMITS.extensions : nameValid.value));
const dialogTitle = computed(() => ({ create: '카테고리 생성', rename: '카테고리 이름 변경', delete: '카테고리 삭제', extension: (selected.value?.name ?? '') + ' 확장자 추가' })[dialog.value ?? 'create']);
const extensionHint = computed(() => {
  if (!draft.value) return '영문·숫자 20자 이내로 입력하세요. 예: .PDF → pdf';
  if (!normalized.value) return '확장자는 원문 20자 이내의 영문·숫자로 입력해 주세요.';
  if (duplicate.value) return '이미 이 카테고리에 등록된 확장자입니다.';
  if (selected.value && selected.value.extensions.length >= CATEGORY_LIMITS.extensions) return '카테고리에는 확장자를 최대 50개 등록할 수 있습니다.';
  const registered = [...(props.policies?.fixed ?? []), ...(props.policies?.custom ?? [])].find(p => p.extension === normalized.value);
  const elsewhere = categories.value.some(c => c.id !== selectedId.value && c.extensions.includes(normalized.value!));
  const status = registered ? `정책에 이미 등록됨 · 현재 ${registered.blocked ? '차단' : '허용'}. ` : '';
  return status + (elsewhere ? '다른 카테고리에도 등록되어 있습니다. 이 카테고리에 추가할 수 있습니다.' : '이 카테고리에 추가할 수 있습니다.') + ' 추가만으로 차단 상태는 바뀌지 않습니다.';
});

async function load() {
  if (!props.policies) return;
  loading.value = true;
  try {
    const result = await api('/api/policies/categories');
    if (!Array.isArray(result?.categories) || !result.categories.every(isCategory)) throw new ApiError('카테고리 응답을 확인하지 못했습니다.', true);
    categories.value = result.categories; loaded.value = true;
    if (!mutating.value) message.value = '';
    emit('loaded', categories.value);
  } catch (error) {
    loaded.value = false;
    message.value = '카테고리를 불러오지 못했습니다. 정책 새로고침을 눌러 주세요. ' + (error as Error).message;
  } finally { loading.value = false; }
}
watch(() => props.policies, () => { if (!mutating.value) void load(); }, { immediate: true });

function openDialog(mode: NonNullable<typeof dialog.value>, category?: Category) {
  dialog.value = mode; selectedId.value = category?.id;
  draft.value = mode === 'rename' ? category?.name ?? '' : '';
  message.value = ''; removing.value = undefined;
}
function closeDialog() { if (!mutating.value) dialog.value = undefined; }

async function mutate(path: string, method: string, body?: unknown, policyChange = false): Promise<boolean> {
  if (disabled.value) return false;
  mutating.value = true; emit('processing', true); message.value = '카테고리 처리 중…';
  try {
    const result = await api('/api/policies/categories' + path, method, body);
    if (method !== 'DELETE' && !isCategory(result) && !(Number.isInteger(result?.changed) && result.changed >= 0)) throw new ApiError('저장 응답을 확인하지 못했습니다.', true);
    await load();
    if (policyChange && !await props.refresh()) return false;
    if (loaded.value) message.value = '카테고리 변경을 저장했습니다.';
    return true;
  } catch (error) {
    const failure = error as ApiError;
    if (failure.uncertain || failure.code === 'SESSION_REQUIRED') {
      emit('uncertain');
      message.value = '카테고리 저장 결과를 확인하지 못했습니다. 정책 새로고침으로 현재 상태를 확인해 주세요.';
    } else message.value = failure.message;
    return false;
  } finally { mutating.value = false; emit('processing', false); }
}
async function submit() {
  if (!canSubmit.value) return;
  let saved = false;
  if (dialog.value === 'create') saved = await mutate('', 'POST', { name: draft.value });
  else if (dialog.value === 'rename') saved = await mutate('/' + selectedId.value, 'PUT', { name: draft.value });
  else if (dialog.value === 'extension') saved = await mutate('/' + selectedId.value + '/extensions', 'POST', { extension: draft.value });
  else if (dialog.value === 'delete') saved = await mutate('/' + selectedId.value, 'DELETE', undefined, true);
  if (saved) closeDialog();
}
</script>

<template>
  <div class="divider"></div>
  <div class="section-heading"><h3>카테고리별 확장자</h3><button class="subtle" :disabled="disabled" @click="openDialog('create')">카테고리 생성</button></div>
  <p class="help">체크하면 차단, 체크를 해제하면 허용합니다. 전체 버튼은 카테고리의 모든 확장자에 적용됩니다.</p>
  <section v-for="category in categories" :key="category.id" class="category-card" :aria-label="category.name + ' 카테고리'">
    <div class="category-heading">
      <div class="category-title"><h4>{{ category.name }}</h4><span class="help">{{ category.extensions.length }}종 중 {{ blockedCount(category) }}종 차단</span></div>
      <div class="category-tools"><button class="subtle icon-button" :disabled="disabled" :aria-label="category.name + ' 확장자 추가'" title="확장자 추가" @click="openDialog('extension', category)">+</button><button class="subtle icon-button" :disabled="disabled || !category.extensions.length" :aria-label="category.name + ' 확장자 제거'" :aria-pressed="removing === category.id" title="확장자 제거 모드" @click="removing = removing === category.id ? undefined : category.id">×</button></div>
    </div>
    <p v-if="removing === category.id" class="help">×를 누르면 카테고리에서만 제외합니다. 차단 정책은 유지됩니다. 위의 ×를 다시 눌러 마칩니다.</p>
    <div class="category-members">
      <div v-for="extension in category.extensions" :key="extension" class="member-item">
        <span v-if="removing === category.id" class="fixed-item">
          <span>{{ extension }}</span>
          <button class="member-remove" :disabled="disabled" :aria-label="category.name + '에서 ' + extension + ' 제외'" @click="mutate('/' + category.id + '/extensions/' + extension, 'DELETE')">×</button>
        </span>
        <ExtensionToggle v-else :extension="extension" :blocked="blocked.has(extension)" :disabled="disabled" :change="value => toggle(extension, value)" />
      </div>
      <span v-if="!category.extensions.length" class="help">+ 버튼으로 확장자를 추가하세요.</span>
    </div>
    <div class="category-actions">
      <button class="subtle" :disabled="disabled || !category.extensions.length || removing === category.id" :aria-label="category.name + (allBlocked(category) ? ' 전체 허용' : ' 전체 차단')" @click="mutate('/' + category.id + '/state', 'PATCH', { blocked: !allBlocked(category) }, true)">{{ allBlocked(category) ? '전체 허용' : '전체 차단' }}</button>
      <template v-if="!category.builtin"><button class="subtle" :disabled="disabled" :aria-label="category.name + ' 이름 변경'" @click="openDialog('rename', category)">이름 변경</button><button class="subtle" :disabled="disabled" :aria-label="category.name + ' 카테고리 삭제'" @click="openDialog('delete', category)">카테고리 삭제</button></template>
    </div>
  </section>
  <p v-if="!dialog && (message || loading)" class="notice" role="status">{{ loading ? '카테고리 불러오는 중…' : message }}</p>

  <ModalDialog :open="!!dialog" :title="dialogTitle" :busy="mutating" @close="closeDialog">
    <form v-if="dialog" class="modal-form" @submit.prevent="submit">
      <template v-if="dialog === 'delete'"><p>이 카테고리를 삭제하고 소속 확장자를 모두 허용할까요?</p><p class="help">직접 등록했거나 다른 카테고리와 겹친 확장자도 허용됩니다.</p></template>
      <template v-else><label for="category-draft">{{ dialog === 'extension' ? '확장자' : '카테고리 이름' }}</label><input id="category-draft" v-model="draft" autofocus autocomplete="off" spellcheck="false" :disabled="mutating" :aria-describedby="dialog === 'extension' ? 'category-extension-hint' : 'category-name-hint'">
        <p v-if="dialog === 'extension'" id="category-extension-hint" class="help">{{ extensionHint }}</p><p v-else id="category-name-hint" class="help">이름은 30자 이내로 입력하세요. {{ draft && !nameValid ? '이미 등록된 이름 또는 사용할 수 없는 이름입니다.' : '' }}</p>
      </template>
      <p v-if="message" class="notice" role="status">{{ message }}</p>
      <div class="modal-actions"><button type="button" class="subtle" :disabled="mutating" @click="closeDialog">취소</button><button type="submit" :disabled="!canSubmit">{{ dialog === 'create' ? '생성' : dialog === 'rename' ? '저장' : dialog === 'extension' ? '추가' : '삭제' }}</button></div>
    </form>
  </ModalDialog>
</template>
