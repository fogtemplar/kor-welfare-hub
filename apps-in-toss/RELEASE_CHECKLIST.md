# 앱인토스 출시 체크리스트

공식 앱인토스 비게임 출시·테스트 문서를 기준으로 관리합니다.

## 코드에서 완료

- [x] SDK 2.x (`@apps-in-toss/web-framework` 2.10.7)
- [x] `webViewProps.type: "partner"`
- [x] 비게임 내비게이션 바 제목·홈 버튼
- [x] SDK `SafeAreaInsets` 조회 및 변경 구독
- [x] SDK `Storage` 기반 저장과 웹 폴백
- [x] 오프라인 감지·오류 안내·재시도
- [x] 페이지 단위 API 호출과 지연 검색
- [x] 운영/QR/로컬 개발 Origin CORS 허용
- [x] HTTPS API만 사용
- [x] 공공기관 공식 페이지와 법률 고지 외의 외부 이동 없음
- [x] 앱 내부 약관·개인정보 요약과 전체 문서 연결
- [x] 키보드·스크린리더용 버튼 이름과 상태 제공
- [x] AIT 압축 해제 용량 100MB 미만

## 콘솔에서 확인 필요

- [ ] 콘솔 appName이 `bokji`와 정확히 같은지 확인
- [ ] 콘솔 표시 이름이 `나라가쏜다`와 정확히 같은지 확인
- [ ] 콘솔에 업로드한 아이콘 URL을 `granite.config.ts`에 입력
- [ ] 고객센터 이메일·홈페이지 주소 등록
- [ ] 이용약관·개인정보처리방침 URL 등록
- [ ] 샌드박스 앱에서 Android/iOS 실제 기기 테스트
- [ ] `.ait` 업로드 후 QR 테스트를 최소 1회 완료
- [ ] 라이브 Origin에서 API·외부 링크·저장 기능 재확인

## 공식 문서

- 비게임 출시: https://developers-apps-in-toss.toss.im/checklist/app-nongame.html
- 토스앱 테스트: https://developers-apps-in-toss.toss.im/development/test/toss.html
- 미니앱 출시: https://developers-apps-in-toss.toss.im/development/deploy.html
- 외부 링크: https://developers-apps-in-toss.toss.im/checklist/miniapp-external-link.html
