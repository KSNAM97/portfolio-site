# Branch1

> 지사1 라우터 / EIGRP AS100 · DMVPN Phase2 Spoke · NAT

---

## Configuration

```
enable
configure terminal
!
hostname Branch1
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
 interface fa0/0
  ip address 203.0.113.1 255.255.255.252
  no shutdown
!
 crypto isakmp policy 10
  encryption aes 256
  hash sha
  authentication pre-share
  group 5
  lifetime 86400
 crypto isakmp key DMVPN-HUB address 203.0.113.6                  ! HQ-Edge1에 PSK
 crypto isakmp key DMVPN-HUB address 203.0.113.10                 ! HQ-Edge2에 PSK (듀얼 허브라 둘 다 명시)
 crypto isakmp keepalive 10 3
!
 crypto ipsec transform-set TS-AES256 esp-aes 256 esp-sha-hmac
  mode tunnel
 crypto ipsec profile DMVPN-PROFILE
  set transform-set TS-AES256
  set pfs group5
  set security-association lifetime seconds 3600
!
 interface tu0
  ip address 172.16.0.11 255.255.255.0                            ! tu0 오버레이 (허브 .1/.2, BR1 .11)
  ip mtu 1400
  ip tcp adjust-mss 1360
  tunnel source fa0/0
  tunnel mode gre multipoint                                      ! mGRE (스포크-투-스포크 가능)
  tunnel key 100                                                  ! 허브 Tunnel0과 동일 key
  ip nhrp network-id 100
  ip nhrp holdtime 600
  ip nhrp authentication NHRPKEY1                                 ! 허브 Tunnel0과 동일 인증키
  ip nhrp nhs 172.16.0.1                                         ! NHS = HQ-Edge1
  ip nhrp map 172.16.0.1 203.0.113.6                             ! NHS의 오버레이↔공인 정적 매핑
  ip nhrp map multicast 203.0.113.6                             ! Edge1로 멀티캐스트(EIGRP hello) 전송
  ip nhrp nhs 172.16.0.2                                         ! NHS = HQ-Edge2 (듀얼 허브)
  ip nhrp map 172.16.0.2 203.0.113.10
  ip nhrp map multicast 203.0.113.10
  tunnel protection ipsec profile DMVPN-PROFILE shared
!
! ===== 지사 LAN =====
interface fa0/1
 ip address 172.10.20.1 255.255.255.0
 no shutdown
!
 router eigrp 100
  no auto-summary
  passive-interface default
  no passive-interface tu0                                  ! 터널로만 EIGRP (LAN은 passive=광고만)
  net 172.16.0.0 0.0.0.255
  net 172.10.20.0 0.0.0.255
 !
 ip route 203.0.113.0 255.255.255.0 203.0.113.2                ! 공인 대역(허브 IP들)으로 가는 경로 → ISP
 ip route 0.0.0.0 0.0.0.0 172.16.0.1                    ! 기본 경로: 주 허브
 ip route 0.0.0.0 0.0.0.0 172.16.0.2 10                 ! 기본 경로: 예비 허브 (AD 10)
!
ip access-list extended NAT-ACL-BR1
 deny   ip 172.10.20.0 0.0.0.255 10.10.0.0 0.0.255.255            ! 본사  NAT 제외
 deny   ip 172.10.20.0 0.0.0.255 172.100.30.0 0.0.0.255            ! BR2  제외
 deny   ip 172.10.20.0 0.0.0.255 172.10.30.0 0.0.0.255             ! BR3
 deny   ip 172.10.20.0 0.0.0.255 172.200.40.0 0.0.0.255            !BR4
 deny   ip 172.10.20.0 0.0.0.255 172.16.0.0 0.0.255.255             !터널 오버레이
 permit ip 172.10.20.0 0.0.0.255 any                               ! 그 외(인터넷)만 NAT 
!
ip nat inside source list NAT-ACL-BR1 interface fa0/0 overload
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
