# TDD 루프 기록

## RELEASE-20261023 — 배포 환경 gate·제한된 운영 검증

- 사용자 최신 요청은 커밋/정상 origin 푸시/배포/운영 검증의 명시적 승인이다. 환경 실패가 해결되기 전 기능 검증을 하지 않고 부하/대량 업로드도 금지한다. 기존151개 로컬 회귀/타입/빌드를 재사용했다. 상세 명령과 실행 증거는 [배포 원장](./RELEASE_20261023.md)/VALIDATION을 따른다.
- 사전 D1 조회7403은 환경 실패다. 계정/d1(write)/대상 DB를 확인한 뒤 설정/자격증명 변경 없이 순차 조회/SELECT가 성공했다. 최초 원인은 미확정으로 기록했다. 이 기간 운영 기능 검증은0회다.
- 신규 운영 시나리오를 먼저 작성하고 격리된 로컬 E2E 리허설1/1·타입/Node 문법 검사를 통과했다. 비밀값/로컬 데이터 검사 후253개 파일을 `b7d4112`로 커밋해 origin/main에 정상 푸시했다. migration3~5·배포 버전 `60a46602-a2c8-4117-b8a8-7921631517db`가 성공했다.
- 배포 환경 gate에서 활성100% 버전·바인딩·전체 migration/스키마/FK/정책/소속 불변식·예산 보존·비공개 R2·HTTPS/API404·JS/CSS 정확한 바이트를 확인한 뒤에만 운영 검증을 실행했다.
- **운영 첫1실패:** 이름 변경 저장 클릭 직후 새로고침해 PUT 취소 상태-1, DB도 이전 이름이었다. 테스트의 저장 확정 대기 누락이다([최초 로그](./verification/RELEASE-20261023-operational-first.log)). 업로드 전 실패이므로 업로드0·예산 불변·이번 세션2개만 정리했다. trace는 `.wrangler/release-production-playwright`에 보존했다.
- 최소 보정: 팝업 종료·변경된 카드/소속 수를 확인한 뒤 새로고침하고 기존 영속성 기대를 반복한다. timeout/내용/상태 기대를 완화하지 않았다. 리팩토링 검토에서는 아티팩트 prefix로 시도별 증거를 분리하는 작은 개선만 필요했다. 제품 코드/번들은 변경하지 않았다.
- 수정 로컬 리허설1/1·타입 검사 후 환경 gate도 다시 통과했다. **최종 운영1/1·49.2초 통과**([로그](./verification/RELEASE-20261023-operational.log), [결과](./verification/RELEASE-20261023-browser.json)). 두 세션·카테고리/정책 CRUD·새로고침/필터/공유 상태·차단/허용을 확인했다. 앱 변경이 없어 전체151개 검사를 반복하지 않았다.
- **실제 원격 R2 저장/정리 통과:**28바이트×2/원본 SHA-256 일치, 예산967734/5→967790/7. 객체2개와 성공 시도 세션2개만 삭제·연관행 cascade/FK0·예산 환급 없음([저장 증거](./verification/RELEASE-20261023-storage.json)). 실패 시도 세션2개는 별도로 정리했다. 부하/대량 업로드·플랫폼 장애 모방/자동 retry는 없었다. 결과와 테스트 보정은 후속 기록 커밋으로 보존한다.

## FINAL-LOCAL-01 — 최종 로컬 검증·누락 보강

- 2026-10-23 21:25:47 KST 시작(도구 확인). 사용자 요청에 따라 완료 문서와 현재 구현/테스트를 대조하고 요구사항/기대값을 완화하지 않는다. 기존 미커밋 변경을 보존한다. 실제 실행·대조표는 VALIDATION/FINAL_LOCAL_REVIEW에 연결한다.
- 기준선 `pnpm run check`는 샌드박스의 Wrangler 로그 쓰기/단위 수집 임시 rename EPERM으로 실패([환경](./verification/FINAL-LOCAL-01-baseline.log)). 사용자 환경 재실행은 타입/빌드·단위42/Worker39 통과 후 별도 CATEGORY-05 E2E가 같은4173 포트를 사용해 시작 전 중단([로그](./verification/FINAL-LOCAL-01-baseline-user.log)). 단독 E2E 재시도도 동일 포트 충돌([로그](./verification/FINAL-LOCAL-01-baseline-e2e.log)). 실제 프로세스를 읽기 확인하고 종료/재사용하지 않았다. 제품 Red나 E2E 실행 통과로 세지 않는다.
- 구현을 바꾸기 전에 새 카테고리 단위23개와 실제 D1/R2 Worker14개를 작성했다. 첫 실행 **단위65/65·신규Worker14/14 통과**([단위](./verification/FINAL-LOCAL-01-unit-first.log), [Worker](./verification/FINAL-LOCAL-01-worker-first.log)). 기존에 동작하던 경계의 테스트 누락이며 인위적인 Red를 만들지 않았다.
- Worker 보강은 이름30/31자·구성원50/51개·원문20/21자, 대소문자 이름/정규화 구성원 경합, 중복 rename rollback, 기존 custom200개에서 고정/기존 소속 일괄 변경, 단건/일괄 경합, 허용 batch 실제 trigger rollback, 전 액션 세션 격리와 HTTP 오류다. 저장은 실제 D1 예약 실패/커밋 후 결과 유실·put 예외/실제 저장 뒤 null·크기 불일치·예외와 예산 미환급/새 수동 시도 바이트를 확인했다. put 대역은 앱 실패 분기 검증이며 Cloudflare 장애의 정확한 재현이 아니다.
- 신규UI7개 첫 실행 **6통과/1실패**([최초 로그](./verification/FINAL-LOCAL-01-ui-first.log), trace는 `.wrangler/final-local-playwright`에 보존). 실패 원인: 테스트가 두 카드에서 제거 모드를 동시에 유지한다고 가정했다. 구현/기존 UI는 한 카드씩 제거 모드(`removing` ID 하나)를 사용하므로 다른 카드로 이동 후 첫 카드의 ×가 없다. 테스트 흐름에서 첫 카드 체크박스 복귀를 확인하고 제거 모드로 명시적으로 재진입하도록 수정했다. 정책/소속/필터/삭제/요청 수 기대는 유지했다. 제품 결함 Red로 세지 않는다.
- 추가 테스트 타입 검사 종료0([타입](./verification/FINAL-LOCAL-01-type-first.log)). UI 흐름 보정 후 **7/7 통과**([재검증](./verification/FINAL-LOCAL-01-ui-green.log)). 생성/차단 rollback·직접 SQL 제약·일괄 실행 직전 소속 변경·카테고리 정책T 전후4개를 추가했고 경계Worker12/12가 첫 실행 통과했다([추가 Worker](./verification/FINAL-LOCAL-01-worker-extra.log)).
- 리팩토링 검토: 테스트 준비/HTTP 오류 확인은 작은 파일별 헬퍼로 공유했다. 기존 카테고리 E2E 캡처는 공통 `verificationPath`로 묶고 최종 실행 접두사를 붙여 과거 이미지 덮어쓰기를 방지했다. 제품 결함이나 제품 로직을 정리할 필요는 확인되지 않았고 서버/UI 동작을 바꾸지 않았다.
- **최종 누적 회귀 완료 21:35:39~21:37:31 KST:** `UPLOADER_VERIFICATION_PREFIX=FINAL-LOCAL-01`로 `pnpm run check` **종료0, 단위65/Worker57/E2E29=151개·타입/빌드 전부 성공**([report](./verification/runs/CHECK-2026-10-23T12-35-39-480Z-ce4bb88e/report.json), [stdout](./verification/FINAL-LOCAL-01-final-check.log)). 신규48개는 단위23/Worker18/E2E7이며 기존103개도 모두 포함한다. 기존60초 timeout·응답 손실·T·예산·세션 회귀 실패 없음. 통과 후 같은 앱 검사 반복/앱 소스 변경은 없다.
- [구현/요건/테스트 대조표](./FINAL_LOCAL_REVIEW.md)와 VALIDATION·대화/프롬프트 기록·문서 진입점을 갱신한다. 원문 과제·의존성·기존 미커밋 제품 변경을 보존했으며 원격 배포/새 의존성/커밋/푸시는 없다.
- 종료 점검: 문서52개·로컬 참조649개·앵커11개 누락0·보호 파일6개 불변, Git 공백 검사 종료0·코드5개 검사 이슈0이다. 최초 rg의 종료1은 skip/only 등 검색 결과0개이며 테스트 실패가 아니다. 별도 Node 검사에서도 금지 패턴/끝 공백0을 확인했다. 검증/기록을 완료했다.

## CATEGORY-05 — 커스텀 차단 칩 스타일 통일

- 2026-10-23 21:24:52 KST 도구 확인. 사용자 첨부 두 이미지의 차이를 확인하고 기존 삭제 E2E에 같은 gif 칩/×의 실제 계산 스타일 비교를 먼저 추가했다.
- **Red1실패**: 커스텀의 font12px/반경6px/작은 여백·배경이 카테고리의 font13px/반경8px/여백8px 10px·투명 배경과 달랐다([Red](./verification/CATEGORY-05-red-ui.log)).
- 최소 수정·리팩토링: App의 커스텀 칩에 기존 fixed-item/member-remove를 공유하고 중복 tag/button CSS를 제거했다. tag-list의 세로 늘어남을 막아 실제 높이도 일치시켰다. 조회 강조용 tag.highlight와 차단 해제/잠금은 유지했다. 새 컴포넌트/API/DB/의존성은 없다.
- **Green1/1**: 칩/× 계산 스타일과 기존 소속 제거·일반 모드 복귀/새로고침·390px 넘침 검사를 통과했다([Green](./verification/CATEGORY-05-green-ui.log)). [커스텀 칩](./verification/CATEGORY-05-custom-chips.png)·[카테고리 칩](./verification/CATEGORY-05-category-chips.png)을 view_image로 열어 확인했다.
- 첫 `pnpm run check`: 타입/빌드·단위42/Worker39 통과, E2E21/22. 실제60초 timeout 본문 assertion 오류 없이 context 종료 시 trace/network/zip 파일 ENOENT로1개 실패했다([report](./verification/runs/CHECK-2026-10-23T12-25-53-222Z-2ee53b86/report.json), [stdout](./verification/CATEGORY-05-final-check.log)). 파일이 사라진 외부 원인은 확인하지 못했다. uploader-ui-checks와 기존 하네스를 확인했고 앱/검사를 바꾸지 않은 채 `--output .wrangler/category-05-playwright`로 증거 경로를 분리해 E2E만 다시 실행한다. 이미 통과한 타입/빌드/단위/Worker는 반복하지 않는다.
- 출력 경로 분리 후 **E2E22/22·종료0**([stdout](./verification/CATEGORY-05-final-e2e.log)). 기존 실제60초 timeout도 통과했다. 최종 누적 **단위42/Worker39/E2E22=103개·타입/빌드 통과**이며 첫 check 실패를 삭제하지 않고 단계별 결과를 구분했다. 문서 링크/앵커 누락0·보호 파일 보존·공백 검사 종료0도 확인했다([문서](./verification/CATEGORY-05-docs.json)). 앱 변경 없이 기록만 마무리했다. 배포/커밋/푸시 없음.

## CATEGORY-04 — 제거 모드 체크박스 숨김·칩 내부 ×

- 2026-10-23 21:10:56 KST 시작(도구 확인). 사용자 요청은 제거 모드의 표시 수정이다. 기존 삭제 시나리오에 체크박스0개·텍스트 오른쪽의×가 같은 칩 내부에 있음·일반 모드 복귀 검사를 먼저 추가했다.
- **Red 1실패**: 제거 모드의 체크박스 기대0개, 실제6개([Red](./verification/CATEGORY-04-red-ui.log)). API/환경 오류가 아닌 요청된 화면 상태 미구현이다.
- 최소 수정: 제거 모드는 기존 fixed-item을 재사용한 이름/× 칩, 일반 모드는 기존 ExtensionToggle을 조건부 렌더한다. ×의 크기/간격만 조정했다. **Green1/1**([Green](./verification/CATEGORY-04-green-ui.log)).
- 리팩토링 검토: 기존 공통 테두리/CSS와 소속 제거 경로를 재사용하고 모드별 렌더만 분리했다. 추가 컴포넌트/추상화는 필요하지 않다. API/SQL/의존성은 바꾸지 않았다.
- 실제 [데스크톱](./verification/CATEGORY-04-removal-desktop.png)·[390px](./verification/CATEGORY-04-removal-mobile.png)을 열어 체크박스 없음·이름 바로 옆×·칩 내부 배치를 확인했다. 같은 검사에서 실제 소속 제거·일반 모드 체크박스 복귀·새로고침 유지도 통과했다.
- 최종 `pnpm run check` **종료0·단위42/Worker39/E2E22=103개·타입/빌드 통과**([report](./verification/runs/CHECK-2026-10-23T12-13-43-096Z-fd6845db/report.json), [stdout](./verification/CATEGORY-04-final-check.log)). 기존 정책 T/저장·예산·실제60초 timeout도 포함한다. 문서 링크/앵커 누락0·보호 파일 보존·공백 검사 종료0을 확인했다. 통과 후 앱 변경이나 검사 반복 없이 기록만 마무리했다. 배포/커밋/푸시 없음.

## CATEGORY-03 — 카테고리 공통 조작·팝업·체크박스

- 2026-10-23 20:44:43 KST 시작(도구 확인). 사용자 수정1~4번과 일관된 UI 요청을 TDD_PLAN의 후속 범위로 기록했다. 기본 카테고리도 구성원 편집 가능, 단일 전체 차단/허용, 이름 옆 수량·우측+/×, 추가/이름/삭제 팝업, 공통 개별 체크박스다. 소속 제거는 정책 유지, 카테고리 자체 삭제는 이전 답변대로 소속 모두 허용을 유지한다.
- 테스트 선행: 새 Worker3개는 **실제3실패**(기본 구성원 추가400, 이름만 생성400, 기존 세션 migration 전 그룹 수1≠5). [Worker Red](./verification/CATEGORY-03-red-worker.log). UI2개는 **실제2실패**(전체 버튼 미존재/이름 입력 없이 누를 수 없는 이전 생성 버튼). [UI Red](./verification/CATEGORY-03-red-ui.log). 환경/수집 오류를 기능 Red로 대체하지 않았다.
- 최소 서버: migration5로 기본 분류도 세션별 DB 소속으로 저장하고 기존 세션을 보강했다. 신규 세션 seed batch와 현재 DB 소속 전체 대상 SQL, 이름만 생성/변경, 소속 POST/DELETE를 추가했다. 원자적 구성원50개 상한/중복/다른 세션 보호를 유지한다. **Worker3/3 Green**([결과](./verification/CATEGORY-03-green-worker.log)).
- 최소 UI: ExtensionToggle/ModalDialog를 고정/카테고리와 네 종류 팝업에서 공유한다. 기본/사용자 카드 +/×·제거 모드, 현재 정책에서 계산한 단일 전체 버튼, 이름 팝업·삭제 확인을 연결했다. **UI2/2·타입 검사 통과**([UI Green](./verification/CATEGORY-03-green-ui.log), [타입](./verification/CATEGORY-03-typecheck.log)).
- 응답 유실 보강: 실제 member 저장201 뒤 응답을 잃고 팝업을 닫으면 복구 안내가 사라지는 **1실패**를 먼저 확인했다([Red](./verification/CATEGORY-03-recovery-red.log)). 닫아도 오류 안내를 유지하고 재조회 성공 후 지우도록 최소 수정했다. 서버 폴리시/R2는 모방하지 않았다.
- 리팩토링: 개별 custom 제거도 공통 changeExtension을 사용하게 했고, 구성원 상수50을 공유하고 미사용 guide/category-kind CSS를 정리했다. 기본/사용자 일괄 SQL을 한 경로로 통합했다. 범용 폼/서비스 계층·새 라이브러리는 추가하지 않았다.
- 기존 검사 반영: 사전 클릭-입력 채움/인라인 구성원 입력/고정 ‘5종’ 버튼 기대는 최신 사용자 지시로 대체했다. 별도 입력값 독립·정책 영속성/중복·일괄 한도·응답 손실 assertions는 유지했다. 삭제 뒤 orphan 검사는 이제 존재하는 기본 소속20행을 잘못 세지 않고 삭제한 그룹의 소속0행을 확인한다.
- 첫 전체 회귀: 타입/빌드·단위42·Worker39 통과, **E2E19통과/3실패**([stdout](./verification/CATEGORY-03-final-check.log)). 닫힌 native dialog의 slot에도 같은 오류 문구가 렌더돼 strict locator가2개를 찾았다. 선택자를 느슨하게 만들지 않고 열린 팝업의 form만 렌더하도록 수정했다. 카테고리 관련 UI 전체 **7/7 Green**([결과](./verification/CATEGORY-03-green-ui2.log)).
- 추가 보강: 변경된 기본 소속이 실제 R2의 heic 거절/기존 png 허용과 정확한 저장 바이트에 적용됨, 기존 세션 migration 보존·다른 세션 불변, 동일 DB 50개 경합, 기존 정책 등록 안내·포커스/모바일/헤더 수량 위치를 확인했다. [모바일](./verification/CATEGORY-03-mobile.png)·[팝업](./verification/CATEGORY-03-popup.png)을 직접 열어 확인했다. 일반 dev migration5도 종료0([DB](./verification/CATEGORY-03-dev-db.log)).
- 최종 전체 회귀 **단위42/Worker39/E2E22=103개·타입/빌드 전부 종료0**([report](./verification/runs/CHECK-2026-10-23T12-03-16-839Z-e7989aee/report.json), [stdout](./verification/CATEGORY-03-final-check2.log)). 실제60초 timeout·기존 T/예산·저장/응답 유실·수동 재시도·세션 격리도 통과했다. 일반dev5173 HTML/세션/카테고리200·초기4분류 각5개도 확인했다([HTTP](./verification/CATEGORY-03-dev-http.json)). 통과 후 앱 소스 변경/같은 검사 반복은 없고 문서만 마무리했다. 배포/커밋/푸시 없음.

## CATEGORY-01 — 카테고리 필터·일괄 정책·사용자 카테고리

- 2026-10-23 20:02 KST 시작. 사용자 요청으로 USER-04a/04b·기본4분류 각5개·사용자 카테고리 CRUD/일괄 차단·허용을 추가했다. 삭제 시 소속 차단도 해제하라는 답변을 반영했다. [테스트 선행 계획](./CATEGORY_PLAN.md).
- Worker7개·E2E2개를 먼저 작성했다. 샌드박스의 workerd 모듈 기동/localhost fetch 실패는 미수집 환경 오류다([Worker 환경](./verification/CATEGORY-01-red-worker.log), [UI 환경](./verification/CATEGORY-01-red-ui.log)). 사용자 환경의 같은 로컬 검사에서 **Worker7실패(기대200/201, 실제404)·UI2실패(카테고리 영역/입력 미존재)**로 실제 Red를 확인했다([Worker Red](./verification/CATEGORY-01-red-worker-user.log), [UI Red](./verification/CATEGORY-01-red-ui-user.log)).
- 최소 구현: shared 사전/정규화, migration4의 세션별 카테고리·FK 구성원, 작은 categories API, 단일 INSERT/UPSERT의 custom200개 조건, 허용/편집/삭제의 D1 batch, CategoryPanel과 조회 필터. **Worker7/7·UI2/2 Green**([Worker](./verification/CATEGORY-01-green-worker.log), [UI](./verification/CATEGORY-01-green-ui.log)).
- 보강: 실제 D1 제약 실패의 편집/삭제 rollback, 겹친 그룹/세션 격리, 실제 R2 차단 미저장/허용 바이트, UI응답 유실 잠금·200개 초과 입력/정책 보존. 기존 구현에서 통과했고 새 Red를 꾸미지 않았다.
- 첫 누적 회귀 **단위42/Worker36/E2E19=97개·타입/빌드 종료0**([report](./verification/runs/CHECK-2026-10-23T11-12-16-594Z-8ac35921/report.json), [stdout](./verification/CATEGORY-01-regression.log)). SESSION-01과 기존 T/예산/실제60초 timeout/수동 재시도를 포함한다. [데스크톱](./verification/CATEGORY-01-desktop.png)·[390px](./verification/CATEGORY-01-mobile.png)을 직접 열어 버튼/줄바꿈을 확인했다.

## CATEGORY-02 — 재조회 복구 안내·리팩토링/최종 회귀

- 복구 후 오래된 오류 안내가 남는 경로를 발견해 assertion을 먼저 추가했다. 첫 검사는 로딩 중 오류가 잠깐 숨겨진 시점에 통과했다([첫 검사](./verification/CATEGORY-02-red-ui.log)). 카테고리 버튼 활성화까지 기다리도록 보정한 뒤 **1실패: 오류 문구 기대0, 실제1**을 확인했다([실제 Red](./verification/CATEGORY-02-red-ui2.log)).
- 최소 수정: 성공한 수동 재조회에서 과거 메시지를 지운다. 리팩토링: shared 사전/규칙을 유지하고 중첩 조건·미사용 guide-row CSS를 제거했다. 범용 계층/새 라이브러리는 추가하지 않았다.
- 전체 시도1: 타입/빌드·단위42·Worker36 통과, E2E16통과/3실패([stdout](./verification/CATEGORY-02-final-regression.log)). 기존 테스트가 정책 준비 전에 disabled file input에 파일을 주입해 빈 목록에서 업로드 버튼을 기다린 선행조건 문제였다. 실제 파일 선택 버튼의 활성화를 기다리도록 보정했다.
- 시도2: 같은 정적/단위/Worker 통과, E2E17통과/2실패([stdout](./verification/CATEGORY-02-final-regression2.log)). 같은 준비 상태 누락이 남아 있던 malformed JSON/전송 직전 GET 실패 검사도 보정하고 quota 입력도 같은 상태를 기다렸다. 제품의 준비 전 잠금과 기존 오류/60초 timeout·요청 수·결과 assertions는 유지했다. 자동 retry로 실패를 감추지 않았다.
- 최종 시도3: **타입/빌드·단위42·Worker36·E2E19 전부 종료0, 로컬97개 통과**([report](./verification/runs/CHECK-2026-10-23T11-23-01-521Z-1fd008d8/report.json), [stdout](./verification/CATEGORY-02-final-regression3.log)). CATEGORY-02의 복구 메시지와 기존 실제60초 timeout·파싱/응답 유실·수동 재시도·세션 격리까지 회귀 실패 없음. 통과 후 새 앱 변경 없이 같은 검사는 반복하지 않았다. 일반 dev migration4도 종료0([결과](./verification/CATEGORY-01-dev-db.log)). 원격 배포/원격 바인딩·의존성 변경·커밋/푸시는 없다.

## SESSION-01 — 익명 세션 정책 분리 (2026-10-23 후속 승인)

- 범위: 사용자 지정 익명 쿠키+D1·새 세션 fixed7 unchecked/custom0·새로고침 유지. 원본20자/200개/중복/삭제/서버 적용 유지. 로컬 TDD만 수행하고 배포하지 않는다. 브라우저 수명 외 TTL·reset UI·스케줄은 추가하지 않는다.
- **Red, 20:01 KST**: 새 Worker5개 실패. POST `/api/session`404 및 무쿠키 GET200이 기대200/401과 다름. [Worker Red](./verification/SESSION-01-red-worker.log). 롤백1개는 테이블 부재를 제품 Red로 세지 않도록 이 실행 필터에서 제외. 새 E2E1개는 A가 체크한 exe가 B에 나타나 기대 체크0/실제1로 실패했다. [브라우저 Red](./verification/SESSION-01-red-ui.log).
- 최소 구현: 새 session/정책 테이블·복합 PK/FK/CHECK, 서버 난수 토큰/해시·HttpOnly 쿠키·batch seed. CRUD/count·T 판정을 쿠키의 session_id로 제한. UI는 세션 POST 후 GET, 무쿠키401이면 잠금. 전역 예산 유지·이전 정책 미복사.
- **Green, 20:03 KST**: Worker전체28/28([결과](./verification/SESSION-01-green-worker.log)), 신규E2E2/2([결과](./verification/SESSION-01-green-ui.log)). 실제 D1 trigger가 seed를 거부하면 세션/정책 모두 rollback·쿠키 미발급. A/B 같은 custom 등록·한쪽200개에서 다른쪽 추가 가능, A차단 미저장/B허용 R2바이트 일치, 새 세션도 글로벌 예산 우회 불가.
- 리팩토링: migration/session 준비를 fixture로 모으고 APIRequest도 같은 context.request로 수정했다. 기존 경계/T/동시성/바이트 assertion 유지·unused import 제거·중복 쿠키 경계 보강. 추가 서비스 계층은 필요하지 않았다.
- **누적 회귀, 20:04~20:05 KST**: `pnpm run check` 종료0, 타입/빌드·단위42·Worker28·E2E15=**로컬85개 통과**. [report](./verification/runs/CHECK-2026-10-23T11-04-16-943Z-a7c2e320/report.json), [stdout](./verification/SESSION-01-final-check.log). 기존 실제60초 timeout·응답 유실·성공 보존·수동 재시도·글로벌 예산·T 전후 변경 회귀 유지. 첫 Green 후 전체 통과했다.
- 일반 dev migration3 적용·5173 초기 화면 확인. 데스크톱/390px 이미지를 열어 확인했다. 기존 증거를 덮어쓴 screenshot은 SESSION-01 이름으로 보관하고 원본 복구, 이후 캡처 경로에 prefix를 적용해 수집만 확인한다. 제품 동작 변화 없는80초 회귀는 반복하지 않는다.
- 종료: 로컬 기능/회귀·일반 개발 준비 완료. 배포/원격 검증·커밋/푸시 없음. 명령·증거/한계는 VALIDATION의 SESSION-01을 따른다.

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

### LOCAL-20261023 — 후속 로컬 개발 환경 설정

- 2026-10-23 19:40~19:45 KST. 기능 개발을 로컬 우선으로 하고 Cloudflare 배포는 이후 명시적 요청 때만 수행하라는 사용자 지시를 지침·결정·실행 안내에 반영했다. 앱 기능 추가 루프와 구분한다.
- 기존 의존성 13개와 Chromium이 준비되어 추가 설치가 없었다. 기본 샌드박스의 pnpm SQLite 인덱스 오류는 실제 사용자 환경에서 기존 D 전역 스토어로 확인해 해결했으며 제품 Red로 세지 않았다.
- Vite `remoteBindings: false` 한 설정을 추가했다. 기존 `--local` migration 2개 적용, 환경 스모크·타입/빌드 종료0, 개발 서버 HTML/API200·초기 Chromium 렌더/오류0을 확인했다. 설정 변경으로 새 기능 Red를 만들지 않았고 추가 리팩토링은 필요하지 않았다.
- 검증 범위는 로컬 개발 환경 준비다. 전체 앱 회귀나 원격 검증을 새로 실행했다고 표시하지 않는다. 원격 배포·커밋/푸시 없음. [실제 명령·증거](./VALIDATION.md#local-20261023--로컬-데브-준비).
