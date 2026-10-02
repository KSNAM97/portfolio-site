# 웹서버

> 웹서버 기본 설정

---

## Configuration

```
enable
configure terminal
!
hostname WEB-SERVER
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
 ip address 203.0.113.26 255.255.255.252     ! R-ISP gi4/0(203.0.113.25)과 페어
 no shutdown
!
interface lo0
 ip address 8.8.8.8 255.255.255.255         ! "인터넷 서버" 역할 (DNS 흉내 IP, 핑/접속 테스트 대상)
!
ip route 0.0.0.0 0.0.0.0 203.0.113.25       ! 모든 응답 트래픽 → R-ISP로 (디폴트)
```
