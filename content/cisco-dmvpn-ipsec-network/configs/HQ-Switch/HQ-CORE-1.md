# SW-Core1

> HQ 코어 스위치 / VTPv3 Primary · HSRP Active(VLAN10,20,99) · OSPF

---

## Configuration

```
enable
configure terminal
!
hostname SW-Core1
!
no ip domain-lookup
!
line console 0
 logging synchronous
 exec-timeout 0 0
 length 0
 exit
!
line vty 0 4
 logging synchronous
 exec-timeout 0 0
 length 0
 exit
!
end
!
write memory
!
configure terminal
!
! ===== VTP v3 (VLAN 정보 중앙 관리) =====
vtp password Cisco123
vtp domain HQ
vtp version 3
vtp mode server         ! Core1/Core2는 server, Access는 client
!
! ===== Core1-Core2 간 EtherChannel (LACP) =====
interface range gi0/2 - 3
 switchport trunk encapsulation dot1q
 switchport mode trunk
 channel-group 1 mode active ! LACP active → Po1로 묶음
 no shutdown
!
interface port-channel 1
 switchport trunk encapsulation dot1q
 switchport trunk allowed vlan 10,20,30,40,99
 switchport mode trunk
!
end
!
 vtp primary force  ! VTPv3 primary server 강제 지정 (DB 수정 권한 보유자)
!
configure terminal
!
! ===== VLAN 정의 (VTP server에서 생성 → client로 전파) =====
vlan 10
 name Data
vlan 20
 name Voice
vlan 30
 name Server
vlan 40
 name Guest
vlan 99
 name Mgmt
!
! ===== STP 루트 분담 =====
spanning-tree vlan 1,10,20,99 root primary   ! Core1 = VLAN 10/20/99 루트 (HSRP active와 일치)
spanning-tree vlan 30,40 root secondary      ! VLAN 30/40은 백업 루트 (Core2가 primary)
!
port-channel load-balance src-dst-ip    ! EtherChannel 트래픽 분산
!
interface range gi3/0 - 3
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
 no shutdown
!
configure terminal
!
spanning-tree mode rapid-pvst           ! RPVST+ (빠른 수렴)
!
ip routing                                ! RPVST+ (빠른 수렴)
!
! ===== 업링크 추적 (HSRP 연동) =====
track 1 interface gi0/0 line-protocol      ! 엣지 향 gi0/0 상태 추적
track 2 interface gi0/1 line-protocol      ! 엣지 향 gi0/1 상태 추적
!
track 10 list boolean or                   ! gi0/0 OR gi0/1 둘 중 하나라도 살아있으면 up
 object 1
 object 2
!
! ===== VLAN 게이트웨이 + HSRP =====
interface vlan 10
 ip address 10.10.10.2 255.255.255.0
 standby 10 ip 10.10.10.1                 ! 가상 게이트웨이 IP (PC가 바라보는 GW)
 standby 10 priority 110                  ! Core1이 더 높음 → vlan10 active
 standby 10 timers 1 3                    ! hello 1s / hold 3s 
 standby 10 preempt                       ! 복구 시 active 탈환
 standby 10 preempt delay minimum 60      ! 부팅 후 60초 대기 (라우팅 수렴 기다림)
 standby 10 track 10 decrement 20         ! 업링크 둘 다 죽으면 priority 110→90 (Core2에 양보)
 no shutdown
!
interface vlan 20
 ip address 10.10.20.2 255.255.255.0
 standby 20 ip 10.10.20.1
 standby 20 priority 110                 ! vlan20 Core1 active
 standby 20 timers 1 3                   
 standby 20 preempt
 standby 20 preempt delay minimum 60
 standby 20 track 10 decrement 20  
 no shutdown
!
interface vlan 30
 ip address 10.10.30.2 255.255.255.0
 standby 30 ip 10.10.30.1
 standby 30 priority 100                 ! vlan30 priority 100 → Core2(110)가 active, Core1은 standby
 standby 30 timers 1 3
 no shutdown
!
interface vlan 40
 ip address 10.10.40.2 255.255.255.0
 standby 40 ip 10.10.40.1
 standby 40 priority 100                 ! vlan40 Core2가 active
 standby 40 timers 1 3
 no shutdown
!
interface vlan 99
 ip address 10.10.99.2 255.255.255.0
 standby 99 ip 10.10.99.1                ! 관리 VLAN 게이트웨이
 standby 99 priority 110                 ! Core1 active
 standby 99 timers 1 3
 standby 99 preempt
 standby 99 preempt delay minimum 60
 standby 99 track 10 decrement 20 
 no shutdown
!
! ===== 엣지 L3 라우티드 포트 =====
interface gi0/0
 no switchport                        ! L3 모드 전환
 ip address 172.168.10.6 255.255.255.252  ! HQ-Edge1 gi3/0(172.168.10.5)과 P2P
 no shutdown
interface gi 0/1
 no switchport
 ip address 172.168.10.14 255.255.255.252 ! HQ-Edge2 gi2/0(172.168.10.13)과 P2P
 no shutdown
!
router ospf 1
 router-id 1.1.1.1
 auto-cost reference-bandwidth 10000  ! 엣지와 동일하게 10G 기준
passive-interface default
no passive-interface gi0/0             ! 엣지 OSPF 활성
no passive-interface gi0/1
no passive-interface vlan99           ! 관리망 OSPF (Core1↔Core2 vlan99 인접)
!
net 10.10.10.0 0.0.0.255 area 0      ! 사용자 VLAN 대역 OSPF 광고 → 엣지가 학습
net 10.10.20.0 0.0.0.255 area 0
net 10.10.30.0 0.0.0.255 area 0
net 10.10.40.0 0.0.0.255 area 0
net 10.10.99.0 0.0.0.255 area 0
net 172.168.10.4 0.0.0.3 area 0      ! 엣지1  링크
net 172.168.10.12 0.0.0.3 area 0     ! 엣지2  링크
!
! P2P + 타이머 (엣지와 5/15 일치해야 인접)
interface gi0/0
 ip ospf network point-to-point
 ip ospf hello-interval 5
 ip ospf dead-interval 15
!
interface gi0/1
 ip ospf network point-to-point
 ip ospf hello-interval 5
 ip ospf dead-interval 15
!
interface vlan99
 ip ospf network point-to-point
 ip ospf hello-interval 5
 ip ospf dead-interval 15
!
```
