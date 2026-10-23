# 검증 계획과 결과

## FINAL-LOCAL-01 — 최종 로컬 테스트 (2026-10-23)

사용자 요청에 따라 완료 기록까지 현재 구현/테스트와 대조했다. [요건·구현·테스트 대응표와 누락 목록](./FINAL_LOCAL_REVIEW.md), [실패/리팩토링 기록](./TDD_LOG.md), [대화](./conversations/2026-10-23-011.md). 기존103개에서 검증이 부족했던 경계48개를 추가했고 이번 요청의 제품 코드 변경은 없다. 기대값/요건 완화·자동 retry·skip은 추가하지 않았다.

환경: 기존 Windows/Node24.16.0/pnpm11.5.1·Vitest4.1.10·동일 Cloudflare 플러그인/Playwright Chromium. Worker는 격리된 실제 로컬 D1/R2, E2E는 `.wrangler/e2e`·Vite4173이다. 일반dev5173와 원격 바인딩은 변경하지 않았다.

| 명령·실행 | 실제 결과 | 증거 |
| --- | --- | --- |
| 최초 `pnpm run check` | 수집 전 EPERM(사용자 Wrangler 로그·Vitest 임시 rename). 환경 실패 | [환경 로그](./verification/FINAL-LOCAL-01-baseline.log) |
| 사용자 환경 `pnpm run check`, 이후 `pnpm run test:e2e` | 타입/빌드·단위42/Worker39 통과, E2E는 별도 CATEGORY-05가4173을 사용해 시작 전 중단. 다른 프로세스 종료/재사용 없음 | [기준선](./verification/FINAL-LOCAL-01-baseline-user.log), [포트 충돌 재시도](./verification/FINAL-LOCAL-01-baseline-e2e.log) |
| 새 입력 경계 보강 후 `pnpm run test:unit` | 65/65 통과(신규23). 기존 동작의 검증 보강이며 인위적인 Red 없음 | [단위 최초](./verification/FINAL-LOCAL-01-unit-first.log) |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/category-boundaries.test.ts tests/integration/upload-failures.test.ts` | 새14/14 통과 | [Worker 최초](./verification/FINAL-LOCAL-01-worker-first.log) |
| `pnpm run test:e2e -- tests/e2e/final-boundaries.spec.ts --output .wrangler/final-local-playwright` | 신규6통과/1실패. 두 카드가 제거 모드를 동시에 유지한다고 가정한 테스트 순서 오류. 첫 카드 모드에 다시 진입하도록 수정 | [UI 최초](./verification/FINAL-LOCAL-01-ui-first.log). 최초 trace는 해당 output 아래 보존 |
| `pnpm run test:e2e -- tests/e2e/final-boundaries.spec.ts --output .wrangler/final-local-playwright-green` | 7/7 종료0, 데이터/정책/필터/삭제/요청 수 기대 유지 | [UI 재검증](./verification/FINAL-LOCAL-01-ui-green.log) |
| 추가 rollback/직접SQL/현재소속/T 검사 후 `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/category-boundaries.test.ts` | 카테고리 경계12/12 통과. 첫 실행8개에4개 보강 | [Worker 추가](./verification/FINAL-LOCAL-01-worker-extra.log) |
| `$env:UPLOADER_VERIFICATION_PREFIX='FINAL-LOCAL-01'; pnpm run check` | **종료0, 타입/빌드·단위65/Worker57/E2E29=151개 통과**. 21:35:39~21:37:31 KST | [최종 report](./verification/runs/CHECK-2026-10-23T12-35-39-480Z-ce4bb88e/report.json), [stdout](./verification/FINAL-LOCAL-01-final-check.log) |

실제 D1/R2 증거: 이름/구성원 정규화 중복 경합의201/409·행1개, member50·custom200 정확한 경계/해제 후 추가·같은DB 단건/일괄 경합, 생성/차단/허용/교체/삭제의 실제 trigger rollback, 세션별 모든 변경 액션 격리·기본 보호를 확인했다. 일괄 실행 전 소속 교체와 정책 T 전/후 변경은 await 경계로 제어했다. 차단 업로드의 객체 미증가와 허용/저장 뒤 결과 실패의 정확한 R2 바이트를 다시 읽었다.

저장 실패 대역은 앱 계약에 한정했다. 실제 예약 trigger 실패는 put0회/예산0, 실제 커밋 후 결과 전달 실패는 put0회/예산 유지, put거부는 객체0/예산 유지, 실제 저장 후 null/잘못된 크기/예외는 앱503/객체1/바이트 일치/예산 유지다. 수동 새 시도는 예약과 put을 각각1회 더 사용한다. UI에서도 실제 로컬 예약 SQL 실패로 첫 행 실패·다음 전송 중단·목록 보존·수동 재시도만 새 요청을 확인했다. Cloudflare 실제 장애/쿼터의 정확한 응답을 검증했다고 해석하지 않는다.

기존 실제60초 timeout·저장 후 응답 손실·성공 결과 유지·수동 재시도·파일/본문/UTF-8 경계·세션 분리도 전체 회귀에 포함했다. 공통 `verificationPath`로 최종 이미지에 접두사를 적용해 과거 증거를 보존했다. [390px 전체 화면](./verification/FINAL-LOCAL-01-CATEGORY-03-mobile.png)을 view_image로 확인했다. 문서 점검 결과는 [FINAL-LOCAL-01-docs](./verification/FINAL-LOCAL-01-docs.json)에 기록한다. 통과 후 제품/테스트 변경이나 같은 앱 검사 반복은 없다. 원격 배포·원격 smoke·새 의존성·커밋/푸시는 수행하지 않았다.

문서 마무리: Markdown52개·로컬 참조649개·앵커11개에서 누락0, 보호 파일6개(원본 과제·manifest/lockfile/workspace 설정·기존migration1/2) 보존을 확인했다. `git -c core.safecrlf=false diff --check` 종료0, 추가/보강 코드5개의 끝 공백·skip/only/todo·고정 sleep 검사 이슈0이다. 새 테스트4개는 Git에 무시되지 않는 미추적 파일임을 확인했다. 이 점검을 앱 테스트 통과 수에 합산하지 않는다.

## CATEGORY-05 — 커스텀·카테고리 칩 스타일 (2026-10-23)

[사용자 요청](./conversations/2026-10-23-010.md)은 스타일 통일이다. 기존 로컬 Worker/Chromium으로 기존 삭제 시나리오의 같은 gif 칩/× 계산 스타일을 비교했다. `pnpm run test:e2e -- tests/e2e/category-interactions.spec.ts -g 'shared checkbox UI'`에서 실제1실패([Red](./verification/CATEGORY-05-red-ui.log)) 후 공통 CSS 재사용으로1개 통과([Green](./verification/CATEGORY-05-green-ui.log)). 글자 크기·여백·반경·테두리·배경·간격·높이/너비가 일치하고 기존 제거/복귀·새로고침·390px 가로넘침 검사도 통과했다. [커스텀](./verification/CATEGORY-05-custom-chips.png)과 [카테고리](./verification/CATEGORY-05-category-chips.png) 렌더를 직접 확인했다. 새 API/DB/의존성·배포는 없다.

첫 `pnpm run check`는 타입/빌드·단위42/Worker39 통과, E2E21/22다([report](./verification/runs/CHECK-2026-10-23T12-25-53-222Z-2ee53b86/report.json), [stdout](./verification/CATEGORY-05-final-check.log)). 실제60초 timeout 본문 assertion 오류 없이 context 종료 시 trace/network/zip 파일 ENOENT로 실패했다. 파일 누락의 외부 원인은 확인하지 못했다. uploader-ui-checks로 기존 진단 경로를 확인하고 앱/테스트를 바꾸지 않은 채 `pnpm run test:e2e -- --output .wrangler/category-05-playwright`로 출력 경로를 분리해 **E2E22개 통과·종료0**을 확인했다([최종 E2E](./verification/CATEGORY-05-final-e2e.log)). 이미 통과한 타입/빌드/단위/Worker는 반복하지 않았다. 최종 누적은 **단위42/Worker39/E2E22=103개·타입/빌드 통과**이며 단일 check 종료0으로 기록하지 않는다. 문서 링크/앵커 누락0·보호 파일 보존·공백 검사 종료0도 확인했다([문서](./verification/CATEGORY-05-docs.json)).

## CATEGORY-04 — 제거 모드 확장자 칩 (2026-10-23)

사용자 표시 수정([대화009](./conversations/2026-10-23-009.md))을 uploader-ui-checks로 확인했다. 기존 버전/실제 로컬 Worker/Chromium을 사용하며 앱 API·DB는 변경하지 않았다.

| 실제 명령·검사 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm run test:e2e -- tests/e2e/category-interactions.spec.ts -g 'shared checkbox UI'` | 먼저 실제1실패(제거 모드 체크박스 기대0/실제6), 최소 구현 뒤1개 통과 | [Red](./verification/CATEGORY-04-red-ui.log), [Green](./verification/CATEGORY-04-green-ui.log) |
| 실제 bounding box·제거/복귀·화면 확인 | ×가 텍스트 오른쪽이면서 같은 칩 내부, 세로 중앙 정렬. 데스크톱/390px 체크박스 숨김·가로넘침 없음. 소속 제거 후 일반 모드 체크박스 복귀/재접속 유지. view_image로 이미지도 확인 | [desktop](./verification/CATEGORY-04-removal-desktop.png), [mobile](./verification/CATEGORY-04-removal-mobile.png) |

최종 `pnpm run check`는 **종료0·단위42/Worker39/E2E22=103개·타입/빌드 통과**다([report](./verification/runs/CHECK-2026-10-23T12-13-43-096Z-fd6845db/report.json), [stdout](./verification/CATEGORY-04-final-check.log)). 기존 정책 T/저장·예산·실제60초 timeout을 포함한다. 기존 기능의 동작/저장 의미는 유지하고 새 기능·의존성·원격 배포/검증은 추가하지 않았다. 문서 링크/앵커 누락0·보호 파일 보존·Git 공백 검사 종료0도 확인했다([문서 점검](./verification/CATEGORY-04-docs.json)).

## CATEGORY-03 — 공통 카테고리 조작 로컬 검증 (2026-10-23)

사용자 수정1~4번의 실제 범위·판단·도구는 [대화008](./conversations/2026-10-23-008.md), 테스트 선행 계획은 TDD_PLAN CATEGORY-03을 따른다. 기존 의존성/전역 pnpm 스토어와 실제 로컬 D1/R2·Chromium을 사용했다. 배포/원격 검증은 수행하지 않았다.

| 실제 명령·검사 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/category-members.test.ts` | 신규3개 실제 실패→최소 구현 후3개 통과 | [Red](./verification/CATEGORY-03-red-worker.log), [Green](./verification/CATEGORY-03-green-worker.log) |
| `pnpm run test:e2e -- tests/e2e/category-interactions.spec.ts` | 새2개 실제 실패→최소 구현 후2개 통과 | [Red](./verification/CATEGORY-03-red-ui.log), [Green](./verification/CATEGORY-03-green-ui.log) |
| `pnpm run typecheck` | 종료0 | [타입](./verification/CATEGORY-03-typecheck.log) |
| 실제 member 저장 후 응답 유실·팝업 취소 | 입력/잠금 유지, 닫은 뒤 복구 안내 누락1개 실제 실패 | [보강 Red](./verification/CATEGORY-03-recovery-red.log) |
| 리팩토링 후 `pnpm run check` | 타입/빌드·단위42·Worker39 통과, E2E19/22. 닫힌 팝업의 중복 status DOM으로3개 strict locator 실패 | [첫 전체](./verification/CATEGORY-03-final-check.log) |
| 열린 팝업만 form 렌더 후 `pnpm run test:e2e -- tests/e2e/category-interactions.spec.ts tests/e2e/categories.spec.ts` | 카테고리 UI7/7 통과. 검사 조건을 낮추지 않고 중복 DOM 제거 | [UI7개](./verification/CATEGORY-03-green-ui2.log) |
| 일반 개발 `pnpm run db:local` | 종료0, migration5로 기존 세션의 기본 소속 보강, 사용자 정책/분류 보존 | [DB](./verification/CATEGORY-03-dev-db.log) |
| native dialog·키보드·레이아웃·view_image | 추가 input 포커스/Enter/Escape·포커스 복귀, 이름/삭제 팝업 취소/확인, 이름 오른쪽 수량 위치, 390px 가로넘침 없음. 모바일/팝업 이미지를 직접 확인 | [모바일](./verification/CATEGORY-03-mobile.png), [팝업](./verification/CATEGORY-03-popup.png), [전체 화면](./verification/CATEGORY-03-desktop.png) |

Worker는 기본 구성원 수정/재접속 보존·다른 세션 불변, 기본값 복원 없음·단일 전체 동적 대상, 이름만 변경 시 소속 유지, 정규화/중복·50개 동일DB 경합, 이전 세션 migration 보존을 확인했다. 변경된 heic 정책은 실제 업로드422/R2 객체0, 제외된 png는201/저장 바이트 일치를 확인했다. UI는 popup의 동일 카테고리 중복 차단과 기존 정책/다른 카테고리 등록 안내, 개별 체크로 소속 유지, 전체 버튼 전환, 제거 모드·사용자 이름/삭제 확인·응답 유실 복구를 확인했다.

최종 `pnpm run check`는 **종료0, 단위42/Worker39/E2E22=로컬103개와 타입/빌드 통과**다([report](./verification/runs/CHECK-2026-10-23T12-03-16-839Z-e7989aee/report.json), [stdout](./verification/CATEGORY-03-final-check2.log)). 기존 T/누적 예산·200개·저장/응답 손실·실제60초 timeout 회귀를 유지한다. 일반dev5173 HTML/새 세션/카테고리200·기본4분류 각5개도 확인했다([HTTP](./verification/CATEGORY-03-dev-http.json)). 실기기/전체 브라우저/스크린리더·부하·제공자 장애 모방·원격 배포 동작은 이번에 검증하지 않았다.

문서 마무리는 기존 Node 링크/앵커/보호 파일 검사에 출력 경로 인자를 추가해 과거 CATEGORY-01 증거를 덮어쓰지 않고 수행했다([CATEGORY-03 문서 결과](./verification/CATEGORY-03-docs.json)). 문서48개·로컬 참조507개·앵커11개 누락0, 원본 과제/의존성/이전 migration1·2 보존, Git 공백 검사 종료0·새 코드7개 끝 공백0이다. 과거 사용자 원문의 루트 기준 링크3개는 원문과 원래 문맥을 보존했다. 이 점검을 앱 테스트 추가 통과로 합산하지 않는다.

## CATEGORY-01/02 — 카테고리 후속 로컬 TDD (2026-10-23)

사용자 명시적 구현 요청으로 기존 V31/TC18 미구현 옵션 상태를 후속 구현으로 대체했다. 이전 날짜의 미구현 기록은 당시 결과다. 범위/AI 설계값은 [CATEGORY_PLAN](./CATEGORY_PLAN.md), 사용자 원문·선택 답변은 [004](./conversations/2026-10-23-004.md)·[005](./conversations/2026-10-23-005.md)를 따른다.

환경: 기존 Windows/Node24.16.0/pnpm11.5.1·D 전역 스토어·동일 의존성, 실제 로컬 D1/R2·Chromium. 일반dev는 `.wrangler/state/v3`, E2E는 `.wrangler/e2e`, Worker 통합은 격리된 실제 바인딩이다. 원격 배포/원격 smoke는 수행하지 않았다.

| 명령·확인 | 실제 결과 | 증거 |
| --- | --- | --- |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/categories.test.ts` | 샌드박스는런타임 미기동/미수집. 사용자 환경은 API404로 신규7개 실제 실패 | [환경](./verification/CATEGORY-01-red-worker.log), [Red](./verification/CATEGORY-01-red-worker-user.log) |
| `pnpm run test:e2e -- tests/e2e/categories.spec.ts` | 샌드박스는 localhost/log 오류. 사용자 환경은 화면/입력 미존재로2개 실제 실패 | [환경](./verification/CATEGORY-01-red-ui.log), [Red](./verification/CATEGORY-01-red-ui-user.log) |
| 최소 구현 후 동일 대상 실행 | Worker7/7·UI2/2 통과 | [Worker](./verification/CATEGORY-01-green-worker.log), [UI](./verification/CATEGORY-01-green-ui.log) |
| rollback·겹친 분류·UI응답 손실/한도 검사 보강 후 `pnpm run check` | 타입/빌드·단위42/Worker36/E2E19=97개 통과 | [첫 전체 report](./verification/runs/CHECK-2026-10-23T11-12-16-594Z-8ac35921/report.json), [stdout](./verification/CATEGORY-01-regression.log) |
| `pnpm run test:e2e -- tests/e2e/categories.spec.ts -g 'real saved response loss'` | 첫 통과는 대기 부족. 재조회 완료까지 기다린 검사에서 과거 오류 안내 잔존으로1실패 | [첫 검사](./verification/CATEGORY-02-red-ui.log), [실제 Red](./verification/CATEGORY-02-red-ui2.log) |
| 복구 안내 수정·리팩토링 후 전체 check 시도1/2 | 정적/단위/Worker 통과. E2E 각각16/19·17/19. 준비 전에 파일을 주입하던 기존 검사 선행조건을 보정 | [시도1](./verification/CATEGORY-02-final-regression.log), [시도2](./verification/CATEGORY-02-final-regression2.log) |
| 일반 로컬 `pnpm run db:local` | 종료0, migration4 적용. 기존 정책 초기화 없음 | [dev DB](./verification/CATEGORY-01-dev-db.log) |
| view_image로 실제 desktop/390px 열기 | 카드·필터·입력·버튼 줄바꿈 확인, Playwright 가로넘침 검사 통과 | [desktop](./verification/CATEGORY-01-desktop.png), [mobile](./verification/CATEGORY-01-mobile.png) |

실제 새 범위: 기본4분류 각5개/조회 무변경, 이름·구성원 정규화/세션 격리/새로고침, 고정+custom 일괄 차단·허용, 199/200개 경계·동일 DB 경합의 전체 성공/취소, 실제 로컬 제약 실패의 편집/삭제 rollback, 겹친 분류와 삭제의 차단 해제, 정책/업로드 잠금·응답 유실 재조회, 사전 검사와 실제 R2 바이트를 확인했다. 기존 T/앱 예산/성공 결과/실제60초 timeout 회귀도 포함한다. D1 trigger fixture의 앱 rollback을 Cloudflare 실제 장애 모방으로 기록하지 않는다.

최종 `pnpm run check` 시도3은 **종료0, 단위42/Worker36/E2E19=로컬97개·타입/빌드 통과**다([최종 report](./verification/runs/CHECK-2026-10-23T11-23-01-521Z-1fd008d8/report.json), [stdout](./verification/CATEGORY-02-final-regression3.log)). 복구 안내/카테고리8개 Worker·4개 UI와 기존 기능 전체가 포함된다. 통과 뒤 앱 소스는 바꾸지 않았다. 일반 개발5173의 HTML/새 세션/카테고리 GET200, 기본4분류 각5개·고정7/custom0도 확인했다([HTTP](./verification/CATEGORY-01-dev-http.json)). 문서 링크/앵커·원본/의존성 보존은 [점검 스크립트](./verification/CATEGORY-01-check-docs.mjs)와 [결과](./verification/CATEGORY-01-docs.json)를 따른다. 최초 단순 상대경로 검사에서 사용자 원문 내 저장소 루트 기준 참조3개를 확인해 원문을 보존하고 원래 문맥으로 검사했다. 모바일 실기기/파일 내용 검사/부하/무료 요금 보장/카테고리 원격 동작은 검증하지 않았다.

## SESSION-01 — 익명 세션 정책 로컬 TDD (2026-10-23)

환경은 기존 Windows/Node24.16.0/pnpm11.5.1, 실제 로컬 D1/R2와 Chromium이다. 의존성/lockfile 변경 없음. 원본 과제의 기본값·DB 저장/새로고침 유지·20자/200개/중복/삭제·실제 서버 업로드 판정을 세션별로 유지한다. 공개 데모는 이전 버전이며 이번 코드를 배포하지 않았다.

| 실제 명령·절차 | 결과 | 증거 |
| --- | --- | --- |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/sessions.test.ts -t 'SESSION: (creates\|isolates\|applies\|missing\|new identity)'` | 종료1, 신규5개 기능 실패. 초기화404·무쿠키 조회200. rollback1개는 이 Red 필터에서 제외 | [Worker Red](./verification/SESSION-01-red-worker.log) |
| `pnpm run test:e2e -- sessions.spec.ts -g 'fresh browser'` | 종료1, 별도 B context에 A의 체크1개가 보임 | [UI Red](./verification/SESSION-01-red-ui.log) |
| 최소 구현 후 `pnpm run test:integration` | 종료0, 신규6+기존22=28개 | [Worker Green](./verification/SESSION-01-green-worker.log) |
| `pnpm run test:e2e -- sessions.spec.ts` | 종료0, 신규2개 | [UI Green](./verification/SESSION-01-green-ui.log) |
| 리팩토링 후 `pnpm run check` | 종료0, typecheck/build·단위42·Worker28·E2E15=**로컬85개 통과** | [report](./verification/runs/CHECK-2026-10-23T11-04-16-943Z-a7c2e320/report.json), [stdout](./verification/SESSION-01-final-check.log) |
| `pnpm run db:local` | 종료0, 일반dev의 migration3 적용 | [dev DB](./verification/SESSION-01-dev-db.log) |
| Chromium으로 기존5173 dev 초기 화면 확인·캡처, view_image로 desktop/390px 열기 | 새 익명 세션 fixed7 unchecked/custom0·세션 안내·page 오류0. 새 UI의 줄바꿈/기존 행 버튼 확인 | [dev JSON](./verification/SESSION-01-dev-browser.json), [dev desktop](./verification/SESSION-01-local-desktop.png), [390px](./verification/SESSION-01-mobile.png), [정책](./verification/SESSION-01-policy-desktop.png), [레이아웃](./verification/SESSION-01-layout-desktop.png) |

실제 DB/R2 증거: 서버 세션 토큰 해시만 저장, 기존 전역 체크값을 새 세션에 복사하지 않음, 세션 batch 롤백은 실제 D1 trigger의 seed 거절로 확인했다. 같은 DB에 A/B 정책을 만들고 CRUD/같은 custom/세션별200개·같은 세션 원자적 경쟁을 검증했다. A차단은 객체0, B허용은 R2에서 원문 바이트를 다시 읽어 일치, 새 C세션도 앱 전체 예산을 우회하지 못했다. 무쿠키·형식 오류·미발급/중복 쿠키는 조회/편집/업로드401, 새 세션 초기화만 새 토큰을 발급한다. 로그와 JSON 본문에 토큰을 노출하지 않는다.

UI 증거: 서로 다른 browser context는 초기값 독립, A의 새로고침과 같은 context의 새 탭은 변경값 유지. 쿠키 미전달 상황은 session bootstrap 응답만 좁게 제어하고 실제 정책 GET401·편집/업로드 잠금·복구를 확인했다. 이전13개 E2E도 실제60초 timeout·응답 손실·성공 보존·수동 재시도·T 정책 거절·글로벌 예산 거절까지 전부 통과했다. 기존 assertion을 약화하지 않고 APIRequest를 브라우저와 같은 쿠키 저장소로 맞췄다.

전체 검사 후 바뀐 테스트 파일은 screenshot 출력 경로뿐이다. 과거 이미지3개는 이번 이미지를 SESSION-01로 복사한 뒤 기존 Git 원본으로 복구했고, 향후 캡처는 실행 prefix를 사용한다. 제품/검증 조건 변화가 없어 전체 검사를 반복하지 않으며 `playwright test --list`로 수집을 확인한다. 원격 smoke는 이후 호환성을 위해 같은 context 쿠키를 쓰도록 수정했지만 실행하지 않았다.

최종 수집에서 별도 채팅이 추가한 카테고리4개를 포함해 E2E19개가 수집됨을 확인했다([수집](./verification/SESSION-01-collection.log)). 이 외부 변경은 보존하고, 그 작업의 완결된 [전체 report](./verification/runs/CHECK-2026-10-23T11-12-16-594Z-8ac35921/report.json)/[stdout](./verification/CATEGORY-01-regression.log)을 읽어 타입/빌드·단위42/Worker36/E2E19=97 통과와 세션 검사 유지도 확인했다. 이는 해당 채팅이 실행한 결과이며 세션 작업의85개 실행과 중복 합산하지 않는다. 세션/카테고리 대화 파일 번호 충돌은 원본 채팅의 fileChange 기록으로 복구·분리했다.

20:16 KST 최종 문서 검사: Markdown22개·로컬 참조352개 누락0, Git 공백 검사0, 원본 과제·package/lockfile·migration1/2 보존 확인([결과](./verification/SESSION-01-docs.json)). 동시 변경 후 일반dev의 migration도 확인해 더 적용할 것이 없었다([결과](./verification/SESSION-01-current-dev-db.log)).

한계: 같은 브라우저 쿠키를 공유하는 탭/사람은 같은 정책이다. Expires/Max-Age 없는 쿠키가 브라우저 복원으로 유지될 수 있다. 별도 서버 TTL·DB 자동 정리·세션 발급 제한·초기화 UI는 구현하지 않아 익명 세션 행이 누적된다. 앱 전체 자원 예산은 공유로 유지한다. 원격 migration/배포/원격검증·커밋/푸시 없음. [TDD 상세](./TDD_LOG.md), [사용자 원문·응답](./conversations/2026-10-23-007-session-implementation.md).

상태: **로컬 앱 검증·실제 공개 배포/원격 저장 검증 완료** (2026-10-22). 아래 V 표는 기준 명세이며 실제 수행/한계는 실행 원장을 따른다. 환경 스모크와 앱 결과를 구분한다. 조건부 V31 옵션은 미구현이다.

## 검증 방식

- Vitest 순수 규칙 검증: 정규화, 파일명 토큰 추출, 차단 판정, 경계값.
- Workers 런타임 통합: 실제 로컬 D1/R2 바인딩을 사용해 API·제약·경쟁·실제 저장·앱 예산 거절을 확인한다. Cloudflare 운영 장애·계정 쿼터 응답을 Error/503 대역으로 모방하는 검사는 제외한다. 실제 저장 후 응답 전달 차단은 클라이언트 처리 검증으로 구분한다.
- Playwright: 한 화면의 핵심 사용자 흐름과 UI/서버 상태 일치를 확인한다. 실제 로컬 Worker API와 저장소를 사용한다.
- 배포 수동 검증: 별도 테스트용 파일/커스텀 값으로 원격 D1/R2와 공개 URL을 확인한다. 결과는 로컬 결과와 구분한다.

## TDD 실행 계획과 기록

사용자가 수정된 [TDD_PLAN](./TDD_PLAN.md)을 승인해 S0부터 실제 구현했다. TC18/V31은 조건부 옵션으로 생략했다. Cloudflare 응답 모방 제외에 따라 V17/V35/V40은 앱 자체 조건과 클라이언트 통신 제어만 검사한다.

승인 후 매 루프 테스트 선행·실제 Red의 원인 기록·최소 구현·리팩토링·대상 재검증 및 누적 회귀 확인을 수행한다. 실패 분류·실제 메시지·각 실행 명령/종료 코드·리팩토링 이유·기존 기능 결과는 [TDD_LOG](./TDD_LOG.md)에 남기고 여기의 관련 V 항목과 증거를 연결한다. 지금까지 구현된 기능의 단위/Worker 통합/핵심 E2E를 회귀 대상으로 누적하며 미구현 계층은 통과로 세지 않는다.

실제 앱 TDD 루프는 S0-C01~S5-C01 및 S6-C01/C02로 [TDD_LOG](./TDD_LOG.md)에 기록했다. S2 초기 fixture 오류와 절차 보정, S4 환경 오류, S5 통신 제어 fixture 오류도 누락하지 않았다. 아래 과거 환경/계획 검사 결과를 기능 Red/Green으로 소급하지 않는다.

후속 범위 수정 확인(22:04 KST): Cloudflare 실제 장애·계정 한도 응답의 모방 제외, 앱 자체 예산/정책 불변식/클라이언트 통신 제어 유지. 문서 32개/로컬 링크 185개, 깨진 참조 0개·보호 파일 9개 해시 동일·Git 공백 검사 성공. 증거는 `.docs/verification/TDD-SCOPE-20261022-docs.json`. 앱/Cloudflare 장애 테스트는 미실행이다.

2026-10-22 21:49 KST 계획 문서 확인: Markdown 31개/로컬 링크 183개, 깨진 경로·앵커 0개. S0~S8·TC01~TC19와 기존 V01~V40의 참조 누락 없음(V31 조건부). 원본·패키지·lockfile·하네스·기존 스킬 등 9개 보호 파일의 SHA-256 동일, 앱/테스트/설정/SQL 미생성, Git 공백 검사 성공. 증거는 `.docs/verification/TDDPLAN-20261022-docs.json`이며 앱 테스트가 아닌 문서 검사 결과다.

## 기본 계획(P0) 검증표

P0는 우선순위이며 과제 필수 여부나 상호 합의를 뜻하지 않는다. A/B는 필수 목표, K는 초기 후보이다. 현재 반영 범위는 PLAN/DECISIONS를 기준으로 한다. USER-01/02/03/05/06은 V26~30, 조건부 USER-04a/04b는 V31, AI-01/02/03/05/06/08의 핵심 추가·품질 기준은 아래 관련 항목과 V32~36으로 검증한다. [UI_UX.md](./UI_UX.md)의 구체 화면 흐름·경계 조건은 V37~40에서도 확인한다. 시그니처·상태 조회 확장안은 생략/보류 상태이다.

| ID | 시나리오/입력 | 기대 결과 | 방식 |
| --- | --- | --- | --- |
| V01 (A1) | 새 DB 초기화 | 고정 7개 전부 해제, 커스텀 0개 | 통합 + E2E |
| V02 (A2) | exe 체크/해제 → 재조회·새로고침·seed 재실행 | 마지막 저장 값 유지, 커스텀에는 없음 | 통합 + E2E |
| V03 (A3/K1) | `sh`, `. SH `, `SH` | 처음만 저장, 나머지는 동일 정규화 값 중복 | 단위 + 통합 |
| V04 (A3/K1) | 20자/21자, 빈값, `..sh`, `tar.gz`, 내부 공백, 한글/전각 확장자 | 20자만 허용, 나머지 값 오류 | 단위 + 통합 |
| V05 (A3) | 200개 도달 후 추가, 하나 삭제 후 추가 | 초과 거절, 삭제 후 성공, 200개 유지 | 통합 |
| V06 (A3/K4) | 199개에서 서로 다른 2개 동시 추가, 같은 값 동시 추가 | 총수 200 이하, 동일 값 1행 | 실제 D1 통합 |
| V07 (A3/A4/K1) | X 삭제·이미 없는 값 재삭제·고정 exe 커스텀 추가/삭제 시도 | custom 삭제 멱등, fixed 중복/삭제 거절 | 통합 + E2E |
| V08 (B1/B2/K1) | exe 차단 후 `a.exe`, `a.EXE`, `a.exe.txt`를 UI 및 직접 API 전송 | 모두 422, 이유에 exe, R2 객체 증가 없음 | 단위 + 통합 + E2E |
| V09 (B3) | 정상 `sample.txt`, 허용된 `archive.tar.gz` | 201, ID, R2 실제 바이트 일치 | 통합 + E2E |
| V10 (B1) | fixed exe 해제 후 exe 업로드 | 다른 파일 규칙 통과 시 허용. 숨은 고정 차단 없음 | 통합 |
| V11 (K1/K2) | `README`, `.env`, 끝 점/공백, 연속 점, 제어문자, 경로/콜론 포함 이름 | 명세대로 422 또는 파서 거절 400, 저장 없음 | 단위 + raw multipart |
| V12 (K2) | UTF-8 이름 255/256바이트, 한글 이름 | 255 허용, 256 거절, 한글 바이트 기준 | 단위 + 통합 |
| V13 (K2) | 0바이트/5 MiB/5 MiB+1, 전체 본문 6 MiB 초과 | 0은 422, 5 MiB 허용, 초과 413 | 통합 |
| V14 (K2) | Content-Length 없는 큰 본문 및 런타임이 허용하는 길이 불일치 요청 | 실제 바이트 상한 적용, 저장 없음 | HTTP/통합, 전송 계층의 선제 거절은 별도 기록 |
| V15 (K2) | 파일 없음/2개/중복 file/문자열 file/추가 필드/깨진 multipart | 400, 저장 없음 | 통합 |
| V16 (B1/K2) | 차단 파일의 MIME을 image/png로 위조 | MIME과 무관하게 정책 차단 | 통합 |
| V17 (K3, 범위 축소) | 실제 로컬 D1의 고정 정책 누락 | 앱 503, 성공 UI 없음, 정책 불변식 오류 시 R2 미호출. 실제 D1/R2 운영 장애/비정상 반환 모방은 제외·미검증 | 실제 D1 fixture + E2E |
| V18 (A2/A3/K3) | 정책 저장 실패 및 저장 후 응답 유실 | 실패 시 기존 값 유지, 불확실 시 GET으로 재동기화 | 통합 + E2E |
| V19 (A2/K4) | 서로 다른 항목 동시 변경 / 같은 항목 동시 변경 | 서로 보존 / 마지막 커밋 우선 | 통합 |
| V20 (B1/K4) | 정책 조회 전 변경 / 조회 후 변경 | DESIGN의 판정 시점과 일치 | 통합, 해당 경계만 제어 |
| V21 (K3) | 저장 성공 이후 응답 유실 | 완료 여부 불명확 안내. 재시도 중복 가능성 기록 | E2E/실패 주입 |
| V22 (K3) | 초기 조회 오류·처리 중 연타·재시도 | 입력 보존, 작업 잠금, 명확한 상태 표시 | E2E |
| V23 (K5) | 키보드 이동, label, 결과 알림, 모바일 폭 | 기본 조작 가능, 가로 넘침 최소화 | E2E + 수동 |
| V24 (K2/K6/Q1) | 없는 `/api/*`, JSON 아닌 변경, 다른 Origin, 4 KiB 초과 JSON | 404/415/403/413 JSON, HTML 200 fallback 없음 | 통합 |
| V25 (D1/D2) | 배포 URL에서 저장·새로고침·차단·허용 업로드 | 원격 D1/R2 실제 동작, 공개 접속 가능 | 배포 수동 |
| V26 (USER-01) | 복수 파일 선택, 허용/차단 파일 혼합 | 파일을 각각 식별하고 처리 결과를 구분 | E2E + 통합 |
| V27 (USER-02) | 같은 파일들을 선택 창과 드롭으로 등록 | 같은 정책 판정, 드롭 중 페이지 이탈 없음, 클릭 선택 가능 | E2E + 수동 |
| V28 (USER-03) | 전송 완료 뒤 서버 저장 지연·거절·실패 | 파일별 상태 표시, 전송 100%만으로 성공 처리하지 않음 | E2E + 통합 |
| V29 (USER-05) | 대표 분류·알 수 없는 확장자·초기 정책 조회 | 사전 분류 안내, 미분류 처리, 사전 표시만으로 차단 정책 변경 없음 | 단위 + E2E |
| V30 (USER-06) | 전송 전 차단 파일 확인·제외, 확인 후 서버 정책 변경 | 예상 이유 확인·제외 가능, 서버의 최종 판정 유지 | E2E + 통합 |
| V31 (USER-04a/04b, 시간 여유 시) | 필터 조회·대표 분류 일괄 적용, 수동 등록/고정 항목, 상한/중복/실패 | 필터만으로 쓰기 없음, 고정 영역/전체 수 유지. 대표 목록만 적용, 수동 등록 해제 안내, 전체 성공/실패·200개 상한 확인 | 옵션 구현 시 통합 + E2E |
| V32 (AI-01/02) | 대기 목록 제외 후 시작, 성공/실패 혼합에서 실패 항목만 재시도 | 제외 파일 미전송, 성공 항목 유지/재전송 없음, 자동 재시도 없음 | E2E + 통합 |
| V33 (AI-03) | 등록된 fixed/custom 검색, 중복 입력, 미등록 값 조회 | 해당 등록 항목만 확인, 중복 추가 방지 보조, 외부 검색/자동 신규 등록 없음 | E2E + 통합 |
| V34 (AI-08) | T 이전/이후 정책 변경, 성공 후 현재 정책 재조회 | T 전 변경 반영, T 후 변경은 다음 요청 적용, 완료 결과 유지 | 통합 + E2E |
| V35 (AI-05, 앱 예산) | 앱 누적 예산 경계의 동시 예약/조건부 거절, 실제 저장 후 클라이언트 응답 유실, seed 재실행 | 앱 예산 초과 없음·예약 거절 시 put 없음. 앱 예산 오류 반환·응답 유실/seed에 따른 환급/자동 초기화 없음. Cloudflare 계정 한도/저장 장애 모방 제외 | 실제 로컬 D1/R2 + 응답 전달 제어 |
| V36 (AI-02/05/06/08) | 정상 저장 후 응답 유실·파싱 실패·타임아웃, 사용자가 수동 재업로드 | 성공 추정/상태 polling 없음, 완료 확인 실패 안내, 새 T 판정과 추가 예산 소비, 비공개 저장 | 실패 주입 + E2E |
| V37 (A3, UI F03) | 원문 20/21자, 정규화 후 20자가 되는 점 포함 21자, 초과 붙여넣기 | 원문과 정규화 값 모두 상한 적용, 21자 거절, 무단 잘라 등록하지 않고 입력 보존 | 단위 + 통합 + E2E |
| V38 (UI C01/02/06) | 목록 8개에서 3개 추가, 같은 이름의 별도 파일, 선택 창 취소, 완료 행 제거 | 초과 묶음 전체 거절/기존 8개 유지, 같은 이름 별도 처리, 취소 시 보존, 행 제거는 서버 파일 삭제 요청 없음 | E2E |
| V39 (UI C04/08, 후속 입력 분리) | 별도 등록 확인 입력, 해제된 fixed 조회, 대표 클릭 시 추가 입력만 변경 | 현재 등록 값의 정확한 일치만 확인, 등록/차단 구분, 대표 클릭은 입력만 채우며 자동 정책 쓰기 없음 | E2E + 통합 |
| V40 (UI 5절, 범위 명확화) | 정책 GET의 앱 오류/클라이언트 차단, 그룹 중 편집/추가/제거, 개별 거절/브라우저 통신 차단/앱 자체 예산 거절, 새로고침 | GET 실패 시 미전송·조작 잠금. 개별 거절 뒤 가능한 항목 계속, 통신 실패/앱 예산 거절은 다음 요청 중단. 새로고침 시 정책 유지/목록 초기화. Cloudflare 응답 모방 제외 | 실제 API·앱 예산 E2E + 클라이언트 통신 제어 |

시그니처 검사는 이번 범위에서 생략한다. 파일 헤더/내용 검사 통과를 성공 조건이나 UI 문구로 사용하지 않는지 확인한다. 검사 대안 자체는 FEATURE_BRAINSTORM에 보관한다.

## 실행·증거 원칙

1. 상한/동시성 검증은 격리된 로컬 DB에서 실행한다. 공개 데모의 200개 데이터를 테스트로 채우지 않는다.
2. 로컬 초기화 전용 DB/버킷과 원격 리소스를 구분한다. 테스트 종료 시 테스트가 만든 데이터만 정리한다.
3. 무해한 텍스트·더미 바이트 fixture를 사용한다. 실제 악성코드나 개인정보는 필요하지 않다.
4. 통합 저장 성공은 응답 코드뿐 아니라 R2 객체 바이트를 읽어 확인한다. 거절은 고립된 저장소의 객체 수/키 또는 put 미호출 증거를 확인한다.
5. 필요한 typecheck/build, 위 단위·통합 검증, 핵심 E2E가 통과하면 결과를 정리하고 배포로 진행한다. 새 변경/실패가 없으면 같은 검사를 불필요하게 반복하지 않는다.
6. 파일 기반 증거는 `.docs/verification/`에 두고 실행 ID로 연결한다. 의존성 캐시나 로컬 DB 자체를 증거로 커밋하지 않는다.

## 개발 환경 실행 결과

공통 환경: Windows x64, 기존 Node.js v24.16.0/pnpm 11.5.1, PC 전역 스토어 `D:\.pnpm-store\v11`. 아래 시각은 도구 확인 KST이며 사용자 전송 시각이 아니다. 설치/기동 명령은 PC 계정 실행 환경에서 수행했다. 전체 버전과 재현 방법은 [DEVELOPMENT.md](./DEVELOPMENT.md)에 있다.

| 실행 ID | KST 시각 | 실제 명령·절차 | 결과 | 증거·한계 |
| --- | --- | --- | --- | --- |
| ENV-01 | 2026-10-22 20:55~20:56 | `pnpm install --reporter=append-only` | 종료 0, 직접 의존성 13개. 캐시 재사용 107개/다운로드 16개, 연결 120개. strict peer 검사 성공 | [설치 로그](./verification/ENV-20261022-install.txt). 기존 캐시 버전 유지, 정확한 직접 버전과 lockfile 생성 |
| ENV-02 | 2026-10-22 20:56~20:57 | `pnpm exec playwright install chromium` | 종료 0, Chromium/Headless Shell 156.0.8078.4 및 FFmpeg/Winldd 설치 | [브라우저 설치 로그](./verification/ENV-20261022-browsers.txt). Firefox/WebKit 미설치 |
| ENV-03 | 2026-10-22 20:56 | `pnpm exec vite --version`, `tsc --version`, `vue-tsc --version`, `vitest --version`, `playwright --version`, `wrangler --version` (각 CLI에 `pnpm exec` 사용), `pnpm list --depth=0` | 모두 실행 성공. Vite 6.4.3/TS 5.6.3/Vitest 4.1.10/Playwright 1.64.1/Wrangler 4.127.1 | vue-tsc CLI 출력은 사용하는 TS 버전 5.6.3이다. 패키지 버전 자체는 2.2.12. 실제 패키지 버전은 ENV-04 JSON에서도 확인 |
| ENV-04a | 2026-10-22 20:58:17 | `node .docs/verification/check-environment.mjs` | 종료 1. 점검 스크립트의 가상 Vite 진입 경로 오류 | [실패 1](./verification/ENV-20261022-smoke-attempt1.json). 앱/의존성 문제로 단정하지 않음 |
| ENV-04b | 2026-10-22 20:58:36 | 위 명령, 가상 진입 경로 수정 후 재실행 | 종료 1. 빌드 반환값 배열을 객체로 처리한 점검 코드 오류 | [실패 2](./verification/ENV-20261022-smoke-attempt2.json). 결과 배열 형식 처리로 수정 |
| ENV-04c | 2026-10-22 20:58:51 | 위 명령, 결과 배열 처리 수정 후 재실행 | 종료 1. Vue 빌드 통과, Miniflare 5의 옵션 형식 불일치 | [실패 3](./verification/ENV-20261022-smoke-attempt3.json). 설치된 타입 정의를 확인해 제공 API `convertV4MiniflareOptions` 사용 |
| ENV-04 | 2026-10-22 20:59:22 | 위 명령, 옵션 변환 수정 후 재실행 | 종료 0. 패키지 버전·플러그인 import, Vue/TS 메모리 빌드, 로컬 Worker 응답/D1 SELECT/R2 put·get·delete, Chromium headless 기동 성공 | [최종 JSON](./verification/ENV-20261022-smoke.json), [stdout](./verification/ENV-20261022-smoke.txt), [점검 스크립트](./verification/check-environment.mjs). 실제 storeDir도 확인. 임시 로컬 리소스만 사용, 앱 기능/원격/성능 검증 아님 |
| ENV-05 | 2026-10-22 20:59~21:00 | `pnpm install --frozen-lockfile --offline --reporter=append-only`, 실행 전후 `Get-FileHash pnpm-lock.yaml -Algorithm SHA256` | 종료 0, 추가 다운로드 없음, lockfile 해시 동일 | [설치 결과](./verification/ENV-20261022-frozen-offline.txt), [해시 확인](./verification/ENV-20261022-lockfile.json). 기존 설치와 캐시를 사용한 재현 확인이며 별도 깨끗한 PC 검증은 아님 |

세 번의 스모크 실패는 AI가 작성한 환경 점검 스크립트의 오류였다. 수정 시 패키지 버전은 유지했고 통과 후 같은 스모크를 반복하지 않았다. 테스트용 Worker 코드는 점검 스크립트의 메모리 내 응답만 다루며 앱/API 구현·SQL 마이그레이션을 만들지 않는다.

## 스킬·하네스 준비 확인 (2026-10-22)

앱 검증과 구분한다. 새 의존성 설치 없이 기존 Node/pnpm으로 실행했다. 구성·선정 근거는 [HARNESS](./HARNESS.md)를 따른다.

| 실행 ID | KST 시각 | 실제 명령·절차 | 결과·한계 | 증거 |
| --- | --- | --- | --- | --- |
| HARNESS-01 | 21:16 | `pnpm run check:plan` | 종료 0. 환경/앱 모드와 없는 앱 스크립트 5개 표시. 검사를 실행한 결과가 아님 | 사용자에게 보인 도구 출력·HARNESS 문서 |
| HARNESS-02 | 21:16 | `pnpm run check`, `node .docs/harness/check.mjs invalid` | 각각 종료 2. 앱 준비 부재와 잘못된 인수를 통과로 처리하지 않음. 앱 하위 단계 0개 실행 | [미준비 JSON](./verification/runs/CHECK-2026-10-22T12-16-15-043Z-a8ec1695/report.json) |
| HARNESS-03 | 21:17 | `pnpm run check:env` | 종료 0. CLI 연결·실행별 증거·기존 환경 스모크 통과. 앱 테스트 아님 | [하네스 결과](./verification/runs/CHECK-2026-10-22T12-16-58-955Z-87aea6fd/report.json), [환경 결과](./verification/runs/CHECK-2026-10-22T12-16-58-955Z-87aea6fd/environment.json) |
| HARNESS-04 | 21:20 | Node 내장 기능으로 임시 디렉터리에 실행기·대역 pnpm CLI를 두고 정상/실패 실행 | 5단계 정상은 종료 0, test:unit 자식 종료 7이면 하네스 종료 1·뒤 2단계 미실행. 앱 스크립트를 구현한 것이 아님 | [제어 흐름 결과](./verification/HARNESS-20261022-runner-control.json) |
| HARNESS-05 | 21:16~21:20 | `quick_validate.py` 시도, 이후 Node 내장 기능으로 두 SKILL.md frontmatter 검사 | 번들 검증기는 PyYAML 부재로 실행 실패. 추가 설치 없이 작성한 두 단순 scalar frontmatter의 필드·이름·설명 검사 성공. 범용 YAML/자동 선택/실제 행동 평가는 미검증 | [제한된 구조 검사](./verification/HARNESS-20261022-skills.json) |

기존 환경 스모크에 출력 파일 경로를 전달하도록 수정해 과거 기준 결과를 보존했다. 실제 앱 검증의 순차 연결은 앱 구현 후 확인한다. 스킬은 관련 작업의 판단 기준이며 실행만으로 도메인 검증이 자동 보장되는 것은 아니다.

21:24 KST 최종 확인: Markdown 28개(스킬 2개 포함), 로컬 링크 149개, 깨진 경로·앵커 0개. Git 공백 검사 성공. 직접 의존성 버전 13개·lockfile SHA-256·이전 환경 기준 JSON 보존을 확인했고 앱 스캐폴딩 파일이 생성되지 않았음을 확인했다. 증거: `.docs/verification/HARNESS-20261022-final.json`. 앱 테스트 통과로 표시하지 않는다.

## 애플리케이션 실행 결과 원장

| 실행 ID | KST 시각 | 환경/버전 | 실제 명령·절차 | 검증 ID | 결과/실패 | 증거/후속 조치 |
| --- | --- | --- | --- | --- | --- | --- |
| 미실행 | — | 구현 전 | — | 전체 | 계획만 작성 | 구현 요청 후 기록 |

배포 URL: 미생성. GitHub: [Meggigoatee/file-uploader-demo](https://github.com/Meggigoatee/file-uploader-demo). 면접 당일 접속 확인: 일정 미제공/미실행.

## 이번 문서 작업 확인

- 원본의 필수 기능과 제출 항목을 PLAN에 대응시켰다.
- 원본 3-1~3-4 고려사항을 CONSIDERATIONS에 포함했다.
- 스키마의 컬럼·타입·제약·인덱스를 DESIGN에 기술했다. 실제 SQL은 미작성이다.
- 대화 기록/AI 활용 기록을 분리하고 미구현·미실행 상태를 명시했다.
- 2026-10-21 21:04 KST 기준 문서 점검: PowerShell로 Markdown 코드 블록을 제외한 로컬 링크 9개(앵커 포함)를 확인했으며 깨진 링크 0개. 원본 포함 Markdown 8개, `.docs` 밖 파일 0개를 확인했다.
- 일정의 단계별 합계는 360분이다. 파일 크기 표현을 ‘1바이트 이상, 5 MiB 이하’로 정정해 0바이트 거절 기준과 일치시켰다. 이 점검은 애플리케이션 테스트 통과를 뜻하지 않는다.
- 사용자 정의 보강(P002) 반영 후 재점검: Markdown 9개, 로컬 링크 11개(앵커 포함), 깨진 링크 0개, `.docs` 밖 파일 0개, 360분 유지. 검증표에 이전 B4 참조가 남지 않았으며 필수 A/B와 추가 K 목표 참조를 구분했다.
- 브레인스토밍(P003/P004) 반영 후 문서 점검: Markdown 12개, 로컬 링크 21개(앵커 포함), 깨진 링크 0개, `.docs` 밖 파일 0개. 비교용 일정 360분, 묶음 비용 산술 합계 A 70~110분/B 90~140분 확인. 비용 추정의 정확성을 검증한 것은 아니며 앱 테스트는 미실행이다.
- 사용자 기능 채택(P006) 반영 후 문서 점검: Markdown 14개, 로컬 링크 25개(앵커 포함), 깨진 링크 0개, `.docs` 밖 파일 0개. PLAN에 채택된 사용자 기능 5개와 시간 여유 시 기능 구분을 확인하고 V26~31 계획을 추가했다. 앱 검증과 시간 실측은 미실행이다.
- 승인·설계 검토(P007) 반영 후 문서 점검: Markdown 16개, 로컬 링크 32개(앵커 포함), 깨진 링크 0개, `.docs` 밖 파일 0개. T 전후 정책 변경/결과 보존, 수동 재시도, 예산 동시 예약/미환급 검증 계획을 반영했다. 앱 테스트·CPU/메모리 실측은 미실행이다.
- 기술 기준안·UI/UX 설계(P009) 반영 후 2026-10-21 22:59 KST 문서 점검: Markdown 19개, 코드 블록 제외 로컬 링크 45개(앵커 포함), 깨진 링크 0개, `.docs` 밖 파일 0개. UI 표는 필수 7행·핵심 11행·조건부 옵션 2행이며 PLAN의 합의 분류와 대응한다. V37~40은 계획으로 추가했다. 실제 UI 렌더링·앱 테스트·배포·성능/시간 실측은 미실행이다.
- 오늘 설계 마무리·루트 문서(P010) 점검: Markdown 22개, 코드 블록 제외 로컬 링크 72개(앵커 포함), 깨진 링크 0개. `.docs` 밖 파일은 사용자가 요청한 README/AGENTS 2개만 존재한다. 일반 비밀키 패턴 후보와 이번 수정 문서의 비정상 문자 0개. 앱 코드·설정·SQL·설치·앱 테스트·배포 없음.
- 2026-10-22 개발 의존성 준비(P011) 문서·범위 확인: Markdown 24개, 로컬 링크 105개(앵커 포함), 깨진 경로/앵커 0개. [검사 결과](./verification/ENV-20261022-docs.json). `git diff --check` 성공, .gitignore가 node_modules/로컬 DB·환경 변수·스토어·빌드/테스트 산출물을 제외하는지 확인. 원본 과제는 변경하지 않았다. 패키지/환경 점검과 관련 문서만 변경했으며 앱 코드·SQL·배포 설정은 생성하지 않았다.

## 실제 앱 구현·회귀·배포 실행 원장 (2026-10-22)

환경: Windows x64 / Node 24.16.0 / pnpm 11.5.1 / 기존 전역 store `D:\.pnpm-store\v11`. 기존 의존성 버전 유지. 실제 기능 루프의 명령·최초 실패·재실행·리팩토링은 [TDD_LOG](./TDD_LOG.md)를 따른다.

| 실행 | 실제 결과 | 증거 |
| --- | --- | --- |
| S0~S5 기능 루프 | 최초 기능 실패와 최소 구현 후 통과. S2 초기 SQL fixture 오류/순서 보정, S4 HMR 오류, S5 통신 fixture 오류도 별도 기록 | [TDD_LOG](./TDD_LOG.md) |
| S6 최초 전체 하네스 | 종료 2. pnpm.mjs 미인식 도구 오류. 수정 후 타입/빌드/단위42/Worker19/E2E9 통과 | [blocked](./verification/S6-final-check.log), [report](./verification/runs/CHECK-2026-10-22T13-41-41-313Z-78c64850/report.json) |
| S6 경계 보강 | 타입/빌드/단위42/Worker21/E2E9 종료 0 | [report](./verification/runs/CHECK-2026-10-22T13-44-29-997Z-d6d491af/report.json) |
| S8 실제 ID 연결 후 전체 회귀 | 타입/빌드/단위42/Worker21/E2E11 전부 종료 0. E2E에 실제 60초 XHR timeout 포함 | [최종 report](./verification/runs/CHECK-2026-10-22T13-52-13-374Z-f1e9d9d3/report.json), [stdout](./verification/S8-final-check.log) |
| 동일 항목 서로 다른 값 마지막 커밋 보강 | 실제 동일 DB의 commit 순서를 await 경계로 제어. Worker 전체 **22/22 종료 0**. 제품 코드 변경 없음, 위 나머지 결과 재사용 | [22개 결과](./verification/S8-last-commit.log) |
| 원격 리소스·배포 | D1/R2 전용 생성, migration 2개 적용, build/deploy 종료 0. r2.dev 비공개 | [D1](./verification/S8-d1-create.log), [R2](./verification/S8-r2-create.log), [migration](./verification/S8-migrate-remote.log), [배포](./verification/S8-deploy.log), [비공개](./verification/S8-r2-private.log) |
| 공개 Chromium TC19/V25 | 정책 fixed/custom 저장·새로고침 유지, 차단 422, 허용 파일 완료, unknown API JSON404. **1/1 종료 0** | [실행](./verification/S8-remote-browser.log), [관찰 JSON](./verification/S8-remote-browser.json), [화면](./verification/S8-public-desktop.png) |
| 원격 실제 저장 | R2에서 39바이트를 읽어 원본 SHA-256 일치, 원격 실제 schema/고정7행/예약39바이트·1회 확인 | [바이트](./verification/S8-r2-bytes.json), [원격 DB](./verification/S8-remote-db.json) |
| 검증 데이터 정리 | 테스트 custom 삭제, fixed 이전 값 복구, 테스트 소유 원격 객체만 삭제. 누적 예산 환급 없음 | [cleanup](./verification/S8-cleanup.log) |

현재 증거 합계: 단위 **42**, Worker 통합 **22**, 로컬 E2E **11**, 공개 원격 **1** 모두 통과. 같은 제품 코드의 타입/빌드 결과를 재사용한다. 마지막 커밋 검사는 테스트 증거만 추가했으므로 60초 E2E를 불필요하게 다시 반복하지 않았다.

| 기준 V | 실제 검사 범위·관찰 |
| --- | --- |
| V01~07/24/37 | seed 보존·CHECK·원문/정규화 경계·CRUD·동일 DB 중복/200개 경쟁·삭제 후 재추가·JSON/type/origin/body/404. 화면 저장/새로고침/입력 보존 |
| V08~16 | unchecked exe 허용, exe/EXE/embedded 토큰 차단·MIME 위조 무시, 실제 R2 바이트/객체 수, raw multipart 위험 이름, UTF-8 경계, 0/5 MiB/5 MiB+1, 실제 body 초과/길이 없음/거짓 header, 필드 형식 |
| V17 | 실제 D1 fixed 누락 fixture로 앱503·R2 미저장. 제공자 장애를 mock하지 않음. UI 최초 통신 실패 잠금은 별도 E2E |
| V18/19/20/34 | 실제 중복 요청과 저장 후 응답 유실/재조회, 동일 DB 병행 변경/마지막 실제 commit, 수신 중(T 전)/put 직전(T 후) 정책 변경, GET으로 과거 결과가 변하지 않음 |
| V21/22/28/32/35/36/40 | 실제 저장 뒤 응답 보류/부분 손실/손상 JSON/60초 timeout, 서버 확인·완료 확인 실패·수동 재시도·다음 파일 중단·성공 보존. 실제 앱 budget의 bytes/puts 각각 경쟁/거절, seed·응답 유실에 따른 자동 환급 없음 |
| V23/26/27/29/30/33/38/39 | 혼합 선택/파일 드롭/제거/10개 정확 경계·초과 묶음 전체 거절·같은 이름 별도 ID·빈 선택 보존, guide는 입력만 채움, fixed 등록/차단 구분, Enter/포커스/390px 긴 파일명·스크린샷 확인 |
| V25 | 실제 공개 URL·원격 D1/R2 저장 확인. 로컬 대역을 원격 결과로 세지 않음 |
| V31 | 옵션 필터·일괄 변경 미구현/미실행. 핵심/배포 우선 결정 |

한계: 이 V 연결은 모든 가능한 입력 조합의 전수 검증을 뜻하지 않는다. 실제 OS 파일 선택 창의 취소는 빈 선택 이벤트로 확인했고, 다양한 브라우저/WebKit/Firefox·모바일 실기기·스크린리더 수동 검사는 미실행이다. Chromium 390px 렌더링/키보드와 접근 가능한 이름을 확인했다. Cloudflare 실제 운영 장애·계정 한도 응답 모방, 부하 성능, 계정 전체 사용량/비용 보장은 제외·미검증이다. 테스트 자체 오류와 제품 결함은 TDD_LOG에서 구분한다. Git 커밋/푸시는 수행하지 않았다.

### 깨끗한 복사본 재현·정리 (23:03~23:07 KST)

- 제품 코드는 바꾸지 않았다. 처음 C 드라이브 OS 임시 복사본에서 offline 설치를 시도했으나 C 드라이브의 별도 전역 스토어에 tarball이 없어 실패했다. 일반 frozen 설치/DB/타입/빌드는 통과했지만, 메타데이터의 storeDir가 D가 아니어서 이 결과를 요구된 D 스토어 재현으로 인정하지 않았다. 정리 guard가 중단한 것도 이 환경 차이이며 앱 기능 Red가 아니다.
- 같은 D 드라이브의 새 복사본(의존성·로컬 DB 없음)에서 **frozen/offline 설치 → db:local → typecheck → build 전부 종료0**, storeDir `D:\.pnpm-store\v11`, 동일 lockfile 해시를 확인했다. 경로를 검증한 뒤 이번 작업에서 생성한 두 복사본만 삭제했다. 전역 스토어 자체는 삭제/이동하지 않았다.
- [재현 결과](./verification/S8-clean-result.json), [D 설치](./verification/S8-clean-D-install.log), [D DB](./verification/S8-clean-D-db.log), [D 타입](./verification/S8-clean-D-typecheck.log), [D 빌드](./verification/S8-clean-D-build.log). C 실패/성공 stdout도 별도 이름으로 보존했다.
- [문서/보존 검사](./verification/S8-docs-check.json): Markdown35·로컬 링크281 깨진 참조0, 원본 과제·lockfile 동일, 전역 D store/저장소 내부 store 없음. [소스/의존성 검사](./verification/S8-source-check.json): 직접13개 버전 동일, 일반 비밀값 패턴 후보0. 원격에서 읽은 dummy 파일 본문은 해시 확인 후 로컬에서 삭제했고 예산 환급 없이 테스트 객체를 정리했다.

## UI-R01 — 후속 화면 변경 검증 (2026-10-22 23:30~23:43 KST)

사용자1~4번을 반영했다. 상하/업로드 우선 배치, 독립 추가/등록 확인 입력, ‘정책 새로고침’, 행별 업로드·제거 좌우/동일 크기 및 상태별 비활성이다. 사용자5번은 의견 요청이므로 수동 성공 항목 비우기를 제안으로 남기고 미구현이다.

| 실제 실행 | 결과 | 증거 |
| --- | --- | --- |
| 새 테스트 선행 | 2개 실패, 기존 좌우 배치·행 버튼 미구현 | [Red](./verification/UI-R01-red.log) |
| 최소 구현 | 2/2 통과 | [Green](./verification/UI-R01-green.log) |
| 리팩토링 후 누적 회귀 | 단위42/실제 Worker22/E2E13·타입/빌드 전부 종료0 | [최종 report](./verification/runs/CHECK-2026-10-22T14-38-44-656Z-6fa30f36/report.json), [stdout](./verification/UI-R01-final-check.log) |
| 공개 재배포 | 종료0, 버전 1b382c8c-43b4-40a6-be43-560479d442f9 | [배포](./verification/UI-R01-deploy.log) |
| 실제 공개 Chromium | 1/1 통과, 새 배치·독립 입력·행 업로드 및 정책 유지/차단 | [실행](./verification/UI-R01-remote-browser.log), [JSON](./verification/UI-R01-remote-browser.json), [화면](./verification/UI-R01-public-desktop.png) |
| 실제 원격 저장 확인 | 39바이트 SHA-256 일치·테스트 소유 객체만 삭제·예산 환급 없음 | [바이트](./verification/UI-R01-r2-bytes.json), [정리](./verification/UI-R01-cleanup.log) |

최신 합계는 **78개 통과(단위42/Worker22/로컬E2E13/원격1)**다. 이전 S8 76개 결과는 역사 기록이다. 실제 서버/DB/R2 규칙과 의존성 버전은 유지했다. 새 행 업로드는 최신 정책 GET1회·전송1회·다른 대기 보존을 검증했다. 전송 중 행/정책 잠금, 사전 차단/성공 업로드 비활성, 두 버튼의 실제 bounding box 크기/위치를 확인했다. 입력은 서로 값을 바꾸거나 추가 성공으로 조회 값을 지우지 않으며, 조회 Enter/대표 클릭은 무단 정책 등록을 하지 않는다.

기존 결과 유지/완료 확인 실패·실제60초 timeout·실패만 수동 재시도 회귀도 전부 통과했다. 모바일390px 스크린샷을 열어 긴 이름과 행 버튼을 확인했다. Cloudflare 장애/계정 한도 모방·계정 전체 비용/성능 검증은 추가하지 않았다. 상세 실패·리팩토링은 TDD_LOG의 UI-R01을 따른다.

## LOCAL-20261023 — 로컬 데브 준비

2026-10-23 19:40~19:45 KST(도구 확인 시각). 사용자 지시에 따라 이후 기능 개발은 로컬 우선, Cloudflare 배포는 이후 명시적 요청 시에만 진행한다. 기존 Node 24.16.0 / pnpm 11.5.1 / 직접 의존성 13개 / PC 전역 스토어 `D:\.pnpm-store\v11`을 유지했다. 필요한 패키지·Chromium이 이미 설치되어 있어 추가 설치나 버전 변경은 하지 않았다.

| 실제 명령·절차 | 결과 | 증거·한계 |
| --- | --- | --- |
| `pnpm store path`, `pnpm list --depth=0` | 실제 PC 사용자 환경에서 기존 D 스토어·고정 버전 13개 확인 | 최초 기본 샌드박스 조회는 별도 계정 스토어/SQLite 인덱스 열기 오류. 앱 기능 실패가 아님. 환경 report에 실제 storeDir·버전 보존 |
| `pnpm run db:local` | 종료0, 기존 migration 2개를 로컬 개발 DB에 적용 | [migration](./verification/LOCAL-20261023-db.log). `--local`, `.wrangler/state/v3/d1` 사용 |
| Vite 설정 `remoteBindings: false` | 원격 바인딩 연결 비활성화, 기존 개발/E2E 영속 경로 유지 | 설치된 1.54.2 플러그인 타입·분기 확인. 제품 API/정책/업로드 코드 변경 없음 |
| `pnpm run check:env` | 종료0, 고정 패키지·Vue/TS 메모리 빌드·임시 로컬 Worker/D1/R2·Chromium 기동 성공 | [report](./verification/runs/CHECK-2026-10-23T10-43-32-683Z-5d1e4370/report.json), [환경 JSON](./verification/runs/CHECK-2026-10-23T10-43-32-683Z-5d1e4370/environment.json), [stdout](./verification/LOCAL-20261023-environment.log). 앱 기능 회귀가 아님 |
| `pnpm run typecheck`, `pnpm run build` | 각각 종료0 | [타입](./verification/LOCAL-20261023-typecheck.log), [빌드](./verification/LOCAL-20261023-build.log). 배포 실행 없음 |
| `pnpm run dev` 및 HTTP 읽기 | `http://127.0.0.1:5173/` 기동, HTML/정책 API 각각200, Local Explorer에 DB/UPLOADS 바인딩 확인 | [HTTP](./verification/LOCAL-20261023-http.json). Vite 개발 클라이언트 포함. 서버는 확인 후 계속 실행 |
| 설치된 Playwright Chromium으로 로컬 페이지 열기 | 종료0, 초기 화면 렌더·정책 GET200, console/page 오류 및 요청 실패0 | [브라우저](./verification/LOCAL-20261023-browser.json). 정책 변경·파일 업로드 조작 없음 |

환경 설정 변경이므로 새 기능 Red를 만들지 않았다. 설정 타입·빌드와 실제 개발 서버 기동을 검증했으며 단위/Worker 통합/핵심 E2E 전체 회귀를 이번에 재실행한 것으로 표시하지 않는다. 기존 UI-R01의 78개 증거는 당시 결과로 보존한다. 새 리팩토링 항목은 없었다. Cloudflare 로그인·원격 리소스 생성·원격 migration·배포·원격 smoke·Git 커밋/푸시는 수행하지 않았다. 문서 링크·설정 일관성·원본/의존성 보존 확인은 [최종 점검](./verification/LOCAL-20261023-docs.json)에 기록한다.

### 접속 세션 공유 범위 질의 확인

2026-10-23 19:50 KST, 코드·설계 조회로 전역 정책/예산과 탭별 Vue 상태, 수동/업로드 전 정책 재조회, 로컬/원격 분리를 확인했다. 제품 수정·정책 변경·업로드·새 앱 테스트는 실행하지 않았다. [확인 파일·응답](./conversations/2026-10-23-002.md). 이번 기록의 링크 대상 존재와 Git 공백 검사를 확인한다.

### 필수·핵심 추가 기능의 구현 현황 대조

2026-10-23 19:54:40 KST 최초 도구 확인. 원본 과제·PLAN/DECISIONS의 합의 범위를 shared/server/src/migrations의 구현과 기존 테스트·UI-R01 실행 증거에 대조했다. 필수 A1~A4/B1~B3와 사용자 핵심 USER-01/02/03/05/06, 합의한 AI-01/02/03/05/06/08의 구현 경로를 확인했다. 조건부 USER-04a/04b는 미구현, 완료 목록 일괄 정리는 미합의 제안으로 구분했다. 시그니처·상태 조회·중복 방지·빈도 제한·해시는 생략/보류 대안이다. [상세 표·대화·도구 결과](./conversations/2026-10-23-003.md).

uploader-worker-checks/uploader-ui-checks를 기존 증거의 해석 기준으로 읽었다. 새 앱 테스트·실제 정책 변경·업로드·배포는 수행하지 않았다. 기존 UI-R01의 78개 통과와 타입/빌드 성공을 당시 결과로 인용했으며 2026-10-23 환경 확인을 전체 회귀로 합산하지 않았다. Node 내장 fs/path로 변경 문서3개의 로컬 링크110개를 확인해 깨진 대상0개였고, 필수/합의 범위의 표 대응과 Git 공백 검사에서 오류가 없었다. LF→CRLF 안내만 출력됐다. 코드 확인을 새로운 실행 통과로 표시하지 않는다.

### 익명 세션 분리 검토 문서 확인

2026-10-23, 사용자 요청 범위는 검토다. 기존 전역 정책/보존 seed·API/XHR과 MDN/Cloudflare 공식 문서를 근거로 [익명 쿠키/탭 토큰 비교·설계·로컬 TDD 후보](./SESSION_POLICY_REVIEW.md)를 작성했다. 신규 세션별 정책이 실제로 동작한다고 검증한 결과는 아니다. 제품 코드·migration·로컬/원격 데이터·배포는 변경하지 않았다. 이번 추가 문서 링크와 Git 공백 검사만 수행하며 앱 테스트 통과로 표시하지 않는다. [대화 기록](./conversations/2026-10-23-006-session-review.md).

실제 문서 점검: Node 내장 기능으로 관련 Markdown7개·로컬 경로167개를 확인해 누락0, `git diff --check` 종료0. `git diff --exit-code -- server src migrations package.json pnpm-lock.yaml` 종료0으로 제품 소스·SQL·의존성 불변을 확인했다. 앱 테스트는 미실행이다.
