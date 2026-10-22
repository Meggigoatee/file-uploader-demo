# TDD 루프 기록

상태: **S0~S6 완료 / S7 옵션 생략 / S8 배포·원격 검증 완료 / 후속 UI-R01 완료**. 초기 기능 루프 8개와 후속 UI 루프 1개, 총 9개 및 환경 보정·최종 검증을 기록했다. 환경 스모크와 기능 검사를 구분한다. 실행 규칙은 [TDD_PLAN](./TDD_PLAN.md)을 따른다.

## 원장

### S0-C01 — API 경계와 실행 구성 (TC05 / V24)

- 2026-10-22 22:08~22:13 KST. Node 24.16.0 / pnpm 11.5.1 / Vitest 4.1.10, 실제 로컬 workerd. 이전 앱 회귀 기준 없음.
- 먼저 `tests/integration/api.test.ts`를 작성하고 import 가능한 평문 404 진입점에서 실행했다. **Red 종료 1:** `text/plain;charset=UTF-8`가 `application/json`을 포함하지 않음. [Red](verification/S0-C01-red.log). 구성/수집 오류가 아닌 응답 계약 미구현이다.
- 최소 구현: 공통 JSON/no-store 오류 응답, UUID 요청 ID, API와 정적 자산 경계를 작성했다. **Green 종료 0: 1/1**. [Green](verification/S0-C01-green.log).
- 리팩토링 검토: 오류 응답을 `server/http.ts`의 작은 함수로 모아 향후 정책 API가 같은 계약을 쓰도록 했다. 추가 계층은 불필요해 만들지 않았다.
- 리팩토링 후 누적 Worker 회귀 **1/1 종료 0**. [회귀](verification/S0-C01-regression.log). `wrangler types`, `vue-tsc --noEmit`, `vite build` 모두 종료 0 ([타입 생성](verification/S0-typegen.log), [타입 검사](verification/S0-typecheck.log), [빌드](verification/S0-build.log)). 아직 단위/UI 기능이 없어 해당 계층은 미실행이다.
- S0 완료. 원격 DB ID는 로컬 개발용 자리표시자이며 원격 리소스 확인·배포 성공을 뜻하지 않는다. 패키지 버전 변경 없음.

### S1-C01 — 공유 입력·파일명 규칙 (TC01/02 / V03/04/08/11/12/16/37)

- 22:13~22:15 KST, S0 회귀 기준. 테스트를 먼저 작성하고 null/undefined 반환 스텁으로 실행했다.
- **Red 종료 1: 10 실패 / 29 통과**. 정규화 허용 값이 null, 파일명 토큰 미구현. [Red](verification/S1-C01-red.log).
- 최소 구현 후 **시도 2 종료 1: 1 실패 / 38 통과**. `. SH `에서 점 제거 뒤 공백을 다시 정리하지 않아 null이 됐다. 테스트 오류가 아닌 문서 규칙 구현 누락. [시도 2](verification/S1-C01-green.log).
- 점 하나 제거 후 trim을 적용해 해결. **시도 3 종료 0: 39/39**, [Green](verification/S1-C01-green2.log). 원문 20자 검사는 정규화 전에 유지한다.
- 리팩토링 검토: 파일명 토큰 추출과 차단 집합 비교를 분리해 서버·클라이언트가 재사용한다. 작은 함수로 충분해 추가 계층은 만들지 않았다.
- 누적 Worker 회귀 **1/1**, 타입 검사 종료 0 ([회귀](verification/S1-C01-regression-worker.log), [타입](verification/S1-C01-typecheck.log)). UI 미구현으로 E2E 미실행. 기능 회귀 실패 없음. S1 완료.

### S2-C01 — 실제 D1 정책 API (TC03/04/05 / V01~07/24)

- 22:15~22:18 KST, 이전 기준 S1. API/스키마/동일 DB 경쟁 테스트를 먼저 작성했다.
- **시도 1 종료 1은 기능 Red 아님:** no-op SQL 주석의 세미콜론을 단순 분리해 주석만 D1에 전달했고 `SQL code did not contain a statement`가 발생했다. [fixture 오류](verification/S2-C01-red.log). 이 오류 상태에서 구현 초안을 작성한 절차 이탈이 있었다. 이를 숨기지 않고 라우팅을 S0로 되돌려 기능 실패를 다시 확인했다.
- **보정 Red 종료 1: 4 실패 / 2 통과**, 정책 API의 200/201/415 기대에 실제 404. [실제 Red](verification/S2-C01-red2.log). 스키마 fixture를 SQL 문장으로 교체해 수집·초기화 문제를 해소했다. unknown fixed는 DESIGN 계약상 404여서 잘못 작성한 기대 400도 정정했다.
- 최소 구현: CHECK/seed-preserving SQL, GET/PATCH/POST/DELETE, bounded JSON, Origin, 원자적 count 조건 INSERT와 PK. 첫 연결 실행은 6/6 통과했으나 보정 전 실행으로 별도 보존([초안 실행](verification/S2-C01-green.log)). 보정 Red 후 재연결 **Green 6/6 종료 0** ([Green](verification/S2-C01-green2.log)).
- 리팩토링: 본문 제한/JSON 파싱을 작은 HTTP 함수로 모으고 정책 조회를 업로드에서도 재사용하도록 분리했다. 일반 Service/Repository는 만들지 않았다.
- 누적 단위 **39/39**, Worker **6/6**, 타입 검사 종료 0 ([단위](verification/S2-C01-regression-unit.log), [타입](verification/S2-C01-typecheck.log)). 원자적 상한은 동일 DB에 199개를 넣고 두 POST를 겹쳐 최종 200행을 확인했다. UI 미구현. S2 완료, 이후에는 fixture 유효성 확인 후 기능 Red를 먼저 확보한다.

### S3-C01 — 실제 업로드·T·앱 예산 (TC06~10 / V08~17/19/20/34/35)

- 22:18~22:20 KST. 먼저 실제 D1/R2 fixture와 multipart 테스트 9개를 작성했다. no-op 예산 migration은 주석 없이 유효한 SELECT로 시작했다.
- **Red 종료 1: 새 9개 실패 / 기존 6개 통과**, 201/422/413/400/503 기대에 업로드 스텁 404 ([Red](verification/S3-C01-red.log)). 환경 오류 없음.
- 최소 구현: 실제 스트림 바이트 상한 → multipart 1 File → 파일 검사 → 정책 단일 조회 T → 조건부 예산 예약 → UUID private R2 put 완료 확인. **Green 종료 0: 15/15** ([Green](verification/S3-C01-green.log)).
- 리팩토링 검토: JSON·multipart가 같은 bounded-reader를 사용하고 T를 코드 주석으로 명시했다. 예산 예약 후 환급·상태 테이블·추가 추상화는 넣지 않았다. 함수 크기가 작아 추가 분해는 하지 않았다.
- 누적 회귀 단위 **39/39**, Worker **15/15**, 타입·빌드 종료 0 ([단위](verification/S3-C01-regression-unit.log), [Worker](verification/S3-C01-regression-worker.log), [타입](verification/S3-C01-typecheck.log), [빌드](verification/S3-C01-build.log)). R2 실제 바이트·octet-stream·객체 개수, 동일 DB 경합의 최종 예산 256 MiB/500을 assertion으로 확인했다.
- T 이후 변경은 실제 R2 put 직전 await 경계에서 DB 정책을 변경하고 원래 put을 실행했다. 첫 요청 저장 성공과 다음 요청 거절을 확인했으며 Cloudflare 오류 대역은 사용하지 않았다.
- 원격 준비 확인: `wrangler whoami` 종료 0이지만 **not authenticated** ([결과](verification/S3-cloud-account.log)). 원격 D1/R2·비용·배포 미검증. 로컬 S3 완료, 원격 부분은 인증 후 수행할 항목으로 남긴다.

### S4-C01 — 정책 Vue 화면 (TC11/12 / V18/22/33/39)

- 22:21~22:28 KST. 실제 로컬 Worker/D1에 연결한 Playwright 시나리오를 먼저 작성했다. **Red 종료 1:** exe checkbox 미존재 ([Red](verification/S4-C01-red.log)).
- 최소 구현: 정책 조회/즉시 저장/커스텀 CRUD, 원문 길이·정확 일치 안내, 정적 13종 안내, 저장 불확실 시 재조회 잠금. 외부 UI 라이브러리 없음.
- **시도 2/3 종료 1:** 브라우저 click timeout. 빈 CSS import 경고를 제거했으나 실패가 남았다 ([시도 2](verification/S4-C01-green.log), [시도 3](verification/S4-C01-green2.log)). trace에서 `vite-error-overlay`가 클릭을 가로채고, 설치된 plugin-vue의 `handleHotUpdate`가 초기 compiler=null에서 `invalidateTypeCache`를 읽는 것을 확인했다. CSS 경고와 실제 클릭 차단 원인을 구분했다.
- 버전을 올리지 않고 설치된 Vue의 `vue/compiler-sfc`를 Vite Vue 플러그인에 명시했다. **시도 4 Green 종료 0: E2E 1/1** ([Green](verification/S4-C01-green3.log)). 공식 Vite 저장소 검색도 확인했으나 수정 근거는 로컬 설치 코드/실제 trace다.
- 리팩토링: API 응답 처리/정책 상태를 작은 모듈로 분리해 화면이 HTTP 오류·불확실성을 일관되게 다룬다. 일반 서비스 계층은 도입하지 않았다. 누적 회귀 단위 **39/39**, Worker **15/15**, E2E **1/1**, 타입 종료 0 ([단위](verification/S4-C01-regression-unit.log), [Worker](verification/S4-C01-regression-worker.log), [타입](verification/S4-C01-typecheck.log)). S4 완료. 아직 없는 S5 검사 세 개의 Red는 별도로 기록했다.

### S5-C01 — 목록·순차 전송·진행률·수동 재시도 (TC13~16 / V21/22/26~28/30/32/34/36/38/40)

- 22:28~22:35 KST. 먼저 목록 단위 3개와 실제 브라우저 시나리오 3개를 작성했다. **Red 단위 3 실패/기존39 통과**, 목록 스텁이 빈 배열이고 재시도 false. **Red E2E 3 실패/기존1 통과**, 파일 입력 미존재 ([단위 Red](verification/S5-C01-red-unit.log), [E2E Red](verification/S5-C01-red-e2e.log)).
- 최소 구현: 10개 묶음 한도·선택/드롭·사전 검사·순차 1파일 요청, 최신 정책 GET, XHR 전송 이벤트와 서버 확인 구분, 성공 응답 검증, 실패만 수동 재시도, 그룹 잠금/중단. **단위 Green 42/42** ([단위](verification/S5-C01-green-unit.log)).
- **E2E 시도 2: 3통과/1실패.** Playwright route가 원래 브라우저 요청을 정지시켜 실제 upload progress도 멈췄다. 서버에 대신 보낸 route.fetch 성공만으로 브라우저 전송 100%를 주장할 수 없었다 ([시도 2](verification/S5-C01-green-e2e.log)).
- 테스트 전용 HTTP 프록시로 실제 브라우저 전송·실제 Worker 저장을 유지하고 응답만 보류했다. **시도 3: 3통과/1실패.** 빈 TCP 종료는 Chromium 내부 재전송으로 완료 응답이 도착했다 ([시도 3](verification/S5-C01-green2-e2e.log)). 이를 앱 자동 재시도 결함으로 오분류하지 않았다.
- 실제 저장된 응답의 Content-Length와 일부 바이트를 보낸 뒤 연결을 종료해 부분 응답 손실을 재현했다. **시도 4 Green E2E 4/4** ([Green](verification/S5-C01-green3-e2e.log)). 저장은 서버 201로 확인했고 보류 중 서버 확인 상태/잠금, 유실 뒤 중단/대기 보존, 수동 재시도에서 요청 수 2→3을 확인했다. Cloudflare 장애 모방은 없다.
- 리팩토링: 전송 결과 해석과 목록 규칙을 작은 모듈로 분리하고 CSS를 읽기 쉽게 정리했다. 누적 단위 **42/42**, Worker **15/15**, E2E **4/4**, 타입 검사 모두 종료 0 ([단위](verification/S5-C01-regression-unit.log), [Worker](verification/S5-C01-regression-worker.log), [E2E](verification/S5-C01-regression-e2e.log), [타입](verification/S5-C01-typecheck.log)). S5 완료.

### S6-C01 — 교차 오류·접근성 검사 (TC09~17 / V18~23/33~40)

- 22:35~22:37 KST. 기존 구현을 실제 API/UI 교차 시나리오로 확장했다. **첫 실행 7통과/2실패** ([실패](verification/S6-C01-initial.log)). 별도 서버 오류 대역 없이 중복 등록은 실제 다른 요청, 정책 저장 응답 유실은 실제 저장 후 route.abort, 앱 한도는 격리된 E2E D1 행으로 재현했다.
- 실패 원인: 시각적으로 숨긴 file input도 접근성 트리에서 button 역할로 노출돼 ‘파일 선택’이 두 개였다. assertion을 first()로 약화하지 않고 네이티브 input을 hidden으로 바꿔 실제 사용자용 버튼 하나만 노출했다.
- **Green 9/9 종료 0** ([Green](verification/S6-C01-green.log)). 그룹 도중 타 방문자 정책 변경, 재조회 후 성공/과거 거절 이유 보존, 최초 GET 실패 잠금, 키보드 Enter 추가와 포커스 복귀, 390px 긴 이름 가로 넘침 없음을 확인했다.
- 모바일 스크린샷을 직접 열어 확인했고 추가 버튼 줄바꿈을 발견해 CSS에서 축소/줄바꿈을 막았다. 검증용 데이터는 `.wrangler/e2e`만 사용하며 예산 재설정은 테스트 fixture 정리다. 앱에는 초기화 기능이 없다.
- 후속 S6 최종 누적 회귀에 연결한다.

### S6-C02 — 운영 로그와 독립 경계 보강 (TC05/09/10)

- 22:38~22:40 KST. DESIGN의 정책 변경 결과 로그 테스트를 먼저 추가했다. **Red 1실패/18통과**, console.info 호출 없음 ([Red](verification/S6-C02-red.log)). 새 예산 bytes/puts 독립 경쟁, 수신 중 정책 변경(T 이전) 검사는 기존 구현에서 통과했다.
- 최소 구현: API 결과의 시각·요청 ID·작업 종류·상태·소요 시간, 정책 대상/값, 크기/실패 코드를 구조화 로그로 기록했다. 원본 파일명/내용/자격증명은 기록하지 않는다. **Green 19/19 종료 0** ([Green](verification/S6-C02-green.log)).
- 리팩토링: 정상/오류 응답이 공통 결과 로그를 거친 후 반환하도록 합쳤다. 사용자용 오류 문구를 한국어로 일관되게 정리했다. 최종 하네스에서 모든 계층을 회귀 확인한다.

### S6 누적 종료와 CLI 하네스 보정

- S6-C01/C02 리팩토링 후 `pnpm run check` 첫 실행은 **종료 2/blocked**. 기존 하네스의 pnpm CLI 정규식이 설치된 `pnpm.mjs`를 허용하지 않는 도구 결함이었다. 앱 실패/기능 Red로 세지 않는다 ([첫 실행](verification/S6-final-check.log)).
- 정규식에 mjs를 허용하고 재실행했다. **타입/빌드/단위42/Worker19/E2E9 전부 종료 0** ([첫 전체 성공](verification/runs/CHECK-2026-10-22T13-41-41-313Z-78c64850/report.json)).
- 검증 보강: 삭제 후 200개 재도달, 동일 값 동시 추가, 서로 다른 fixed 동시 갱신, 예산 seed 보존, MIME 위조 차단, UTF-8 서버 경계, Content-Length 없는 초과 본문. 새 제품 동작을 추가하지 않고 기존 규칙의 증거를 보강했다. **단위42/Worker21/E2E9, 타입/빌드 종료 0** ([회귀](verification/runs/CHECK-2026-10-22T13-44-29-997Z-d6d491af/report.json)). 기능 회귀 실패 없음.

### S7 — 조건부 옵션 생략

필터·대표 일괄 변경은 조건부 목표다. 핵심 검증·실제 배포·제출 기록을 우선해 구현하지 않았고 옵션 UI/API를 노출하지 않았다. TC18/V31 미실행이며 통과로 세지 않는다.

### S8 — 실제 배포·저장·최종 회귀

- 22:40~22:54 KST. 신규 제품 루프가 아닌 승인된 S8 검증/배포다. `whoami` 미인증 → 사용자 선택으로 OAuth 로그인 완료. R2 목록 실제 code 10042 → 사용자 직접 활성화 선택 → 목록 조회 성공. 비용 checkout을 대신 수행하지 않았다.
- 새 프로젝트 전용 D1/R2 생성, 실제 원격 migration 2개 적용, 실제 리소스 ID로 config 연결, build/deploy 종료 0 ([생성](verification/S8-d1-create.log), [버킷](verification/S8-r2-create.log), [migration](verification/S8-migrate-remote.log), [빌드](verification/S8-build.log), [배포](verification/S8-deploy.log)).
- 공개 URL `https://file-uploader-demo.meggigoatee.workers.dev`, 배포 버전 `e58b9e24-4937-4b93-8452-2f08595fd213`. 실제 Chromium 원격 **1/1 종료 0** ([브라우저](verification/S8-remote-browser.log), [관찰 결과](verification/S8-remote-browser.json)).
- R2 원격 실제 39바이트를 읽어 원본과 SHA-256 일치 확인 ([바이트](verification/S8-r2-bytes.json)). 이는 검증 도구의 비교이며 제품에 해시 검사 기능을 추가한 것이 아니다. r2.dev 비공개 확인 ([설정](verification/S8-r2-private.log)). 원격 실제 schema/7행/예약39바이트·1회 확인 ([DB](verification/S8-remote-db.json)).
- 테스트 소유 custom 정책과 fixed 변경 복구, 원격 테스트 객체만 삭제 ([정리](verification/S8-cleanup.log)). 예산 환급/초기화 없음. 다른 앱 데이터 변경 없음.
- 마지막 검증 보강: 10개 정확한 목록과 빈 선택 보존, 해제된 fixed 등록 확인, 실제 저장 후 JSON 파싱 실패, **실제 60초 XHR timeout**에서 완료 확인 실패·다음 파일 미전송. 기존 제품 코드에서 통과했으며 새 Red를 꾸미지 않았다. 실제 리소스 ID 연결 후 최종 **단위42/Worker21/E2E11, 타입/빌드 모두 종료 0** ([최종 전체 report](verification/runs/CHECK-2026-10-22T13-52-13-374Z-f1e9d9d3/report.json), [전체 stdout](verification/S8-final-check.log)). E2E 11개 중 timeout 검사는 실제 약 60초 걸렸다.
- 기존 기능 회귀 실패 없음. 같은 앱 코드에서 추가 변경 없이 같은 검사를 반복하지 않는다. 실제 Cloudflare 장애/계정 쿼터 모방, 부하 성능, 계정 전체 비용 보장은 제외·미검증이다. 로컬·원격 핵심 구현/검증 완료.

## 루프별 기록 양식

아래는 양식이며 실제 실패·통과 사례가 아니다.

```text
루프 ID / 단계 / TC·V 번호:
KST 시작·종료 / 환경·버전 / 직전 회귀 기준 실행 ID:
변경하려는 동작 / 근거 문서의 절:

시도 1 — Red
- 먼저 작성한 테스트 파일·케이스:
- 실행 명령 / 종료 코드 / 증거 파일:
- 기대 결과 / 실제 결과 / 실제 실패 메시지:
- 실패 분류(미구현·제품 결함·테스트 오류·환경 오류)와 확인한 원인:
- 환경/수집 실패라면 기능 Red가 아니라는 구분과 해소 방법:

시도 2 이후 — Green을 위한 최소 구현·재실행
- 실패 원인에 대응한 변경:
- 실행 명령 / 종료 코드 / 결과·새 실패 원인(통과면 실패 없음):
- 증거 파일:

Refactor
- 동작을 유지하며 정리한 내용과 이유:
- 정리할 항목이 없으면 검토 내용과 변경하지 않은 이유:

리팩토링 후 재검증·회귀
- 대상 테스트 및 누적 단위/Worker 통합/핵심 E2E의 명령·결과:
- typecheck 및 단계 종료 build/check 결과 또는 아직 준비되지 않은 계층:
- 기존 기능의 회귀 실패 여부와 원인, 수정·다시 실행한 결과:
- 실행 ID / stdout·JSON·trace 등 증거 위치:

종료 판단
- 완료 / 실패 해결 중 / 환경 미준비:
- 미실행·조건부 옵션 / 남은 원인·다음 조치:
```

완료는 대상 및 현재 구현된 기능의 회귀 검사가 통과한 경우에만 기록한다. 관련 TC/V별 최종 증거는 VALIDATION 원장에도 연결한다. 비밀값·파일 본문·로컬 DB를 붙이지 않는다. 같은 요청의 사용자/AI 대화는 conversations에 별도 보존한다.

### 마지막 커밋 증거 보강

22:57 KST 전후, TC09/V19의 동일 필드에 서로 다른 값을 동시에 쓰는 경우도 실제 D1 commit 순서를 await 경계로 제어해 검증했다. 두 요청 200, 나중 commit의 true가 최종 DB에 남았다. Worker 전체 **22/22 종료 0** ([결과](verification/S8-last-commit.log)). 제품 코드 변경이 없어 마지막 전체 하네스의 단위42/E2E11/타입/빌드와 원격1 결과를 재사용한다. 전체 최신 증거는 **로컬75 + 원격1 = 76개 통과**다.

### 실행 절차 재현 보강

제품 코드 변경 없이 의존성/로컬 상태가 없는 D 드라이브 복사본에서 frozen/offline 설치·로컬 migration·타입·빌드가 모두 종료0이었다. 최초 C 임시 복사본은 pnpm 기본 전역 스토어가 C 드라이브 쪽으로 선택되어 offline tarball 부족/스토어 guard 중단을 겪었다. D 복사본으로 바로잡아 요구된 `D:\.pnpm-store\v11` 사용과 동일 lockfile을 확인했다. 이 환경 실패를 제품 Red로 세지 않았다. 임시 두 복사본은 정확한 절대경로 확인 후 정리했다. [결과](verification/S8-clean-result.json). 앱/의존성 버전 변경 없음.

### UI-R01 — 상하 레이아웃·독립 입력·행별 업로드 (사용자 후속1~4 / TC11~17 / V18/22/23/26/30/32/33/39/40)

- 2026-10-22 23:30~23:43 KST. 기존 코드/스킬/설계 참조 후 `tests/e2e/layout.spec.ts` 2개를 먼저 작성했다. 사용자5번은 의견 요청으로 분리해 승인 전 목록 정리 기능을 구현하지 않았다.
- **Red 종료1: 새2개 실패** ([실제 Red](verification/UI-R01-red.log)). 상하 좌표 기대 `upload.bottom <= policy.top`에 기존 upload.bottom795.66 > policy.top170.78. 행별 `one.txt 업로드` 버튼 미존재. 테스트 수집/환경 오류가 아닌 요청 동작 미구현이다.
- 최소 구현: root DOM에서 업로드를 위로 옮기고 단일 열, 추가/조회 ref·computed를 분리, ‘정책 새로고침’, 같은 크기 행 업로드/제거. 행 업로드는 `start(retryable(item), item.id)`로 기존 정책 재조회/잠금/전송 처리를 재사용했다. 사전 차단·진행·완료는 비활성, 실패는 기존 재시도를 같은 자리에 유지한다. **Green 2/2 종료0** ([Green](verification/UI-R01-green.log)).
- 리팩토링: 두 입력의 정확 일치 판정은 작은 findPolicy 함수로 공유하되 값/입력 상태는 독립 유지. canUpload로 행 전송 가능 상태를 모았다. 새 서비스·상태 라이브러리는 도입하지 않았다. 대표 클릭은 추가 값만, 추가 성공도 추가 값만 초기화한다.
- 첫 누적 회귀 **단위42/Worker22/E2E13·타입/빌드 종료0** ([첫 전체 report](verification/runs/CHECK-2026-10-22T14-34-46-926Z-ac4ff112/report.json)). 기존 버튼명의 테스트 선택자3개를 요청된 새 이름으로 맞췄다. 기존 동작 기대/실패 검사를 약화하지 않았다.
- 실제 데스크톱/390px 스크린샷을 확인했다. 조회 안내가 focus outline과 가까워 CSS 간격만 보완한 뒤 다시 누적 회귀 **단위42/Worker22/E2E13·타입/빌드 종료0**, 회귀 실패 없음 ([최종 report](verification/runs/CHECK-2026-10-22T14-38-44-656Z-6fa30f36/report.json), [stdout](verification/UI-R01-final-check.log)). 기존 실제60초 timeout·응답 손실·실패만 재시도도 통과했다. 제품 코드의 추가 결함/환경 오류 없이 Green 이후 통과했다.
- 새 assertion: 두 입력 값 유지/추가 후 조회 값 유지/대표 클릭 및 Enter가 무단 등록하지 않음, 업로드 위/같은 폭, 행 버튼 위치/크기, 사전 차단·진행 중·성공 업로드 비활성, 한 행 전송1회·직전 정책 GET1회·다른 대기 보존. [데스크톱](verification/UI-R01-desktop.png), [390px](verification/mobile.png).
- 기존 공개 데모 배포 종료0, 버전 `1b382c8c-43b4-40a6-be43-560479d442f9` ([배포](verification/UI-R01-deploy.log)). 원격 Chromium **1/1 종료0**, 새 배치·별도 입력·실제 행별 업로드와 기존 정책 유지/차단/API404 확인 ([원격](verification/UI-R01-remote-browser.log), [결과](verification/UI-R01-remote-browser.json), [공개 화면](verification/UI-R01-public-desktop.png)). 원격 산출물 prefix를 분리해 S8 증거를 덮어쓰지 않았다.
- 실제 R2 39바이트를 읽어 원본 해시 일치, 이 테스트 소유 객체/정책만 정리. 기존 방문자 custom 목록은 유지하고 fixed는 테스트 전 값으로 복구했다. 추가 예약은 환급하지 않았다 ([바이트/정리](verification/UI-R01-r2-bytes.json), [삭제](verification/UI-R01-cleanup.log)).
- 종료: **로컬77 + 원격1 = 최신78개 통과**, 타입/빌드 성공. 서버 코드/SQL/설치 버전/전역 pnpm 스토어 변경 없음. 사용자5번의 수동 성공 항목 비우기는 제안만 유지한다. Git 커밋/푸시 없음.
