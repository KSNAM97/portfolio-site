# 멀티벤더 하이브리드 네트워크 프로젝트 — 최종 설계

## 1. 전체 구조

```
HQ(65001) ─┬─ ISP-1 ─┐
           └─ ISP-2 ─┤
DC(65002) ─┬─ ISP-1 ─┼─ (ISP 내부는 eBGP, 사이트는 OSPF)
           └─ ISP-2 ─┤
BR1        ─┬─ ISP-1 ─┤
           └─ ISP-2 ─┤
BR2        ─┬─ ISP-1 ─┘
           └─ ISP-2 ─┘

DC ←── DMVPN Phase3(mGRE over IPsec, Private Internet 경유) ──→ BR1, BR2
```

- 사이트(HQ/DC/BR1/BR2) 내부: OSPF 전용, BGP 없음
- ISP-1/ISP-2: 라우터별 개별 AS의 eBGP 전용, OSPF 없음
- 사이트 ↔ ISP: 라우팅 프로토콜 없음, 정적 경로 + OSPF 재분배(track)
- Private Internet(DMVPN 언더레이): 별도 OSPF 프로세스(2), ACL 화이트리스트
- DC만 Arista cEOS, 나머지 전부 Cisco (7200 / IOU)

## 2. 사이트 · AS

| 사이트 | AS | 대역 | 비고 |
|---|---|---|---|
| HQ | 65001 | 10.1.0.0/16 | OSPF 프로세스1 Area0 |
| DC | 65002 | 10.2.0.0/16 | OSPF 프로세스1 Area10, DMVPN Hub(R24) |
| BR1 | 65003 | 10.3.0.0/16 | OSPF 프로세스1 Area20, DMVPN Spoke(R1) |
| BR2 | 65004 | 10.4.0.0/16 | OSPF 프로세스1 Area30, DMVPN Spoke(R2) |
| ISP-1 | PE-A 65111 / P1 65112 / P2 65113 / PE-B 65114 | 100.1.0.0/16 | eBGP 전용 |
| ISP-2 | PE-A 65121 / P1 65122 / P2 65123 / PE-B 65124 | 100.2.0.0/16 | eBGP 전용 |
| Private Internet | 없음(BGP 미사용) | 203.0.113.0/24 | OSPF 프로세스2 Area100, DMVPN 언더레이 전용 |
| DMVPN 터널 | - | 172.16.0.0/24 | OSPF 프로세스1 Area0 |

폐기된 AS: 65000, 65006, 65007, 65010, 65020 (설계 변경 과정에서 대체됨)

## 3. VLAN

| 사이트 | VLAN | 이름 | 서브넷 | 게이트웨이 이중화 |
|---|---|---|---|---|
| HQ | 10 | HQ-USER-A | 10.1.10.0/24 | HSRP (SW101 .2 / SW102 .3, VIP .1) |
| HQ | 20 | HQ-USER-B | 10.1.20.0/24 | HSRP |
| DC | 50 | SERVER (DNS1/2, DB1) | 10.2.50.0/24 | VARP/VRRP (SW201 .2 / SW202 .3, VIP .1) |
| BR1 | 10 | BR1-USER | 10.3.10.0/24 | HSRP |
| BR2 | 10 | BR2-USER | 10.4.10.0/24 | HSRP |
| 전 사이트 | 100 | MGMT | 10.X.100.0/24 | - |
| 전 사이트 | 999 | NATIVE | IP 없음 | 모든 트렁크 native |

## 4. 인터페이스 · 포트 매핑 (제안값 — 실제 케이블링과 대조 필요)

### HQ
| A | B | 서브넷/용도 |
|---|---|---|
| SW101 e1/0 | R11 Gi0/0 | 10.1.0.0/30 |
| SW101 e1/1 | R12 Gi0/0 | 10.1.0.4/30 |
| SW102 e1/0 | R11 Gi1/0 | 10.1.0.8/30 |
| SW102 e1/1 | R12 Gi1/0 | 10.1.0.12/30 |
| R11 Gi2/0 | R12 Gi2/0 | 10.1.0.16/30 |
| R11 Gi3/0 | ISP1-PE-A Gi2/0 | 100.1.11.0/30 |
| R12 Gi3/0 | ISP2-PE-A Gi2/0 | 100.2.12.0/30 |
| R12 Gi4/0 | PI Gi2/0 | 203.0.113.8/30 |
| SW110 e1/0-1 | SW101 e0/0-1 (Po1, VLAN10/20/100) |
| SW110 e1/2-3 | SW102 e0/0-1 (Po2) |
| SW101 e0/2-3 | SW102 e0/2-3 (Po3) |
| **QoS 대상** | R11 Gi0/0, Gi1/0 / R12 Gi0/0, Gi1/0 |

### DC
| A | B | 서브넷/용도 |
|---|---|---|
| R23 Gi0/0 | SW211 Et1 | 10.2.0.0/30 |
| R23 Gi1/0 | SW212 Et1 | 10.2.0.4/30 |
| R24 Gi0/0 | SW211 Et2 | 10.2.0.8/30 |
| R24 Gi1/0 | SW212 Et2 | 10.2.0.12/30 |
| SW211 Et3 | SW212 Et3 | 10.2.0.16/30 |
| SW211 Et4-5 | SW201 Et1 / SW202 Et1 |
| SW212 Et4-5 | SW201 Et2 / SW202 Et2 |
| SW201 Et3-4 | R21 Gi0/0 / R22 Gi0/0 |
| SW202 Et3-4 | R21 Gi1/0 / R22 Gi1/0 |
| R21 Gi2/0 | R22 Gi2/0 | 10.2.0.52/30 |
| R23 Gi2/0 | PI Gi0/0 | 203.0.113.0/30 |
| R24 Gi2/0 | PI Gi1/0 | 203.0.113.4/30 (Tunnel0 source) |
| R21 Gi3/0 | ISP1-PE-A Gi3/0 | 100.1.21.0/30 |
| R22 Gi3/0 | ISP2-PE-A Gi3/0 | 100.2.22.0/30 |
| SW201 Et5-6 | SW202 Et5-6 (Po1, VLAN50/100) |
| SW201/202 Et7-8 | SW-SVR1 / SW-SVR2 (트렁크) |
| SW-SVR1 Et3 | DNS1 (VLAN50 access) |
| SW-SVR2 Et3 | DNS2 (VLAN50 access) |
| SW-SVR2 Et4 | DB1 (VLAN50 access) |
| **QoS 대상** | R21 Gi0/0,Gi1/0 / R22 Gi0/0,Gi1/0 / R23 Gi0/0,Gi1/0 / R24 Gi0/0,Gi1/0 |

### BR1 (BR2는 10.3→10.4, ISP 링크 하단 표 참고)
| A | B | 서브넷/용도 |
|---|---|---|
| SW1 e0/0-1 | R1 Gi0/0 / R2 Gi0/0 |
| SW2 e0/0-1 | R1 Gi1/0 / R2 Gi1/0 |
| R1 Gi2/0 | R2 Gi2/0 | 10.3.0.16/30 |
| R1 Gi3/0 | ISP1-PE-B Gi2/0 | 100.1.31.0/30 |
| R2 Gi3/0 | ISP2-PE-B Gi2/0 | 100.2.32.0/30 |
| R1 Gi4/0 | PI Gi3/0 | 203.0.113.12/30 (Tunnel0 source, DMVPN Spoke) |
| SW1 e1/0-1 | SW2 e1/0-1 (Po1, VLAN10/100) |
| SW1/SW2 → SW3 | 트렁크 |
| H1/H2 | SW3 (VLAN10 access) |
| **QoS 대상** | R1 Gi0/0,Gi1/0 / R2 Gi0/0,Gi1/0 |

### BR2 (BR1과 동일 패턴, 스포크는 R2)
| 링크 | 서브넷 |
|---|---|
| R1 Gi3/0 ↔ ISP1-PE-B Gi3/0 | 100.1.41.0/30 |
| R2 Gi3/0 ↔ ISP2-PE-B Gi3/0 | 100.2.42.0/30 |
| R2 Gi4/0 ↔ PI Gi4/0 | 203.0.113.16/30 (Tunnel0 source, DMVPN Spoke) |

### ISP-1 (ISP-2는 100.1→100.2, AS +10)
| A | B | 서브넷 |
|---|---|---|
| PE-A Gi0/0 | P1 Gi0/0 | 100.1.0.0/30 |
| PE-A Gi1/0 | P2 Gi0/0 | 100.1.0.4/30 |
| PE-B Gi0/0 | P1 Gi1/0 | 100.1.0.8/30 |
| PE-B Gi1/0 | P2 Gi1/0 | 100.1.0.12/30 |
| P1 Gi2/0 | P2 Gi2/0 | 100.1.0.16/30 |

### DMVPN
| 장비 | Tunnel0 | NBMA(source) | 역할 |
|---|---|---|---|
| DC R24 | 172.16.0.1/24 | 203.0.113.5 | Hub, priority 255, mGRE over IPsec transport |
| BR1 R1 | 172.16.0.11/24 | 203.0.113.13 | Spoke, priority 0, shortcut |
| BR2 R2 | 172.16.0.12/24 | 203.0.113.17 | Spoke, priority 0, shortcut |

## 5. 정책

### Private Internet ACL (화이트리스트, 5개 링크 전부)
- permit OSPF(224.0.0.5/6), GRE/ESP/UDP500(203.0.113.0/24 간), ICMP(임시)
- deny ip any any log

### QoS (사이트↔스위치 라우터 인터페이스, 총 20포트)
- 위치: HQ R11/R12, DC R21/R22/R23/R24, BR1·BR2 R1/R2 — 각 Gi0/0, Gi1/0
- 제외: 라우터간 링크, ISP 방향, PI 방향, Tunnel0
- 클래스: CONTROL(DSCP CS6, 10%) / BUSINESS(DNS 53→AF31, 30%) / class-default(fair-queue)
- 부모 정책: shape average (병목 검증용 예시값, 실측 시 조정)

### 접근 통제
- DC VLAN50(DNS1/2): 각 사이트 → UDP/TCP 53만 허용, 그 외 차단
- DC VLAN50(DB1): DB 종류 확정 후 허용 포트 추가 (그 전까지 사이트 → DB1 차단 유지)

## 6. 빌드 순서 (6주, 3인)

| 주차 | 내용 |
|---|---|
| W1 | AS/IP/VLAN 확정, GNS3 환경 세팅, 이미지별 RAM 실측(cEOS 포함), 노드 배치 |
| W2 | 사이트 내부 L2/L3 (VLAN, 트렁크, EtherChannel, HSRP/VARP, 사이트 내부 OSPF) |
| W3 | 사이트↔ISP 정적경로+재분배, ISP 내부 eBGP 풀메시, PI ACL |
| W4 | DMVPN(mGRE over IPsec), DNS 서비스, QoS 정책, 접근통제 ACL |
| W5 | 이중화 장애 실측(FHRP, EtherChannel, ISP 장애, DMVPN Hub 장애), 트러블슈팅 로그 |
| W6 | PPT 제작, 리허설 |

## 7. 미확정 항목
- HQ의 DMVPN 스포크 편입 여부 (편입 시 Area 번호 재조정 필요)
- DB1 서버: VLAN50 추가 확정 (SW-SVR2 Et4). DB 종류, IP, 허용 포트, 접근 정책은 미확정
- 스위치(IOU L2/cEOS) QoS 지원 여부 실측
