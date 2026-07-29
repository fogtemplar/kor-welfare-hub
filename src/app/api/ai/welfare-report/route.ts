import { NextResponse } from "next/server";
import { CURATED_POLICIES } from "@/lib/data/policies";
import { fetchExternalPolicies } from "@/lib/scrapers/aggregate";
import type { Policy } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ReportRequest = {
  orderId?: string;
  details?: string;
  filters?: { age?: number | null; region?: string; category?: string };
  tossData?: { gender?: string; nationality?: string };
};

const recentOrders = new Map<string, number>();
const ORDER_TTL_MS = 24 * 60 * 60 * 1000;

function pruneOrders() {
  const cutoff = Date.now() - ORDER_TTL_MS;
  for (const [id, createdAt] of recentOrders) if (createdAt < cutoff) recentOrders.delete(id);
}

function scorePolicy(policy: Policy, request: ReportRequest): number {
  const text = `${policy.title} ${policy.summary} ${policy.benefit} ${policy.eligibility}`.toLowerCase();
  const terms = String(request.details || "").toLowerCase().split(/[^0-9a-z가-힣]+/).filter((term) => term.length >= 2);
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

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI_REPORT_NOT_CONFIGURED" }, { status: 503 });

  let body: ReportRequest;
  try { body = await request.json() as ReportRequest; }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }

  const orderId = String(body.orderId || "").trim();
  const details = String(body.details || "").trim();
  if (orderId.length < 8 || details.length < 10 || details.length > 700) return NextResponse.json({ error: "INVALID_REPORT_REQUEST" }, { status: 400 });
  if (/\d{6}\s*-?\s*[1-4]\d{6}/.test(details)) return NextResponse.json({ error: "주민등록번호는 입력할 수 없어요." }, { status: 400 });

  pruneOrders();
  if (recentOrders.has(orderId)) return NextResponse.json({ error: "ORDER_ALREADY_PROCESSED" }, { status: 409 });
  recentOrders.set(orderId, Date.now());

  try {
    const policies = [...CURATED_POLICIES, ...(await fetchExternalPolicies())]
      .sort((a, b) => scorePolicy(b, body) - scorePolicy(a, body))
      .slice(0, 35)
      .map((policy) => ({ id: policy.id, title: policy.title, agency: policy.agency, region: policy.region, category: policy.category, summary: policy.summary, benefit: policy.benefit, eligibility: policy.eligibility, howTo: policy.howTo, url: policy.url, updatedAt: policy.updatedAt }));

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6",
        instructions: "당신은 한국 복지 정책 안내 도우미입니다. 제공된 후보 정책만 추천하고 자격을 확정적으로 단정하지 마세요. 사용자가 당장 확인할 순서와 준비할 내용을 간결한 한국어 해요체로 작성하세요. 입력에 포함된 개인정보를 답변에 불필요하게 반복하지 마세요.",
        input: JSON.stringify({ user: { details, age: body.filters?.age, region: body.filters?.region, category: body.filters?.category, gender: body.tossData?.gender, nationality: body.tossData?.nationality }, candidatePolicies: policies }),
        text: {
          format: {
            type: "json_schema",
            name: "welfare_report",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["title", "summary", "actionPlan", "cautions", "recommendations"],
              properties: {
                title: { type: "string" }, summary: { type: "string" },
                actionPlan: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
                cautions: { type: "array", maxItems: 4, items: { type: "string" } },
                recommendations: { type: "array", minItems: 1, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["policyId", "title", "agency", "reason", "nextStep", "url"], properties: { policyId: { type: "string" }, title: { type: "string" }, agency: { type: "string" }, reason: { type: "string" }, nextStep: { type: "string" }, url: { type: "string" } } } },
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
    return NextResponse.json(JSON.parse(outputText), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    recentOrders.delete(orderId);
    console.error("[ai/welfare-report] failed", error);
    return NextResponse.json({ error: "REPORT_GENERATION_FAILED" }, { status: 500 });
  }
}
