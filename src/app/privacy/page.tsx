import type { Metadata } from "next";
import { LegalPage, Section, Note, Bullets } from "../legal-layout";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "kor-welfare-hub 개인정보 처리방침",
};

const EFFECTIVE = "2026년 8월 1일";

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보 처리방침" effectiveDate={EFFECTIVE}>
      <Note>
        <strong>이 서비스는 건강·장애·임신 등 민감정보를 서버에 저장하지
        않습니다.</strong> 해당 정보는 회원의 기기 안에만 보관되며, 맞춤 추천
        계산도 기기에서 이뤄집니다.
      </Note>

      <Section heading="1. 개인정보를 어디에 보관하는가">
        <p>
          이 서비스는 정보를 두 곳에 나누어 다룹니다. 어떤 정보가 어디에 있는지
          아래에서 확인하실 수 있습니다.
        </p>

        <div className="rounded-xl border border-line overflow-hidden mt-4">
          <div className="bg-bg-subtle px-4 py-2.5 text-13 font-bold text-ink">
            회원의 기기에만 저장 (서버 전송 없음)
          </div>
          <div className="px-4 py-3 text-14">
            소득 수준, 가구 형태, 주거 형태, 자녀 나이, 임신 여부, 장애 여부,
            취업 상태, 저장한 정책 목록
            <p className="mt-2 text-13 text-ink-tertiary">
              브라우저 저장소(localStorage)에 보관됩니다. 서비스 운영자는 이
              값을 볼 수 없습니다. 브라우저 데이터를 삭제하면 함께 지워집니다.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line overflow-hidden mt-3">
          <div className="bg-bg-subtle px-4 py-2.5 text-13 font-bold text-ink">
            서버에 저장 (토스 로그인을 선택한 경우에만)
          </div>
          <div className="px-4 py-3 text-14">
            회원 식별자, 생년월일, 성별, 거주 시·도, 알림을 신청한 정책 번호
            <p className="mt-2 text-13 text-ink-tertiary">
              마감 알림 발송에 필요한 최소 항목입니다. 상세 주소는 저장하지
              않으며, 시·도 단위까지만 보관합니다.
            </p>
          </div>
        </div>
      </Section>

      <Section heading="2. 토스 로그인을 쓰지 않아도 됩니다">
        <p>
          서비스는 <strong>토스 로그인 없이도 모든 정책 조회와 맞춤 추천을
          이용</strong>할 수 있습니다. 이 경우 서버에 저장되는 개인정보가
          없습니다.
        </p>
        <p>
          토스 로그인은 나이·지역을 자동으로 채워 입력을 줄이고, 마감 알림을
          받기 위한 선택 기능입니다.
        </p>
      </Section>

      <Section heading="3. 수집 항목과 목적">
        <div className="overflow-x-auto">
          <table className="w-full text-14 border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-3 font-bold text-ink">항목</th>
                <th className="py-2 pr-3 font-bold text-ink">목적</th>
                <th className="py-2 font-bold text-ink">보유기간</th>
              </tr>
            </thead>
            <tbody className="text-ink-secondary">
              <tr className="border-b border-line">
                <td className="py-2.5 pr-3">회원 식별자(CI)</td>
                <td className="py-2.5 pr-3">동일 회원 식별</td>
                <td className="py-2.5">연동 해지 시까지</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2.5 pr-3">생년월일</td>
                <td className="py-2.5 pr-3">연령 조건 매칭</td>
                <td className="py-2.5">연동 해지 시까지</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2.5 pr-3">성별</td>
                <td className="py-2.5 pr-3">성별 대상 정책 매칭</td>
                <td className="py-2.5">연동 해지 시까지</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2.5 pr-3">주소(시·도)</td>
                <td className="py-2.5 pr-3">지역 정책 매칭</td>
                <td className="py-2.5">연동 해지 시까지</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2.5 pr-3">알림 신청 정책 번호</td>
                <td className="py-2.5 pr-3">마감 알림 발송</td>
                <td className="py-2.5">알림 해제 또는 마감 후 30일</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3">접속 로그</td>
                <td className="py-2.5 pr-3">장애 대응·부정이용 방지</td>
                <td className="py-2.5">3개월</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section heading="4. 민감정보를 다루는 방식">
        <p>
          소득·장애·임신 여부는 개인정보 보호법 제23조가 정한 민감정보이거나
          그에 준하는 정보입니다. 서비스는 이 정보를{" "}
          <strong>서버로 전송하지 않는 방식</strong>을 택했습니다.
        </p>
        <Bullets
          items={[
            "회원이 입력한 값은 기기 안에만 저장됩니다.",
            "정책과의 매칭 계산도 기기 안에서 실행됩니다.",
            "AI 추천 기능을 사용할 때는 회원이 직접 입력한 문장만 처리 목적으로 전송되며, 응답 생성 후 서비스 서버에 보관하지 않습니다.",
          ]}
        />
      </Section>

      <Section heading="5. 제3자 제공 및 처리위탁">
        <p>서비스는 개인정보를 제3자에게 판매하거나 제공하지 않습니다. 다만 서비스 제공에 필요한 범위에서 아래 업체에 처리를 위탁합니다.</p>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-14 border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-3 font-bold text-ink">수탁자</th>
                <th className="py-2 pr-3 font-bold text-ink">위탁 업무</th>
                <th className="py-2 font-bold text-ink">전송 항목</th>
              </tr>
            </thead>
            <tbody className="text-ink-secondary">
              <tr className="border-b border-line">
                <td className="py-2.5 pr-3">비바리퍼블리카(토스)</td>
                <td className="py-2.5 pr-3">로그인 인증, 알림 발송</td>
                <td className="py-2.5">회원 식별자</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2.5 pr-3">Vercel Inc.</td>
                <td className="py-2.5 pr-3">서비스 호스팅</td>
                <td className="py-2.5">접속 로그</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3">Google LLC</td>
                <td className="py-2.5 pr-3">AI 추천 처리</td>
                <td className="py-2.5">회원이 입력한 상담 문장</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-13 text-ink-tertiary mt-3">
          Vercel과 Google은 국외(미국 등)에서 정보를 처리합니다. 회원은 국외 이전을
          거부할 수 있으며, 이 경우 AI 추천 기능 이용이 제한될 수 있습니다.
        </p>
      </Section>

      <Section heading="6. 회원의 권리">
        <p>회원은 언제든지 다음을 할 수 있습니다.</p>
        <Bullets
          items={[
            <><strong>기기 저장 정보 삭제</strong> — 서비스 내 &lsquo;내 정보 초기화&rsquo; 또는 브라우저 데이터 삭제</>,
            <><strong>서버 저장 정보 삭제</strong> — 토스 앱에서 연동을 해지하면 서버 데이터가 자동으로 삭제됩니다</>,
            <><strong>열람·정정 요청</strong> — 아래 문의처로 요청하시면 지체 없이 처리합니다</>,
            <><strong>알림 해제</strong> — 정책별 알림을 개별 해제할 수 있습니다</>,
          ]}
        />
      </Section>

      <Section heading="7. 연동 해지 시 처리">
        <p>
          회원이 토스에서 연동을 끊으면 서비스는 토스로부터 해지 통보를 받고,
          해당 회원의 서버 저장 정보를 <strong>지체 없이 파기</strong>합니다.
          기기에 저장된 정보는 회원이 직접 삭제하거나 브라우저 데이터를 지우면
          제거됩니다.
        </p>
      </Section>

      <Section heading="8. 만 14세 미만 아동">
        <p>
          서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 법정대리인의 동의
          없이 만 14세 미만 아동의 개인정보를 수집하지 않습니다.
        </p>
      </Section>

      <Section heading="9. 개인정보 보호책임자">
        <p>
          {/* 성명은 실명 기재가 원칙입니다. 사업자 등록 후에는 대표자명으로 교체하세요. */}
          성명: fogtemplar (서비스 운영자)
          <br />
          연락처: fogtemplar@gmail.com
        </p>
        <p className="text-13 text-ink-tertiary">
          개인정보 침해에 관한 상담이 필요하시면 개인정보침해신고센터(국번없이
          118) 또는 개인정보 분쟁조정위원회(1833-6972)에 문의하실 수 있습니다.
        </p>
      </Section>

      <Note>
        <strong>부칙</strong> — 이 처리방침은 {EFFECTIVE}부터 시행합니다.
        내용이 변경되는 경우 시행 7일 전부터 서비스 내에 공지합니다.
      </Note>
    </LegalPage>
  );
}
