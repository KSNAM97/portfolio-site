# SW-Access4

> HQ 액세스 스위치 / VLAN40(Guest) · VTP Client

---

## Configuration

```
enable
configure terminal
!
hostname SW-Access4
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
 ip address 10.10.99.44 255.255.255.0
 no shutdown
!
 ip default-gateway 10.10.99.1
!
spanning-tree mode rapid-pvst
!
interface gi0/0
 spanning-tree vlan 40 cost 100    ! VLAN40도 Core2 쪽 우선
interface gi0/1
 spanning-tree vlan 40 cost 10      ! gi0/1(Core2=vlan40 active/루트) 우선
!
interface range gi0/2-3
 switchport mode access
 switchport access vlan 40
 spanning-tree bpduguard enable
 spanning-tree portfast
 no shutdown
!
```
