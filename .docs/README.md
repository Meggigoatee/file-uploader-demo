# 파일 업로드 과제 개발 문서

기준일: 2026-10-22 (Asia/Seoul). 수정 계획 승인 후 **S0~S6 구현·회귀와 S8 실제 배포·원격 검증을 완료**했다. [공개 데모](https://file-uploader-demo.meggigoatee.workers.dev). 아래 명령으로 로컬 실행과 검증을 재현한다. 실제 결과는 VALIDATION/TDD_LOG에 별도 기록한다.

## 문서 안내

최신 FINAL-LOCAL-01 최종 로컬 검증은 **단위65/Worker57/E2E29=151개·타입/빌드 통과**다. 카테고리/저장 실패 검증 누락48개를 보강하고 [구현·테스트 대조표](./FINAL_LOCAL_REVIEW.md)를 남겼다. CATEGORY-03은 카테고리 전체 버튼·소속+/×·공통 팝업·개별 체크박스를 통일하고 기본 분류 구성도 세션별 편집/유지한다. 새 세션에서만 기본 각5개이며 사용자 수정 뒤에는 고정 개수가 아니다. 일반 dev migration5를 적용했고 배포하지 않았다.

SESSION-01은 익명 쿠키+D1 세션별 정책 분리(당시 로컬85개 통과)다. 이후 사용자 요청으로 CATEGORY-01/02의 카테고리 필터·일괄 차단/허용·분류별5개·사용자 카테고리를 로컬 구현했다. [후속 계획](./CATEGORY_PLAN.md), 실제 최신 회귀는 VALIDATION/TDD_LOG를 따른다. 카테고리 삭제는 소속 차단도 해제한다. 완료 항목 일괄 비우기는 미합의다. 이번 변경은 배포·커밋/푸시하지 않았으며 공개 데모는 이전 UI-R01 공유 정책 버전이다.

| 문서 | 용도 |
| --- | --- |
| [원본 과제](./과제_파일업로드_AI개발.md) | 요구사항의 기준. 원본은 수정하지 않는다. |
| [루트 README](../README.md), [AGENTS.md](../AGENTS.md) | 프로젝트 소개·문서 진입점과 저장소 전체 작업 지침 |
| [PLAN.md](./PLAN.md) | 필수 범위, 준비사항, 6시간 일정, 제출 조건 |
| [TDD_PLAN.md](./TDD_PLAN.md) | 승인 대상 구현 순서·핵심 TC01~TC19·Red/Green/리팩토링/누적 회귀 절차 |
| [TDD_LOG.md](./TDD_LOG.md) | 실제 루프별 실패 원인·수정·리팩토링·재검증·회귀 기록 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 설치 버전, PC 전역 pnpm 스토어, 재설치·환경 스모크 확인 |
| [HARNESS.md](./HARNESS.md) | 프로젝트 스킬의 출처·선정/제외 이유, CLI 하네스와 실행 결과 |
| [DESIGN.md](./DESIGN.md) | 기술 선택, API, 정책 규칙, 테이블 스키마, 저장 흐름 |
| [SESSION_POLICY_REVIEW.md](./SESSION_POLICY_REVIEW.md) | 최초 비교·제안 기록 및 SESSION-01 채택/제외 범위. 실제 스키마·결과는 DESIGN/VALIDATION |
| [UI_UX.md](./UI_UX.md) | 필수/핵심/시간 여유 옵션의 화면 구성, 와이어프레임, 조작·상태·오류 흐름 |
| [DECISIONS.md](./DECISIONS.md) | 최신 기능 합의, 즉시 정책 저장, 업로드 판정 시점, 보수적 실패 처리, 무료 티어·자원 한도 |
| [CONSIDERATIONS.md](./CONSIDERATIONS.md) | 보안·데이터·UX·운영 고려사항과 포함/제외 근거 |
| [VALIDATION.md](./VALIDATION.md) | 요구사항별 검증 계획과 실행 결과 기록 위치 |
| [FINAL_LOCAL_REVIEW.md](./FINAL_LOCAL_REVIEW.md) | 최종 로컬 검증의 구현/요건/테스트 대조표, 누락 보강·경계·실패 검증의 증거와 한계 |
| [FEATURE_BRAINSTORM.md](./FEATURE_BRAINSTORM.md) | 사용자/AI 제안 구분, 업로드·정책 관리 UX 비교, 대안 및 상호 합의 상태 |
| [PROMPT_LOG.md](./PROMPT_LOG.md) | 시간순 AI 입력의 의도, 도구 사용, 채택·수정·폐기 및 회고 |
| [conversations/2026-10-21-001.md](./conversations/2026-10-21-001.md) | 첫 요청과 응답, 작업 결과를 기록한 별도 대화 파일 |
| [conversations/2026-10-21-002.md](./conversations/2026-10-21-002.md) | 필수 목표·핵심 추가 기능 정의 보강과 문서 수정 기록 |
| [conversations/2026-10-21-003.md](./conversations/2026-10-21-003.md) | 사용자 추가 기능 제안과 브레인스토밍 |
| [conversations/2026-10-21-004.md](./conversations/2026-10-21-004.md) | 두 방향의 범위·비용을 먼저 비교하라는 사용자 답변 |
| [conversations/2026-10-21-005.md](./conversations/2026-10-21-005.md) | 시간 추정의 근거 질문과 미검증 추정의 한계 정정 |
| [conversations/2026-10-21-006.md](./conversations/2026-10-21-006.md) | 사용자 추가 기능 채택과 보안·전송·검사·DB 상태 후보 제안 |
| [conversations/2026-10-21-007.md](./conversations/2026-10-21-007.md) | AI 기능 승인·범위 제한, 직관성 판단과 정책 경쟁·실패·무료량 검토 |
| [conversations/2026-10-21-008.md](./conversations/2026-10-21-008.md) | SQLite/D1 선택 이유와 MySQL·PostgreSQL 대안 비교 |
| [conversations/2026-10-21-009.md](./conversations/2026-10-21-009.md) | 단순한 기술 구성 선택, 계획·설계 갱신과 UI/UX 설계 |
| [conversations/2026-10-21-010.md](./conversations/2026-10-21-010.md) | 오늘 설계 마무리, 루트 문서 작성과 명시적으로 승인한 커밋·푸시 |
| [conversations/2026-10-22-001.md](./conversations/2026-10-22-001.md) | 구현 전 개발 의존성 설치·기존 버전 재사용과 환경 검증 |
| [conversations/2026-10-22-002.md](./conversations/2026-10-22-002.md) | 필요한 프로젝트 스킬·하네스 작성과 출처·선정 이유 |
| [conversations/2026-10-22-003.md](./conversations/2026-10-22-003.md) | 단계별 TDD 계획·핵심 테스트·루프 기록 방식과 구현 승인 대기 |
| [conversations/2026-10-22-004.md](./conversations/2026-10-22-004.md) | Cloudflare 실제 장애·한도 응답 모방 제외와 앱 예산 검증의 구분 |
| [conversations/2026-10-22-005.md](./conversations/2026-10-22-005.md) | 수정 계획 승인과 실제 S0~S8 구현·TDD 기록 |
| [conversations/2026-10-22-006.md](./conversations/2026-10-22-006.md) | Cloudflare 로그인 시작 요청 |
| [conversations/2026-10-22-007.md](./conversations/2026-10-22-007.md) | R2 사용자 활성화 후 배포 계속 |
| [conversations/2026-10-23-001.md](./conversations/2026-10-23-001.md) | 로컬 데브 우선·명시적 요청 시에만 배포, 기존 로컬 환경 확인 |
| [conversations/2026-10-23-007-session-implementation.md](./conversations/2026-10-23-007-session-implementation.md) | 익명 세션 쿠키+D1 최소 구현 승인·로컬 TDD 결과·배포 금지 |

## 범위 용어

- **필수 목표**는 과제가 반드시 구현하도록 요구하는 기능이다.
- **핵심 추가 기능**은 기술적 완성도·UX를 높이기 위해 수행자가 제시한 필수 목표 외의 구현 목표이다.
- 배포·검증·문서·대화 기록은 개발·제출 작업으로 별도 관리한다.
- P0/P1은 우선순위이며 필수/추가의 구분과 다르다. 상세 분류는 PLAN을 기준으로 한다.
- 핵심 추가 기능은 사용자/AI 제안의 출처를 보존하고 양쪽이 같은 범위를 합당하다고 판단한 뒤에만 최종 계획에 반영한다. 그 외 항목은 브레인스토밍 문서의 대안으로 관리한다.

## 현재 확인한 상태

- 작업 폴더: `D:\garage\file-uploader-demo`. 시작 시 `.docs/과제_파일업로드_AI개발.md`만 존재했다.
- 현재 Git 저장소이며 브랜치는 `main`, origin은 `https://github.com/Meggigoatee/file-uploader-demo.git`이다. 2026-10-21 후속 요청에서 원격 등록과 푸시를 명시적으로 승인받았고, 초기 조회 시 로컬·원격 모두 커밋이 없었다.
- 로컬 Node.js `v24.16.0`과 pnpm `11.5.1`을 기존 설치 그대로 사용한다. PC 계정의 pnpm 스토어는 `D:\.pnpm-store\v11`이다.
- 최소 패키지 설정·lockfile을 작성하고 의존성 13개를 직접 등록했다. 캐시 버전을 재사용하고 누락 패키지만 다운로드했다. Playwright Chromium 설치, 도구 CLI, 메모리 내 Vue 빌드·임시 로컬 Workers/D1/R2·브라우저 기동을 확인했다.
- 앱·테스트·설정·실제 SQL을 작성했고 로컬 D1/R2/Chromium에서 회귀를 수행했다. 상세 증거는 VALIDATION/TDD_LOG에 있다.
- 정책 관리·실제 단건 저장·대기 목록·다중 UX·수동 재시도에 이어 세션별 카테고리 필터·일괄 변경·사용자 카테고리·공통 팝업/체크박스 조작을 로컬 구현했다. 최신 전체 회귀는 단위42/Worker39/E2E22=103개·타입/빌드 통과다. 현재 카테고리 변경은 배포하지 않았다.
- 사용자 로그인/R2 활성화 후 프로젝트 전용 D1/R2를 생성하고 실제 배포했다. 공개 브라우저 1개와 원격 R2 바이트/DB를 확인했다. 후속 UI-R01 기준 로컬 단위42·Worker22·E2E13 및 타입/빌드가 최종 통과했다.

## 로컬 실행

2026-10-23 사용자 지시에 따라 기능 개발·검증은 이 로컬 환경을 우선 사용한다. Cloudflare 배포는 이후 사용자의 명시적 배포 요청이 있을 때만 수행한다. 필요한 로컬 의존성 설치·설정은 진행하되 기존 버전과 PC 전역 pnpm 스토어를 유지한다.

최신 화면은 업로드 위/정책 아래의 한 열이다. 추가와 등록 확인은 독립 입력이며, 각 대기 파일의 ‘업로드’로 한 파일만 전송할 수 있다. 사전 차단/진행/완료는 업로드 비활성이고 실패는 수동 재시도한다. 완료 목록의 자동/일괄 정리는 아직 의견 단계다. 최신 SESSION-01은 익명 쿠키별 정책을 적용하며 로컬85개가 통과했다. 새 세션은 fixed7 unchecked/custom0이며 새로고침은 유지된다. 쿠키를 차단하면 편집/업로드를 중단한다. 같은 브라우저 탭은 공유하고 서버의 세션 DB 자동 정리는 하지 않는다.

기존 Node 24.16.0 / pnpm 11.5.1과 PC 전역 스토어를 사용했다. 처음 받은 체크아웃에서는 다음 순서로 실행한다. 전역 도구를 업데이트하거나 저장소 전용 pnpm 스토어를 만들지 않는다.

```powershell
pnpm install --frozen-lockfile
pnpm run db:local
pnpm run dev
```

Vite가 표시하는 로컬 URL을 연다. 기본은 `http://127.0.0.1:5173`이다. Vite의 `remoteBindings: false`로 원격 바인딩을 비활성화하며 로컬 Worker와 D1/R2를 사용한다. 개발 상태는 `.wrangler/state/v3`에 보존되며 Git에서 제외한다. `db:local`의 seed는 기존 정책/누적 예산 값을 덮어쓰지 않는다. Cloudflare 로그인·API 토큰·추가 환경 변수 파일 없이 로컬 실행할 수 있다. 상세 구성은 [DEVELOPMENT](./DEVELOPMENT.md#로컬-데브-운영)를 따른다.

```powershell
pnpm run typecheck
pnpm run build
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm run check
```

`check`는 타입 → 빌드 → 단위 → Worker 통합 → E2E를 실행하고 `.docs/verification/runs/CHECK-.../report.json`에 결과를 남긴다. 통합 검사는 `cloudflare:test.reset()`으로 격리된 실제 바인딩을 사용한다. E2E는 `.wrangler/e2e` 전용 상태에 migration을 적용하고 4173 포트의 서버를 실행/종료한다. 해당 테스트 데이터만 초기화하며 일반 개발/원격 DB를 건드리지 않는다. Chromium이 없는 다른 PC에서는 `pnpm exec playwright install chromium`이 필요하다. 검증용 잘못된 데이터를 공개 데모에 넣지 않는다.

## 코드와 스키마

- `src/App.vue`, `src/policies.ts`: 정책 화면과 확정/불확실 상태. `src/UploadPanel.vue`, `src/queue.ts`, `src/upload.ts`: 목록·순차 전송·실제 XHR 진행률과 저장 응답 구분.
- `shared/rules.ts`: 원문/정규화·파일명·차단 토큰·제한 상수. 서버가 독립적으로 다시 검사한다.
- `server/index.ts`, `http.ts`, `policies.ts`, `uploads.ts`: 표준 Workers API. 작은 함수 외 ORM/Service/Repository/DI는 없다.
- [이전 정책 migration](../migrations/0001_initial.sql): 이전 데이터 보존. [예산 migration](../migrations/0002_budget.sql): singleton 누적 예약. [세션 migration](../migrations/0003_sessions.sql): 세션/세션별 정책·복합 PK/FK/CHECK. 실제 SQL과 DESIGN을 함께 참조한다.
- 파일은 `uploads/<UUID>` 비공개 키와 `application/octet-stream`으로 저장한다. 공개 URL/다운로드 API는 없다. 요청/원본 파일명을 앱 로그에 남기지 않는다.

## 원격 배포

이 절은 명시적 배포 요청을 받은 경우의 절차다. 기능 개발이나 로컬 환경 준비 요청만으로 실행하지 않는다.

배포 URL은 `https://file-uploader-demo.meggigoatee.workers.dev`, 최신 UI-R01 배포 버전은 `1b382c8c-43b4-40a6-be43-560479d442f9`이다. 이전 S8 배포 기록은 VALIDATION에 보존한다. 전용 D1 `file-uploader-demo`와 비공개 R2 `file-uploader-demo`가 연결되어 있다. 버킷 r2.dev 공개 접근은 꺼져 있다. 원격 39바이트 테스트 객체를 읽어 원본과 비교한 뒤 삭제했다. 정책은 이전 값으로 복구했고 누적 예산 39바이트/1회는 환급하지 않았다.

아래는 처음 배포하는 계정에서의 절차다. 현재 계정에는 이미 리소스가 생성되어 있어 재배포 시 migration/build/deploy 단계만 사용한다. 새 계정이면 D1 생성 결과를 `wrangler.jsonc`에 반영한다. 구독 checkout은 사용자가 직접 수행하며 계정 전체 무료 사용을 보장하지 않는다.

```powershell
pnpm exec wrangler login
pnpm exec wrangler d1 create file-uploader-demo
pnpm exec wrangler r2 bucket create file-uploader-demo
# 생성 결과를 wrangler.jsonc에 반영한 뒤 실행
pnpm exec wrangler d1 migrations apply file-uploader-demo --remote
pnpm run build
pnpm exec wrangler deploy --config dist/file_uploader_demo/wrangler.json
```

실제 수행 결과는 VALIDATION의 S8 증거를 따른다. 원격 smoke 재실행은 `pnpm exec playwright test --config playwright.remote.config.ts`다. 이 검사는 실제 파일 하나를 저장하고 자체 정책 변경을 복구한다. R2 파일 정리와 실제 바이트 비교는 별도 CLI로 확인했다. Workers 밖의 실제 장애/계정 한도 응답은 모방·검증하지 않는다.

## 이후 기록 원칙

1. 이 프로젝트의 계획·설계·검증 증거·AI 활용 기록은 모두 `.docs` 아래에 둔다. 사용자가 요청한 루트 README/AGENTS는 프로젝트 진입점·작업 지침으로 둔다.
2. 사용자 메시지마다 `.docs/conversations/YYYY-MM-DD-NNN.md`를 하나씩 생성한다. 같은 사용자 요청에 대한 중간 응답과 최종 응답은 그 파일에 함께 기록한다. 날짜와 시간은 한국 시간으로 쓴다.
3. 사용자 입력 원문, AI의 사용자에게 보이는 응답, 도구 작업의 목적·결과, 결정의 이유를 기록한다. 비공개 내부 추론은 기록하지 않는다. 비밀값은 원문 대신 `[REDACTED]`로 표시한다.
4. `PROMPT_LOG.md`에는 대화 파일 링크와 함께 의도·결과·재질문·도구 사용·사용자 판단을 요약한다. 사용자가 아직 검토하지 않은 AI 제안을 사용자 승인으로 기록하지 않는다.
5. 구현 단계에서는 실제 변경에 맞춰 설계와 고려사항을 갱신한다. 테스트는 명령·환경·결과·증거를 기록하며 미실행을 통과로 표시하지 않는다.
6. 원본 과제가 요구하는 실행 README는 구현 후 `.docs/README.md`에 실제 확인한 실행·배포·제출 안내를 추가해 충족한다. 루트 README는 GitHub 첫 화면의 소개·문서 참조점으로 사용하고 상세 안내를 연결한다.

의존성 설치·환경 검증 결과는 [DEVELOPMENT.md](./DEVELOPMENT.md)와 [VALIDATION.md](./VALIDATION.md)에 있다. 다음 작업의 출발점은 [구현 전 준비사항](./PLAN.md#구현-전-준비사항)의 남은 항목이다.
