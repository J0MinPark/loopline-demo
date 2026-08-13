# Loopline (demo)

RepliQA QA 검증용 데모 스타트업 사이트. 실제 결제/이메일 발송 없이도 동작하며,
SMTP 환경변수를 설정하면 실제 이메일 인증 코드가 발송됩니다.

## 로컬 실행

```
npm install
npm start
```

기본 포트는 3300이며, `PORT` 환경변수로 변경할 수 있습니다.

## 환경변수 (선택)

`RESEND_API_KEY`를 설정하지 않으면 인증 코드가 서버 콘솔에 출력됩니다(로컬 개발용).
SMTP가 아니라 [Resend](https://resend.com) REST API로 발송한다 — 대부분의 무료
호스팅(Render 등)이 아웃바운드 SMTP 포트를 막아두기 때문.

- `RESEND_API_KEY` — Resend API 키
- `RESEND_FROM` — 발신자(기본값: `Loopline <onboarding@resend.dev>`, 도메인 미인증 시 이 주소만 사용 가능)
- `SESSION_SECRET`

## 참고

- `/upgrade` 결제 폼은 실제 PG에 연결되어 있지 않습니다. 어떤 카드 정보를 입력해도
  실제 청구는 발생하지 않습니다.
- 사용자 데이터는 인메모리에만 저장되며 서버 재시작 시 초기화됩니다.
