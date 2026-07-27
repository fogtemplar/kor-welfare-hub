# 나라가쏜다 Apps in Toss

앱인토스 WebView용 경량 프런트엔드입니다. 정책 데이터는 운영 중인
`https://kor-welfare-hub.vercel.app/api/policies`에서 페이지 단위로 가져옵니다.

## 빌드

Node.js 24 이상에서 실행합니다.

```bash
npm install
npm run build
```

생성된 `.ait` 파일을 앱인토스 콘솔의 **앱 출시** 메뉴에 업로드합니다.
`granite.config.ts`의 `appName`은 콘솔에 등록한 appName과 정확히 같아야 합니다.
