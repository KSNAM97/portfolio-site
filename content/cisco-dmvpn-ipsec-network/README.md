# 🏆 DMVPN + IPsec 기반 본사-지사 통합 네트워크 구축

[![Cisco](https://img.shields.io/badge/Cisco-IOS-blue?logo=cisco)](https://github.com/KSNAM97)
[![GNS3](https://img.shields.io/badge/GNS3-Topology-green)](https://github.com/KSNAM97)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](./LICENSE)

**DMVPN Phase2/3 · IPsec AES-256 · OSPF / EIGRP 재분배 · HSRP 이중화 · NAT — Cisco IOS / GNS3 기반 본사-지사 WAN 네트워크 종합 구축**

---

## 📖 About

| 항목 | 내용 |
| --- | --- |
| 주제 | DMVPN(mGRE+IPsec) Phase2/3 · OSPF-EIGRP 재분배 · HSRP 이중화 · NAT |
| 장비 구성 | HQ-Edge1/2 (Router), SW-Core1/2 (L3-Switch), SW-Access1 ~ 4 (L2-Switch), BR1 ~ 4 (Router), R-ISP |
| 핵심 기술 | DMVPN Phase2 / Phase3, IPsec AES-256/SHA/DH5, OSPF Area 0, EIGRP AS100/200, Route 재분배(태그), HSRP Track, VTPv3, EtherChannel(LACP), NAT/PAT |
| 시뮬레이터 | GNS3 / Cisco IOS |
| 검증 | `show dmvpn`, `show crypto isakmp sa`, `show ip ospf neighbor`, `show standby brief`, `show ip nat translations` 등 |

---

## 🌐 토폴로지

![Topology](./topology/TOPOLOGY-1.png)

```text
                         [R-ISP]  203.0.113.0/24
                  ┌────────┬────────┬────────┐
                Edge1    Edge2    BR1     BR2  (BR3·BR4 Phase3)
                  │        │      tu0     tu0
                  └──OSPF──┘    ←DMVPN Phase2→
                  │        │
              SW-Core1  SW-Core2   ← HSRP 이중화 (VLAN10/20/99 · 30/40)
                  └──Po1(LACP)──┘
                        │
              SW-Access1~4 (VLAN 10/20/30/40)
                        │
                    PC1 ~ PC8
```

---

## 📁 폴더 구조

```
cisco-dmvpn-ipsec-network/
├── configs/
│   ├── HQ-Router/
│   │   ├── HQ-EDGE-1.md
│   │   └── HQ-EDGE-2.md
│   ├── HQ-Switch/
│   │   ├── HQ-CORE-1.md
│   │   ├── HQ-CORE-2.md
│   │   ├── HQ-ACCESS-1.md
│   │   ├── HQ-ACCESS-2.md
│   │   ├── HQ-ACCESS-3.md
│   │   └── HQ-ACCESS-4.md
│   ├── Branch/
│   │   ├── BRANCH1.md
│   │   ├── BRANCH2.md
│   │   ├── BRANCH3.md
│   │   └── BRANCH4.md
│   └── ISP-VPC/
│       ├── R-ISP.md
│       ├── VPC-basic.md
│       └── WebServer-basic.md
├── topology/
│   └── TOPOLOGY-1.png
├── verification/
│   ├── verification-guide.md
│   └── requirements.md
├── LICENSE
└── README.md
```

| 폴더 | 내용 |
| --- | --- |
| `configs/HQ-Router/` | HQ Edge 라우터 — OSPF · DMVPN HUB · 재분배 · NAT |
| `configs/HQ-Switch/` | HQ Core/Access 스위치 — VTPv3 · EtherChannel · HSRP · STP |
| `configs/Branch/` | 지사 라우터 — DMVPN Spoke · EIGRP · NAT |
| `configs/ISP-VPC/` | ISP 라우터 · VPC · 웹서버 기본 설정 |
| `topology/` | 토폴로지 이미지 |
| `verification/` | 단계별 검증 명령어 & 전체 요구사항 |

---

## 🗂️ 구성 단계 (Build Stages)

| # | 단계 | 대상 장비 | 핵심 내용 |
| --- | --- | --- | --- |
| **1** | **VPC Config** | PC1 ~ PC8, BR-PC1 ~ 4 | VLAN·지사 단말 IP / GW 배치 |
| **2** | **WAN Config** | R-ISP · Edge1/2 · BR1/2 | 203.0.113.0/24 /30 분할, ISP 링크 |
| **3** | **HQ L2 + EtherChannel** | SW-Core1/2 · Access1 ~ 4 | VTPv3 · LACP Po1 · VLAN 분리 · 트렁킹 |
| **4** | **STP + SVI + HSRP** | SW-Core1/2 | Rapid-PVST+ · SVI · HSRP Track 이중화 |
| **5** | **HQ 백본 OSPF Area 0** | Edge1/2 · Core1/2 | 172.168.10.0/24 P2P 링크 + 수렴 |
| **6** | **DMVPN HUB & SPOKE** | Edge1/2 · BR1/2 | IKE Phase1 · mGRE · Tunnel0 (Phase2) |
| **7** | **EIGRP & Default Route** | Edge1/2 · BR1/2 | AS100/200 이웃 · 이중 기본 라우트 |
| **8** | **재분배** | Edge1/2 | OSPF↔EIGRP Route-Map 태그 기반 재분배 |
| **9** | **NAT** | Edge1/2 | 사설망 제외 · 인터넷 PAT |
| **10** | **BR3 추가** | Edge1/2 · BR3 | Tunnel1 Phase3 Shortcut / AS100 |
| **11** | **BR4 추가** | Edge1/2 · BR4 | Tunnel1 Phase3 Shortcut / AS200 |

> 각 단계의 상세 검증 명령어 → [`verification/verification-guide.md`](./verification/verification-guide.md)  
> 각 단계의 구성 요구사항 → [`verification/requirements.md`](./verification/requirements.md)

---

## 🔑 핵심 설계 포인트

### DMVPN Phase 2 vs Phase 3

| | Phase 2 (Tunnel0) | Phase 3 (Tunnel1) |
| --- | --- | --- |
| Spoke | BR1, BR2 | BR3, BR4 |
| Spoke-to-Spoke | Hub 경유 | 직접 터널 형성 |
| NHRP redirect (HUB) | ✗ | ✓ |
| NHRP shortcut (SPOKE) | ✗ | ✓ |
| tunnel key / network-id | 100 | 200 |

### HSRP Track 설계

| VLAN | Active | Priority | Track |
| --- | --- | --- | --- |
| 10, 20, 99 | SW-Core1 | 110 | track 10 decrement 20 |
| 30, 40 | SW-Core2 | 110 | track 10 decrement 20 |

> track 10 = boolean or (gi0/0, gi0/1) — 업링크 전체 장애 시 반대 Core로 자동 전환

### 재분배 태그 설계 (루프 방지)

| 방향 | Match Tag | Set Tag |
| --- | --- | --- |
| EIGRP100 → OSPF | — | 100 |
| EIGRP200 → OSPF | — | 200 |
| OSPF → EIGRP100 | deny tag 100, permit | — |
| OSPF → EIGRP200 | deny tag 200, permit | — |
| EIGRP100 ↔ EIGRP200 | deny 상대 tag | 상대 tag |

---

## 📜 License

[MIT License](./LICENSE)
