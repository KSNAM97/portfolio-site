# 일정 — 3인 체제 (Network / Cloud / Policy)

## 역할 분담

| 역할 | 담당 사이트 |
|---|---|
| Network | DC, Private Internet, DNS, QoS |
| Cloud | HQ, ISP-1, ISP-2 |
| Policy | BR1, BR2, DMVPN(Hub+Spoke), 접근통제 ACL |

## VLAN 태그

| VLAN | 태그 | 소속 |
|---|---|---|
| 10 | `vlan-hq-user-a` | Cloud |
| 20 | `vlan-hq-user-b` | Cloud |
| 50 | `vlan-dc-server` | Network |
| BR1 10 | `vlan-br1-user` | Policy |
| BR2 10 | `vlan-br2-user` | Policy |
| 100 | `vlan-mgmt` | 공통 |
| 999 | `vlan-native` | 공통 |

커밋 형식: `[역할][vlan-태그] 내용` 예) `[Network][vlan-dc-server] DNS1/2 ACL 추가`

## 일별 목표

| 주 | 일 | Network | Cloud | Policy |
|---|---|---|---|---|
| W1 | 월 | AS/IP/VLAN 표 리뷰 | 〃 | 〃 |
| | 화 | GNS3/Jira/Slack/Git 세팅 | 〃 | 〃 |
| | 수 | 7200/cEOS RAM 실측 | IOU RAM 실측 | 이미지별 문서화 |
| | 목 | DC 노드 배치 | HQ/ISP 노드 배치 | BR1/BR2 노드 배치 |
| | 금 | 기본 링크, up/up 확인 | 〃 | 〃 |
| W2 | 월 | DC VLAN/트렁크(Arista) | HQ VLAN/트렁크 | BR1 VLAN/트렁크 |
| | 화 | DC VARP | HQ HSRP | BR1 HSRP |
| | 수 | DC STP 루트 고정, Po | HQ Po1-3 | BR1 Po1 |
| | 목 | DC 내부 OSPF | HQ 내부 OSPF | BR2 반복 |
| | 금 | 사이트 내부통신 검증 | 〃 | 〃 |
| W3 | 월 | PI 기본 연결 | ISP-1 내부 eBGP 4세션 | BR1↔ISP 정적경로 |
| | 화 | PI OSPF(프로세스2) | ISP-2 내부 eBGP 4세션 | BR2↔ISP 정적경로 |
| | 수 | PI ACL 화이트리스트 | PE 고객 대역 광고 | track/IP SLA |
| | 목 | DC↔ISP 정적경로+재분배 | HQ↔ISP 정적경로+재분배 | 〃 |
| | 금 | 전 사이트 상호 도달 확인 | 〃 | 〃 |
| W4 | 월 | DMVPN Hub(R24) crypto | ISP 경로 필터 정리 | DMVPN Spoke(BR1) |
| | 화 | DNS1/2 배치 | OSPF↔BGP 재분배 점검 | DMVPN Spoke(BR2) |
| | 수 | DNS 검증(dig) | - | Phase3 shortcut 검증 |
| | 목 | QoS 20포트 중 DC 4대 | QoS 20포트 중 HQ 2대 | QoS 20포트 중 BR 4대 |
| | 금 | 접근통제 ACL, 통합 테스트 | 〃 | 〃 |
| W5 | 월 | HSRP/VARP 전환 실측 | 〃 | 〃 |
| | 화 | EtherChannel 멤버 다운 실측 | 〃 | 〃 |
| | 수 | - | ISP 장애→DMVPN 전환 실측 | 〃 |
| | 목 | DMVPN Hub 장애 실측 | - | 〃 |
| | 금 | 트러블슈팅 로그 정리 | 〃 | 〃 |
| W6 | 월~수 | PPT 슬라이드(DC/이중화) | PPT 슬라이드(HQ/ISP) | PPT 슬라이드(BR/DMVPN) |
| | 목 | 리허설 | 〃 | 〃 |
| | 금 | 예비일 | 〃 | 〃 |
