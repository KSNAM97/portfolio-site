# 🏆 멀티벤더 하이브리드 네트워크 구축

[![Cisco](https://img.shields.io/badge/Cisco-IOS-blue?logo=cisco)](https://github.com/KSNAM97)
[![Arista](https://img.shields.io/badge/Arista-cEOS-orange)](https://github.com/KSNAM97)
[![GNS3](https://img.shields.io/badge/GNS3-Topology-green)](https://github.com/KSNAM97)

**ISP 이중화 eBGP · DMVPN Phase3 (mGRE over IPsec) · OSPF · HSRP/VARP · QoS · 화이트리스트 ACL — Cisco + Arista 멀티벤더 4개 사이트 WAN 종합 구축**

---

## 📖 About

| 항목 | 내용 |
| --- | --- |
| 주제 | HQ / DC / BR1 / BR2 4개 사이트를 ISP 이중화와 DMVPN으로 연결하는 멀티벤더 하이브리드 네트워크 |
| 장비 구성 | HQ (R11·R12, SW101·SW102·SW110), DC (R21 ~ R24, SW201·SW202·SW211·SW212, SW-SVR1·2, DNS1·2, DB1), BR1·BR2 (R1·R2, SW1 ~ SW3, H1·H2), ISP-1·ISP-2 (PE-A·P1·P2·PE-B 각 4대), Private Internet (PI) |
| 핵심 기술 | 사이트 OSPF, ISP eBGP(라우터별 개별 AS), 정적 경로 + 재분배(IP SLA/track), DMVPN Phase3, IPsec, HSRP / VARP, EtherChannel, QoS, ACL 화이트리스트 |
| 시뮬레이터 | GNS3 (Cisco 7200 / IOU, Arista cEOS) |
| 일정 | 6주 (3인 체제 / 2인 체제 일정 문서 제공) |
| 검증 | 이중화 장애 실측 (FHRP, EtherChannel, ISP 장애, DMVPN Hub 장애), 트러블슈팅 로그 |

---

## 🌐 토폴로지

![Topology](./topology/topology-draft.png)

```text
HQ(65001) ─┬─ ISP-1 ─┐
           └─ ISP-2 ─┤
DC(65002) ─┬─ ISP-1 ─┼─ (ISP 내부는 eBGP, 사이트는 OSPF)
           └─ ISP-2 ─┤
BR1        ─┬─ ISP-1 ─┤
           └─ ISP-2 ─┤
BR2        ─┬─ ISP-1 ─┘
           └─ ISP-2 ─┘

DC ←── DMVPN Phase3 (mGRE over IPsec, Private Internet 경유) ──→ BR1, BR2
```

---

## 📁 폴더 구조

```
network-project/
├── configs/
│   ├── hq/
│   ├── dc/
│   ├── br1/
│   ├── br2/
│   ├── isp1/
│   ├── isp2/
│   └── private-internet/
├── docs/
│   ├── network-project-final.md
│   ├── schedule-3person.md
│   └── schedule-2person.md
├── jira/
│   ├── jira-tickets-3person.csv
│   └── jira-tickets-2person.csv
├── slack/
│   └── slack-announcement.md
├── topology/
│   ├── topology-draft.drawio
│   └── topology-draft.png
├── CONTRIBUTING.md
└── README.md
```

| 폴더 | 내용 |
| --- | --- |
| `configs/` | 사이트별 장비 컨피그 (`configs/<사이트>/<장비명>.cfg`) |
| `docs/` | 전체 설계 (아키텍처, AS / VLAN / IP, 인터페이스 매핑, 정책, 빌드 순서)와 일정 |
| `jira/` | Jira Import용 티켓 목록 (팀 구성에 맞는 파일 사용) |
| `slack/` | 팀 공지 초안 |
| `topology/` | 토폴로지 원본(drawio)과 이미지 |

---

## 🗂️ 구성 단계 (Build Stages)

| 주차 | 단계 | 핵심 내용 |
| --- | --- | --- |
| **W1** | 설계 확정, 환경 세팅 | AS / IP / VLAN 확정, GNS3 환경, 이미지별 RAM 실측(cEOS 포함), 노드 배치 |
| **W2** | 사이트 내부 L2 / L3 | VLAN, 트렁크, EtherChannel, HSRP / VARP, 사이트 내부 OSPF |
| **W3** | 사이트 ↔ ISP | 정적 경로 + 재분배(track), ISP 내부 eBGP 풀메시, Private Internet ACL |
| **W4** | DMVPN, 서비스, 정책 | DMVPN(mGRE over IPsec), DNS 서비스, QoS 정책, 접근통제 ACL |
| **W5** | 이중화 장애 실측 | FHRP, EtherChannel, ISP 장애, DMVPN Hub 장애, 트러블슈팅 로그 |
| **W6** | 정리 | PPT 제작, 리허설 |

> 역할 분담과 일별 목표 → [`docs/schedule-3person.md`](./docs/schedule-3person.md), [`docs/schedule-2person.md`](./docs/schedule-2person.md)  
> 전체 설계 → [`docs/network-project-final.md`](./docs/network-project-final.md)

---

## 🔑 핵심 설계 포인트

### 사이트 · AS

| 사이트 | AS | 대역 | 비고 |
| --- | --- | --- | --- |
| HQ | 65001 | 10.1.0.0/16 | OSPF 프로세스1 Area 0 |
| DC | 65002 | 10.2.0.0/16 | OSPF 프로세스1 Area 10, DMVPN Hub (R24) |
| BR1 | 65003 | 10.3.0.0/16 | OSPF 프로세스1 Area 20, DMVPN Spoke (R1) |
| BR2 | 65004 | 10.4.0.0/16 | OSPF 프로세스1 Area 30, DMVPN Spoke (R2) |
| ISP-1 | 65111 ~ 65114 | 100.1.0.0/16 | eBGP 전용 (PE-A / P1 / P2 / PE-B 개별 AS) |
| ISP-2 | 65121 ~ 65124 | 100.2.0.0/16 | eBGP 전용 |
| Private Internet | 없음 | 203.0.113.0/24 | OSPF 프로세스2 Area 100, DMVPN 언더레이 전용 |
| DMVPN 터널 | - | 172.16.0.0/24 | OSPF 프로세스1 Area 0 |

### 라우팅 설계

- 사이트 (HQ / DC / BR1 / BR2) 내부: OSPF 전용, BGP 없음
- ISP-1 / ISP-2: 라우터별 개별 AS의 eBGP 전용, OSPF 없음
- 사이트 ↔ ISP: 라우팅 프로토콜 없이 정적 경로 + OSPF 재분배 (IP SLA / track)
- Private Internet: 별도 OSPF 프로세스, ACL 화이트리스트로 언더레이 트래픽만 허용
- DC 내부 스위치만 Arista cEOS, 나머지는 Cisco (7200 / IOU)

### DMVPN Phase 3

| 장비 | Tunnel0 | NBMA (source) | 역할 |
| --- | --- | --- | --- |
| DC R24 | 172.16.0.1/24 | 203.0.113.5 | Hub, priority 255, mGRE over IPsec |
| BR1 R1 | 172.16.0.11/24 | 203.0.113.13 | Spoke, priority 0, shortcut |
| BR2 R2 | 172.16.0.12/24 | 203.0.113.17 | Spoke, priority 0, shortcut |

### VLAN 및 게이트웨이 이중화

| 사이트 | VLAN | 이름 | 서브넷 | 게이트웨이 이중화 |
| --- | --- | --- | --- | --- |
| HQ | 10 / 20 | HQ-USER-A / B | 10.1.10.0/24, 10.1.20.0/24 | HSRP |
| DC | 50 | SERVER (DNS1·2, DB1) | 10.2.50.0/24 | VARP / VRRP |
| BR1 / BR2 | 10 | BR-USER | 10.3.10.0/24, 10.4.10.0/24 | HSRP |
| 전 사이트 | 100 / 999 | MGMT / NATIVE | 10.X.100.0/24 / IP 없음 | - |

### QoS와 접근 통제

| 항목 | 내용 |
| --- | --- |
| QoS 대상 | 사이트 ↔ 스위치 라우터 인터페이스 20포트 (각 Gi0/0, Gi1/0) |
| 클래스 | CONTROL (CS6, 10%) / BUSINESS (DNS 53 → AF31, 30%) / class-default (fair-queue) |
| 제외 | 라우터 간 링크, ISP 방향, Private Internet 방향, Tunnel0 |
| Private Internet ACL | OSPF, GRE / ESP / UDP 500 (203.0.113.0/24 간), ICMP(임시)만 허용 후 `deny ip any any log` |
| DC VLAN 50 | DNS1·2는 각 사이트에서 UDP / TCP 53만 허용, DB1은 DB 종류 확정 후 포트 추가 (그 전까지 차단) |

### 미확정 항목

- HQ의 DMVPN 스포크 편입 여부 (편입 시 Area 번호 재조정 필요)
- DB1 서버: VLAN 50 추가 확정 (SW-SVR2 Et4). DB 종류, IP, 허용 포트, 접근 정책 미확정
- 스위치 (IOU L2 / cEOS) QoS 지원 여부 실측

> 브랜치 전략, 커밋 규칙, Jira 연동 → [`CONTRIBUTING.md`](./CONTRIBUTING.md)
