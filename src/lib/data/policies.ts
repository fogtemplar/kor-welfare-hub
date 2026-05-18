import type { Policy } from "@/lib/types";

// 큐레이션 데이터 비활성화 — 정부 API(복지로·온통청년·K-Startup)에서 직접 가져옵니다.
// 필요 시 이 배열에 항목 추가하면 자동으로 합쳐집니다.
export const CURATED_POLICIES: Policy[] = [];
