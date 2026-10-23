# 최종 로컬 구현·테스트 대조 — FINAL-LOCAL-01

2026-10-23 21:25:47 KST 시작(사용자 전송 시각이 아닌 도구 확인 시각). [사용자 요청과 응답](./conversations/2026-10-23-011.md). 완료 기록을 현재 코드/실행과 다시 대조했다. 과거 CATEGORY-01~05/SESSION-01 완료 기록은 역사 기록으로 보존한다. 이번 요청의 제품 코드 수정은 없으며, 기존 미커밋 변경을 보존했다.

## 발견한 검증 누락과 보강

기존 카테고리 Worker11개/E2E7개는 정상 CRUD·기본 구성원 편집·200개 일괄 경합·50개 구성원 경합·세션 격리·삭제/편집 rollback·실제 업로드 적용·응답 유실을 확인했다. 다만 다음 항목의 직접적인 검증이 부족했다.

1. `categoryInput`/`isCategory` 자체의 단위 검사가 없었다. 이름 정확히30자/31자·제어문자/예약명, 원문20/21자·구성원50/51개·정규화 중복·잘못된 응답 형식을 추가했다.
2. 이름 대소문자/정규화 구성원 동시 중복, 중복 이름으로 rename 시 전체 보존, 구성원 교체 성공 시 정책 보존, 다른 세션의 모든 변경 경로, 빈 분류·정확히200개에서 기존 소속/고정 변경, 단건 추가와 일괄 경합을 추가했다.
3. 생성/차단/허용의 실제 D1 제약 실패 rollback, 직접 SQL의 PK/FK/CHECK, 실행 직전 소속 변경과 단일 SQL의 현재 대상, 카테고리 일괄 정책의 T 전후 실제 R2 결과를 추가했다.
4. 예약 실패/커밋 후 결과 미확인·put 거부/저장 후 반환 null·크기 불일치·예외에서 성공을 반환하지 않음, put 호출 횟수·실제 객체 바이트·예산 유지/재시도 추가 소비를 추가했다.
5. UI의 원문 길이 보존/중복 버튼 잠금·서버409 뒤 입력 보존·50개 경계/빈 분류·다른 카드 모드 전환·소속 제거 후 기타 필터·선택 카테고리 삭제 후 필터 복귀·후속 GET 실패 잠금/복구·실제 로컬 예약 실패 후 수동 재시도를 추가했다.

신규 **48개(단위23/Worker18/E2E7)**다. 이미 동작하던 로직은 새 테스트의 첫 실행에서도 통과했으며 인위적 실패를 만들지 않았다. UI1개는 한 카드씩인 제거 모드를 두 카드가 동시에 유지한다고 잘못 가정해 실패했다. 카드로 돌아와 모드에 재진입하는 절차를 고쳤고 기존 데이터/정책/필터/삭제 기대는 유지했다. [실패와 수정 기록](./TDD_LOG.md), [최초 UI 로그](./verification/FINAL-LOCAL-01-ui-first.log), [UI7개 재검증](./verification/FINAL-LOCAL-01-ui-green.log).

## 카테고리 구현과 테스트 매핑

테스트 파일 안의 `CATEGORY`, `CATEGORY-03`, `FINAL category`, `FINAL UI` 이름으로 사례를 구분한다. 단순 함수 호출이나 HTTP200만으로 데이터/저장 성공을 판정하지 않았다.

| 합의 동작·구현 경로 | 현재 확인하는 테스트 | 관찰하는 결과 |
| --- | --- | --- |
| 새 세션의 기본4분류 각5개, 기존 세션 편집값 보존 — `server/categories.ts:categorySeeds`, `server/session.ts`, migration5 | [categories](../tests/integration/categories.test.ts), [category-members](../tests/integration/category-members.test.ts), [sessions](../tests/integration/sessions.test.ts) | DB 소속·기본값·기존 사용자 분류/정책 보존·같은 쿠키 재초기화 시 원복 없음 |
| 이름1~30자·원문 확장자20자·구성원최대50개·정규화/중복 제거 — `shared/categories.ts:categoryInput` | [단위](../tests/unit/categories.test.ts), [HTTP 경계](../tests/integration/category-boundaries.test.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts) | 정확한 경계 허용/초과 거절, 잘라내기 없음, 거절 후 DB 불변 |
| 같은 세션 이름 중복·NOCASE/정규화 구성원 PK — category 생성/구성원 POST, migration4 | [HTTP 경계](../tests/integration/category-boundaries.test.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts) | 같은 DB의 동시 요청201/409·행1개, 오류 코드·입력 보존·다른 세션 동일 이름 허용 |
| 이름만 생성·이름만 변경·전체 구성원 교체 — category POST/PUT | [category-members](../tests/integration/category-members.test.ts), [HTTP 경계](../tests/integration/category-boundaries.test.ts), [카테고리 UI](../tests/e2e/categories.spec.ts) | 빈 소속 생성·이름 변경 시 소속 유지·전체 교체 시 차단 상태 불변·rename409 rollback |
| 기본/사용자 구성원 추가·제거, 제거는 차단 유지 — extensions POST/DELETE | [category-members](../tests/integration/category-members.test.ts), [HTTP 경계](../tests/integration/category-boundaries.test.ts), [공통 UI](../tests/e2e/category-interactions.spec.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts) | 정규화·같은 분류 중복·50개에서 한 자리 경쟁·삭제 멱등·새로고침 유지·정책 유지 |
| 세션마다 분류/정책 격리·기본 이름/자체 삭제 보호 — 모든 category 액션 | [categories](../tests/integration/categories.test.ts), [HTTP 경계](../tests/integration/category-boundaries.test.ts), [브라우저 세션](../tests/e2e/sessions.spec.ts) | foreign ID의 PUT/POST/DELETE/state 모두404·원세션 데이터 보존·기본 변경400 |
| 전체 차단/허용·고정/custom 공유 정책, 현재 소속 전체 대상 — state PATCH | [categories](../tests/integration/categories.test.ts), [category-members](../tests/integration/category-members.test.ts), [HTTP 경계](../tests/integration/category-boundaries.test.ts) | 고정7개/custom 분리·중복 차단 멱등·기존200개도 기존 소속/고정 변경 가능·빈 그룹 no-op |
| custom200개 상한·원자성 — 단일 INSERT/UPSERT | [categories](../tests/integration/categories.test.ts), [HTTP 경계](../tests/integration/category-boundaries.test.ts), [카테고리 UI](../tests/e2e/categories.spec.ts) | 199개에서 일괄2개 전체 거절·일괄/일괄 및 일괄/단건 경합 한쪽만 성공·실패 쪽 고정값도 보존 |
| 실행 중 구성원 변경 — state SQL의 target | [HTTP 경계](../tests/integration/category-boundaries.test.ts) | SQL run 전 await 경계에서 pdf 제거/zip 추가 후 zip만 차단. sleep 없음·실제 D1 실행 |
| 생성·편집·허용·삭제 rollback — D1 batch/단일 문장 | [categories](../tests/integration/categories.test.ts), [HTTP 경계](../tests/integration/category-boundaries.test.ts) | 실제 로컬 trigger가 실패를 만들고 이름/소속/고정/custom 모두 이전 상태·고아 소속 없음 |
| 카테고리 삭제는 현재 소속 모두 허용, 겹친 분류도 공유 정책 — category DELETE | [categories](../tests/integration/categories.test.ts), [카테고리 UI](../tests/e2e/categories.spec.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts) | 소속 fixed unchecked/custom 삭제·다른 분류 소속은 남음·이미 소속에서 제외한 정책은 삭제해도 유지 |
| 필터 전체/기본/사용자/기타·총수/표시수·선택 삭제 복귀 — `src/App.vue` | [카테고리 UI](../tests/e2e/categories.spec.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts) | 필터 쓰기0·표시5/총6 구분·소속 제외 후 기타로 이동·선택 분류 삭제 후 all·고정 유지 |
| 공통 체크박스·한 개 전체 버튼·빈 그룹 잠금 — `src/CategoryPanel.vue`, `src/ExtensionToggle.vue` | [공통 UI](../tests/e2e/category-interactions.spec.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts) | 전체 차단/허용 전환·일부 해제 시 전체 차단 복귀·개별 실패 시 체크값 복원·빈 카드 버튼 비활성 |
| 추가/이름/삭제 공통 팝업·취소/포커스·제거 모드 — `src/ModalDialog.vue`, CategoryPanel | [공통 UI](../tests/e2e/category-interactions.spec.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts) | Enter/Escape·원래 버튼 포커스·삭제 취소 보존·처리 중 잠금·동일/다른 분류 등록 안내·390px 넘침 없음 |
| 불확실 저장/실패 GET과 잠금/복구 — CategoryPanel load/mutate, `src/policies.ts` | [카테고리 UI](../tests/e2e/categories.spec.ts), [공통 UI](../tests/e2e/category-interactions.spec.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts) | 실제 저장 후 응답 전달 차단·입력 보존·팝업 밖 안내 유지·후속 정책 GET 실패 시 업로드 잠금·수동 재조회 복구 |
| 카테고리 정책의 서버 업로드 적용·T — `server/uploads.ts`, `server/policies.ts:readPolicies` | [categories](../tests/integration/categories.test.ts), [category-members](../tests/integration/category-members.test.ts), [HTTP 경계](../tests/integration/category-boundaries.test.ts) | 차단422/R2미증가·허용201/바이트 일치·T 전 변경 반영·T 후 저장 유지/다음 요청 거절 |

## 기존 핵심 기능과 저장 실패 매핑

| 영역 | 테스트 | 핵심 증거 |
| --- | --- | --- |
| 정책 입력/고정 보호/중복/200개/동시 변경/API 오류 | [rules](../tests/unit/rules.test.ts), [policies](../tests/integration/policies.test.ts), [api](../tests/integration/api.test.ts), [정책 UI](../tests/e2e/policies.spec.ts), [오류 UI](../tests/e2e/errors.spec.ts) | 원문20자·DB CHECK/PK·고정7개·실제 same DB 경합·불확실 저장 재조회 |
| 파일 이름/바이트/본문·정책 검증/UUID·실제 R2 | [uploads](../tests/integration/uploads.test.ts), [rules](../tests/unit/rules.test.ts) | 0/5MiB/5MiB+1·6MiB/거짓 길이·UTF-8 255/256·multipart·확장자 토큰·바이트/메타데이터 |
| 앱 자체 누적 예산/동시 예약·세션 생성으로 우회 불가 | [uploads](../tests/integration/uploads.test.ts), [sessions](../tests/integration/sessions.test.ts), [오류 UI](../tests/e2e/errors.spec.ts) | 실제 예산 행256MiB/500 경계·동시 한쪽 저장·거절 시 객체 미증가·전역 예산 |
| 예약 SQL 실패/커밋 뒤 결과 유실 | [새 저장 실패](../tests/integration/upload-failures.test.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts) | 실제 D1 trigger/실제 커밋 후 좁은 throw·put0회·예산0 또는 예약 보존·UI 다음 전송 중단 |
| put 거부·실제 저장 후 null/크기 불일치/예외 | [새 저장 실패](../tests/integration/upload-failures.test.ts) | 앱503·put1회·저장 전 거부는 객체0/예산 유지·저장 뒤 오류는 실제 바이트 존재/예산 유지 |
| 수동 재시도·성공/대기 행 보존·응답 손실/60초 timeout | [업로드 UI](../tests/e2e/uploads.spec.ts), [UI 경계](../tests/e2e/final-boundaries.spec.ts), [queue](../tests/unit/queue.test.ts) | 재시도 요청 수·성공 행 미전송·전송100%와 저장 성공 구분·실제 저장 뒤 전달 실패·기존60초 timeout |
| 세션 쿠키/정책 격리·새로고침·초기화 rollback | [sessions](../tests/integration/sessions.test.ts), [브라우저 세션](../tests/e2e/sessions.spec.ts) | 별도 context와 같은 탭 쿠키·미발급/잘못된/누락 쿠키401·세션/정책 동시 rollback |

## 실행과 한계

- 기존 Windows/Node24.16.0/pnpm11.5.1·동일 고정 의존성을 사용했다. Worker 통합은 테스트별 격리된 실제 로컬 D1/R2, E2E는 Vite4173과 `.wrangler/e2e`를 사용했다. 일반 dev5173 상태를 초기화하지 않았다.
- 최초 샌드박스 EPERM과 CATEGORY-05와의4173 충돌은 환경/동시 실행 문제로 분류했다. 다른 프로세스를 종료하거나 `reuseExistingServer`로 우회하지 않았다. UI 최초 오류 trace는 `.wrangler/final-local-playwright`에 남겼다. 자동 retry·skip/only·오류 기대 완화는 추가하지 않았다.
- 좁은 대역은 예약 커밋 결과 전달, R2 put 반환/예외, 브라우저 응답 전달에 한정했다. 로컬 D1/R2 사용과 대역을 구분했다. 실제 Cloudflare 장애·계정 한도 응답의 정확한 재현, 원격 배포/원격 smoke, 부하·전체 브라우저·실기기는 이번 결과에 포함하지 않는다.
- 공통 `verificationPath`를 사용해 최종 E2E 캡처에는 `FINAL-LOCAL-01` 접두사를 붙인다. 과거 이미지 증거를 덮어쓰지 않는다. 제품 동작/요건을 바꾸는 리팩토링은 필요하지 않았다.
- 최종 전체 실행 결과와 report는 [VALIDATION](./VALIDATION.md)에 기록한다. 단위/Worker/E2E 파일 수나 테스트 수는 코드 커버리지 백분율을 의미하지 않는다.

최종 `pnpm run check`는 **종료0·단위65/Worker57/E2E29=151개·타입/빌드 통과**다([report](./verification/runs/CHECK-2026-10-23T12-35-39-480Z-ce4bb88e/report.json), [stdout](./verification/FINAL-LOCAL-01-final-check.log)). 실행 시각은21:35:39~21:37:31 KST다. 위 동작 대조와 추가48개를 포함한 전체 회귀에서 남은 실패는 없다. 제품 로직 수정을 요구하는 결함은 발견되지 않았다.
