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
- [x] 서버에서 토스 로그인 userKey·orderId·SKU·결제 상태 검증
- [x] 미결 주문 로컬 복구 및 사용자별 최신 리포트 서버 복원 경로
- [x] 온보딩·광고·결제 유도·결제 완료 퍼널 이벤트
- [x] 전역 클라이언트 오류 이벤트 기록

## 콘솔에서 확인 필요

- [ ] 콘솔 appName이 `bokji`와 정확히 같은지 확인
- [ ] 콘솔 표시 이름이 `나라가쏜다`와 정확히 같은지 확인
- [ ] 유저정보 불러오기 항목은 이름·생년월일·주소만 선택했는지 확인
- [ ] 콘솔에 업로드한 아이콘 URL을 `granite.config.ts`에 입력
- [ ] 고객센터 이메일·홈페이지 주소 등록
- [ ] 이용약관·개인정보처리방침 URL 등록
- [ ] 샌드박스 앱에서 Android/iOS 실제 기기 테스트
- [ ] `.ait` 업로드 후 QR 테스트를 최소 1회 완료
- [ ] 라이브 Origin에서 API·외부 링크·저장 기능 재확인
- [ ] Vercel에 `TOSS_REPORT_SKU`가 콘솔 상품 ID와 같은지 확인
- [ ] Vercel에 Redis REST URL/Token을 설정하고 기기 변경 복원 테스트
- [ ] Sentry 프로젝트/DSN/소스맵 업로드 설정
- [ ] 앱 내 기능 `맞춤 복지혜택 확인하기`를 최소 1개 등록
- [ ] 결제 성공·취소·네트워크 실패·AI 생성 실패·미결 주문 복구 테스트
- [ ] 전면형 광고 승인 후 9단계 TODO를 실제 광고 종료 콜백에 연결

## 공식 문서

- 비게임 출시: https://developers-apps-in-toss.toss.im/checklist/app-nongame.html
- 토스앱 테스트: https://developers-apps-in-toss.toss.im/development/test/toss.html
- 미니앱 출시: https://developers-apps-in-toss.toss.im/development/deploy.html
- 외부 링크: https://developers-apps-in-toss.toss.im/checklist/miniapp-external-link.html
