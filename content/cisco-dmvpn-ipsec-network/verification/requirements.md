# 전체 구성 요구사항

> **기준**: AS 분리 / Tunnel0=BR1(AS100)·BR2(AS200) / Tunnel1=BR3(AS100)·BR4(AS200)  
> ※ 이 파일을 보고 config 작성하는 순서 가이드

---

## [1] VPC Config

**목적**: HQ VLAN 단말 + 4개 지사 LAN 단말 선설정 IP 배치

```
! 형식: ip <주소> <서브넷> <게이트웨이> 입력 후 반드시 save
! HQ (서브넷 /24, GW=뒤역 .1)
- VLAN10 10.10.10.0/24 : PC1 .101 / PC2 .102   GW 10.10.10.1
- VLAN20 10.10.20.0/24 : PC3 .101 / PC4 .102   GW 10.10.20.1
- VLAN30 10.10.30.0/24 : PC5 .101 / PC6 .102   GW 10.10.30.1
- VLAN40 10.10.40.0/24 : PC7 .101 / PC8 .102   GW 10.10.40.1

! 지사
- BR1 172.10.20.0/24   : PC1 .101 / PC2 .102   GW 172.10.20.1
- BR2 172.100.30.0/24  : PC1 .101 / PC2 .102   GW 172.100.30.1
- BR3 172.10.30.0/24   : PC1 .101 / PC2 .102   GW 172.10.30.1
- BR4 172.200.40.0/24  : PC1 .101 / PC2 .102   GW 172.200.40.1
```

---

## [2] WAN Config

**목적**: 외부망 203.0.113.0/24 을 /30 분할, ISP-기본라우터 WAN 링크  
> BR3·BR4 링크는 단계10·11에서 추가

```
! 서브넷 255.255.255.252, 각 인터페이스 no sh
- R-ISP : Fa5/0=203.0.113.2(BR1) / gi0/0=203.0.113.5(Edge1)
          gi1/0=203.0.113.9(Edge2) / Fa5/1=203.0.113.13(BR2)
- BR1   Fa0/0=203.0.113.1   (ISP 203.0.113.2 방향)
- BR2   Fa0/0=203.0.113.14  (ISP 203.0.113.13 방향)
- Edge1 gi0/0=203.0.113.6   (ISP 203.0.113.5 방향)
- Edge2 gi0/0=203.0.113.10  (ISP 203.0.113.9 방향)

! 검증: 각 라우터 간 ISP쪽 IP로 ping 통신
```

---

## [3] HQ L2 + EtherChannel

**목적**: HQ 계층 VTPv3 + EtherChannel(LACP) + VLAN 분리 + 트렁킹

```
! VTP (작성 순서: 비밀번호 → 도메인 → 버전 → 모드 순)
- password Cisco123 / domain HQ / version 3
- CORE1·CORE2 = server / ACCESS1~4 = client
- CORE1 에서 'vtp primary force' (Primary Server 승격)

! VLAN (CORE1에서 생성 후 명명화): 10 Data / 20 Voice / 30 Server / 40 Guest / 99 Mgmt

! EtherChannel (CORE1<->CORE2)
- 멤버포트 gi0/2-3 에 channel-group 1 mode active (LACP)
- Po1 : dot1q 트렁크 / allowed vlan 10,20,30,40,99
- port-channel load-balance src-dst-ip (각 코어)

! 트렁킹 (순서: VTP먼저 → 트렁크 → VLAN 생성)
- CORE↔ACCESS 다운스트림(CORE1 gi3/0-3) : dot1q / allowed 10,20,30,40,99
- ACCESS↔CORE 업링크(Gi0/0-1) : dot1q / allowed 10,20,30,40,99
```

---

## [4] STP 보정 + SVI + HSRP (HQ Core)

**목적**: Rapid-PVST+ 루트 안정화 + VLAN별 SVI + HSRP 연결성 안정화

```
! STP 모드 Rapid-PVST+ (각 스위치)
- CORE1 : VLAN 1,10,20,99 Root Primary / 30,40 Root Secondary
- CORE2 : VLAN 30,40 Root Primary / 1,10,20,99 Root Secondary

! Access 다운스트림(gi0/2-3): switchport access + portfast + bpduguard
- ACCESS1=VLAN10 / ACCESS2=VLAN20 / ACCESS3=VLAN30 / ACCESS4=VLAN40

! Access STP Block 방지 (해당 VLAN 업링크 cost)
- ACCESS1,2 : gi0/0 cost 10(우선) / gi0/1 cost 100
- ACCESS3,4 : gi0/0 cost 100 / gi0/1 cost 10(우선)

! Access 관리접속: enable secret cisco / line vty 0 15 password cisco login
- VLAN99 IP(/24): ACCESS1 10.10.99.11 / 2 .22 / 3 .33 / 4 .44
- ip default-gateway 10.10.99.1

! SVI+HSRP (ip routing 활성, CORE1/CORE2 분담 / VIP=.1 / CORE1=.2 / CORE2=.3)
- 전체 VLAN 10,20,30,40,99 / HSRP 그룹번호=VLAN번호 / 타이머 hello 1 hold 3
- CORE1 Active(10,20,99): priority 110, preempt delay min 60, track 10 decrement 20
- CORE1 Standby(30,40)  : priority 100, preempt 없음
- CORE2 Active(30,40)   : priority 110, preempt delay min 60, track 10 decrement 20
- CORE2 Standby(10,20,99): priority 100, preempt 없음

! Track (각 코어 업링크)
- track 1 = int gi0/0 line-protocol
- track 2 = int gi0/1 line-protocol
- track 10 = list boolean or (object 1, object 2)
```

---

## [5] HQ 백본 OSPF Area 0

**목적**: Edge↔Core 172.168.10.0/24 라우티드 링크 OSPF + 수렴 확인

```
! 라우티드 링크 IP (Core에 no switchport 후 IP, 전부 /30)
- Edge1 : gi1/0=.1(Edge2쪽) / gi3/0=.5(Core1쪽) / gi2/0=.9(Core2쪽)
- Edge2 : gi1/0=.2(Edge1쪽) / gi2/0=.13(Core1쪽) / gi3/0=.17(Core2쪽)
- Core1 : gi0/0=.6(Edge1쪽) / gi0/1=.14(Edge2쪽)
- Core2 : gi0/1=.10(Edge1쪽) / gi0/0=.18(Edge2쪽)

! process ospf 1 / auto-cost reference-bandwidth 10000
! router-id: Core1=1.1.1.1 / Core2=2.2.2.2 / Edge1=11.11.11.11 / Edge2=22.22.22.22
! 선언: HQ LAN 10.10.x.0/24(10,20,30,40,99) + 백본 172.168.10.x/30 전부 area 0
! passive-interface default 후:
- Core  : no passive gi0/0, gi0/1, Vlan99
- Edge  : no passive gi1/0, gi2/0, gi3/0

! 백본 링크 + Vlan99: ip ospf network point-to-point / hello 5 / dead 15
  (HQ LAN SVI·WAN인터페이스 제외)
```

---

## [6] DMVPN HUB & SPOKE

**목적**: PSK+mGRE+IPsec DMVPN (Edge + BR1·BR2 먼저 / BR3·BR4는 단계10·11)

```
! 공통 암호화 (각 장비 동일)
- IKE Phase1 policy 10: pre-share / AES-256 / SHA / DH5 / lifetime 86400
- Transform-Set TS-AES256: esp-aes 256 + esp-sha-hmac / mode tunnel
- IPsec Profile DMVPN-PROFILE: pfs group5 / SA lifetime 3600
- DPD: crypto isakmp keepalive 10 3
! 공통 터널: ip mtu 1400 / tcp adjust-mss 1360 / mGRE / profile shared

! HUB Edge1(Primary)/Edge2(Backup) 설정 (tunnel source gi0/0)
- tu0: id100/key100/NHRPKEY1 / Edge1=172.16.0.1 Edge2=172.16.0.2 (/24)
- tu1: id200/key200/NHRPKEY2 / Edge1=172.16.10.1 Edge2=172.16.10.2 (/24)
- 공통: holdtime 600 / nhrp map multicast dynamic / nhrp redirect
- AS 구분에 따라 터널 적용:
    ip next-hop-self eigrp 100 / no ip split-horizon eigrp 100
    ip next-hop-self eigrp 200 / no ip split-horizon eigrp 200
- PSK: address 0.0.0.0 0.0.0.0

! SPOKE BR1, BR2 (tu0 클라이언트 / 3745 Phase2 / NHS·map 분리)
- BR1 (AS100) tu0=172.16.0.11 / id100/key100/NHRPKEY1 / source Fa0/0
- BR2 (AS200) tu0=172.16.0.22 / id100/key100/NHRPKEY1 / source Fa0/0
- 공통 NHS: 172.16.0.1↔203.0.113.6 / 172.16.0.2↔203.0.113.10
    (ip nhrp nhs / map / map multicast 각각 작성)
- PSK: address 203.0.113.6 / address 203.0.113.10 (분리)
- shortcut/redirect 미적용
```

---

## [7] EIGRP & Default Route

**목적**: 터미널에 EIGRP + 기본 이중 라우트 (Edge + BR1·BR2 먼저)

```
! 공통: no auto-summary / passive-interface default 후 터널만 no passive

! HUB Edge1/Edge2 (AS 분리, 각 터널로 100·200 동시 선언)
- eigrp 100: no passive tu0, tu1 / net 172.16.0.0, 172.16.10.0 (0.0.0.255)
- eigrp 200: no passive tu0, tu1 / net 172.16.0.0, 172.16.10.0 (0.0.0.255)
- Edge1: ip route 0.0.0.0 0.0.0.0 203.0.113.5
- Edge2: ip route 0.0.0.0 0.0.0.0 203.0.113.9

! BR1 (AS100)  LAN fa0/1=172.10.20.1/24
- eigrp 100: no passive tu0 / net 172.16.0.0, 172.10.20.0 (0.0.0.255)
- ip route 203.0.113.0 255.255.255.0 203.0.113.2
- ip route 0.0.0.0 0.0.0.0 172.16.0.1 / ip route 0.0.0.0 0.0.0.0 172.16.0.2 10

! BR2 (AS200)  LAN fa0/1=172.100.30.1/24
- eigrp 200: no passive tu0 / net 172.16.0.0, 172.100.30.0 (0.0.0.255)
- ip route 203.0.113.0 255.255.255.0 203.0.113.13
- ip route 0.0.0.0 0.0.0.0 172.16.0.1 / ip route 0.0.0.0 0.0.0.0 172.16.0.2 10
```

---

## [8] 재분배 (HQ-EDGE1 / HQ-EDGE2)

**목적**: OSPF 와 EIGRP100/200 상호 재분배 + Route-Map 태그(루프 방지)

```
! Route-Map
- EIGRP100-TO-OSPF permit 10  : set tag 100
- EIGRP200-TO-OSPF permit 10  : set tag 200
- OSPF-TO-EIGRP100: deny 10 match tag 100 / permit 20
- OSPF-TO-EIGRP200: deny 10 match tag 200 / permit 20
- EIGRP200-TO-EIGRP100 permit 10: set tag 200
- EIGRP100-TO-EIGRP200 permit 10: set tag 100

! 재분배 (자기 프로세스 제외 시, metric 1000000 <delay> 255 1 1500)
- router ospf 1: redistribute eigrp 100 subnets route-map EIGRP100-TO-OSPF
                 redistribute eigrp 200 subnets route-map EIGRP200-TO-OSPF
- router eigrp 100: redistribute ospf 1 ... route-map OSPF-TO-EIGRP100
                    redistribute eigrp 200 ... route-map EIGRP200-TO-EIGRP100
- router eigrp 200: redistribute ospf 1 ... route-map OSPF-TO-EIGRP200
                    redistribute eigrp 100 ... route-map EIGRP100-TO-EIGRP200
- 루트 delay: Edge1=eigrp100에 100 우선 / Edge2=eigrp200에 100 우선
  (반대방향은 2000으로 분산)
```

---

## [9] NAT (HQ-EDGE1 / HQ-EDGE2)

**목적**: 사설망 NAT 제외 + 인터넷 PAT (BR3·BR4 deny는 단계10·11에서 추가)

```
! NAT-ACL (extended, deny=사설/NAT없이 통과 | permit=인터넷)
- deny ip 10.0.0.0 0.255.255.255 any
- deny ip 172.16.0.0 0.15.255.255 any
- deny ip 172.168.0.0 0.0.255.255 any
- deny ip 172.10.20.0 0.0.0.255 any
- deny ip 172.100.30.0 0.0.0.255 any
- permit ip any any

! PAT: ip nat inside source list NAT-ACL interface gi0/0 overload
! outside: gi0/0 / inside: tu0, tu1, gi1/0, gi2/0, gi3/0
```

---

## [10] BR3 추가

**목적**: BR3(7200, Phase3 shortcut) 편입 → Tunnel1 / AS100

```
! R-ISP 링크 추가: gi2/0 = 203.0.113.18 /30
! BR3 인터페이스: gi0/0=203.0.113.17 /30 / gi1/0(LAN)=172.10.30.1 /24
! 암호화 정책: 단계6과 동일 (policy10 / TS-AES256 / DMVPN-PROFILE / keepalive 10 3)
! PSK: address 0.0.0.0 0.0.0.0

! tu1 (AS100, Phase3): 172.16.10.33 /24 / source gi0/0
- key200 / id200 / NHRPKEY2 / holdtime600 / mtu1400 / mss1360
- map 172.16.10.1↔203.0.113.6 / 172.16.10.2↔203.0.113.10 (+multicast 각각)
- nhs 172.16.10.1 / nhs 172.16.10.2 / ip nhrp shortcut / profile shared

! EIGRP: router eigrp 100 / no auto-summary / passive default + no passive tu1
- net 172.16.10.0 0.0.0.255 + 172.10.30.0 0.0.0.255

! 라우트: ip route 203.0.113.0 255.255.255.0 203.0.113.18
          ip route 0.0.0.0 0.0.0.0 172.16.10.1 / ... 172.16.10.2 10

! Edge1/Edge2 추가: router eigrp 100에 net 172.10.30.0 0.0.0.255
! Edge1/Edge2 NAT-ACL 추가: 45 deny ip 172.10.30.0 0.0.0.255 any
```

---

## [11] BR4 추가

**목적**: BR4(7200, Phase3 shortcut) 편입 → Tunnel1 / AS200 (BR3과 같은 클라이언트)

```
! R-ISP 링크 추가: gi3/0 = 203.0.113.21 /30
! BR4 인터페이스: gi0/0=203.0.113.22 /30 / gi1/0(LAN)=172.200.40.1 /24
! 암호화 정책: 단계6과 동일
! PSK: address 0.0.0.0 0.0.0.0

! tu1 (AS200, Phase3): 172.16.10.44 /24 / source gi0/0
- key200 / id200 / NHRPKEY2 / holdtime600 / mtu1400 / mss1360
- map 172.16.10.1↔203.0.113.6 / 172.16.10.2↔203.0.113.10 (+multicast 각각)
- nhs 172.16.10.1 / nhs 172.16.10.2 / ip nhrp shortcut / profile shared

! EIGRP: router eigrp 200 / no auto-summary / passive default + no passive tu1
- net 172.16.10.0 0.0.0.255 + 172.200.40.0 0.0.0.255

! 라우트: ip route 203.0.113.0 255.255.255.0 203.0.113.21
          ip route 0.0.0.0 0.0.0.0 172.16.10.2 / ... 172.16.10.1 10

! Edge1/Edge2 추가: router eigrp 200에 net 172.200.40.0 0.0.0.255
! Edge1/Edge2 NAT-ACL 추가: 65 deny ip 172.200.40.0 0.0.0.255 any
! 최종 shortcut 확인: BR3·BR4 동시 tu1(id200) 클라이언트 후 BR3↔BR4 직접 통신
```
