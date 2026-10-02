# Branch2

> 지사2 라우터 / EIGRP AS200 · DMVPN Phase2 Spoke · NAT

---

## Configuration

```
enable
configure terminal
!
hostname Branch2
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
 interface Fa0/0
  ip address 203.0.113.14 255.255.255.252               ! ISP fa5/1(203.0.113.13)와 페어
  no shutdown
!
crypto isakmp policy 10
  encryption aes 256
  hash sha
  authentication pre-share
  group 5
  lifetime 86400
 crypto isakmp key DMVPN-HUB address 203.0.113.6
 crypto isakmp key DMVPN-HUB address 203.0.113.10
 crypto isakmp keepalive 10 3
!
 crypto ipsec transform-set TS-AES256 esp-aes 256 esp-sha-hmac
  mode tunnel
 crypto ipsec profile DMVPN-PROFILE
  set transform-set TS-AES256
  set pfs group5
  set security-association lifetime seconds 3600
!
 interface tu0                                          ! tu0 오버레이 BR2=.22
  ip address 172.16.0.22 255.255.255.0
  ip mtu 1400
  ip tcp adjust-mss 1360
  tunnel source fa0/0
  tunnel mode gre multipoint
  tunnel key 100                                               ! ★ Branch2도 tu0(key100) 사용
  ip nhrp network-id 100
  ip nhrp holdtime 600
  ip nhrp authentication NHRPKEY1
  ip nhrp nhs 172.16.0.1
  ip nhrp map 172.16.0.1 203.0.113.6
  ip nhrp map multicast 203.0.113.6
  ip nhrp nhs 172.16.0.2
  ip nhrp map 172.16.0.2 203.0.113.10
  ip nhrp map multicast 203.0.113.10
  tunnel protection ipsec profile DMVPN-PROFILE shared
!
 interface fa0/1       
 ip address 172.100.30.1 255.255.255.0                                  ! BR2 LAN
 no shutdown
!
 router eigrp 200                                                    ! ★ Branch2는 EIGRP 200
  no auto-summary
  passive-interface default
  no passive-interface tu0
  net 172.16.0.0 0.0.0.255
  net 172.100.30.0 0.0.0.255
 !
 ip route 203.0.113.0 255.255.255.0 203.0.113.13
 ip route 0.0.0.0 0.0.0.0 172.16.0.1                    ! 기본 경로: 주 허브
 ip route 0.0.0.0 0.0.0.0 172.16.0.2 10                 ! 기본 경로: 예비 허브 (AD 10)
 !
 ip access-list extended NAT-ACL-BR2
 deny   ip 172.100.30.0 0.0.0.255 10.10.0.0 0.0.255.255
 deny   ip 172.100.30.0 0.0.0.255 172.10.20.0 0.0.0.255
 deny   ip 172.100.30.0 0.0.0.255 172.10.30.0 0.0.0.255
 deny   ip 172.100.30.0 0.0.0.255 172.200.40.0 0.0.0.255
 deny   ip 172.100.30.0 0.0.0.255 172.16.0.0 0.0.255.255
 permit ip 172.100.30.0 0.0.0.255 any
!
ip nat inside source list NAT-ACL-BR2 interface fa0/0 overload
!
interface fa0/0
 ip nat outside
!
interface fa0/1
 ip nat inside
!
interface tu0
 ip nat inside
!
```
