# HQ-Edge2

> HQ 라우터 / OSPF · DMVPN HUB · 재분배 · NAT

---

## Configuration

```
enable
configure terminal
!
hostname HQ-Edge2
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
 interface gi0/0
  ip address 203.0.113.10 255.255.255.252   ! ISP gi1/0(203.0.113.9)와 페어 (Edge1과 다른 ISP 링크)
  no shutdown
!
interface gi1/0
 ip address 172.168.10.2 255.255.255.252       ! HQ-Edge1 gi1/0(172.168.10.1)과 연결되는 OSPF P2P 링크
 no shutdown
interface gi2/0
 ip address 172.168.10.13 255.255.255.252
 no shutdown
interface gi3/0
 ip address 172.168.10.17 255.255.255.252
 no shutdown
!
router ospf 1
 router-id 22.22.22.22                 ! Edge1=11.11.11.11 / Edge2=22.22.22.22
 auto-cost reference-bandwidth 10000
 passive-interface default
 default-information originate              ! Edge2도 디폴트 광고 → 코어 입장에서 ECMP 또는 이중 게이트웨이
 no passive-interface gi1/0
 no passive-interface gi2/0
 no passive-interface gi3/0
 net 172.168.10.0 0.0.0.3 area 0
 net 172.168.10.12 0.0.0.3 area 0
 net 172.168.10.16 0.0.0.3 area 0        
!
interface gi1/0
 ip ospf network point-to-point
 ip ospf hello-interval 5
 ip ospf dead-interval 15
!
interface gi2/0
 ip ospf network point-to-point
 ip ospf hello-interval 5
 ip ospf dead-interval 15
!
 interface gi3/0
 ip ospf network point-to-point
 ip ospf hello-interval 5
 ip ospf dead-interval 15
!
crypto isakmp policy 10
 authentication pre-share
 encryption aes 256
 hash sha
 group 5
 lifetime 86400
!
crypto ipsec transform-set TS-AES256 esp-aes 256 esp-sha-hmac
 mode tunnel
!
crypto ipsec profile DMVPN-PROFILE
 set transform-set TS-AES256
 set pfs group5
 set security-association lifetime seconds 3600
!
crypto isakmp keepalive 10 3
!
crypto isakmp key DMVPN-HUB address 0.0.0.0 0.0.0.0
!
interface tu0                      
 ip address 172.16.0.2 255.255.255.0
 ip mtu 1400
 ip tcp adjust-mss 1360
 tunnel source gi0/0
 tunnel mode gre multipoint
 tunnel key 100
 ip nhrp network-id 100
 ip nhrp holdtime 600
 ip nhrp authentication NHRPKEY1
 ip nhrp map multicast dynamic
 ip next-hop-self eigrp 100
 no ip split-horizon eigrp 100
 ip next-hop-self eigrp 200  
 no ip split-horizon eigrp 200
 tunnel protection ipsec profile DMVPN-PROFILE shared
!
 router eigrp 100
  no auto-summary
  passive-interface default
  no passive-interface tu0
  net 172.16.0.0 0.0.0.255
 router eigrp 200
  no auto-summary
  passive-interface default
  no passive-interface tu0
  net 172.16.0.0 0.0.0.255
!
 ip route 0.0.0.0 0.0.0.0 203.0.113.9    ! Edge2의 ISP  디폴트
!
route-map EIGRP100-TO-OSPF permit 10
 set tag 100
!
route-map EIGRP200-TO-OSPF permit 10
 set tag 200
!
route-map OSPF-TO-EIGRP100 deny 10
 match tag 100
route-map OSPF-TO-EIGRP100 permit 20
!
route-map OSPF-TO-EIGRP200 deny 10
 match tag 200
route-map OSPF-TO-EIGRP200 permit 20
!
route-map EIGRP200-TO-EIGRP100 deny 5
 match tag 100
route-map EIGRP200-TO-EIGRP100 permit 10
 set tag 200
!
route-map EIGRP100-TO-EIGRP200 deny 5
 match tag 200
route-map EIGRP100-TO-EIGRP200 permit 10
 set tag 100
!
router ospf 1
 redistribute eigrp 100 subnets route-map EIGRP100-TO-OSPF
 redistribute eigrp 200 subnets route-map EIGRP200-TO-OSPF
!
router eigrp 100
 redistribute ospf 1 metric 1000000 2000 255 1 1500 route-map OSPF-TO-EIGRP100
! Edge2는 OSPF→EIGRP100을 비선호(delay 2000)
 redistribute eigrp 200 metric 1000000 100 255 1 1500 route-map EIGRP200-TO-EIGRP100
!
router eigrp 200
 redistribute ospf 1 metric 1000000 100 255 1 1500 route-map OSPF-TO-EIGRP200
! Edge2는 OSPF→EIGRP200을 선호(delay 100)
 redistribute eigrp 100 metric 1000000 100 255 1 1500 route-map EIGRP100-TO-EIGRP200
!
ip access-list extended NAT-ACL-HQ
 !HQ
 deny ip 10.10.0.0 0.0.255.255 10.10.0.0 0.0.255.255
 deny ip 10.10.0.0 0.0.255.255 172.10.20.0 0.0.0.255
 deny ip 10.10.0.0 0.0.255.255 172.100.30.0 0.0.0.255
 deny ip 10.10.0.0 0.0.255.255 172.10.30.0 0.0.0.255
 deny ip 10.10.0.0 0.0.255.255 172.200.40.0 0.0.0.255
 deny ip 10.10.0.0 0.0.255.255 172.16.0.0 0.0.255.255
 permit ip 10.10.0.0 0.0.255.255 any
!
ip nat inside source list NAT-ACL-HQ interface gi0/0 overload
!
interface gi0/0
 ip nat outside
!
interface tu0
 ip nat inside
!
interface gi1/0
 ip nat inside
interface gi2/0
 ip nat inside
interface gi3/0
 ip nat inside
!
 interface tu1
  ip address 172.16.10.2 255.255.255.0
  ip mtu 1400
  ip tcp adjust-mss 1360
  tunnel source gi0/0
  tunnel mode gre multipoint
  tunnel key 200
  ip nhrp network-id 200
  ip nhrp holdtime 600
  ip nhrp authentication NHRPKEY2
  ip nhrp map multicast dynamic     
  ip nhrp redirect                          
  no ip next-hop-self eigrp 100
  no ip split-horizon eigrp 100
  no ip next-hop-self eigrp 200
  no ip split-horizon eigrp 200
  ip nat inside
  tunnel protection ipsec profile DMVPN-PROFILE shared
 !
  router eigrp 100
  no passive-interface tu1
  net 172.16.10.0 0.0.0.255
 router eigrp 200
  no passive-interface tu1
  net 172.16.10.0 0.0.0.255
!
```
