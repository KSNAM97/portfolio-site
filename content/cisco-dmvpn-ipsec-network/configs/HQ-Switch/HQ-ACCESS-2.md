# SW-Access2

> HQ 액세스 스위치 / VLAN20(Voice) · VTP Client

---

## Configuration

```
enable
configure terminal
!
hostname SW-Access2
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
vtp password Cisco123
vtp domain HQ
vtp version 3
vtp mode client
!
interface range gi0/0 - 1
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,99
 no shutdown
!
enable secret cisco
!
line vty 0 15
  password cisco
  login
!
interface vlan 99
 ip address 10.10.99.22 255.255.255.0
 no shutdown
!
 ip default-gateway 10.10.99.1
!
spanning-tree mode rapid-pvst

!
interface gi0/0
 spanning-tree vlan 20 cost 10   ! VLAN20은 gi0/0(Core1=vlan20 active/루트) 우선
interface gi0/1
 spanning-tree vlan 20 cost 100
!
interface range gi0/2-3
 switchport mode access
 switchport access vlan 20        ! 단말 = vlan20
 spanning-tree bpduguard enable
 spanning-tree portfast
 no shutdown
```
