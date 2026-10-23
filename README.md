# File Uploader Demo

확장자 차단 정책을 DB에 저장하고, 서버가 실제 파일 업로드에 해당 정책을 강제하는 과제입니다. Vue 화면과 Cloudflare Workers·D1·비공개 R2로 구성했으며 익명 세션별 정책/카테고리 관리까지 공개 배포했습니다.

- GitHub: [Meggigoatee/file-uploader-demo](https://github.com/Meggigoatee/file-uploader-demo)
- 배포 사이트: [File Uploader Demo](https://file-uploader-demo.meggigoatee.workers.dev)
- 제출 항목/준비 상태: [SUBMISSION.md](SUBMISSION.md)

## 제출 문서

| 문서/파일 | 내용 |
| --- | --- |
| [CONSIDERATIONS.md](CONSIDERATIONS.md) | 보안·정책/데이터·UX/예외·운영별 판단과 미구현 한계 |
| [PROMPT_LOG.md](PROMPT_LOG.md) | 시간순 입력 의도/재질문, 실제 스킬·플러그인·도구 사용, 채택/수정/폐기 회고 |
| [SCHEMA.md](SCHEMA.md), [schema.sql](schema.sql) | 테이블 컬럼/타입/제약/인덱스와 실제 migration 통합 SQL |
| [.docs/](.docs/) | 원본 과제·전체 설계/대화·실패/검증 원장과 실행 증거 |

## 로컬 실행

검증 환경은 Windows·Node.js24.16.0·pnpm11.5.1입니다. 의존성 버전은 package.json/lockfile로 고정했고 기존 PC 전역 pnpm 스토어를 유지했습니다.

```powershell
git clone https://github.com/Meggigoatee/file-uploader-demo.git
cd file-uploader-demo
pnpm install --frozen-lockfile
pnpm run db:local
pnpm run dev
```

기본 주소는 `http://127.0.0.1:5173`이며 Vite가 표시한 실제 주소를 엽니다. 프런트와 API는 같은 로컬 서버에서 동작합니다. Cloudflare 로그인/토큰/추가 환경 변수 없이 로컬 Worker·D1·R2를 사용하며 `remoteBindings: false`로 원격 바인딩 연결을 비활성화했습니다. 로컬 데이터는 Git에서 제외된 `.wrangler/state/v3`에 보존합니다.

## 구현 기능

| 구분 | 구현한 동작 |
| --- | --- |
| 필수 정책 | 고정 `bat,cmd,com,cpl,exe,scr,js` 7개는 새 세션에서 체크 해제. 체크/해제 즉시 DB 저장·새로고침 유지. 고정은 custom 영역에서 제외 |
| 필수 custom | 원문 최대20자·정규화 중복 방지·최대200개. 추가 후 DB/목록 반영, ×로 삭제 |
| 필수 업로드 | 클라이언트와 별개로 서버가 파일/정책을 재검증. 차단 사유와 함께 거절하거나 실제 비공개 R2 저장 후 성공 응답 |
| 추가 UX | 다중 선택/드롭·최대10개 대기 목록·사전 검사/제외·파일별 전송률/결과·수동 재시도·등록 여부 확인·행별 업로드 |
| 세션 분리 | 로그인 없이 서버 발급 쿠키와 D1 행으로 분리. 같은 브라우저 프로필의 탭은 공유하고 새 세션만 초기값 생성 |
| 카테고리 | 기본4분류의 새 세션 소속 각5개, 기본/사용자 소속 편집·사용자 분류 생성/이름 변경/삭제·조회 필터·개별/전체 차단/허용 |

카테고리에서 **소속 제외는 차단 유지**, 카테고리 **자체 삭제는 현재 소속 모두 허용**입니다. 같은 확장자의 여러 분류/수동 등록은 같은 현재 정책을 공유합니다. 분류별 별도 우선순위는 없습니다.

## 저장 흐름과 제한

`브라우저(Vue) → Worker API → 세션별 D1 정책 조회(T) → 앱 공통 예산 예약 → 비공개 R2 put → 저장 성공 응답`

- 요청당 파일1개, 파일1바이트~5MiB, 본문6MiB, 파일명 UTF-8 255바이트 이하입니다.
- 전송100%는 서버 확인 중입니다. 정상 저장 응답이 있어야 완료이며 응답 유실은 완료 확인 실패로 표시합니다.
- 자동 재시도·상태 조회·멱등 키는 없습니다. 수동 재시도는 중복 저장과 추가 예산 소비가 생길 수 있습니다.
- 확장자 정책이며 내용/시그니처·악성코드 검사는 구현하지 않았습니다. 기본 고정 정책도 체크 전에는 숨은 차단을 하지 않습니다.
- 파일은 `uploads/<UUID>`/`application/octet-stream`으로 저장합니다. 공개 다운로드·미리보기·보관함은 없습니다.
- 앱 공통 누적256MiB/500회 예약 예산을 쓰며 실패/객체 정리/새 세션으로 환급하거나 초기화하지 않습니다. 계정 전체 무료 사용·가용성 보장은 아닙니다.
- 서버 세션 TTL/자동 정리·발급 제한·로그인/감사 이력은 미구현입니다.

20자/200개는 원본 필수 조건입니다. 그 외 제한과 포함/제외 근거는 [고려사항](CONSIDERATIONS.md)에 구분했습니다.

## 테스트와 검증 결과

처음 E2E를 실행하는 PC에서 Chromium이 없다면 설치한 뒤 전체 검사를 실행합니다.

```powershell
pnpm exec playwright install chromium
pnpm run check
```

`check`는 타입 검사→빌드→단위→실제 로컬 Worker 통합→Chromium E2E를 실행합니다. E2E는 `.wrangler/e2e` 전용 DB/R2와4173 서버를 사용하며 일반 개발/운영 데이터와 분리합니다.

| 검증 | 최신 완료 결과 |
| --- | --- |
| 로컬 전체 | 단위65·Worker57·E2E29=151개, 타입/빌드 성공 |
| 배포 환경 | 활성100% 버전·바인딩·D1 migration/FK/불변식·비공개R2·HTTPS/JS/CSS 바이트 일치 |
| 운영 기능 | 두 세션의 분리·새로고침·카테고리/정책 CRUD·차단/허용 통과 |
| 실제 운영 저장 | 28바이트 파일2개, 원격R2 바이트/SHA-256 일치. 소유 객체/세션 정리·예산 환급 없음 |

운영에서는 환경 확인이 통과한 뒤만 기능 테스트를 실행했고 부하/대량 업로드는 하지 않았습니다. 원격 시나리오는 로컬 전체 검사와 별도입니다. 이 문서 준비 중 앱 테스트나 업로드를 다시 실행한 것은 아닙니다.

[최종 로컬 report](.docs/verification/runs/CHECK-2026-10-23T12-35-39-480Z-ce4bb88e/report.json) · [구현/테스트 대응표](.docs/FINAL_LOCAL_REVIEW.md) · [배포·운영/실패 분석](.docs/RELEASE_20261023.md) · [전체 검증 원장](.docs/VALIDATION.md)

배포 소스 커밋은 `b7d4112`, 결과 기록은 `fcb55a1`, 배포 버전은 `60a46602-a2c8-4117-b8a8-7921631517db`입니다. 배포 재현/원격 검증의 상세 명령은 [개발 문서](.docs/README.md#원격-배포)를 따릅니다. 기능 개발은 로컬 우선이며 새 배포는 명시적인 요청이 있을 때 수행합니다.

## 소스 구성

| 경로 | 역할 |
| --- | --- |
| `src/` | Vue 정책/카테고리/업로드 화면과 클라이언트 상태 |
| `shared/` | 고정 목록·입력/파일명 규칙·제한값·타입 |
| `server/` | 표준 Workers API·세션·정책·카테고리·예산/파일 저장 |
| `migrations/` | 실제 D1 스키마 변경1~5 |
| `tests/` | 단위·실제 로컬 D1/R2 통합·로컬 E2E·별도 원격 검증 |
| `.agents/skills/` | 자체 작성 Worker/UI 검증 스킬 |
| `.docs/` | 상세 설계·전체 AI 입력·TDD 실패/회귀·배포 증거 |

프런트는 Vue3.5.41/TypeScript5.6.3/Vite6.4.3, 로컬·배포는 Wrangler4.127.1, 검증은 Vitest4.1.10/Playwright1.64.1을 사용합니다. ORM·Express·라우터·전역 상태 라이브러리·별도 에이전트 SDK는 추가하지 않았습니다. [AI 활용/선택 이유](PROMPT_LOG.md), [정확한 의존성](package.json), [상세 환경](.docs/DEVELOPMENT.md)을 확인할 수 있습니다.

원본 요구사항은 [.docs/과제_파일업로드_AI개발.md](.docs/과제_파일업로드_AI개발.md)를 보존했습니다. 자동화 작업 지침은 [AGENTS.md](AGENTS.md), 상세 문서 탐색은 [.docs/README.md](.docs/README.md)를 따릅니다.
