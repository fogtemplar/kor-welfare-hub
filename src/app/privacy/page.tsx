import type { Metadata } from "next";
import { LegalPage, Section, Note, Bullets } from "../legal-layout";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "kor-welfare-hub 개인정보 처리방침",
};

const EFFECTIVE = "2026년 7월 27일";

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보 처리방침" effectiveDate={EFFECTIVE}>
      <Note>
        <strong>이 서비스는 건강·장애·임신 등 민감정보를 서버에 저장하지
        않습니다.</strong> 해당 정보는 이용자의 기기 안에만 보관되며, 맞춤 추천
        계산도 기기에서 이뤄집니다.
      </Note>

      <Section heading="1. 개인정보를 어디에 보관하는가">
        <p>
          이 서비스는 정보를 두 곳에 나누어 다룹니다. 어떤 정보가 어디에 있는지
          아래에서 확인하실 수 있습니다.
        </p>

        <div className="rounded-xl border border-line overflow-hidden mt-4">
          <div className="bg-bg-subtle px-4 py-2.5 text-13 font-bold text-ink">
            이용자의 기기에만 저장 (서버 전송 없음)
          </div>
          <div className="px-4 py-3 text-14">
            소득 수준, 가구 형태, 주거 형태, 자녀 나이, 임신 여부, 장애 여부,
            취업 상태, 저장한 정책 목록
            <p className="mt-2 text-13 text-ink-tertiary">
              웹에서는 브라우저 저장소(localStorage), 앱인토스에서는 네이티브
              Storage에 보관됩니다. 운영자는 이 값을 볼 수 없으며, 해당 서비스의
              저장 데이터를 삭제하면 함께 지워집니다.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line overflow-hidden mt-3">
          <div className="bg-bg-subtle px-4 py-2.5 text-13 font-bold text-ink">
            서버에서 자동 처리
          </div>
          <div className="px-4 py-3 text-14">
            접속 시각, IP 주소, 브라우저·기기 정보, 요청 주소
            <p className="mt-2 text-13 text-ink-tertiary">
              서비스 보안, 장애 대응과 부정 이용 방지를 위한 접속 기록입니다.
              토스 로그인 사용 시에는 아래 로그인 정보도 서버에서 처리합니다.
            </p>
          </div>
        </div>
      </Section>

      <Section heading="2. 토스 로그인과 선택 이용">
        <p>
          정책 조회와 저장 기능은 로그인 없이 이용할 수 있습니다. 이용자가 토스
          로그인을 선택하면 앱인토스 동의 화면에서 허용한 항목만 전달받습니다.
          유저정보 불러오기는 토스 로그인과 별개의 선택 기능이며, 개인정보 제3자
          제공 동의 후에만 실행됩니다.
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
              <tr>
                <td className="py-2.5 pr-3">접속 로그</td>
                <td className="py-2.5 pr-3">장애 대응·부정이용 방지</td>
                <td className="py-2.5">3개월</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3">토스 사용자 식별키, 동의한 이름·생년월일·성별·연락처 등</td>
                <td className="py-2.5 pr-3">로그인, 회원 식별 및 맞춤형 복지 안내</td>
                <td className="py-2.5">로그인 연결 해제 또는 동의 철회 시까지</td>
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
          Vercel과 Google은 국외(미국 등)에서 정보를 처리합니다. 이용자는 국외 이전을
          거부할 수 있으며, 이 경우 AI 추천 기능 이용이 제한될 수 있습니다.
        </p>
      </Section>

      <Section heading="6. 회원의 권리">
        <p>이용자는 언제든지 다음을 할 수 있습니다.</p>
        <Bullets
          items={[
            <><strong>기기 저장 정보 삭제</strong> — 서비스 내 &lsquo;내 정보 초기화&rsquo; 또는 브라우저 데이터 삭제</>,
            <><strong>열람·정정 요청</strong> — 아래 문의처로 요청하시면 지체 없이 처리합니다</>,
            <><strong>로그인 연결 해제</strong> — 내 정보 화면의 &lsquo;로그아웃 및 연결 끊기&rsquo; 또는 토스 앱 설정에서 처리할 수 있습니다</>,
          ]}
        />
      </Section>

      <Section heading="7. 저장 정보 삭제">
        <p>
          웹에서는 브라우저 데이터를 삭제하고, 앱인토스에서는 미니앱의 저장
          데이터를 삭제하면 기기에 저장된 정보가 제거됩니다. 운영자가 보유한
          접속 기록에 대한 문의나 삭제 요청은 아래 문의처로 접수할 수 있습니다.
          토스 로그인 연결 해제·약관 철회·토스 탈퇴 콜백을 받으면 해당 사용자의
          로그인 세션과 보유 개인정보를 지체 없이 파기합니다.
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
