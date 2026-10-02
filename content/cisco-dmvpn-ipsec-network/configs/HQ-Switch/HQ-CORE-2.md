# SW-Core2

> HQ 코어 스위치 / VTPv3 Server · HSRP Active(VLAN30,40)

---

## Configuration

```
enable
configure terminal
!
hostname SW-Core2               ! Core2 server (단, primary는 Core1이 force로 잡음)
!
no ip domain-lookup
!
spanning-tree mode rapid-pvst
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
vtp password Cisco123
vtp domain HQ
vtp version 3
vtp mode server             ! Core2 server (단, primary는 Core1이 force로 잡음)
!
interface range gi0/2 - 3
 switchport trunk encapsulation dot1q
 switchport mode trunk
 channel-group 1 mode active
 no shutdown
!
interface port-channel 1
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
!
! ===== STP 루트 = Core1과 반대 =====
spanning-tree vlan 30,40 root primary             ! VLAN 30/40 루트 (HSRP active와 일치)
spanning-tree vlan 1,10,20,99 root secondary      ! 10/20/99는 백업
!
port-channel load-balance src-dst-ip
!
interface range gi3/0 - 3
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
 no shutdown
!
configure terminal
!
spanning-tree mode rapid-pvst
!
ip routing
!
track 1 interface gi0/0 line-protocol
track 2 interface gi0/1 line-protocol
!
track 10 list boolean or
 object 1
 object 2
!
interface vlan 10
 ip address 10.10.10.3 255.255.255.0
 standby 10 ip 10.10.10.1
 standby 10 priority 100            ! VLAN10은 standby (Core1이 active)
 standby 10 timers 1 3
 no shutdown
!
interface vlan 20
 ip address 10.10.20.3 255.255.255.0
 standby 20 ip 10.10.20.1
 standby 20 priority 100           ! standby
 standby 20 timers 1 3
 no shutdown
!
interface vlan 30
 ip address 10.10.30.3 255.255.255.0
 standby 30 ip 10.10.30.1
 standby 30 priority 110           ! vlan30 = Core2 active
 standby 30 timers 1 3
 standby 30 preempt
 standby 30 preempt delay minimum 60
 standby 30 track 10 decrement 20 
 no shutdown
!
interface vlan 40
 ip address 10.10.40.3 255.255.255.0
 standby 40 ip 10.10.40.1
 standby 40 priority 110           ! vlan40 = Core2 active
 standby 40 timers 1 3
 standby 40 preempt
 standby 40 preempt delay minimum 60
 standby 40 track 10 decrement 20 
 no shutdown
!
interface vlan 99
 ip address 10.10.99.3 255.255.255.0
 standby 99 ip 10.10.99.1
 standby 99 priority 100         ! standby
 standby 99 timers 1 3
 no shutdown
!
! ===== 엣지 L3 포트 =====
interface gi0/0
 no switchport
 ip address 172.168.10.18 255.255.255.252   ! HQ-Edge2 gi3/0(172.168.10.17)과 P2P
 no shutdown
interface gi 0/1
 no switchport
 ip address 172.168.10.10 255.255.255.252   ! HQ-Edge1 gi2/0(172.168.10.9)과 P2P
 no shutdown
!
router ospf 1
 router-id 2.2.2.2
 auto-cost reference-bandwidth 10000
passive-interface default
no passive-interface gi0/0
no passive-interface gi0/1
no passive-interface vlan99
!
net 10.10.10.0 0.0.0.255 area 0
net 10.10.20.0 0.0.0.255 area 0
net 10.10.30.0 0.0.0.255 area 0
net 10.10.40.0 0.0.0.255 area 0
net 10.10.99.0 0.0.0.255 area 0
net 172.168.10.16 0.0.0.3 area 0
net 172.168.10.8 0.0.0.3 area 0
!
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
