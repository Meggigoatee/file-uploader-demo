# 최소 설계안

2026-10-23 RELEASE-20261023에서 세션/카테고리 코드를 공개 배포하고 환경·소규모 운영 검증을 완료했다. [배포/저장 증거](./RELEASE_20261023.md). 아래 과거 ‘미배포’ 판단은 해당 설계 당시의 상태다.

## CATEGORY-03 최신 카테고리 구성·API

기본/사용자 카테고리의 구성원을 모두 DB에서 읽는다. `0005_editable_builtin_categories.sql`은 custom_categories에 nullable `builtin_key`(photos/videos/audio/documents CHECK)와 UNIQUE(session_id,builtin_key) 인덱스를 추가한다. 기존 세션에 기본4분류/각5개 소속만 채우며 사용자 카테고리·차단 정책을 바꾸지 않는다. 신규 세션은 기존 세션/고정7개 초기화 batch에 기본 카테고리/소속도 포함한다. 수정한 구성원을 다음 GET/재초기화로 원래5개로 되돌리지 않는다.

기본의 내부 키는 session_id와 builtin_key를 조합하고 공개 API ID는 기존 photos/videos/audio/documents를 유지한다. 모든 카테고리 작업은 세션 조건으로 실제 내부 키를 조회한 뒤 실행한다. 전체 차단 SQL도 기본 사전 상수 대신 현재 DB 구성원을 읽어 전체에 적용한다. 기본 카테고리 이름/자체 삭제는 보호하고 구성원 편집은 허용한다.

| API 추가/수정 | 동작 |
| --- | --- |
| POST `/api/policies/categories` | `{name}`만으로 빈 카테고리 생성. 이전 `{name,extensions}`도 호환 |
| PUT `/api/policies/categories/:id` | `{name}`은 이름만 변경해 동시 구성원 편집을 덮어쓰지 않음. 이전 명시적 extensions 전체 교체도 호환 |
| POST `/api/policies/categories/:id/extensions` | `{extension}` 정규화/기존 문자·길이 검증. 단일 INSERT의 count<50·복합PK로 동일 카테고리 중복/경합 방지. 성공201·중복/상한409 |
| DELETE `/api/policies/categories/:id/extensions/:extension` | 해당 소속만 제거, 204. 현재 차단 정책은 유지 |

이름 변경/소속 편집은 정책 변경과 구분한다. 카테고리 자체 삭제의 ‘소속 모두 허용’ batch는 기존 기준을 유지한다. 개별 체크박스는 고정 PATCH 또는 custom POST/DELETE를 공통 경로로 사용하며 소속 목록을 삭제하지 않는다. 불확실한 저장은 UI/업로드 잠금과 수동 정책 재조회로 복구한다. 상세 테스트/실제 결과는 TDD_LOG/VALIDATION CATEGORY-03을 따른다. 아래 CATEGORY-01 설계의 UI/고정 사전 부분은 이 최신 설계로 대체한다.

## 2026-10-23 CATEGORY-01 카테고리 후속 설계

카테고리 필터·일괄 차단/허용·사용자 카테고리를 추가했다. 이전 S7 조건부 언급은 당시 범위이며, 로컬 검증 후 RELEASE-20261023에서 원격에도 배포했다.

- 기본 사전은 `shared/categories.ts`의 사진/영상/음성/문서 각5개다. 서버와 화면이 같은 사전을 사용하며 최초 정책에 자동 등록하지 않는다.
- `0004_categories.sql`: `custom_categories(id TEXT PK, session_id TEXT FK → anonymous_sessions ON DELETE CASCADE, name TEXT COLLATE NOCASE CHECK 길이1~30, UNIQUE(session_id,name))`, `category_extensions(category_id TEXT FK → custom_categories ON DELETE CASCADE, extension TEXT CHECK 기존 영문소문자·숫자1~20, PK(category_id,extension))`다. 이름 유일성 인덱스는 세션 조회를, 구성원 PK는 카테고리별 조회를 지원한다.
- 모든 카테고리 조회/변경은 기존 익명 쿠키의 session_id를 서버에서 확인한다. 다른 세션의 카테고리를 편집·삭제·일괄 변경할 수 없다. 차단 자체는 기존 `session_extension_policies`에 저장한다.

| API | 동작 |
| --- | --- |
| GET `/api/policies/categories` | `{categories: Category[]}` 기본4개+현재 세션 사용자 카테고리. Category는 id/name/extensions/builtin |
| POST `/api/policies/categories` | `{name,extensions}` 생성, 201. 빈 확장자 목록 허용 |
| PUT `/api/policies/categories/:id` | 이름·소속 확장자 전체 교체, 200. 생성/편집은 차단 상태를 자동 변경하지 않음 |
| PATCH `/api/policies/categories/:id/state` | `{blocked:boolean}` 전체 차단/허용, 200 `{changed:number}` |
| DELETE `/api/policies/categories/:id` | 소속 확장자 허용+카테고리 삭제를 한 batch로 처리, 204 |

기본 ID는 photos/videos/audio/documents다. 기본 이름/자체 삭제는 보호하고 구성원은 편집할 수 있다. 사용자 입력은 이름30자·구성원50개와 기존 확장자 원문20자 규칙을 적용한다. 추가 경계값은 AI의 작은 데모 설계다. 중복 이름/구성원409, 잘못된 입력400, 다른 세션/없는 카테고리404, 한도 초과409, 불확실한 저장소 결과503이다. 기존 JSON 본문4KiB·Origin 검사/no-store 계약을 유지한다.

차단은 소속 확장자를 mutation SQL 안에서 읽는다. 현재 custom 수+새 custom 수≤200일 때만 단일 INSERT/UPSERT로 고정 체크와 custom 등록을 전부 적용한다. 초과이면 어떤 행도 변경하지 않고 `CUSTOM_LIMIT_REACHED`409다. 같은 DB의 동시 일괄 요청도 이 조건을 통과해야 한다. 허용은 고정 체크 해제와 대상 custom 삭제를 D1 batch에 묶는다. 사용자 카테고리 삭제는 여기에 카테고리 삭제를 덧붙이며 FK로 구성원도 삭제한다. 편집도 이름 변경·이전 구성원 삭제·새 구성원 삽입을 batch로 묶는다.

카테고리 자체의 차단 boolean/우선순위/등록 출처를 저장하지 않는다. 화면은 현재 정책에서 N개 중 M개 차단을 계산한다. 수동 등록과 겹친 확장자도 같은 정책을 공유하므로 한 카테고리 허용/삭제는 다른 카테고리에 보이는 해당 확장자의 차단도 해제한다. 삭제/허용은 R2 파일 삭제나 누적 예산 환급이 아니다. 업로드 판정 T와 과거 성공 결과 유지 기준은 그대로다.

상태: 아래 설계를 기준으로 2026-10-22 핵심 기능을 구현·배포했다. 표는 설계 기준이고 실제 SQL은 migrations, 코드와 검증 결과는 README/VALIDATION을 따른다. 공개 URL·원격 D1/R2 연결과 작은 파일 바이트 일치를 확인했다. 운영 부하 성능·제공자 실제 장애/계정 한도 동작은 검증하지 않았다.

필수 목표 A/B, 사용자 추가 기능 및 AI-01/02/03/05/06/08의 반영 범위는 PLAN을 따른다. 정책 판정·보수적 실패 처리·한도 설계는 [DECISIONS.md](./DECISIONS.md)를 기준으로 한다. AI-07은 생략, AI-09는 보류한다. 미선택 K/AI 항목은 [브레인스토밍 문서](./FEATURE_BRAINSTORM.md)에 보관한다. 세부 설계값과 사용자 원문 승인은 구분한다. P0/P1은 우선순위만 뜻한다.

## 기술 구성

| 영역 | 선택한 기준안 | 이유 |
| --- | --- | --- |
| 화면 | Vue 3 Composition API, TypeScript, Vite | 사용자가 익숙한 기술로 단일 화면 구현 |
| API | TypeScript Cloudflare Worker, 표준 Request/Response | 화면과 같은 도메인에서 API 제공, 별도 서버 운영 제거 |
| 정책 DB | Cloudflare D1 (SQLite SQL semantics) | Workers 바인딩·관리형 운영, 작은 정책/예산 데이터와 짧은 원자적 쓰기. 선택 근거·한계는 DECISIONS 참고 |
| 파일 저장 | 비공개 Cloudflare R2 버킷 | Worker 로컬 파일시스템 대신 영속 객체 저장 |
| 로컬 개발 | Node.js/pnpm, Cloudflare Vite 플러그인/Wrangler | PC 전역 pnpm 스토어, Workers 런타임 및 로컬 D1/R2 사용 |
| 검증 | Vitest, Workers용 테스트 연동, Playwright | 순수 규칙·실제 바인딩 통합·사용자 흐름을 구분 |

Express.js는 사용자가 익숙하지만 이번 기본안에서는 제외한다. 표준 Worker API로 충분한 5개 엔드포인트에 Node 서버 호환 계층을 더할 실익이 작다. 새로운 프레임워크나 ORM도 도입하지 않는다. 2026-10-22 별도 요청으로 기존 캐시 버전과 호환성을 확인해 개발 의존성을 설치·고정했다. 설치 버전과 환경 검증은 [DEVELOPMENT.md](./DEVELOPMENT.md)에 기록한다. 앱 구성과 기능은 아직 구현하지 않았다.

공식 Vue 안내는 Vite 기반 Vue 정적 자산과 Worker 백엔드를 함께 다룬다. 로컬 D1/R2 모의 리소스를 사용할 수 있다. 이 지원 사실을 바탕으로 단일 배포 구성을 제안했다. [Vue 안내](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/), [로컬 바인딩 지원](https://developers.cloudflare.com/workers/local-development/bindings-per-env/).

## 구성과 책임

`브라우저(Vue) → 동일 출처 /api/* (Worker) → D1 정책 조회/변경 또는 R2 파일 저장`

- UI: 한 페이지의 정책 관리/업로드 두 영역. 정책 안에 고정 체크박스, 커스텀 입력/등록 확인·목록, 대표 분류 안내를 둔다. 업로드에는 다중 선택·드롭·대기 목록·파일별 진행/결과를 둔다. 좁은 화면은 세로 배치한다. [UI_UX.md](./UI_UX.md)의 필수/핵심/옵션 및 상태 설계를 따른다. 필요하면 정책/업로드 컴포넌트로만 분리한다.
- 공유 모듈: 고정 확장자·제한 상수, 입력/파일명 규칙과 타입. 서버는 공유 함수 사용 여부와 무관하게 모든 입력을 다시 검증한다.
- 서버: 정책 핸들러, 업로드 핸들러, 작은 응답/오류 헬퍼. DB 직접 prepared statement와 바인딩을 사용한다.
- `/api/*`는 Worker가 처리하고 알 수 없는 API 경로는 JSON 404를 반환한다. SPA fallback이 API 오류를 HTML 200으로 바꾸지 않도록 검증한다.
- 정책은 캐시하지 않는다. DB가 불가능하면 오래된 메모리 정책이나 빈 차단 목록으로 업로드를 계속하지 않는다.

## 확장자 입력 규칙

1. 문자열만 허용한다. 앞뒤 공백 제거 → 맨 앞 점 1개 제거 → ASCII 소문자로 변환한다.
2. 결과는 영문 소문자/숫자만 1~20자 허용한다. `. SH `는 `sh`, `PDF`는 `pdf`가 된다. `tar.gz`, `..sh`, 공백만 있는 값, 내부 공백·기호·유니코드는 거절한다.
3. 원본의 입력 최대 20자 조건에 맞춰 **원문도 최대 20자**, 정규화 결과도 1~20자로 검증한다. 점/공백이 포함된 21자를 정규화 후 짧아진다는 이유로 허용하지 않는다. 붙여넣기를 조용히 잘라 다른 값으로 등록하지 않는다. JSON 요청 본문도 4 KiB로 제한한다. 기존 정규화 값만의 길이 기준을 UI 설계 과정에서 이 기준으로 명확히 했다.
4. 정규화 값으로 중복을 판단한다. `.SH`와 `sh`는 동일하다. 고정 확장자는 체크 여부와 관계없이 커스텀으로 추가할 수 없다.
5. 커스텀은 등록되면 항상 차단된다. 최대 200개는 고정 7개를 제외한 수이다. 모두 해제된 초기 고정 정책을 임의로 활성화하지 않는다.

## 테이블 스키마

SESSION-01(2026-10-23)부터 정책 테이블은 `session_extension_policies`다. 세션마다 고정7개+커스텀 최대200개를 저장한다. 기존 `extension_policies`는 이전 migration/데이터 보존을 위해 남기며 제품 API에서 읽거나 쓰지 않는다. 기존 공유 정책의 체크 상태를 새 세션에 복사하지 않는다.

세션 테이블 `anonymous_sessions`: `id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=64)`는 서버 발급 256비트 토큰의 SHA-256 hex, `created_at TEXT NOT NULL`은 UTC 생성 시각이다. 쿠키 원문·계정·신원·서버 만료 컬럼은 저장하지 않는다.

| 컬럼 | SQLite 타입 | 제약/의미 |
| --- | --- | --- |
| `session_id` | TEXT | NOT NULL, anonymous_sessions(id) FK ON DELETE CASCADE. 세션 키 |
| `extension` | TEXT | NOT NULL. 소문자 ASCII 영숫자 1~20자. 점 제외. `(session_id, extension)` 복합 PRIMARY KEY로 같은 세션의 고정/커스텀 중복 불가 |
| `kind` | TEXT | NOT NULL, `fixed` 또는 `custom`만 허용 |
| `blocked` | INTEGER | NOT NULL, 0 또는 1. `custom`이면 반드시 1 |
| `created_at` | TEXT | NOT NULL, UTC ISO 8601. 생성 시각 |
| `updated_at` | TEXT | NOT NULL, UTC ISO 8601. 마지막 변경 시각. 감사 이력을 대체하지 않음 |

- CHECK: 확장자 길이·소문자·ASCII 영숫자, kind enum, blocked boolean, custom의 blocked=1을 보장한다. SQLite의 문자열 패턴 규칙을 정규식처럼 오해하지 않도록 실제 마이그레이션에서 검증한다.
- CHECK: 고정 7개는 `fixed`만 허용하고 나머지는 `custom`만 허용한다. API에서도 같은 규칙을 검사한다.
- 인덱스: `(session_id, extension)` 복합 PK로 해당 세션 조회·중복·count를 처리한다. 별도 kind 인덱스는 추가하지 않는다.
- 초기 데이터: 새 익명 세션과 고정7개 `blocked=0`을 한 D1 batch로 생성한다. 기존 유효한 쿠키의 세션은 생성/seed를 재실행하지 않는다. 커스텀은0개로 시작한다. 실제 SQL은 `migrations/0003_sessions.sql`, 초기 행 생성은 `server/session.ts`다.
- 고정 행 삭제·종류 변경은 API에서 허용하지 않는다. 고정 7행 누락 등 정책 불변식이 깨지면 조회/업로드를 실패시키고 운영 오류를 남긴다.
- 커스텀 상한은 API의 단순한 선조회 후 INSERT로 구현하지 않는다. **같은 session_id의 custom count < 200 조건을 포함한 단일 원자적 INSERT**와 복합 PK로 동시 상한·중복을 막는다. 모든 CRUD·중복 조회에도 서버가 확정한 session_id 조건을 적용한다.
- 상한은 컬럼 CHECK로 표현할 수 없는 행 집합 제약이다. 직접 관리 SQL은 API 보호를 우회할 수 있다. 마이그레이션/운영 시 200개 불변식을 확인하며 별도 트리거까지는 도입하지 않는다.
- 업로드 작업/상태 조회·감사·로그인 사용자 테이블은 두지 않는다. 익명 세션은 계정이 아니며 AI-09는 보류하고 수동 재업로드를 사용한다.

### 프로젝트 누적 저장 예산

AI-05의 최소 구현안으로 `upload_budget` 단일 행을 둔다. 개별 파일의 저장 상태 테이블이 아니며 성공 판정에 사용하지 않는다.

| 컬럼 | SQLite 타입 | 제약/의미 |
| --- | --- | --- |
| `id` | INTEGER | PRIMARY KEY, 1만 허용하는 singleton CHECK |
| `reserved_bytes` | INTEGER | NOT NULL, 기본 0, 0 이상. 허가한 저장 시도의 누적 파일 바이트 |
| `reserved_puts` | INTEGER | NOT NULL, 기본 0, 0 이상. 허가한 저장 시도 횟수 |
| `updated_at` | TEXT | NOT NULL, UTC ISO 8601 |

PK 외 인덱스는 없다. 기존 값을 보존하는 seed를 사용한다. 상한 조건이 붙은 단일 갱신으로 파일 크기와 시도 1회를 원자적 예약하고 성공이 확인된 경우에만 R2 put을 한 번 시도한다. 실패·응답 유실에도 환급하지 않는다. 기본안은 누적 256 MiB/500회이며 자동 초기화하지 않는다. 실제 설정·계정 사용량 확인은 DECISIONS를 따른다.

## API 계약

성공 응답은 필요한 데이터만 반환한다. 오류는 공통으로 `error.code`, 사용자용 `error.message`, `requestId`를 포함하며 필요한 경우 `error.details`에 차단 확장자·허용 크기를 넣는다. 내부 SQL/stack/자격증명은 반환하지 않는다.

| 메서드/경로 | 입력 | 성공 | 주요 실패 |
| --- | --- | --- | --- |
| POST `/api/session` | 유효한 쿠키가 있으면 유지, 없으면 서버 발급 | 200, ready:true. 새 세션만 Set-Cookie | 403 다른 Origin, 503 DB/초기화 실패 |
| GET `/api/policies` | 없음 | 200, fixed 배열·custom 배열·customCount·제한값 | 503 정책 DB 장애/불변식 위반 |
| PATCH `/api/policies/fixed/:extension` | JSON `blocked: boolean` | 200, 저장된 항목 | 400 형식 오류, 404 고정 목록에 없음, 503 저장 실패 |
| POST `/api/policies/custom` | JSON `extension: string` | 201, 저장된 항목 | 400 값 오류, 409 중복/고정 중복/200개, 503 저장 실패 |
| DELETE `/api/policies/custom/:extension` | 정규화된 확장자 | 204, 이미 없는 경우도 동일 | 400 형식/고정 항목 삭제 시도, 503 저장 실패 |
| POST `/api/uploads` | multipart/form-data, `file` 하나 | 201, `id`, `size`, `requestId` | 400 형식/개수, 413 크기, 422 파일명/확장자/0바이트/정책 차단, 503 DB/R2 장애 |

- 코드 예: `INVALID_EXTENSION`, `DUPLICATE_EXTENSION`, `FIXED_EXTENSION`, `CUSTOM_LIMIT_REACHED`, `BLOCKED_EXTENSION`, `INVALID_FILENAME`, `FILE_TOO_LARGE`, `INVALID_FILE_COUNT`, `STORAGE_UNAVAILABLE`, `UPLOAD_QUOTA_EXCEEDED`. 프로젝트 예산 소진은 503과 사유를 반환하며 자동 재시도하지 않는다.
- 위 JSON/503은 **Worker의 앱 코드가 처리해 반환하는 응답 계약**이다. Cloudflare가 Worker 밖에서 반환하는 오류 페이지나 실행 중단까지 같은 응답으로 보장하지 않는다. `UPLOAD_QUOTA_EXCEEDED`는 앱의 D1 누적 예산이며 Cloudflare 계정의 사용 한도/요금 예산이 아니다. 실제 제공자 장애·쿼터 응답 모방은 최신 사용자 지시에 따라 검증 범위에서 제외한다.
- 정책 PATCH는 toggle 명령이 아닌 원하는 boolean을 저장한다. 동일 요청 재전송으로 체크가 반전되지 않는다.
- JSON 이외 Content-Type은 415, JSON/멀티파트 파싱 실패는 400, 요청 본문 한도 초과는 413, 다른 출처의 Origin이 명시된 변경 요청은 403을 반환한다. Origin 없는 직접 API 요청도 서버 검증 대상이다.
- API 응답은 `Cache-Control: no-store`. 광범위한 CORS 허용을 추가하지 않는다. Origin 검사는 인증이나 봇 방지 수단이 아니다.

정책/업로드 API는 서버에서 발급·저장된 익명 세션 쿠키가 필요하다. 누락·형식 오류·미발급·중복 쿠키는 401 `SESSION_REQUIRED`로 중단한다. 오류가 나도 전역/빈 정책으로 대체하지 않는다. UI의 정책 refresh는 POST `/api/session` 성공 후 GET `/api/policies`를 실행하며 쿠키가 차단되면 GET401로 편집/업로드를 잠근다. 토큰은 HttpOnly·SameSite=Lax·Path=/api·Domain 생략, HTTPS에서 Secure를 사용한다. Expires/Max-Age 없는 세션 쿠키이며 같은 브라우저 탭은 공유하고 브라우저 복원 시 유지될 수 있다. 서버 TTL·초기화 버튼·DB 자동 정리는 추가하지 않았다. 전역 누적 예산은 세션 생성/종료로 초기화하지 않는다.

## 업로드 판정 및 저장

1. `Content-Length`가 있으면 조기 크기 검사에만 사용한다. 길이가 없거나 거짓인 요청도 실제 읽은 바이트를 누적해 전체 본문 **6 MiB** 초과 시 중단한다. 제한 없이 `formData()`부터 호출하지 않는다.
2. 제한 안의 multipart 본문을 파싱한다. 필드는 `file` 하나만 허용하고 실제 File 1개인지 검사한다. 중복 필드/추가 필드/문자열 file은 400으로 거절한다.
3. 파일은 **1바이트 이상, 5 MiB 이하**이다. 정확히 5 MiB는 허용하고 5 MiB+1바이트는 거절한다. 전체 본문 제한의 나머지 1 MiB는 multipart 오버헤드 여유이다.
4. 파일명은 UTF-8 **255바이트 이하**. 빈 이름, 앞뒤 공백, 끝 점, `/`, `\`, `:`, NUL/제어문자/방향 제어문자, 선행 점(dotfile), 확장자 없음, 연속 점은 거절한다. 일반 한글 본문 이름은 허용한다. 최종 확장자는 ASCII 영숫자 1~20자여야 한다. 프로토콜 파서가 제공한 이름에 추가 URL decode를 하지 않는다.
5. 이름의 첫 부분을 제외한 점 구분 토큰을 소문자로 비교한다. `exe` 차단 시 `file.EXE`와 `file.exe.txt` 모두 거절한다. `archive.tar.gz`는 tar/gz가 차단되어 있지 않으면 허용한다. 이 보수적 규칙은 `report.final.pdf`에서 final을 차단했을 때도 거절하는 사용성 비용이 있다.
6. 요청 쿠키로 확정한 세션을 사용해 파일·본문 검증 후 **저장 전 해당 세션의 D1 정책을 한 번 조회한 시점 T**를 적용 기준으로 삼는다. 차단되면 422를 반환하고 R2 put을 호출하지 않는다. T 이후 같은 세션에서 변경된 정책은 다음 업로드/재시도에 적용한다.
7. 허용된 파일의 용량/저장 시도를 `upload_budget`에서 먼저 원자적 예약한다. 예산 부족·DB 오류·예약 성공 미확인 시 저장하지 않는다. 성공 시 UUID로 `uploads/<uuid>` 키를 만든다. 원본명은 키에 사용하지 않고 MIME은 `application/octet-stream`, 버킷은 비공개로 한다.
8. R2 put 완료 및 반환 객체 크기 확인 후에만 201을 반환한다. 파일은 실행·압축 해제·미리보기·공개 제공하지 않는다. 로컬 R2와 배포 버킷에서 저장 증거를 각각 확인한다. 정상 응답을 확인하지 못한 UI는 완료 확인 실패로 처리하고 수동 재업로드를 안내한다.

최초 고정 정책은 모두 해제되어 있으므로 `.exe` 자체도 체크하기 전에는 정책상 허용될 수 있다. 이를 임의의 숨은 차단 목록으로 바꾸지 않는다. 허용은 악성코드가 없다는 보증이 아니다. 파일명의 사용자 제공 MIME은 신뢰하지 않는다.

이번 범위에서 시그니처 검사는 생략한다. 헤더/내용·악성코드 검증을 통과했다고 표시하지 않는다. 제한된 PNG/JPEG/PDF 검사도 후속 대안으로 보관한다.

## UI 상태와 동시성

- 다중 선택·드롭은 같은 검사 흐름으로 대기 목록에 등록하고 확인·제외 후 시작한다. 요청당 파일 하나/순차 전송, 목록 최대 10개를 기본 설계값으로 사용한다. 성공 항목은 유지하고 실패 항목만 수동 재시도한다.
- 카테고리는 현재 소속의 개별 체크박스·전체 차단/허용과 custom 조회 필터를 제공한다. 새 세션 초기값은 기본4분류 각5개이며 소속 편집을 세션별로 보존한다. 생성/소속 편집/조회만으로 차단은 바뀌지 않고 개별/전체 정책 조작으로 저장한다.
- 프론트 사전 판정은 예상 결과이며 서버의 T 시점 판정을 대체하지 않는다. 시작/수동 재시도 직전 정책 GET 후 대상의 사전 판정을 갱신하고 조회 실패면 전송하지 않는다. 정책 변경/재조회 시 대기 항목의 예상 결과와 실패 항목의 현재 재시도 가능 여부를 갱신하되 과거 실패 사유·진행 중·성공한 업로드 결과를 뒤집지 않는다.
- 2026-10-22 후속 사용자 수정: 등록 확인은 커스텀 추가와 별도 입력/상태를 사용하고 현재 등록 목록과 정규화된 정확한 일치를 확인한다. 추가 입력 자체의 유효성/중복 검사도 유지한다. 당시 대표 클릭-입력 채움은 CATEGORY-03의 개별 정책 체크박스로 대체했다. 파일 업로드 위/정책 아래 배치와 ‘정책 새로고침’은 유지한다.
- 행별 업로드는 제거 왼쪽의 같은 크기 버튼으로 해당 파일만 기존 최신 정책 GET/잠금/전송 경로에 넣는다. 사전 차단·완료·진행 중은 비활성이다. 실패 행은 기존 수동 재시도 버튼을 같은 자리에 유지한다. 서버 API/스키마/판정 T는 변경하지 않는다.

- 첫 조회 전 및 조회 실패 시 정책 편집/업로드를 비활성화하고 재시도 동작을 제공한다.
- 체크/해제는 확인창 없이 즉시 저장 요청을 보내고 서버 성공 뒤 확정한다. 처리 중 중복 조작을 막고 실패 시 기존 확정 상태/입력값을 유지하며 체크박스도 이전 값으로 복구한다.
- 저장 응답을 받기 전 연결이 끊기면 서버에는 이미 저장됐을 수 있다. 성공/실패를 추정하지 않고 정책 GET으로 재동기화하며 그동안 업로드를 막는다.
- 같은 화면에서는 정책 저장 중 업로드를 막고, 전송 그룹 처리 중 정책 변경·파일 추가/제거·별도 재시도를 잠근다. 다른 익명 세션의 정책 변경은 영향을 주지 않으며 같은 쿠키를 공유하는 탭의 변경 가능성은 남는다. 파일별 거절은 실제 이유를 표시하고 정책을 재조회해 남은 대기 항목을 확인한다. 네트워크/DB/저장소 장애·예산 소진이면 다음 전송을 중단하고 목록/결과를 유지한다.
- 서로 다른 탭의 서로 다른 항목 수정은 항목별 API로 보존한다. 같은 고정 항목은 마지막 DB 커밋 값이 이긴다. 실시간 알림/버전 충돌 UI는 제외한다.
- 진행 중 업로드의 정책 조회 이후 변경은 다음 업로드부터 적용된다. 정책 읽기와 R2 저장은 한 트랜잭션이 아니며 도중 변경을 소급 취소하지 않는다. 기존 저장 파일에도 정책을 소급 적용하지 않는다.
- 응답 유실은 완료 확인 실패로 처리하고 수동 재업로드한다. 상태 조회·멱등 키·자동 재시도는 넣지 않는다. 서버에는 이미 저장됐을 수 있어 중복 객체가 생기고 예산도 추가 소비될 수 있다. 실제 미저장 확정으로 설명하지 않는다.

## 운영 기본값

- 별도 로컬/배포 D1 및 R2를 사용한다. 개발 중 원격 데이터에 연결하지 않는 것을 기본으로 한다.
- 데모 파일 보관은 1일 만료 lifecycle을 제안한다. 만료는 비동기 처리이므로 정확히 24시간 삭제를 약속하지 않는다. 정책은 유지한다. [R2 lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
- 로그: UTC 시각, requestId, 작업 종류, HTTP 상태, 차단 이유 코드/확장자, 크기, 소요 시간. 정책 변경은 대상·변경 값·결과를 남긴다. 원본 파일명/파일 내용/토큰/IP를 앱 로그에 기본 기록하지 않는다.
- 전역 공유 데모임을 안내한다. 앱 저장 경로에는 누적 예산을 적용하지만 계정 전체 회계·인증·정교한 rate limit은 범위 밖이다. 다른 리소스 사용이나 공개 조회로 무료량이 소진될 가능성은 남는다.

D1은 prepared statement와 트랜잭션 batch를 제공하지만 이번 핵심 상한 처리는 한 SQL 문장으로 끝내는 설계다. 여러 쿼리를 나열한 것만으로 읽기-쓰기 경쟁이 해결됐다고 가정하지 않는다. [D1 API](https://developers.cloudflare.com/d1/worker-api/d1-database/) (확인: 2026-10-21).
