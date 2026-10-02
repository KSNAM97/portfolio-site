# 멀티벤더 하이브리드 네트워크 프로젝트

HQ / DC / BR1 / BR2 4개 사이트를 ISP 이중화(ISP-1, ISP-2)와 DMVPN으로 연결하는
멀티벤더(Cisco + Arista) 네트워크 구축 프로젝트입니다. GNS3 기반 실습이며,
6주 일정으로 진행합니다.

## 문서 구조

| 경로 | 내용 |
|---|---|
| `docs/network-project-final.md` | 전체 설계 (아키텍처, AS/VLAN/IP, 인터페이스 매핑, 정책, 빌드 순서) |
| `docs/schedule-3person.md` | 3인 체제 일정 (Network / Cloud / Policy) |
| `docs/schedule-2person.md` | 2인 체제 일정 (Network+Cloud 통합 / Policy) |
| `jira/jira-tickets-*.csv` | Jira Import용 티켓 목록 (팀 구성에 맞는 파일 사용) |
| `slack/slack-announcement.md` | 팀 공지 초안 |
| `configs/<사이트>/` | 장비별 컨피그 저장 위치 |
| `topology/` | 다이어그램 원본/캡처 |

## 시작하기

1. `docs/network-project-final.md`로 전체 구조와 AS/IP/VLAN 확정안을 확인합니다.
2. 팀 인원에 맞는 일정 문서(`schedule-3person.md` 또는 `schedule-2person.md`)를 따라갑니다.
3. 해당하는 `jira-tickets-*.csv`를 Jira에 Import합니다. Import 후 실제 발급된
   이슈 번호를 확인하고 커밋 메시지 규칙(`CONTRIBUTING.md` 참고)에 맞춰 작업합니다.
4. 각자 담당 사이트의 컨피그를 `configs/<사이트>/`에 커밋합니다.

## 핵심 설계 요약

- 사이트(HQ/DC/BR1/BR2) 내부: OSPF 전용, BGP 없음
- ISP-1/ISP-2: 라우터별 개별 AS의 eBGP 전용 (PE-A/P1/P2/PE-B 마름모 4대씩)
- 사이트 ↔ ISP: 정적 경로 + OSPF 재분배(IP SLA/track)
- DC ↔ BR1/BR2: DMVPN Phase3 (mGRE over IPsec), Private Internet 경유
- Private Internet: 별도 OSPF 프로세스, ACL 화이트리스트로 언더레이만 통신
- DC 내부 스위치만 Arista cEOS, 나머지는 Cisco (7200 / IOU)

자세한 내용은 `docs/network-project-final.md`를 참고하십시오.
