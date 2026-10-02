# 단계별 검증 명령어 가이드

> **기준**: AS 분리 / Tunnel0=BR1(AS100)·BR2(AS200) / Tunnel1=BR3(AS100)·BR4(AS200)

---

## [1] VPC Config

**목적**: PC 단말 IP / 게이트웨이 배치 확인

```
PC>  show ip                     ! PC1~PC8, 지사 PC 각각 IP / .1 GW 여부 확인
PC>  ping <자기 게이트웨이>       ! VLAN/지사 GW 통신
```

---

## [2] WAN Config

**목적**: ISP-기본라우터 /30 링크 업/다운 확인

```
! 각 라우터
show ip interface brief          ! 인터페이스 up/up + 링크 IP 확인

! R-ISP 에서 각각 인접 장비 통신
ping 203.0.113.2                 ! Fa5/0 - BR1
ping 203.0.113.5                 ! Gi0/0 - Edge1
ping 203.0.113.9                 ! Gi1/0 - Edge2
ping 203.0.113.13                ! Fa5/1 - BR2
```

---

## [3] HQ L2 + EtherChannel

**목적**: VTPv3 + EtherChannel + VLAN 분리 + 트렁킹

```
show etherchannel summary        ! Po1 'SU' / 멤버포트 'P'(In Bundle)
show etherchannel load-balance   ! 'src-dst-ip' 정책 확인
show vtp status                  ! version3 / domain HQ / server·client
show vlan brief                  ! 10,20,30,40,99 + Name 명명화 (Access포트)
show interfaces trunk            ! Allowed VLAN 10,20,30,40,99 포함 확인
```

---

## [4] STP 보정 + SVI + HSRP (HQ Core)

**목적**: Rapid-PVST+ 루트 안정화 + HSRP 연결성 검증

```
show spanning-tree vlan 10       ! CORE1 'This bridge is the root'
show spanning-tree vlan 30       ! CORE2 'This bridge is the root'
show spanning-tree summary       ! mode rapid-pvst

show standby brief               ! CORE1 Active(10,20,99) / CORE2 Active(30,40)
                                 ! priority 110 / hello 1 hold 3 / preempt
show track 10                    ! boolean or (g0/0,g0/1) 'Up', decrement 20 적용
show ip interface brief          ! SVI up/up

! Access 다운스트림 포트 점검
show running-config interface gigabitEthernet 0/2   ! portfast + bpduguard
telnet 10.10.99.11               ! VLAN99 Mgmt IP(.11~.44) 원격 접속
```

---

## [5] HQ 백본 OSPF Area 0

**목적**: 172.168.10.0/24 라우티드 링크 연결 + 수렴 확인

```
show ip ospf interface gigabitEthernet 1/0
                                 ! Network Type POINT_TO_POINT / Hello5 Dead15
show ip ospf neighbor            ! 전체 FULL (DR/BDR 미선출)
show ip route ospf               ! HQ LAN 10.10.0.0/16 + 백본 경로 학습
show ip protocols                ! passive-interface 정책 확인
```

---

## [6] DMVPN HUB & SPOKE (Edge + BR1·BR2)

**목적**: IKE Phase1(AES256/SHA/DH5) mGRE 터널 + Tunnel0 클라이언트 등록

```
show crypto isakmp policy        ! AES256/SHA/group5/86400
show crypto ipsec profile        ! TS-AES256 / PFS group5 / 3600
show crypto isakmp sa            ! QM_IDLE
show crypto ipsec sa             ! Phase2 SA (esp-aes256/esp-sha)

HQ-EDGE1# show dmvpn             ! Tunnel0 : BR1(172.16.0.11), BR2(172.16.0.22)
BR1# show ip nhrp nhs detail     ! NHS 172.16.0.1/.2 'E'(Up)
BR2# show ip nhrp nhs detail

! 확인 포인트
show interface Tunnel0           ! MTU 1400 / 'no ip split-horizon eigrp' 적용
```

---

## [7] EIGRP & Default Route (Edge + BR1·BR2)

**목적**: 터미널에 EIGRP 이웃 + 지사 기본 라우트 안정화

```
HQ-EDGE1# show ip eigrp 100 neighbors   ! Tunnel0=BR1 (추후 Tunnel1=BR3도)
HQ-EDGE1# show ip eigrp 200 neighbors   ! Tunnel0=BR2 (추후 Tunnel1=BR4도)
BR1# show ip eigrp neighbors            ! Edge1/2 (172.16.0.1/.2)
BR2# show ip eigrp neighbors            ! Edge1/2 (172.16.0.1/.2)
show ip route eigrp                     ! 터미널에 + 지사 LAN

BR1# show ip route static               ! 주 172.16.0.1 / 예 172.16.0.2(AD10)
BR1# show ip route 0.0.0.0              ! 0.0.0.0 via 172.16.0.1
BR1# show ip route 203.0.113.6          ! /32 via ISP(203.0.113.2)
Edge1# show ip route 0.0.0.0           ! 0.0.0.0 via 203.0.113.5
```

---

## [8] 재분배 (HQ-EDGE1 / HQ-EDGE2)

**목적**: OSPF 와 EIGRP 상호 재분배 + 태그 기반 루프 방지

```
show route-map                   ! tag 100/200 set, deny tag 블록 확인

Edge1# show ip route eigrp        ! 지사 LAN(172.10.20.0/172.100.30.0) 학습
show ip route ospf               ! HQ Core외부에서 지사 LAN이 'O E2'로 등장
BR1# show ip route               ! 지사단에서 HQ LAN(10.10.x.x) 'D'로 학습
BR1# show ip route 172.100.30.0  ! BR1·BR2 (Edge 경유) 경로 확인
```

---

## [9] NAT (HQ-EDGE1 / HQ-EDGE2)

**목적**: 사설망 NAT 제외 + 인터넷 PAT 변환

```
show ip nat statistics           ! outside Gi0/0 / inside Tunnel,Gi1~3/0
show ip access-list NAT-ACL      ! deny(사설)/permit(인터넷) 히트 카운트
show ip nat translations         ! 선설정후 터미널로 변환 (사설 출발지 제외)

! PC에서 인터넷(ISP loopback) ping 후 → translations 확인
```

---

## [10] BR3 추가 (Tunnel1 / AS100 / Phase 3)

**목적**: BR3 편입 + Phase3 Shortcut + 라우트 안정화

### 1. R-ISP 링크
```
show ip interface brief          ! Gi2/0 = 203.0.113.18/30 up
```

### 2. DMVPN 등록 / NHS
```
BR3# show dmvpn                   ! Tunnel1 클라이언트, Hub(Edge1/2) 등록
BR3# show ip nhrp nhs detail
BR3# show crypto isakmp sa
```

### 3. EIGRP / NAT 편입
```
HQ-EDGE1# show ip eigrp 100 neighbors   ! Tunnel1 에 BR3(172.16.10.33)
Edge1# show ip route eigrp | include 172.10.30   ! BR3 LAN 학습
show ip access-list NAT-ACL      ! 45 deny ip 172.10.30.0 0.0.0.255 any
```

### 4. 라우트 안정화
```
BR3# show ip route 0.0.0.0       ! 주 172.16.10.1 / 보조 172.16.10.2(AD10)
```

### 5. Phase3 Shortcut 검증 (BR3↔BR4 트래픽 기준)
```
BR3-PC1> ping 172.200.40.101 -t
BR3# show dmvpn                   ! 172.16.10.44(BR4) Spoke-to-Spoke 'D'
BR3# show ip nhrp shortcut
BR3# traceroute 172.200.40.101   ! Hub(172.16.10.1/.2) 미경유 = 직결
```

### 6. 종합
```
BR3-PC1> ping 10.10.10.101       ! HQ 통신
```

---

## [11] BR4 추가 (Tunnel1 / AS200 / Phase 3)

**목적**: BR4 편입 + Phase3 확인 + NAT 편입

### 1. R-ISP 링크
```
show ip interface brief          ! Gi3/0 = 203.0.113.21/30 up
```

### 2. DMVPN 등록 / NHS
```
BR4# show dmvpn                   ! Tunnel1 클라이언트, Hub(Edge1/2) 등록
BR4# show ip nhrp nhs detail
BR4# show crypto isakmp sa
```

### 3. EIGRP / NAT 편입
```
HQ-EDGE1# show ip eigrp 200 neighbors   ! Tunnel1 에 BR4(172.16.10.44)
Edge1# show ip route eigrp | include 172.200.40   ! BR4 LAN 학습
show ip access-list NAT-ACL      ! 65 deny ip 172.200.40.0 0.0.0.255 any
```

### 4. 라우트 안정화
```
BR4# show ip route 0.0.0.0       ! 주 172.16.10.2 / 보조 172.16.10.1(AD10)
```

### 5. Phase3 Shortcut 검증 (BR4↔BR3 트래픽 기준)
```
BR4-PC1> ping 172.10.30.101 -t
BR4# show dmvpn                   ! 172.16.10.33(BR3) Spoke-to-Spoke 'D'
BR4# show ip nhrp shortcut
BR4# traceroute 172.10.30.101    ! Hub 미경유 = 직결
```

### 6. 종합
```
BR4-PC1> ping 10.10.10.101       ! HQ 통신
```

---

## 최종 통합 검증

```
show crypto isakmp sa            ! 전체 IKE Phase1 QM_IDLE
show crypto ipsec sa             ! Phase2 SA
show dmvpn                        ! Tunnel0=BR1·BR2 / Tunnel1=BR3·BR4 전체 등록
show ip eigrp 100 neighbors      ! Tunnel0=BR1 / Tunnel1=BR3
show ip eigrp 200 neighbors      ! Tunnel0=BR2 / Tunnel1=BR4
show ip ospf neighbor            ! 백본 FULL
show ip route                     ! 재분배 경로 + 태그
show ip nat translations          ! 인터넷 트래픽만 NAT

! 최종 테스트 : 전체 PC 에서 HQ / 타지사 / 인터넷 ping 성공
! 참고사항 : BR1# show dmvpn 에서 BR2 가 직결 없음(3745 Phase2, Hub 경유만)
```
