# 개발 환경과 의존성

최신 확인일: 2026-10-23 (Asia/Seoul). 기능 개발·검증은 **로컬 데브 우선**, Cloudflare 배포는 **이후 사용자의 명시적 요청 시에만** 수행한다. 아래 의존성 설치·초기 환경 스모크는 2026-10-22 준비 당시 기록이며, 이후 앱 구현·검증·배포 결과는 [VALIDATION](./VALIDATION.md)에 보존한다.

## 로컬 데브 운영

프로젝트 루트의 PowerShell에서 실행한다. 기존 의존성이 준비된 이 PC에서는 설치를 반복할 필요가 없다. 새 체크아웃 또는 의존성 누락 시 고정 lockfile로 설치한다.

```powershell
pnpm install --frozen-lockfile
pnpm run db:local
pnpm run dev
```

- 기본 URL은 `http://127.0.0.1:5173`이며 Vite가 출력한 실제 주소를 확인한다. 프런트엔드와 Worker API를 같은 서버에서 실행한다.
- Vite Cloudflare 플러그인의 `remoteBindings: false`로 원격 바인딩 연결을 비활성화했다. Worker 실행과 D1/R2 저장은 로컬에서 처리한다. Cloudflare 로그인·API 토큰·추가 `.env`/`.dev.vars`는 필요하지 않다.
- `db:local`은 `--local`로 migration을 적용한다. 개발 상태는 `.wrangler/state/v3`, E2E 상태는 `.wrangler/e2e/v3`에 분리해 보존하며 Git에서 제외한다. seed는 기존 정책·누적 예산을 덮어쓰지 않는다.
- 필요한 Vue/Vite/Workers/D1/R2 개발 도구와 Chromium은 이미 설치되어 있다. D1/R2용 별도 서버·Docker·DB 드라이버를 추가하지 않는다. Chromium이 없는 PC에서 E2E를 실행하려면 `pnpm exec playwright install chromium`을 사용한다.
- 로컬 검증 결과와 배포 여부를 구분해 기록한다. 원격 migration·리소스 생성·배포·원격 smoke는 로컬 준비 명령에 포함하지 않는다. 이번 확인 결과는 [LOCAL-20261023](./VALIDATION.md#local-20261023--로컬-데브-준비)에 기록한다.

## 기존 환경과 스토어

- Windows x64, 기존 Node.js `v24.16.0`, pnpm `11.5.1`을 유지했다. packageManager 필드도 같은 pnpm 버전으로 고정한다.
- PC 계정에서 확인한 기본 공유 스토어는 `D:\.pnpm-store\v11`. 설치 후 `node_modules/.modules.yaml`의 storeDir도 같은 값이다. 프로젝트 내부 `.pnpm-store`는 없다.
- 저장소에 기존 package.json/lockfile/node_modules는 없었다. 전역 스토어를 읽기 전용으로 조회해 아래 캐시 버전을 재사용했다. Vue 캐시는 3.5.35/3.5.41, Node 타입 캐시는 22.20.1/25.9.1이 있었으며 각각 3.5.41/22.20.1을 선택했다. 기존 프로젝트 의존성을 업데이트한 것은 아니다.
- 저장소 설정에서 storeDir를 절대 경로로 강제하지 않는다. PC의 기본 전역 스토어를 그대로 사용하며 다른 PC에서도 해당 PC의 기본값을 따른다.
- Codex 기본 샌드박스는 별도 계정의 스토어를 반환하므로 설치·환경 기동 확인은 실제 PC 계정의 실행 환경에서 수행했다. 사용자 전역 pnpm 설정·PATH는 변경하지 않았다.

## 설치한 직접 의존성

| 분류 | 패키지 | 고정 버전 | 용도·선택 근거 |
| --- | --- | --- | --- |
| 런타임 | vue | 3.5.41 | Composition API 화면, 기존 캐시 재사용 |
| 개발 | typescript | 5.6.3 | UI/API 타입 검사, 기존 캐시 재사용 |
| 개발 | vite | 6.4.3 | 로컬 개발·번들, 기존 캐시 재사용 |
| 개발 | @vitejs/plugin-vue | 5.2.4 | Vue SFC 변환, 기존 Vite 6과 호환 |
| 개발 | vue-tsc | 2.2.12 | Vue SFC 타입 검사, 기존 캐시 재사용 |
| 개발 | @types/node | 22.20.1 | Node 도구 설정 타입, 기존 지원 버전 재사용 |
| 개발 | wrangler | 4.127.1 | Worker CLI·로컬 리소스·향후 배포, 기존 캐시 재사용 |
| 개발 | @cloudflare/vite-plugin | 1.54.2 | Vue/Vite와 Workers 연동, 기존 Wrangler와 동일 버전 의존 |
| 개발 | vitest | 4.1.10 | 순수 규칙·통합 검증 러너, 기존 캐시 재사용 |
| 개발 | @cloudflare/vitest-plugin | 1.1.2 | Workers/D1/R2 통합 검증, 기존 Wrangler·Vitest와 호환 |
| 개발 | @vitest/runner | 4.1.10 | Cloudflare 테스트 플러그인의 필수 peer, Vitest 버전과 일치 |
| 개발 | @vitest/snapshot | 4.1.10 | 같은 플러그인의 필수 peer, Vitest 버전과 일치 |
| 개발 | @playwright/test | 1.64.1 | 핵심 사용자 흐름 E2E, 기존 캐시가 없어 신규 설치 |

직접 의존성은 정확한 버전으로, 전이 의존성은 pnpm-lock.yaml로 고정한다. 설치 로그의 재사용 107개/다운로드 16개는 pnpm 진행 통계이며 직접 의존성 수 13개와 구분한다. 실제 연결된 패키지 수는 설치 로그에서 120개로 표시됐다.

최신 Cloudflare Vite 플러그인은 더 높은 Wrangler peer 버전이 필요해 선택하지 않았다. 선택한 두 Cloudflare 플러그인은 Wrangler 4.127.1, workerd 1.20260828.1, Miniflare 5.20260828.0-alpha를 공유한다. Miniflare 버전은 기존 Wrangler의 전이 의존성이다. 임의로 런타임을 교체하거나 peer 충돌을 무시하지 않았다. 환경 스모크의 compatibility date는 설치된 런타임에 맞춘 `2026-08-28`이다.

`pnpm-workspace.yaml`은 단일 루트 패키지의 설정만 담당한다. 정확한 버전 저장, 캐시 우선 사용, 엄격한 peer 검사를 설정했다. 바이너리 준비에 필요한 esbuild/workerd/sharp의 설치 스크립트만 명시적으로 허용한다. 앱의 dev/build/test 스크립트는 앱 구성 후 추가한다. 후속 요청으로 선정한 스킬과 `check:plan`/`check:env`/`check` 진입점은 [HARNESS](./HARNESS.md)를 따른다.

D1/R2는 Workers 바인딩으로 접근하므로 별도 DB 드라이버·ORM·AWS SDK를 설치하지 않는다. Workers/바인딩 타입은 향후 실제 Wrangler 설정 후 `wrangler types`로 생성한다. 다중 선택·드롭·업로드 진행률에는 브라우저 표준 API를 사용할 계획이다. 별도 업로드 라이브러리·라우터·상태관리·UI 프레임워크는 추가하지 않았다.

## 확인한 설치·환경 명령

프로젝트 루트의 PowerShell에서 실행한다. packageManager에 지정된 기존 pnpm을 사용한다.

```powershell
pnpm store path
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm run check:env
```

이 PC에서는 최초 `pnpm install --reporter=append-only`로 설치했고, `pnpm install --frozen-lockfile --offline --reporter=append-only`로 네트워크 없는 재설치와 lockfile SHA-256 불변을 확인했다. 위 일반 frozen 명령은 같은 고정 설치의 재현 방법이다. 다른 PC의 첫 설치에는 인터넷 연결이 필요하다.

Playwright Chromium/Headless Shell 156.0.8078.4와 필요한 FFmpeg/Winldd가 `C:\Users\inhea\AppData\Local\ms-playwright` 아래 공용 캐시에 설치됐다. Firefox/WebKit은 이번 준비 범위에서 설치하지 않았다.

환경 스모크 스크립트는 하네스에서 실행별 결과 파일 경로를 전달받는다. 직접 실행할 때도 시각별 파일로 저장해 과거 `ENV-20261022-smoke.json`을 보존한다. 실제 앱 없이 다음을 확인한다.

1. 직접 패키지 버전·Cloudflare 플러그인 import·실제 storeDir 확인.
2. 임시 가상 Vue SFC의 TypeScript 구문을 Vite/Vue 플러그인으로 메모리 내 빌드. 앱 타입 검사와 구분한다.
3. 임시 Miniflare/workerd에서 응답, D1 `SELECT 1`, R2 테스트 객체 저장·바이트 읽기·삭제. 원격 리소스·앱 스키마는 사용하지 않는다.
4. Chromium headless 기동과 메모리 내 문서 제목 확인. 브라우저는 종료한다.

별도로 Vite/tsc/vue-tsc/Vitest/Playwright/Wrangler CLI 버전 조회도 모두 성공했다. 앱 단위·통합·E2E 테스트, 앱 typecheck/build 통과를 뜻하지 않는다. 이 절은 환경 준비 당시 결과다. 이후 승인받아 앱을 구현하고 실제 결과를 VALIDATION에 기록했다.

## 결과와 남은 준비

설치·환경 스모크·frozen/offline 확인은 성공했다. 세 번의 초기 스모크 실패는 점검 스크립트의 가상 진입 경로·Vite 결과 배열·Miniflare 5 옵션 형식 오류였다. 설치 패키지 버전을 변경하지 않고 스크립트를 수정해 통과했다. 실패와 최종 결과를 모두 [검증 증거](./verification/)에 보존했다.

- [최종 스모크 결과](./verification/ENV-20261022-smoke.json), [설치 로그](./verification/ENV-20261022-install.txt), [브라우저 설치](./verification/ENV-20261022-browsers.txt), [lockfile 확인](./verification/ENV-20261022-lockfile.json).
- [VALIDATION.md](./VALIDATION.md)의 환경 원장과 앱 검증 계획은 구분한다.
- 환경 준비 당시 앱 구현/원격 작업은 하지 않았다. 후속 사용자 승인으로 앱 구현, Cloudflare 로그인·R2 활성화 확인·전용 리소스 생성·배포·원격 저장 검증을 완료했다. 성능 실측과 Git 커밋/푸시는 하지 않았다. 새 의존성 설치/버전 변경 없이 기존 구성으로 진행했다.

## 확인 자료

확인일: 2026-10-22. 실제 버전/peer/engines는 npm 공식 레지스트리의 해당 버전 메타데이터와 설치 lockfile로 확인했다.

- [Cloudflare Vue 가이드](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/) — Vue와 Worker의 Vite 연동.
- [Cloudflare Vitest 가이드](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/) — `@cloudflare/vitest-plugin` 명칭과 Vitest 4.1 이상 연동.
- [Vue TypeScript 가이드](https://vuejs.org/guide/typescript/overview.html) — Vite의 변환과 vue-tsc 타입 검사를 구분.
- [pnpm 설정](https://pnpm.io/settings), [빌드 설정](https://pnpm.io/settings/build) — pnpm-workspace.yaml 설정과 allowBuilds.
- [Playwright 브라우저](https://playwright.dev/docs/browsers) — Chromium과 Headless Shell 설치·기동 방식.
