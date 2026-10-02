# 포트폴리오 사이트 운영 기록

> 이 문서는 구축 내용, 구성, 운영 절차, 변경 이력을 남기는 **백업 원본**입니다.
> `main`에 push하면 같은 내용이 Supabase `ops_log` 테이블에도 복사됩니다 (`.github/workflows/ops-log.yml`).
> 토큰·키 **값은 적지 않습니다**. 이름과 용도만 기록합니다.

## 1. 개요

- 사이트: https://ksnam97.com (www.ksnam97.com 도 동일)
- 목적: 네트워크/인프라 엔지니어 포트폴리오. 프로젝트 카드, 상세 창(문서·컨피그 열람), Jira 진행 현황, 문의 폼.
- 스택: Next.js 14 (Nextra 블로그 스타터, pages 라우터) + Supabase (Postgres) + Vercel + GitHub Actions
- 최종 갱신: 2026-10-02

## 2. 구성도

```
[원본 GitHub repo]                    [GitHub Actions: portfolio-site]            [Supabase]                 [Vercel]
 network-project          push → notify ─┐
 cisco-dmvpn-ipsec-network push → notify ─┼─▶ sync-portfolio (매시간 + 즉시) ─▶ projects / site / project_files ─▶ ksnam97.com
 portfolio.config.json  ──────────────────┘            │                          (브라우저가 공개 키로 읽기만)
                                                       └─▶ Jira KAN 진행률(숫자만) ─▶ site.jira_progress:<slug>
방문자 문의 폼 ─▶ /api/contact (Vercel 서버 함수) ─▶ Slack 웹훅
```

- 사이트는 **브라우저에서 Supabase를 직접 읽는** 구조입니다. DB가 갱신되면 재배포 없이 바뀝니다.
- Vercel은 코드(portfolio-site)가 바뀔 때만 다시 배포됩니다.

## 3. 저장소와 역할

| repo | 공개 여부 | 역할 |
|---|---|---|
| `KSNAM97/portfolio-site` | public | 사이트 코드, 동기화 스크립트, Actions |
| `KSNAM97/network-project` | public (2026-10-02 전환) | 멀티벤더 하이브리드 네트워크 팀 프로젝트 문서·컨피그 |
| `KSNAM97/cisco-dmvpn-ipsec-network` | public | DMVPN + IPsec 프로젝트 컨피그 |

- 사이트에 노출되는 파일은 `portfolio.config.json`의 `sources[].include`로 정합니다. 현재: `README.md`, `docs/`, `configs/`(DMVPN은 `verification/`도).
- `jira/`, `slack/`, `CONTRIBUTING.md`는 사이트에 올리지 않습니다.

## 4. 워크플로

| repo | 워크플로 | 트리거 | 하는 일 |
|---|---|---|---|
| portfolio-site | `sync-portfolio` | 매시간(UTC 정각), push(설정/스크립트 변경), 수동, 원본 repo push | 프로젝트 카드, 원본 파일, Jira 진행률을 Supabase에 반영. 실패 시 Slack 알림 |
| portfolio-site | `jira-import` | 수동 (`dry`/`create`) | GitHub의 CSV로 Jira 이슈 생성. 같은 제목은 건너뜀 |
| portfolio-site | `jira-inspect` | 수동 | Jira 프로젝트/보드 구조 점검 (읽기 전용, 제목은 로그에 안 남김) |
| portfolio-site | `jira-transition` | 수동 | Jira 이슈 하나의 상태를 바꿈. Slack 알림 테스트용 (테스트 후 원래 상태로 되돌릴 것) |
| portfolio-site | `slack-setup` | 수동 (`dry`/`create`) | 설정의 Slack 채널 생성. 이미 있으면 건너뜀 |
| portfolio-site | `slack-announce` | 수동 (`dry`/`post`) | 공지 문서를 팀 채널에 게시. 재실행하면 중복 게시 |
| portfolio-site | `ops-log` | 이 문서 변경 push, 수동 | 이 문서를 `ops_log`에 백업 |
| network-project, cisco-dmvpn-ipsec-network | `notify-portfolio` | 해당 폴더 push, 수동 | portfolio-site의 `sync-portfolio`를 즉시 실행 |

## 5. 시크릿·토큰 목록 (값은 기록하지 않음)

| 위치 | 이름 | 용도 | 권한/범위 |
|---|---|---|---|
| portfolio-site (Actions) | `SUPABASE_URL` | DB 주소 | - |
| portfolio-site (Actions) | `SUPABASE_SERVICE_ROLE_KEY` | DB 쓰기 (동기화) | Supabase secret key. RLS 우회, 클라이언트 노출 금지 |
| portfolio-site (Actions) | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | Jira 읽기/이슈 생성 | 토큰 만료일 확인 필요 |
| portfolio-site (Actions) | `SLACK_WEBHOOK_URL` | 동기화 알림 | 웹훅 1개 |
| portfolio-site (Actions) | `SLACK_BOT_TOKEN` | 채널 생성, 공지 게시 | `channels:manage`, `channels:read`, `chat:write`. 작업 끝나면 권한 축소 권장 |
| network-project, cisco-dmvpn-ipsec-network (Actions) | `PORTFOLIO_DISPATCH_TOKEN` | 동기화 즉시 실행 | fine-grained, portfolio-site만, Actions: Read and write |
| Vercel (Production) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 사이트가 DB를 읽음 | 공개 키(publishable). 공개돼도 안전 |
| Vercel (Production) | `SLACK_CONTACT_WEBHOOK_URL` | 문의 폼 → Slack | 웹훅 URL. 등록 후 Redeploy 필요 |
| Vercel (Production) | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` | `/api/jira-progress`가 Jira를 직접 조회(진행 현황 실시간 반영) | 읽기만 사용. 없으면 DB에 저장된 값으로 폴백 |

로컬 `.env.local`은 git에서 제외됩니다 (`.gitignore`).

## 6. Supabase

- 프로젝트: `ksnam-portfolio` (서울 리전)
- 테이블: `site`(프로필, Jira 진행률), `projects`(카드), `project_files`(상세 창 파일), `ops_log`(이 문서의 백업)
- 보안: 모든 테이블 RLS 켜짐. 공개 키는 `site`/`projects`/`project_files`를 **읽기만** 가능. `ops_log`는 공개 키로 읽기/쓰기 모두 불가.
- 2026-10-02: 공개 키(anon, authenticated)의 INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 권한을 회수 (읽기만 남김). 동기화는 service role이라 영향 없음.
- 무료 플랜은 장기간 활동이 없으면 일시 중지됩니다. 매시간 동기화가 쓰기 요청을 보내므로 보통 해당 없음. GitHub는 repo 활동이 60일 없으면 예약 실행을 끌 수 있으니 오래 쉴 때 확인.

## 6-1. 진행 현황 반영 방식 (실시간성)

- 기본(폴백): `sync-portfolio`가 Jira 숫자를 Supabase `site.jira_progress:<slug>`에 저장 → 사이트가 읽음. 동기화가 돌아야 갱신됨.
- 실시간: `/api/jira-progress`(Vercel 서버 함수)가 Jira를 직접 조회해 숫자만 반환. 응답은 60초 캐시, 변경 후 약 1분 안에 반영. Vercel에 `JIRA_*` 환경변수가 있어야 동작하고, 없으면 503을 반환해 화면은 저장된 값으로 폴백.
- 검증(2026-10-02): `KAN-6`을 `진행 중`→`완료`→`해야 할 일`로 옮기며 측정. 서버 함수는 변경 후 1초, 공개 주소(캐시)는 약 9초 안에 반영되었고 사이트의 진행 현황 패널에도 `3%`(완료 1/29)로 표시됨. 되돌림도 약 9초. 측정 후 테스트 이슈는 `해야 할 일`로 복원.
- 인증 실패 방어: Vercel의 Jira 이메일/토큰/주소가 틀리면 Jira는 요청을 익명으로 처리해 빈 결과(0개)를 성공으로 돌려준다. 그래서 함수는 먼저 `/myself`로 인증을 확인하고 실패하면 `502 jira-auth`를 반환(캐시하지 않음). 화면은 `total`이 0인 실시간 값을 무시하고 저장된 값을 쓴다.
- 점검(2026-10-02): GitHub 예약 실행(`0 * * * *`)이 05~08시 정각에 한 번도 시작되지 않음. 예약 실행은 신규 repo나 정각에 지연·누락될 수 있으므로 Jira 반영의 근거로 삼지 않는다. 변경 후 2분간 DB가 갱신되지 않는 것을 실험으로 확인.

## 7. Jira / Slack

- Jira: 사이트 `final-project-ksnam97`, 프로젝트 키 `KAN` (팀 관리형 칸반). 이슈 29개 생성 (`KAN-4` ~ `KAN-32`, 유형 `작업`). 키는 샘플 이슈 3개가 지워지며 4번부터 시작했고 Jira에서 되돌릴 수 없음. 제목의 `[W1]`~`[W6]` 접두어로 사이트가 주차별 진행률을 계산 (숫자만 노출, 제목은 저장·노출 안 함).
- Slack 워크스페이스 `final-project`. 채널: `#announcements`, `#team-network`, `#team-cloud`, `#team-policy`, `#dev-issues`.
- Jira Cloud 앱 연결: `#team-network`(labels=network), `#team-cloud`(labels=cloud), `#team-policy`(labels=policy). **`#dev-issues`는 제외**. `#announcements`는 연결 안 함.
- 알림 조건(세 팀 채널 공통): `Issue is = created` + `Status is transitioned to = 진행 중, 해야 할 일, 완료`. 상태 조건을 비워 두면 이슈 생성 때만 알림이 오므로 반드시 채워 둘 것(2026-10-02 수정). 되돌릴 때(`해야 할 일`)도 알림이 간다.
- 팀 공지: 최종 설계 공지는 `#team-network`, `#team-cloud`, `#team-policy`에 게시 완료. 사전작업 요약 공지(`slack/2026-10-02-setup-summary.md`)는 `#announcements`에 게시.

## 8. 변경 이력 (2026-10-02)

1. 사이트 구축: Vite+React로 시작해 Next.js(Nextra 스타터)로 교체, Supabase·Vercel 연결, `ksnam97.com`(Route 53) 연결.
2. 프로젝트 카드: 멀티벤더(비공개 repo)·DMVPN·GitBook 위키 카드, 이후 노출 대상을 멀티벤더와 DMVPN으로 정리.
3. 상세 창: 왼쪽 목차 + 파일 열람(`.md` 렌더링, `.cfg` 원문), 원본 GitHub repo에서 직접 읽도록 변경.
4. DMVPN 컨피그 오류 수정: `configure terminal` 누락, 기본 경로 누락, `switchport access vlan` 번호 누락 등. 컨피그 확장자를 `.cfg`/`.vpc`로 변경.
5. 멀티벤더: DB1 서버(VLAN 50) 추가, README를 DMVPN과 같은 형식으로 통일, Slack 공지 최신화, Jira 키 `NET-`을 `KAN-`으로, CSV 쉼표 오류 수정.
6. 커밋 기록 정리: 공동 작성자 줄 제거(히스토리 재작성), 연결 안 된 작성자(`aws_sol`) 커밋을 `KiSukNam`으로 정정.
7. 자동화: 원본 repo push → 즉시 동기화(`notify-portfolio`), Slack 알림, Jira 진행률, 문의 폼.
8. 정리: Vercel `obsidian` 프로젝트 삭제 (GitHub repo는 유지), `network-project`를 공개로 전환(Actions 사용량 한도 회피 목적).
9. Slack 알림 테스트: `KAN-6`(network 라벨만)을 `진행 중`으로 옮겼을 때 알림이 오지 않음 → 원인은 `Status is transitioned to`가 비어 있던 것. 세 팀 채널에 `진행 중`/`완료`를 설정한 뒤 `완료`로 옮겨 재테스트: `#team-network`에만 알림이 오고 `#team-cloud`, `#team-policy`, `#dev-issues`에는 오지 않음(라벨 필터 정상). 테스트 이슈는 `해야 할 일`로 복원.
10. 알림 조건에 `해야 할 일`을 추가해 세 팀 채널 모두 적용하고, 팀별로 `진행 중`/`해야 할 일` 전환 알림이 해당 채널에만 가는 것을 확인.
11. 문의 폼 웹훅(`SLACK_CONTACT_WEBHOOK_URL`)을 Vercel에 등록하고 재배포. `/api/contact` 테스트 응답 200 확인(Slack 도착은 화면 읽기 한계로 육안 확인 필요).
12. 진행 현황을 실시간으로 반영하는 `/api/jira-progress` 추가(Vercel에 `JIRA_*` 환경변수 3개 등록). 인증 오류 방어 코드를 넣고 반영 속도를 측정(약 9초).

## 9. 점검 결과 (2026-10-02)

- GitHub: 세 repo 모두 작성자 `KiSukNam` 단일, 연결 안 된 커밋 0, Claude 흔적 0, 키·토큰 값 0(현재 파일과 히스토리).
- 사이트: `ksnam97.com`, `www` 200, `http`는 `https`로 308 리다이렉트, 공개 JS 번들에 비밀 키 0건.
- Supabase: RLS 켜짐, 공개 키 읽기 200 / 쓰기 401, `ops_log` 공개 키 접근 401.
- 동기화: 두 원본 repo 모두 기본 토큰으로 읽음(DMVPN 18개, 멀티벤더 4개), Jira 29개 이슈 반영.
- Slack: 팀 채널 3곳 Jira 연결 확인, `#dev-issues` 연결 제거 확인.
- Jira → Slack 알림: 팀별 상태 전환 테스트 통과. `KAN-6`(network)은 `#team-network`, `KAN-8`(cloud)은 `#team-cloud`, `KAN-12`(policy)는 `#team-policy`에만 전달되었고, `진행 중`으로 옮길 때와 `해야 할 일`로 되돌릴 때 모두 알림이 옴. 테스트 이슈 3개는 `해야 할 일`로 복원.

## 10. 운영 절차

- **문서/컨피그 수정 반영**: 원본 repo에 push → 약 30초 안에 사이트 반영. 바로 안 보이면 portfolio-site Actions에서 `sync-portfolio` 수동 실행.
- **프로젝트 카드 수정**: `portfolio.config.json`의 `overrides`/`extra_projects` 수정 후 push.
- **노출 파일 변경**: `portfolio.config.json`의 `sources[].include` 수정.
- **토큰 만료/교체**: 만료 전에 새 토큰을 만들어 같은 이름의 시크릿에 덮어씁니다. 만료돼도 사이트는 마지막 내용을 유지하고 갱신만 멈춥니다.
- **Jira 이슈 수정**: Jira에서 직접 수정. CSV는 새 이슈 생성 전용(제목을 바꾼 행은 새 이슈로 만들어짐).
- **문의 폼**: Vercel 환경변수 `SLACK_CONTACT_WEBHOOK_URL` 등록 후 Redeploy.
- **롤백**: 코드는 `git revert`로 되돌리면 Vercel이 자동 재배포. DB는 `sync-portfolio`가 원본 repo 기준으로 다시 채웁니다.

## 11. 남은 일 / 주의

- Vercel `SLACK_CONTACT_WEBHOOK_URL` 등록 여부 확인.
- GitHub 설정에서 `portfolio-source-read` 토큰(읽기용, 더 이상 쓰이지 않음) 폐기. 시크릿 `SOURCE_REPO_TOKEN`은 2026-10-02에 삭제 완료.
- Slack 봇 권한(`channels:manage`, `chat:write`) 축소 또는 `SLACK_BOT_TOKEN` 삭제.
- 팀원을 Slack 채널과 GitHub에 초대. `final-project` 팀 공지를 `#announcements`에 게시.
- Jira에서 GitHub for Jira 앱 연결 (커밋 → 이슈 자동 연결).
- 도메인 `ksnam97.com`은 2027-09-10 만료, 자동 갱신 꺼짐. 호스티드 존 월 $0.50.
- `slack-announce`는 재실행하면 공지가 중복 게시됩니다.
