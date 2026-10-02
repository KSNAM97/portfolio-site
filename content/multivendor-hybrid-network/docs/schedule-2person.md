# 일정 — 2인 체제 (Network+Cloud 통합 / Policy)

## 역할 분담

| 역할 | 담당 사이트 |
|---|---|
| Network+Cloud (통합) | DC, HQ, ISP-1, ISP-2, Private Internet, DNS, QoS |
| Policy | BR1, BR2, DMVPN(Hub+Spoke), 접근통제 ACL |

⚠️ 통합 담당자 업무량이 전체의 약 75%(24개 티켓 중 18개)를 차지합니다.
BR1/BR2 중 하나를 Policy로 넘기는 재배분안을 권장하며, 본 일정은 재배분 적용 기준입니다.

## VLAN 태그 (3인 체제와 동일)

| VLAN | 태그 |
|---|---|
| 10 | `vlan-hq-user-a` |
| 20 | `vlan-hq-user-b` |
| 50 | `vlan-dc-server` |
| BR1 10 | `vlan-br1-user` |
| BR2 10 | `vlan-br2-user` |
| 100 | `vlan-mgmt` |
| 999 | `vlan-native` |

## 일별 목표

| 주 | 일 | Network+Cloud | Policy |
|---|---|---|---|
| W1 | 월 | AS/IP/VLAN 표 리뷰 | 〃 |
| | 화 | GNS3/Jira/Slack/Git 세팅 | 〃 |
| | 수 | 7200/cEOS/IOU RAM 실측 | 문서화 지원 |
| | 목 | DC+HQ+ISP 노드 배치 | BR1+BR2 노드 배치 |
| | 금 | 기본 링크, up/up 확인 | 〃 |
| W2 | 월 | DC VLAN/트렁크(Arista) | BR1 VLAN/트렁크 |
| | 화 | DC VARP | BR1 HSRP |
| | 수 | HQ VLAN/트렁크, HSRP | BR2 VLAN/트렁크 |
| | 목 | HQ Po1-3, 내부 OSPF | BR2 HSRP, 내부 OSPF |
| | 금 | DC/HQ 내부통신 검증 | BR1/BR2 내부통신 검증 |
| W3 | 월 | ISP-1 내부 eBGP 4세션 | BR1↔ISP 정적경로+track |
| | 화 | ISP-2 내부 eBGP 4세션 | BR2↔ISP 정적경로+track |
| | 수 | PE 고객 대역 광고 | 〃 |
| | 목 | DC/HQ↔ISP 정적경로+재분배 | 〃 |
| | 금 | PI 기본연결+OSPF(프로세스2) | 전 사이트 상호도달 확인 |
| W4 | 월 | PI ACL 화이트리스트 | DMVPN Spoke(BR1) |
| | 화 | DMVPN Hub(R24) crypto | DMVPN Spoke(BR2) |
| | 수 | DNS1/2 배치+검증 | Phase3 shortcut 검증 |
| | 목 | QoS 20포트 중 DC/HQ 12대 | QoS 20포트 중 BR 8대 |
| | 금 | 접근통제 ACL, 통합 테스트 | 〃 |
| W5 | 월~화 | HSRP/VARP, EtherChannel 실측 | 〃 |
| | 수 | ISP 장애→DMVPN 전환 실측 | 〃 |
| | 목 | DMVPN Hub 장애 실측 | 〃 |
| | 금 | 트러블슈팅 로그 정리 | 〃 |
| W6 | 월~수 | PPT(DC/HQ/ISP/이중화) | PPT(BR/DMVPN) |
| | 목 | 리허설 | 〃 |
| | 금 | 예비일 | 〃 |

## 3인 대비 리스크
- W3~W4에 통합 담당자 업무가 몰려 있어 지연 시 가장 먼저 영향받는 구간입니다.
- 지연 발생 시 컷 순서: ① QoS 스위치 검증 생략(라우터만) ② DNS 이중화→단일 서버 ③ ISP-2 생략, ISP-1+DMVPN만
