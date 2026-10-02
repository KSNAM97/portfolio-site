# Branch3

> 지사3 라우터 / EIGRP AS100 · DMVPN Phase3 Spoke · NAT

---

## Configuration

```
enable
configure terminal
!
hostname Branch3
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
 ip address 203.0.113.17 255.255.255.252                      ! ISP gi2/0(203.0.113.18)와 페어
 no shutdown
!
interface gi1/0
 ip address 172.10.30.1 255.255.255.0                        ! BR3 LAN
 no shutdown
!
  crypto isakmp policy 10
  encryption aes 256
  hash sha
  authentication pre-share
  group 5
  lifetime 86400
 crypto isakmp key DMVPN-HUB address 0.0.0.0 0.0.0.0        ! ★ BR3/BR4는 와일드카드 PSK (허브 IP 개별 미지정)
 crypto isakmp keepalive 10 3
!
 crypto ipsec transform-set TS-AES256 esp-aes 256 esp-sha-hmac
  mode tunnel
 crypto ipsec profile DMVPN-PROFILE
  set transform-set TS-AES256
  set pfs group5
  set security-association lifetime seconds 3600
!
 interface tu1                                                  ! ★ tu1 사용
  ip address 172.16.10.33 255.255.255.0                     ! tu1 오버레이 (허브 .1/.2, BR3 .33)
  ip mtu 1400
  ip tcp adjust-mss 1360
  tunnel source gi0/0
  tunnel mode gre multipoint
  tunnel key 200                                                    ! ★ key 200 (허브 Tunnel1과 일치)
  ip nhrp network-id 200
  ip nhrp holdtime 600
  ip nhrp authentication NHRPKEY2                                  ! ★ Tunnel1용 인증키
  ip nhrp map 172.16.10.1 203.0.113.6                               ! NHS = Edge1 (tu1 오버레이 .1)
  ip nhrp map 172.16.10.2 203.0.113.10                               ! NHS = Edge2 (.2)
  ip nhrp map multicast 203.0.113.6
  ip nhrp map multicast 203.0.113.10
  ip nhrp nhs 172.16.10.1
  ip nhrp nhs 172.16.10.2
  ip nhrp shortcut                                                  ! ★ Phase3 스포크 shortcut 활성 (허브 redirect와 짝)
  tunnel protection ipsec profile DMVPN-PROFILE shared
 !
  router eigrp 100                                                  ! ★ BR3는 EIGRP 100
  no auto-summary
  passive-interface default
  no passive-interface tu1
  net 172.16.10.0 0.0.0.255
  net 172.10.30.0 0.0.0.255
!
 ip route 203.0.113.0 255.255.255.0 203.0.113.18
 ip route 0.0.0.0 0.0.0.0 172.16.10.1                    ! 기본 경로: 주 허브
 ip route 0.0.0.0 0.0.0.0 172.16.10.2 10                 ! 기본 경로: 예비 허브 (AD 10)
!
ip access-list extended NAT-ACL-BR3
 deny   ip 172.10.30.0 0.0.0.255 10.10.0.0 0.0.255.255
 deny   ip 172.10.30.0 0.0.0.255 172.10.20.0 0.0.0.255
 deny   ip 172.10.30.0 0.0.0.255 172.100.30.0 0.0.0.255
 deny   ip 172.10.30.0 0.0.0.255 172.200.40.0 0.0.0.255
 deny   ip 172.10.30.0 0.0.0.255 172.16.0.0 0.0.255.255
 permit ip 172.10.30.0 0.0.0.255 any
!
ip nat inside source list NAT-ACL-BR3 interface gi0/0 overload
!
interface gi0/0
 ip nat outside
!
interface gi1/0
 ip nat inside
!
interface tu1
 ip nat inside
!
```
