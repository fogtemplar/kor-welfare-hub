import type { Metadata } from "next";
import { LegalPage, Section, Note, Bullets } from "../legal-layout";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "나라가쏜다 개인정보 처리방침",
};

const EFFECTIVE = "2026년 10월 23일";

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보 처리방침" effectiveDate={EFFECTIVE}>
      <Note>
        나라가쏜다는 필요한 정보만 처리합니다. 이름·전화번호·이메일·상세주소는
        AI 맞춤 복지 리포트 생성에 전송하지 않으며, 건강·장애·임신 등 선택 입력
        정보는 별도 동의를 받은 경우에만 분석에 사용합니다.
      </Note>

      <Section heading="1. 처리하는 개인정보와 목적">
        <div className="overflow-x-auto">
          <table className="w-full text-14 border-collapse">
            <thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">구분</th><th className="py-2 pr-3">항목</th><th className="py-2">목적·보유기간</th></tr></thead>
            <tbody className="text-ink-secondary">
              <tr className="border-b border-line"><td className="py-2.5 pr-3">서비스 이용</td><td className="py-2.5 pr-3">접속 시각, IP, 기기·브라우저, 요청 기록</td><td className="py-2.5">보안·장애 대응·부정 이용 방지, 최대 3개월</td></tr>
              <tr className="border-b border-line"><td className="py-2.5 pr-3">토스 로그인</td><td className="py-2.5 pr-3">사용자 식별키, 이름, 생년월일, 성별, 내·외국인, 휴대전화번호, 이메일 및 로그인 토큰</td><td className="py-2.5">로그인·회원 식별, 암호화된 세션 쿠키에 최대 14일 보관</td></tr>
              <tr className="border-b border-line"><td className="py-2.5 pr-3">유저정보 연동</td><td className="py-2.5 pr-3">생년월일, 성별, 내·외국인, 주소</td><td className="py-2.5">나이·지역 등 검색 조건 자동 설정, 현재 이용 화면에서 처리</td></tr>
              <tr className="border-b border-line"><td className="py-2.5 pr-3">AI 리포트</td><td className="py-2.5 pr-3">나이, 지역, 성별, 내·외국인, 가구·주거·소득 구간, 자녀, 임신·장애, 관심 지원, 이용자가 작성한 상황</td><td className="py-2.5">복지 정책 분석과 추천, 생성 입력은 별도 저장하지 않으며 결과는 최대 90일 보관</td></tr>
              <tr><td className="py-2.5 pr-3">결제·복원</td><td className="py-2.5 pr-3">토스 사용자 식별키, 주문번호, 상품번호, 결제 상태, 리포트 결과</td><td className="py-2.5">상품 지급·재시도·기기 변경 시 복원, 최대 90일</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section heading="2. 기기에 저장되는 정보">
        <p>검색 조건, 가구·주거·관심 분야, 저장한 정책 목록과 최근 리포트 사본은 브라우저 또는 앱인토스 저장소에 보관됩니다. 앱의 &lsquo;내 정보 초기화&rsquo;나 미니앱 저장 데이터 삭제로 지울 수 있습니다.</p>
        <p>토스 로그인 세션은 위·변조를 막기 위해 암호화된 보안 쿠키로 저장되며, 자바스크립트에서 읽을 수 없도록 설정합니다.</p>
      </Section>

      <Section heading="3. 민감정보와 선택 동의">
        <p>장애·임신·건강 상태 등은 민감정보에 해당하거나 그에 준하는 정보입니다. AI 리포트 화면에서 처리 항목과 목적을 안내하고 별도 동의를 받은 뒤에만 전송합니다. 동의하지 않아도 무료 정책 검색은 이용할 수 있습니다.</p>
        <Bullets items={[
          "주민등록번호, 계좌·카드번호, 비밀번호와 인증번호는 입력할 수 없습니다.",
          "이름·휴대전화번호·이메일·상세주소는 AI 분석 요청에서 제외합니다.",
          "AI 결과는 자격을 확정하지 않으며 공식 공고와 담당 기관 확인이 필요합니다.",
        ]} />
      </Section>

      <Section heading="4. 처리위탁과 개인정보의 국외 이전">
        <p>서비스 운영에 필요한 범위에서 다음 사업자에게 처리를 위탁하며, 네트워크를 통해 미국 등 국외 리전에 이전될 수 있습니다.</p>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-14 border-collapse">
            <thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">수탁자</th><th className="py-2 pr-3">업무·이전 항목</th><th className="py-2">이전 시점·보유기간</th></tr></thead>
            <tbody className="text-ink-secondary">
              <tr className="border-b border-line"><td className="py-2.5 pr-3">Vercel Inc.</td><td className="py-2.5 pr-3">서비스 호스팅, 접속 기록과 API 요청 처리</td><td className="py-2.5">서비스 접속 시 암호화 전송, 업무 목적 달성 시까지</td></tr>
              <tr className="border-b border-line"><td className="py-2.5 pr-3">OpenAI, L.L.C.</td><td className="py-2.5 pr-3">AI 리포트 생성, 제1조의 AI 리포트 입력 항목</td><td className="py-2.5">리포트 요청 시 암호화 전송, API 악용 방지 로그는 원칙적으로 최대 30일</td></tr>
              <tr><td className="py-2.5 pr-3">Upstash, Inc.</td><td className="py-2.5 pr-3">암호화된 리포트와 주문 연결 정보 보관</td><td className="py-2.5">리포트 생성 시 암호화 전송, 최대 90일</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-13 text-ink-tertiary mt-3">OpenAI API에는 학습 사용을 허용하지 않으며 애플리케이션 상태 저장을 끈 상태로 요청합니다. 다만 서비스 안전을 위한 악용 방지 로그가 최대 30일 보관될 수 있습니다. 국외 이전에 동의하지 않으면 AI 리포트를 구매하지 않고 무료 검색 기능을 이용할 수 있습니다.</p>
      </Section>

      <Section heading="5. 제3자 제공">
        <p>법령에 근거가 있거나 이용자가 별도로 동의한 경우를 제외하고 개인정보를 제3자에게 제공하거나 판매하지 않습니다. 토스에서 정보를 전달받는 항목과 목적은 앱인토스 동의 화면에서 별도로 확인할 수 있습니다.</p>
      </Section>

      <Section heading="6. 파기와 연결 해제">
        <p>보유기간이 끝나거나 처리 목적을 달성한 정보는 복구할 수 없도록 지체 없이 파기합니다. 앱에서 &lsquo;로그아웃 및 연결 끊기&rsquo;를 실행하거나 토스에서 서비스 연결을 해제하면 로그인 세션을 무효화하고 서버에 보관된 리포트를 삭제합니다. 이후에는 다시 로그인하고 동의해야 서비스를 이용할 수 있습니다.</p>
      </Section>

      <Section heading="7. 이용자의 권리">
        <Bullets items={[
          "개인정보 열람·정정·삭제·처리정지 요청",
          "유저정보 제공 및 민감정보 처리 동의 철회",
          "토스 로그인 연결 해제와 기기 저장 정보 삭제",
          "국외 이전을 거부하고 AI 리포트 기능을 이용하지 않을 권리",
        ]} />
        <p>아래 이메일로 요청하면 본인 확인 후 지체 없이 처리합니다.</p>
      </Section>

      <Section heading="8. 안전성 확보조치">
        <p>전송 구간 암호화, 세션과 저장 리포트의 AES-256-GCM 암호화, 접근권한 최소화, 결제 주문의 서버 검증, 입력·출력 검증과 접속 기록 점검을 적용합니다.</p>
      </Section>

      <Section heading="9. 만 14세 미만 아동">
        <p>서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 법정대리인의 동의 없이 아동의 개인정보를 수집하지 않습니다.</p>
      </Section>

      <Section heading="10. 개인정보 보호책임자">
        <p>책임자: 서비스 운영자<br />이메일: fogtemplar@gmail.com</p>
        <p className="text-13 text-ink-tertiary">개인정보 침해 상담은 개인정보침해신고센터(118) 또는 개인정보 분쟁조정위원회(1833-6972)에 문의할 수 있습니다.</p>
      </Section>

      <Note><strong>부칙</strong> — 이 처리방침은 {EFFECTIVE}부터 시행합니다. 중요한 변경은 시행 30일 전, 그 밖의 변경은 시행 7일 전부터 서비스 안에서 알립니다.</Note>
    </LegalPage>
  );
}
