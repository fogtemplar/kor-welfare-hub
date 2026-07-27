import type { Metadata } from "next";
import { LegalPage, Section, Note, Bullets } from "../legal-layout";

export const metadata: Metadata = {
  title: "이용약관",
  description: "kor-welfare-hub 이용약관",
};

const EFFECTIVE = "2026년 8월 1일";

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" effectiveDate={EFFECTIVE}>
      <Note>
        이 서비스는 <strong>정부·지자체가 공개한 복지 정보를 모아 보여주는
        비공식 안내 서비스</strong>입니다. 정부기관이나 공공기관이 운영하지
        않으며, 복지 급여의 지급·심사·결정 권한이 없습니다. 신청 전 반드시
        해당 기관의 공식 안내를 확인해 주세요.
      </Note>

      <Section heading="제1조 (목적)">
        <p>
          이 약관은 회원이 kor-welfare-hub(이하 &ldquo;서비스&rdquo;)를 이용할 때
          서비스와 회원 사이의 권리·의무 및 책임사항을 정하는 것을 목적으로 합니다.
        </p>
      </Section>

      <Section heading="제2조 (서비스의 성격)">
        <Bullets
          items={[
            <>서비스는 복지로·정부24·온통청년·K-Startup 등 <strong>공공기관이 공개한 데이터</strong>를 수집·정리해 제공합니다.</>,
            <>서비스가 제공하는 정보는 <strong>참고용 안내</strong>이며, 특정인의 수급 자격을 판정하거나 보증하지 않습니다.</>,
            <>실제 지원 여부·금액·조건은 소관 기관의 심사에 따라 결정됩니다.</>,
            <>서비스는 복지 급여의 신청을 대행하지 않습니다.</>,
          ]}
        />
      </Section>

      <Section heading="제3조 (정보의 정확성과 시점)">
        <p>
          서비스는 원본 데이터를 주기적으로 갱신하지만, 공공기관의 정보 변경
          시점과 서비스 반영 시점 사이에 시차가 있을 수 있습니다. 또한 원본
          데이터 자체에 오류나 누락이 포함되어 있을 수 있습니다.
        </p>
        <p>
          서비스는 정보의 정확성·완전성·최신성을 보증하지 않습니다. 신청 마감일,
          지원 금액, 자격 요건 등 <strong>중요한 사항은 반드시 각 정책의 공식
          페이지에서 확인</strong>해 주세요.
        </p>
      </Section>

      <Section heading="제4조 (AI 기능)">
        <p>
          서비스는 정책 정보를 이해하기 쉽게 풀어쓰거나 관련 정책을 찾아주기 위해
          인공지능을 사용합니다. 이때 다음을 지킵니다.
        </p>
        <Bullets
          items={[
            <>AI는 원본 문서에 있는 내용을 <strong>쉬운 말로 바꾸는 역할</strong>만 하며, 수급 자격을 판정하지 않습니다.</>,
            <>AI가 생성한 내용에는 항상 원문과 출처를 함께 표시합니다.</>,
            <>AI 출력에 오류가 있을 수 있으므로, 최종 판단은 공식 기관의 안내를 따라 주세요.</>,
          ]}
        />
      </Section>

      <Section heading="제5조 (회원의 의무)">
        <p>회원은 다음 행위를 해서는 안 됩니다.</p>
        <Bullets
          items={[
            "서비스를 자동화된 방법으로 과도하게 조회하여 정상적인 운영을 방해하는 행위",
            "서비스가 제공하는 정보를 사실과 다르게 가공해 타인에게 제공하는 행위",
            "타인의 개인정보를 무단으로 입력하는 행위",
            "법령을 위반하거나 타인의 권리를 침해하는 행위",
          ]}
        />
      </Section>

      <Section heading="제6조 (서비스의 변경·중단)">
        <p>
          서비스는 운영상·기술상 필요에 따라 제공 내용을 변경하거나 중단할 수
          있습니다. 무료로 제공되는 서비스의 변경·중단으로 인해 회원에게 발생한
          손해에 대해서는, 서비스의 고의 또는 중대한 과실이 없는 한 책임을 지지
          않습니다.
        </p>
      </Section>

      <Section heading="제7조 (책임의 제한)">
        <p>
          서비스는 공공 데이터를 정리해 전달하는 매개자입니다. 회원이 서비스의
          정보를 근거로 한 신청·미신청·기한 도과 등으로 발생한 결과에 대해
          서비스는 책임을 지지 않습니다. 다만 서비스의 고의 또는 중대한 과실로
          인한 손해는 그러하지 않습니다.
        </p>
      </Section>

      <Section heading="제8조 (약관의 변경)">
        <p>
          서비스는 필요한 경우 이 약관을 변경할 수 있으며, 변경된 약관은 서비스
          내에 공지합니다. 회원에게 불리한 변경의 경우 시행일 30일 전부터
          공지합니다.
        </p>
      </Section>

      <Section heading="제9조 (문의)">
        <p>
          서비스 이용과 관련한 문의는 아래로 연락해 주세요.
          <br />
          <span className="text-ink font-semibold">
            운영자 이메일: fogtemplar@gmail.com
          </span>
        </p>
      </Section>

      <Note>
        <strong>부칙</strong> — 이 약관은 {EFFECTIVE}부터 시행합니다.
      </Note>
    </LegalPage>
  );
}
