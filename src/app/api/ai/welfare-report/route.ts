import { NextRequest, NextResponse } from "next/server";
import { CURATED_POLICIES } from "@/lib/data/policies";
import { saveUserReport } from "@/lib/report-store";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";
import { getTossIapOrderStatus } from "@/lib/toss-login";
import { openSession, TOSS_SESSION_COOKIE } from "@/lib/toss-session";
import type { Policy } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ReportRequest = {
  orderId?: string;
  details?: string;
  filters?: { age?: number | null; region?: string; category?: string };
  tossData?: { gender?: string; nationality?: string };
  profile?: { household?: string; housing?: string; statuses?: string[]; incomePct?: string; childrenCount?: string; youngestChildAge?: string; pregnant?: boolean; hasDisability?: boolean; supportNeeds?: string[]; interests?: string[] };
};

const recentOrders = new Map<string, { createdAt: number; report?: unknown }>();
const ORDER_TTL_MS = 24 * 60 * 60 * 1000;

function pruneOrders() {
  const cutoff = Date.now() - ORDER_TTL_MS;
  for (const [id, value] of recentOrders) if (value.createdAt < cutoff) recentOrders.delete(id);
}

function scorePolicy(policy: Policy, request: ReportRequest): number {
  const text = `${policy.title} ${policy.summary} ${policy.benefit} ${policy.eligibility}`.toLowerCase();
  const profileText = JSON.stringify(request.profile || {});
  const terms = `${String(request.details || "")} ${profileText}`.toLowerCase().split(/[^0-9a-z가-힣]+/).filter((term) => term.length >= 2);
  let score = terms.reduce((sum, term) => sum + (text.includes(term) ? 2 : 0), 0);
  if (request.filters?.category && request.filters.category !== "all" && policy.category === request.filters.category) score += 5;
  if (!policy.region || policy.region === "전국" || policy.region === request.filters?.region) score += 2;
  return score;
}

function getOutputText(payload: unknown): string {
  const response = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;
  return response.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || "";
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI_REPORT_NOT_CONFIGURED" }, { status: 503 });

  let body: ReportRequest;
  try { body = await request.json() as ReportRequest; }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }

  const orderId = String(body.orderId || "").trim();
  const details = String(body.details || "").trim();
  if (orderId.length < 8 || details.length > 700 || !body.profile?.household || !body.profile?.housing || !body.profile?.incomePct) return NextResponse.json({ error: "INVALID_REPORT_REQUEST" }, { status: 400 });
  if (/\d{6}\s*-?\s*[1-4]\d{6}/.test(details)) return NextResponse.json({ error: "주민등록번호는 입력할 수 없어요." }, { status: 400 });

  const session = openSession(request.cookies.get(TOSS_SESSION_COOKIE)?.value || "");
  if (!session) return NextResponse.json({ error: "TOSS_LOGIN_REQUIRED" }, { status: 401 });
  try {
    const order = await getTossIapOrderStatus(orderId, session.profile.userKey);
    const validStatus = order.status === "PAYMENT_COMPLETED" || order.status === "PURCHASED";
    const expectedSku = process.env.TOSS_REPORT_SKU?.trim() || "ait.0000037018.4b1ec874.bbc410aefe.5308190597";
    if (!validStatus || order.sku !== expectedSku) {
      return NextResponse.json({ error: "PAYMENT_NOT_VERIFIED" }, { status: 402 });
    }
  } catch (error) {
    console.error("[ai/welfare-report] order verification failed", error);
    return NextResponse.json({ error: "PAYMENT_VERIFICATION_FAILED" }, { status: 503 });
  }

  pruneOrders();
  const existing = recentOrders.get(orderId);
  if (existing?.report) return NextResponse.json(existing.report, { headers: { "Cache-Control": "no-store" } });
  if (existing) return NextResponse.json({ error: "ORDER_PROCESSING" }, { status: 409 });
  recentOrders.set(orderId, { createdAt: Date.now() });

  try {
    const policies = [...CURATED_POLICIES, ...(await fetchExternalPolicies())]
      .sort((a, b) => scorePolicy(b, body) - scorePolicy(a, body))
      .slice(0, 35)
      .map((policy) => ({ id: policy.id, title: policy.title, agency: policy.agency, region: policy.region, category: policy.category, summary: policy.summary, benefit: policy.benefit, eligibility: policy.eligibility, howTo: policy.howTo, deadline: policy.deadline, isAlwaysOpen: policy.isAlwaysOpen, url: policy.url, updatedAt: policy.updatedAt }));

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6",
        instructions: "당신은 한국 복지제도 실무 경험이 풍부한 전문 상담사입니다. 결과는 모바일에서 정책별 카드로 읽기 쉽게 사용할 수 있도록 항목을 짧고 구체적으로 작성하세요. 제공된 후보 정책만 추천하고 존재하지 않는 금액·기한·서류·주소를 만들어내지 마세요. 정보가 없으면 '공식 공고 확인 필요'라고 명시하세요. 자격은 확정하지 말고 일치·추가확인·불일치 가능성으로 평가하세요. 각 정책마다 판단 근거, 예상 혜택, 자격 확인 항목, 준비서류, 단계별 신청 절차, 신청 장소 또는 온라인 접수처, 기한, 중복수급·탈락 위험을 구분하세요. 입력된 개인정보는 불필요하게 반복하지 마세요. 문체는 전문적이되 이해하기 쉬운 해요체를 사용하세요.",
        input: JSON.stringify({ user: { details, age: body.filters?.age, region: body.filters?.region, category: body.filters?.category, gender: body.tossData?.gender, nationality: body.tossData?.nationality, ...body.profile }, candidatePolicies: policies }),
        text: {
          format: {
            type: "json_schema",
            name: "welfare_report",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["title", "generatedFor", "executiveSummary", "profileAnalysis", "priorityStrategy", "actionPlan", "generalCautions", "recommendations"],
              properties: {
                title: { type: "string" },
                generatedFor: { type: "string" },
                executiveSummary: { type: "string" },
                profileAnalysis: { type: "array", minItems: 3, maxItems: 7, items: { type: "object", additionalProperties: false, required: ["label", "assessment"], properties: { label: { type: "string" }, assessment: { type: "string" } } } },
                priorityStrategy: { type: "string" },
                actionPlan: { type: "array", minItems: 3, maxItems: 7, items: { type: "string" } },
                generalCautions: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
                recommendations: { type: "array", minItems: 2, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["policyId", "title", "agency", "fit", "fitReason", "benefitEstimate", "eligibilityChecks", "requiredDocuments", "applicationSteps", "applicationLocation", "deadline", "risks", "url"], properties: {
                  policyId: { type: "string" }, title: { type: "string" }, agency: { type: "string" },
                  fit: { type: "string", enum: ["높음", "추가 확인", "낮음"] },
                  fitReason: { type: "string" }, benefitEstimate: { type: "string" }, applicationLocation: { type: "string" }, deadline: { type: "string" }, url: { type: "string" },
                  eligibilityChecks: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
                  requiredDocuments: { type: "array", minItems: 1, maxItems: 7, items: { type: "string" } },
                  applicationSteps: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
                  risks: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } }
                } } },
              },
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`OPENAI_${response.status}`);
    const payload = await response.json();
    const outputText = getOutputText(payload);
    if (!outputText) throw new Error("EMPTY_REPORT");
    const report = JSON.parse(outputText) as unknown;
    recentOrders.set(orderId, { createdAt: Date.now(), report });
    try {
      await saveUserReport(session.profile.userKey, { orderId, createdAt: new Date().toISOString(), report });
    } catch (storeError) {
      console.error("[ai/welfare-report] persistent save failed", storeError);
    }
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    recentOrders.delete(orderId);
    console.error("[ai/welfare-report] failed", error);
    return NextResponse.json({ error: "REPORT_GENERATION_FAILED" }, { status: 500 });
  }
}
