# 프로젝트 스킬 선정과 로컬 하네스

기준일: 2026-10-22 (Asia/Seoul). 사용자 요청에 따라 프로젝트 스킬 두 개와 기존 CLI를 연결하는 하네스를 작성했다. 새 앱 기능·앱 설정·테스트 시나리오를 구현하는 작업과 구분한다. 의존성 버전과 pnpm 전역 스토어는 [DEVELOPMENT](./DEVELOPMENT.md)를 유지한다.

## 선정 기준

명령 한 번으로 끝나는 일은 CLI로 처리한다. 스킬은 명령 실행만으로 보장되지 않는 프로젝트 고유의 판단·검증 절차에 사용한다. 이 프로젝트에서는 실제 DB/파일 저장 증거와 화면의 완료/실패 의미를 놓치지 않는 일이 해당한다.

하네스는 기존 Codex 실행 환경에서 **AGENTS의 작업 범위 → 필요한 스킬만 읽기 → 로컬 CLI 실행 → 결과·증거 기록**을 연결하는 구성을 뜻한다. 별도 에이전트 SDK·서버·MCP·작업 스케줄러는 필요하지 않다.

## 선정한 프로젝트 스킬과 출처

두 스킬 모두 이 저장소에서 직접 작성했다. 외부 기술별 스킬 묶음을 다운로드하거나 복제한 산출물이 아니다. 프로젝트 전체에 적용되는 AGENTS와 세부 문서를 중복 복사하지 않고 필요한 절을 연결한다.

| 스킬 | 최초 출처·근거 | 선정 이유와 적용 시점 |
| --- | --- | --- |
| [uploader-worker-checks](../.agents/skills/uploader-worker-checks/SKILL.md) | 자체 작성. [DESIGN](./DESIGN.md), [DECISIONS](./DECISIONS.md), [VALIDATION](./VALIDATION.md) 및 [Cloudflare Vitest 공식 문서](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/) | 정책 API·업로드·예산 로직 변경 시 실제 D1/R2, 같은 DB에 대한 동시 요청, T 전후 변경, 실패/응답 유실 증거를 연결한다. Vitest를 실행했다는 사실만으로 충족되지 않는 검증이다. |
| [uploader-ui-checks](../.agents/skills/uploader-ui-checks/SKILL.md) | 자체 작성. [UI_UX](./UI_UX.md), DECISIONS/VALIDATION 및 [Playwright CLI](https://playwright.dev/docs/test-cli), [assertions](https://playwright.dev/docs/test-assertions) 공식 문서 | 대기 목록·진행률·정책 편집·재시도 동작 변경 시 화면과 서버 결과가 일치하는지 검증한다. 전송 100%, 저장 성공, 완료 확인 실패를 구분하는 프로젝트의 상태 의미가 핵심이다. |

자동 선택이 가능한 저장소 범위 `.agents/skills/<이름>/SKILL.md`에 작성했다. 일반 기술 키워드만으로 적용되지 않도록 description에 구체적 동작과 제외 조건을 적었다. 공식 OpenAI 문서는 저장소의 `.agents/skills` 탐색과 필요한 스킬만 읽는 방식을 설명한다. [Build skills](https://learn.chatgpt.com/docs/build-skills), [스킬 범위 지침](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

`$uploader-worker-checks`, `$uploader-ui-checks`로 명시적으로 사용할 수도 있다. 2026-10-22 승인 후 실제 앱 구현/검증에 두 스킬을 적용했다. 실제 D1/R2·동일 DB 경쟁·T·응답 유실/진행률 검사를 수행했다. 스킬 자동 선택의 일반 성능 평가와는 구분한다. 상세 선정 기록은 여기, 실행 진입 파일은 표준 탐색 위치에 둔다.

## 이번 작성에 사용한 기존 스킬

| 기존 스킬·출처 | 사용 목적 | 프로젝트 작업에서의 적용 범위 |
| --- | --- | --- |
| [skill-creator](C:/Users/inhea/.codex/skills/.system/skill-creator/SKILL.md) — OpenAI 번들 시스템 스킬 | 간결한 진입 조건·필요한 참조·수행 범위로 프로젝트 스킬 작성 | 스킬 작성/수정 요청에 사용. 앱 구현마다 불러오는 기술 스킬이 아니다. |
| [openai-docs](C:/Users/inhea/.codex/skills/.system/openai-docs/SKILL.md) — OpenAI 번들 시스템 스킬 | 공식 OpenAI 문서로 저장소 스킬의 탐색 위치·적용 방식 확인 | Codex/스킬 설정 질문에 사용. Vue/Cloudflare의 일반 작업에는 적용하지 않는다. |

기존 시스템 스킬의 설치나 전역 설정 변경은 수행하지 않았다. 프로젝트 전용 스킬은 기능 판단에 필요한 두 개만 둔다.

## 별도 기술 스킬을 선정하지 않은 항목

| 기술·작업 | 대체 수단 | 별도 스킬이 불필요한 이유 |
| --- | --- | --- |
| Node.js·pnpm 설치 상태·캐시·버전 확인 | `node --version`, `pnpm --version`, `pnpm store path`, `pnpm list` | 상태 조회와 고정 설치는 CLI로 충분하다. |
| Vue·TypeScript·Vite 일반 개발·타입 검사·번들 | 기존 Composition API와 설계 문서, `vue-tsc`, `vite` | 작은 단일 화면에 범용 프레임워크 가이드를 별도 상시 주입할 필요가 없다. UI 상태 검증이 필요할 때만 선정한 UI 스킬을 사용한다. |
| Wrangler의 타입 생성·로컬 리소스 명령 | `pnpm exec wrangler ...` | CLI 사용 자체에 Cloudflare 전 제품 스킬이 필요하지 않다. 정책/저장 정합성을 바꿀 때만 Worker 스킬을 사용한다. 원격 생성·배포는 해당 요청 범위를 따르며 이번에는 실행하지 않았다. |
| Vitest 일반 단위 테스트·단건 실행 | `pnpm exec vitest run ...` | 명령 실행법을 스킬로 포장하지 않는다. 실제 바인딩·동시성 검증이 필요한 부분만 Worker 스킬에 둔다. |
| Playwright 단건 실행·trace 확인 | `pnpm exec playwright test ...`, `pnpm exec playwright show-trace ...` | 일반 실행·리포트 조회는 CLI로 충분하다. 업로드 상태 의미를 검증할 때만 UI 스킬을 사용한다. |
| D1 SQL·R2 기본 조작 | 바인딩 API·Wrangler·설치된 타입 정의 | ORM·AWS SDK·각 제품 전용 스킬을 추가할 요구가 없다. |

## 하네스 파일과 실행

- [AGENTS](../AGENTS.md): 스킬 선택 기준과 작업 범위.
- [check.mjs](./harness/check.mjs): Node 내장 기능만 사용하는 CLI 실행기. 명령을 문자열 셸로 조합하지 않고 현재 pnpm CLI/Node를 인수 배열로 호출한다.
- [check-environment.mjs](./verification/check-environment.mjs): 기존 환경 스모크를 재사용한다. 출력 경로를 인수로 받아 실행별 JSON을 남기며 과거 기준 증거를 덮어쓰지 않는다.
- package.json의 세 실행 명령만 추가했다. 의존성과 lockfile은 변경하지 않았다.

| 명령 | 동작 | 현재 확인 결과 |
| --- | --- | --- |
| `pnpm run check:plan` | 실행 모드와 앱 검사에 필요한 스크립트의 준비 상태 조회 | 종료 0. 앱 검사 5개가 아직 없음을 표시 |
| `pnpm run check:env` | 패키지 버전·플러그인 import·Vue 메모리 빌드·임시 로컬 Workers/D1/R2·Chromium 확인 | 종료 0. 현재 전역 storeDir와 기존 패키지 버전 확인 |
| `pnpm run check` | 앱 검사 5개를 준비 상태 확인 후 순차 실행 | 실제 앱 검사 전부 종료 0. TDD_LOG/VALIDATION에 실행별 report 연결 |

앱 구현 단계에서 `typecheck`, `build`, `test:unit`, `test:integration`, `test:e2e`를 실제 검사 명령으로 구성하면 이 순서로 호출한다. 이번에 빈 검사 스크립트나 앱 테스트 설정을 미리 만들지 않았다. 아직 이 순차 실행을 실제 앱으로 검증하지 않았다.

하네스는 실행별 `.docs/verification/runs/CHECK-<UTC시각>-<고유값>/report.json`과 단계 출력 파일을 저장한다. JSON 시각은 UTC ISO 8601이며 검증 원장에는 KST로 환산해 기록한다. 종료 코드는 `0=수행한 모드 통과`, `1=실행 실패`, `2=인수 오류/준비 부재`다. 첫 실패에서 중단하고 자동 재시도·설치·버전 갱신을 하지 않는다. 자식 명령은 120초 제한으로 실행한다. 로그 버퍼 상한은 10 MiB다.

단건 점검은 각 CLI를 직접 실행한다. 문서/스타일 수정 때 모든 앱 검사를 강제하는 장치는 추가하지 않았다. 빈 테스트를 통과시키는 Vitest/Playwright 옵션도 하네스에서 추가하지 않는다.

## TDD 계획과의 연결

승인된 [TDD_PLAN](./TDD_PLAN.md)에 따라 개별 Red/Green은 필요한 CLI로 실행하고, 리팩토링 후 현재 기능의 누적 회귀를 확인했다. `e2e.mjs`는 전용 로컬 fixture migration과 Playwright를 실행한다. 원격 smoke는 별도 `playwright.remote.config.ts`로 실행해 대량 로컬 테스트가 공개 DB에 닿지 않게 했다.

하네스의 stdout/종료 코드·JSON은 실행 증거이며 실패 원인·TC/V 대응·리팩토링·회귀 판단은 [TDD_LOG](./TDD_LOG.md)에 남긴다. 모든 계층이 준비된 뒤 `check`를 단계 종료에 연결하며 같은 코드에서 이미 수행한 전체 검사는 중복 실행하지 않는다. 이번 계획 작업에서는 실행기나 앱 스크립트를 변경하지 않았다.

## 실제 확인과 한계

- 21:16 KST: 계획 조회 종료 0, 앱 구성 부재는 종료 2, 잘못된 인수도 종료 2. 앱 구성 부재에서 하위 검사는 실행되지 않았다. [앱 미준비 결과](./verification/runs/CHECK-2026-10-22T12-16-15-043Z-a8ec1695/report.json).
- 21:17 KST: `pnpm run check:env` 종료 0. Vue/로컬 Workers·D1·R2/Chromium 확인과 실행별 증거 연결 성공. [하네스 결과](./verification/runs/CHECK-2026-10-22T12-16-58-955Z-87aea6fd/report.json), [환경 결과](./verification/runs/CHECK-2026-10-22T12-16-58-955Z-87aea6fd/environment.json).
- 21:20 KST: 임시 디렉터리의 대역 pnpm CLI로 5단계 순차 실행(종료 0)과 세 번째 단계 실패 시 나머지 미실행(자식 종료 7 → 하네스 종료 1)을 확인했다. [제어 흐름 결과](./verification/HARNESS-20261022-runner-control.json). 실제 앱 테스트 결과가 아니다. 임시 디렉터리는 생성한 OS 임시 경로 내부인지 확인 후 정리했다.
- 스킬 검증용 번들 `quick_validate.py`를 실행하려 했으나 시스템/번들 Python 모두 PyYAML이 없어 실행되지 않았다. 추가 패키지 설치 없이 작성한 두 단순 frontmatter의 필드·이름·설명을 별도 검사했다. [제한된 구조 검사 결과](./verification/HARNESS-20261022-skills.json). 참조 링크도 문서 검사에서 확인한다. 범용 YAML 검증기 통과나 실제 에이전트 행동 평가로 표현하지 않는다.
- 앱 typecheck/build·단위/통합/E2E·원격 Cloudflare·배포는 미실행이다. 하네스의 환경 성공과 구분한다. 명령·환경·검증 증거는 [VALIDATION](./VALIDATION.md)에 기록한다.

### 2026-10-22 실제 앱 실행 후 갱신

기존 준비 당시의 blocked/미실행 기록은 역사로 유지한다. 사용자 승인 후 실제 앱에 두 스킬을 적용했고, 타입/빌드·단위42·Worker22·로컬 E2E11·원격1을 통과했다. `check.mjs`의 경로 검사를 pnpm 11의 pnpm.mjs에도 맞췄다. `e2e.mjs`는 전용 fixture migration/Playwright를 인수 배열로 실행한다. `tests/e2e/proxy.ts`는 실제 HTTP 전송·Worker 저장을 유지한 채 응답 전달만 제어한다. 일반 서비스 프레임워크나 제품 debug API는 추가하지 않았다. 최종 report/실제 실패는 VALIDATION/TDD_LOG를 따른다.
