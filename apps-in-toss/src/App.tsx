import { appLogin, getConsentedUserData, IAP, openURL, SafeAreaInsets, Storage } from "@apps-in-toss/web-framework";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import "./App.css";

const TdsExternalDialog = lazy(() => import("./TdsExternalDialog"));
const TossBannerAd = lazy(() => import("./TossBannerAd"));

const API_BASE = "https://kor-welfare-hub.vercel.app";
const BRAND_ICON = "https://static.toss.im/appsintoss/45571/324cf347-98a8-46be-b3b5-c9ee5aec737d.png";
const PAGE_SIZE = 30;
const SAVED_KEY = "kor-welfare-hub:ait:saved:v1";
const USER_DATA_KEY = import.meta.env.VITE_TOSS_USER_DATA_KEY?.trim() || "cud_61f829e0613c4f1296aa2d8386f7d34d";
const REPORT_SKU = import.meta.env.VITE_TOSS_REPORT_SKU?.trim() || "ait.0000037018.4b1ec874.bbc410aefe.5308190597";

type WelfareReport = {
  title: string;
  summary: string;
  actionPlan: string[];
  cautions: string[];
  recommendations: Array<{ policyId: string; title: string; agency: string; reason: string; nextStep: string; url: string }>;
};

type ReportProfile = {
  household: string;
  housing: string;
  statuses: string[];
  incomePct: string;
  childrenCount: string;
  youngestChildAge: string;
  pregnant: boolean;
  hasDisability: boolean;
};

const EMPTY_REPORT_PROFILE: ReportProfile = { household: "", housing: "", statuses: [], incomePct: "", childrenCount: "0", youngestChildAge: "", pregnant: false, hasDisability: false };
const HOUSEHOLDS = [["single", "1인 가구"], ["couple", "부부"], ["newlywed", "신혼"], ["general", "일반 가구"], ["multi-child", "다자녀"], ["single-parent", "한부모"], ["multicultural", "다문화"]];
const HOUSINGS = [["own", "자가"], ["jeonse", "전세"], ["monthly", "월세"], ["with-family", "가족과 거주"], ["homeless", "주거 불안정"]];
const STATUSES = [["student", "대학(원)생"], ["jobseeker", "구직 중"], ["employed", "재직 중"], ["self-employed", "자영업·프리랜서"], ["preparing-startup", "창업 준비"], ["farmer", "농어업"], ["career-break", "경력단절·휴직"], ["retired", "은퇴"]];

type TossProfile = {
  userKey: number;
  name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  gender?: string | null;
  nationality?: string | null;
  email?: string | null;
};

type ConsentedData = Partial<Record<"USER_NAME" | "USER_GENDER" | "USER_NATIONALITY" | "USER_BIRTHDAY" | "USER_PHONE" | "USER_ADDRESS" | "USER_EMAIL", string>>;

type Policy = {
  id: string;
  title: string;
  agency: string;
  level: "national" | "metro" | "local";
  region?: string;
  category: string;
  summary: string;
  benefit: string;
  eligibility: string;
  howTo: string;
  url: string;
  updatedAt: string;
  deadline?: string;
  isAlwaysOpen?: boolean;
  tags?: string[];
  source?: string;
};

type PoliciesResponse = {
  count: number;
  total: number;
  hasMore: boolean;
  items: Policy[];
  generatedAt: string;
  lastUpdated: string | null;
  sources: Record<string, number>;
};

const SOURCE_LABELS: Record<string, string> = {
  bokjiro: "복지로",
  gov24: "정부24",
  youthcenter: "온통청년",
  worknet: "고용24",
  curated: "공공기관",
};

const categories = [
  ["all", "전체"],
  ["youth", "청년"],
  ["housing", "주거"],
  ["childcare", "육아"],
  ["employment", "취업"],
  ["startup", "창업"],
  ["education", "교육"],
  ["senior", "노인"],
  ["disability", "장애"],
  ["health", "의료"],
  ["lowincome", "긴급·생계"],
  ["farm", "농어업"],
  ["culture", "문화"],
  ["etc", "기타"],
] as const;

const regions = [
  "전국",
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

function App() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [region, setRegion] = useState("전국");
  const [age, setAge] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Policy[]>([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [selected, setSelected] = useState<Policy | null>(null);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savedItems, setSavedItems] = useState<Policy[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [profile, setProfile] = useState<TossProfile | null>(null);
  const [consentedData, setConsentedData] = useState<ConsentedData | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginAvailable, setLoginAvailable] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [externalTarget, setExternalTarget] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [report, setReport] = useState<WelfareReport | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportConsent, setReportConsent] = useState(false);
  const [reportProfile, setReportProfile] = useState<ReportProfile>(EMPTY_REPORT_PROFILE);

  useEffect(() => {
    fetch(`${API_BASE}/api/toss/session`, { credentials: "include" })
      .then((response) => response.ok ? response.json() : { profile: null })
      .then((data: { profile: TossProfile | null; configured?: boolean }) => {
        setProfile(data.profile);
        setLoginAvailable(Boolean(data.configured));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    const loadSaved = async () => {
      let value: string | null = null;
      try {
        value = await Storage.getItem(SAVED_KEY);
      } catch {
        value = localStorage.getItem(SAVED_KEY);
      }
      if (!active || !value) return;
      try {
        setSaved(new Set(JSON.parse(value) as string[]));
      } catch {
        // 손상된 저장값은 빈 목록으로 복구해요.
      }
    };
    void loadSaved();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const applyInsets = (insets: { top: number; right: number; bottom: number; left: number }) => {
      const root = document.documentElement;
      root.style.setProperty("--ait-safe-top", `${insets.top}px`);
      root.style.setProperty("--ait-safe-right", `${insets.right}px`);
      root.style.setProperty("--ait-safe-bottom", `${insets.bottom}px`);
      root.style.setProperty("--ait-safe-left", `${insets.left}px`);
    };
    try {
      applyInsets(SafeAreaInsets.get());
      return SafeAreaInsets.subscribe({ onEvent: applyInsets });
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      q: debouncedQuery,
      category,
      region,
    });
    if (age !== null) params.set("age", String(age));

    if (!navigator.onLine) {
      setOnline(false);
      setError("인터넷 연결을 확인해 주세요.");
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/policies?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as PoliciesResponse;
      })
      .then((data) => {
        setItems((current) => (page === 0 ? data.items : [...current, ...data.items]));
        setCount(data.count);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setGeneratedAt(data.generatedAt);
        setLastUpdated(data.lastUpdated);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(navigator.onLine ? "혜택 정보를 불러오지 못했어요." : "인터넷 연결을 확인해 주세요.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [age, category, debouncedQuery, page, region, retryNonce]);

  useEffect(() => {
    if (!savedOnly) return;
    if (saved.size === 0) {
      setSavedItems([]);
      return;
    }
    const controller = new AbortController();
    setSavedLoading(true);
    fetch(`${API_BASE}/api/policies/saved`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...saved] }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ items: Policy[] }>;
      })
      .then((data) => setSavedItems(data.items))
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setAuthError("저장한 혜택을 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSavedLoading(false);
      });
    return () => controller.abort();
  }, [saved, savedOnly]);

  const visibleItems = useMemo(
    () => (savedOnly ? savedItems : items),
    [items, savedItems, savedOnly],
  );

  const changeCategory = (next: string) => {
    setCategory(next);
    setPage(0);
  };

  const changeRegion = (next: string) => {
    setRegion(next);
    setPage(0);
  };

  const persistSaved = async (next: Set<string>) => {
    const value = JSON.stringify([...next]);
    try {
      await Storage.setItem(SAVED_KEY, value);
    } catch {
      localStorage.setItem(SAVED_KEY, value);
    }
  };

  const toggleSaved = (id: string) => {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void persistSaved(next);
      return next;
    });
  };

  const openExternal = async (url: string) => {
    try {
      await openURL(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleTossLogin = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const auth = await appLogin();
      const response = await fetch(`${API_BASE}/api/toss/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      });
      const data = await response.json() as { profile?: TossProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "LOGIN_FAILED");
      setProfile(data.profile);
      setAccountOpen(true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message.toLowerCase() : "";
      if (message.includes("not_configured")) {
        setAuthError("로그인 준비가 아직 끝나지 않았어요. 잠시 후 다시 시도해 주세요.");
      } else if (message.includes("cancel") || message.includes("declin") || message.includes("user_abort")) {
        setAuthError("토스 로그인을 취소했어요. 원할 때 다시 시도할 수 있어요.");
      } else if (!navigator.onLine || message.includes("fetch") || message.includes("network")) {
        setAuthError("인터넷 연결이 불안정해 로그인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
      } else {
        setAuthError("토스 로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUserData = async () => {
    if (!USER_DATA_KEY) {
      setAuthError("앱인토스 콘솔에서 유저정보 불러오기를 먼저 등록해 주세요.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const data = await getConsentedUserData({ consentedUserDataKey: USER_DATA_KEY, shouldRequestAgreementWhenUserDeclined: true });
      const next = (data || null) as ConsentedData | null;
      setConsentedData(next);
      if (next?.USER_BIRTHDAY && /^\d{8}$/.test(next.USER_BIRTHDAY)) {
        const birthYear = Number(next.USER_BIRTHDAY.slice(0, 4));
        const birthMonthDay = next.USER_BIRTHDAY.slice(4);
        const today = new Date();
        const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
        setAge(today.getFullYear() - birthYear - (todayMonthDay < birthMonthDay ? 1 : 0));
      }
      if (next?.USER_ADDRESS) {
        const matchedRegion = regions.find((item) => item !== "전국" && next.USER_ADDRESS?.includes(item.slice(0, 2)));
        if (matchedRegion) setRegion(matchedRegion);
      }
      setPage(0);
      setAccountOpen(true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message.toLowerCase() : "";
      if (message.includes("declin") || message.includes("cancel") || message.includes("denied")) {
        setAuthError("정보 제공에 동의하지 않았어요. 검색 조건을 직접 선택해도 모든 혜택을 확인할 수 있어요.");
      } else if (!navigator.onLine || message.includes("fetch") || message.includes("network")) {
        setAuthError("인터넷 연결이 불안정해 정보를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
      } else {
        setAuthError("토스 정보를 불러오지 못했어요. 잠시 후 다시 시도하거나 조건을 직접 선택해 주세요.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    try {
      await fetch(`${API_BASE}/api/toss/session`, { method: "DELETE", credentials: "include" });
    } finally {
      setProfile(null);
      setConsentedData(null);
      setAccountOpen(false);
      setAuthLoading(false);
    }
  };

  const resetPersonalization = () => {
    setConsentedData(null);
    setAge(null);
    setRegion("전국");
    setPage(0);
    setAccountOpen(false);
    setAuthError("");
  };

  const requestPaidReport = async () => {
    if (!reportConsent || !reportProfile.household || !reportProfile.housing || !reportProfile.incomePct) {
      setReportError("가구 유형, 주거 상황, 소득 구간을 선택하고 정보 처리에 동의해 주세요.");
      return;
    }
    setReportLoading(true);
    setReportError("");
    try {
      const catalog = await IAP.getProductItemList();
      const product = catalog?.products.find((item) => item.sku === REPORT_SKU);
      if (!product) {
        setReportError("토스 앱에서 결제 상품을 확인하지 못했어요. 최신 토스 앱에서 다시 시도해 주세요.");
        setReportLoading(false);
        return;
      }
      if (product.type !== "CONSUMABLE" || product.displayAmount.replace(/\D/g, "") !== "990") {
        setReportError("상품 설정을 확인하고 있어요. 잠시 후 다시 이용해 주세요.");
        setReportLoading(false);
        return;
      }
    } catch {
      setReportError("결제 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      setReportLoading(false);
      return;
    }
    let cleanup = () => undefined;
    cleanup = IAP.createOneTimePurchaseOrder({
      options: {
        sku: REPORT_SKU,
        processProductGrant: async ({ orderId }) => {
          try {
            const response = await fetch(`${API_BASE}/api/ai/welfare-report`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                details: reportDetails.trim(),
                filters: { age, region, category },
                profile: reportProfile,
                tossData: consentedData ? {
                  gender: consentedData.USER_GENDER,
                  nationality: consentedData.USER_NATIONALITY,
                } : undefined,
              }),
            });
            const data = await response.json() as WelfareReport & { error?: string };
            if (!response.ok) throw new Error(data.error || "REPORT_FAILED");
            setReport(data);
            return true;
          } catch {
            setReportError("결제는 완료됐지만 리포트를 만들지 못했어요. 고객센터로 문의해 주세요.");
            return false;
          }
        },
      },
      onEvent: () => {
        setReportLoading(false);
        cleanup();
      },
      onError: (reason) => {
        const message = reason instanceof Error ? reason.message.toLowerCase() : String(reason).toLowerCase();
        setReportLoading(false);
        if (message.includes("cancel") || message.includes("user_canceled")) {
          setReportError("결제를 취소했어요. 결제된 금액은 없어요.");
        } else if (message.includes("already_owned")) {
          setReportError("처리 중인 구매가 있어요. 잠시 후 다시 확인해 주세요.");
        } else {
          setReportError("결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
        cleanup();
      },
    });
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="account-row">
          <div className="brand-lockup">
            <img src={BRAND_ICON} alt="" />
            <div><strong>나라가쏜다</strong><span>내 복지 혜택 30초 검색</span></div>
          </div>
          <div className="account-actions">
            {(loginAvailable || profile) && (
              <button className="account-button" onClick={() => profile ? setAccountOpen(true) : void handleTossLogin()} disabled={authLoading}>
                {profile ? `${profile.name || "토스 사용자"}님` : authLoading ? "연결 중…" : "토스 로그인"}
              </button>
            )}
          </div>
        </div>
        <div className="hero-copy">
          <span className="eyebrow">정부 혜택 {total.toLocaleString()}개 통합</span>
          <h1>몰라서 못 받는 지원금,<br /><em>한 번에 찾아드려요</em></h1>
          <p>복지로·정부24·온통청년 정보를 내 조건에 맞춰 빠르게 확인하세요.</p>
          <button className="hero-personalize" onClick={() => consentedData ? setAccountOpen(true) : void handleUserData()} disabled={authLoading}>
            <span className="hero-personalize-icon" aria-hidden="true">✦</span>
            <span><strong>{consentedData ? "내 정보로 다시 맞춤 찾기" : "토스 정보로 맞춤 혜택 찾기"}</strong><small>직접 입력 없이 안전하게 불러와요</small></span>
            <b aria-hidden="true">›</b>
          </button>
        </div>
      </header>

      {authError && <div className="network-banner auth-error" role="alert">{authError}</div>}
      {consentedData && <div className="personalized-banner" role="status">{age !== null ? `${age}세` : "내 정보"}{region !== "전국" ? ` · ${region}` : ""} 기준으로 혜택을 찾고 있어요.</div>}

      {!online && <div className="network-banner" role="status">오프라인 상태예요. 연결되면 다시 시도해 주세요.</div>}

      <section className="search-panel" aria-label="혜택 검색">
        <label className="search-box">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="월세, 청년, 출산처럼 검색해 보세요"
          />
        </label>
        <label className="region-select"><span aria-hidden="true">⌖</span><select aria-label="지역 선택" value={region} onChange={(event) => changeRegion(event.target.value)}>
          {regions.map((item) => <option key={item}>{item}</option>)}
        </select><b aria-hidden="true">⌄</b></label>
      </section>

      <nav className="category-row" aria-label="혜택 분야">
        {categories.map(([key, label]) => (
          <button
            key={key}
            className={category === key ? "active" : ""}
            aria-pressed={category === key}
            onClick={() => changeCategory(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="list-heading">
        <div><span>{savedOnly ? "저장한 혜택" : "지금 확인할 수 있는 혜택"}</span><strong>{savedOnly ? `${saved.size}개` : `${count.toLocaleString()}개`}</strong></div>
        <button aria-pressed={savedOnly} className={savedOnly ? "saved-filter active" : "saved-filter"} onClick={() => setSavedOnly((value) => !value)}>
          ♥ 저장 {saved.size}
        </button>
      </div>
      <div className="data-freshness" role="status">
        <span>출처: 복지로 · 정부24 · 온통청년 · K-Startup</span>
        <span>최종 갱신 {formatUpdatedAt(generatedAt || lastUpdated)}</span>
      </div>

      <section className="paid-report-card">
        <div><span>AI 맞춤 분석</span><h2>나만의 복지 리포트</h2><p>가구·소득·직업 상황까지 반영해 신청 우선순위와 다음 행동을 정리해 드려요.</p></div>
        <button onClick={() => setReportOpen(true)}>1회 990원 <b>›</b></button>
      </section>

      {error && (
        <div className="notice error" role="alert">
          <span>{error}</span>
          <button onClick={() => setRetryNonce((value) => value + 1)}>다시 시도</button>
        </div>
      )}
      {(loading && page === 0) || (savedOnly && savedLoading) ? (
        <div className="skeleton-list" aria-label="혜택을 불러오는 중" aria-busy="true">
          {[0, 1, 2].map((item) => <div className="skeleton" key={item} />)}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="notice">조건에 맞는 혜택이 없어요.</div>
      ) : (
        <section className="policy-list">
          {visibleItems.map((policy, index) => (
            <Suspense key={policy.id} fallback={null}>
            {index === 9 && !savedOnly && <TossBannerAd />}
            <article className="policy-card">
              <div className="card-topline">
                <span>{policy.region || (policy.level === "national" ? "전국" : "지역")}</span>
                <button
                  className={saved.has(policy.id) ? "heart active" : "heart"}
                  aria-label={saved.has(policy.id) ? "저장 취소" : "혜택 저장"}
                  onClick={(event) => { event.stopPropagation(); toggleSaved(policy.id); }}
                >
                  ♥
                </button>
              </div>
              <button className="card-main" onClick={() => setSelected(policy)}>
                <h2>{policy.title}</h2>
                <p>{policy.summary || policy.benefit}</p>
                <div className="card-meta"><small>{policy.agency}</small><span aria-hidden="true">›</span></div>
              </button>
            </article>
            </Suspense>
          ))}
        </section>
      )}

      {!savedOnly && hasMore && (
        <button className="more-button" disabled={loading} onClick={() => setPage((value) => value + 1)}>
          {loading ? "불러오는 중…" : "혜택 더 보기"}
        </button>
      )}

      <footer>
        <p>공개 정책 정보를 모은 비공식 안내 서비스예요. 신청 전 공식 페이지에서 최신 조건을 확인해 주세요.</p>
        <div>
          <button onClick={() => setLegal("terms")}>이용약관</button>
          <button onClick={() => setLegal("privacy")}>개인정보처리방침</button>
        </div>
      </footer>

      {selected && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <section className="detail-sheet" role="dialog" aria-modal="true" aria-label={selected.title} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <button className="close-button" aria-label="닫기" onClick={() => setSelected(null)}>×</button>
            <span className="detail-agency">{selected.agency}</span>
            <h2>{selected.title}</h2>
            <DetailBlock title="지원 내용" text={selected.benefit || selected.summary} />
            <DetailBlock title="신청 대상" text={selected.eligibility} />
            <DetailBlock title="신청 방법" text={selected.howTo} />
            <div className="source-panel">
              <span>정보 출처</span>
              <strong>{SOURCE_LABELS[selected.source || ""] || selected.agency}</strong>
              <small>원문 갱신일 {selected.updatedAt || "확인 필요"}</small>
            </div>
            <p className="external-note">공공기관의 공식 페이지가 외부 브라우저에서 열려요.</p>
            <div className="tds-cta">
              <button className="tds-primary-button" onClick={() => setExternalTarget(selected.url)}>공식 기관 페이지 열기</button>
            </div>
          </section>
        </div>
      )}
      {legal && <LegalSheet kind={legal} onClose={() => setLegal(null)} />}
      {accountOpen && (profile || consentedData) && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAccountOpen(false)}>
          <section className="detail-sheet account-sheet" role="dialog" aria-modal="true" aria-label="내 정보" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <button className="close-button" aria-label="닫기" onClick={() => setAccountOpen(false)}>×</button>
            <h2>{profile?.name || consentedData?.USER_NAME || "토스 사용자"}님</h2>
            <p className="account-description">동의한 정보만 표시하며, 유저정보 불러오기 결과는 서버에 저장하지 않아요.</p>
            <div className="profile-grid">
              {(consentedData?.USER_BIRTHDAY || profile?.birthday) && <ProfileItem label="생년월일" value={consentedData?.USER_BIRTHDAY || profile?.birthday || ""} />}
              {consentedData?.USER_ADDRESS && <ProfileItem label="주소" value={consentedData.USER_ADDRESS} />}
            </div>
            <button className="apply-button" disabled={authLoading} onClick={() => void handleUserData()}>내 정보 다시 불러오기</button>
            {consentedData && <button className="reset-button" onClick={resetPersonalization}>맞춤 조건 초기화</button>}
            {profile && <button className="logout-button" disabled={authLoading} onClick={() => void handleLogout()}>로그아웃 및 연결 끊기</button>}
          </section>
        </div>
      )}
      {reportOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => !reportLoading && setReportOpen(false)}>
          <section className="detail-sheet report-sheet" role="dialog" aria-modal="true" aria-label="맞춤 복지 리포트" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <button className="close-button" aria-label="닫기" disabled={reportLoading} onClick={() => setReportOpen(false)}>×</button>
            <span className="detail-agency">AI 맞춤 분석 · 1회 이용권</span>
            <h2>내 상황에 맞는 복지를<br />우선순위로 정리해요</h2>
            {report ? (
              <div className="report-result">
                <h3>{report.title}</h3><p>{report.summary}</p>
                {report.recommendations.map((item, index) => <button key={`${item.policyId}-${index}`} onClick={() => setExternalTarget(item.url)}><b>{index + 1}. {item.title}</b><span>{item.reason}</span><small>{item.agency} · {item.nextStep}</small></button>)}
                <h4>지금 할 일</h4><ol>{report.actionPlan.map((item) => <li key={item}>{item}</li>)}</ol>
                <p className="report-disclaimer">AI가 공개 정보를 바탕으로 만든 참고 자료예요. 실제 자격과 신청 조건은 기관에서 최종 확인해 주세요.</p>
              </div>
            ) : (
              <>
                <p className="report-intro">정확한 추천을 위해 몇 가지만 알려주세요. 이름·전화번호·상세주소는 AI에 보내지 않아요.</p>
                <ReportChoice title="가구 유형" required options={HOUSEHOLDS} value={reportProfile.household} onChange={(value) => setReportProfile((current) => ({ ...current, household: value }))} />
                <ReportChoice title="주거 상황" required options={HOUSINGS} value={reportProfile.housing} onChange={(value) => setReportProfile((current) => ({ ...current, housing: value }))} />
                <div className="report-question"><strong>경제활동 상태 <small>복수 선택</small></strong><div className="report-chips">{STATUSES.map(([value, label]) => <button type="button" key={value} className={reportProfile.statuses.includes(value) ? "active" : ""} onClick={() => setReportProfile((current) => ({ ...current, statuses: current.statuses.includes(value) ? current.statuses.filter((item) => item !== value) : [...current.statuses, value] }))}>{label}</button>)}</div></div>
                <label className="report-select"><span>가구 기준 중위소득 구간 <b>*</b></span><select value={reportProfile.incomePct} onChange={(event) => setReportProfile((current) => ({ ...current, incomePct: event.target.value }))}><option value="">선택해 주세요</option><option value="50">50% 이하</option><option value="75">75% 이하</option><option value="100">100% 이하</option><option value="150">150% 이하</option><option value="250">250% 이하</option><option value="999">해당 없음·모름</option></select><small>정확하지 않아도 가장 가까운 구간을 선택하세요.</small></label>
                <div className="report-two-columns"><label className="report-select"><span>자녀 수</span><select value={reportProfile.childrenCount} onChange={(event) => setReportProfile((current) => ({ ...current, childrenCount: event.target.value, youngestChildAge: event.target.value === "0" ? "" : current.youngestChildAge }))}>{[0,1,2,3,4].map((count) => <option key={count} value={count}>{count}명{count === 4 ? " 이상" : ""}</option>)}</select></label><label className="report-select"><span>막내 만 나이</span><input type="number" min="0" max="25" disabled={reportProfile.childrenCount === "0"} value={reportProfile.youngestChildAge} onChange={(event) => setReportProfile((current) => ({ ...current, youngestChildAge: event.target.value }))} placeholder="예: 2" /></label></div>
                <div className="report-flags"><label><input type="checkbox" checked={reportProfile.pregnant} onChange={(event) => setReportProfile((current) => ({ ...current, pregnant: event.target.checked }))} /> 임신 중이에요</label><label><input type="checkbox" checked={reportProfile.hasDisability} onChange={(event) => setReportProfile((current) => ({ ...current, hasDisability: event.target.checked }))} /> 등록 장애인이에요</label></div>
                <label className="report-field"><span>가장 필요한 지원 <small>선택</small></span><textarea maxLength={700} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="예: 전세 보증금과 취업 준비 비용 지원을 우선 확인하고 싶어요." /><small>{reportDetails.length}/700</small></label>
                <label className="report-consent"><input type="checkbox" checked={reportConsent} onChange={(event) => setReportConsent(event.target.checked)} /><span>리포트 생성을 위해 입력한 정보가 OpenAI API로 전송되는 것에 동의해요. 생성 후 별도로 저장하지 않아요.</span></label>
                {reportError && <p className="report-error" role="alert">{reportError}</p>}
                <button className="tds-primary-button" disabled={reportLoading || !reportConsent || !reportProfile.household || !reportProfile.housing || !reportProfile.incomePct} onClick={() => void requestPaidReport()}>{reportLoading ? "결제 및 분석 중…" : "990원 결제하고 리포트 받기"}</button>
                <p className="payment-note">단건 결제 상품이며, 버튼을 누르면 토스 결제 화면이 열려요.</p>
              </>
            )}
          </section>
        </div>
      )}
      {externalTarget && (
        <Suspense fallback={<div className="dialog-loading" role="status">확인창을 준비하고 있어요.</div>}>
          <TdsExternalDialog
            onCancel={() => setExternalTarget(null)}
            onConfirm={() => {
              const url = externalTarget;
              setExternalTarget(null);
              void openExternal(url);
            }}
          />
        </Suspense>
      )}
    </main>
  );
}

function LegalSheet({ kind, onClose }: { kind: "terms" | "privacy"; onClose: () => void }) {
  const privacy = kind === "privacy";
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="detail-sheet legal-sheet" role="dialog" aria-modal="true" aria-label={privacy ? "개인정보처리방침" : "이용약관"} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <button className="close-button" aria-label="닫기" onClick={onClose}>×</button>
        <h2>{privacy ? "개인정보처리방침" : "이용약관"}</h2>
        {privacy ? (
          <>
            <DetailBlock title="기기에 저장되는 정보" text="저장한 혜택 목록은 앱인토스 기기 저장소에만 보관돼요. 운영자는 이 값을 확인할 수 없으며, 미니앱 데이터를 삭제하면 함께 지워져요." />
            <DetailBlock title="서버에서 처리되는 정보" text="정책 조회 과정의 접속 기록과, 토스 로그인 시 사용자가 동의한 식별키·프로필 정보를 로그인 및 맞춤 안내 목적으로 처리해요. 유저정보 불러오기 결과는 현재 화면에만 표시하고 서버에 저장하지 않아요." />
            <DetailBlock title="외부 서비스" text="정책 데이터 제공과 호스팅을 위해 Vercel 서버와 통신해요. 공식 신청 버튼을 누른 경우 선택한 공공기관 페이지로 이동해요." />
            <DetailBlock title="유료 AI 리포트" text="사용자가 별도로 동의하고 입력한 상황, 나이·지역·성별·내외국인 조건은 맞춤 복지 리포트 생성을 위해 OpenAI API로 전송돼요. 이름·전화번호·주소는 전송하지 않으며, 서비스 데이터베이스에 리포트 입력값과 결과를 별도로 저장하지 않아요." />
            <DetailBlock title="문의" text="개인정보 관련 문의: fogtemplar@gmail.com" />
          </>
        ) : (
          <>
            <DetailBlock title="서비스 성격" text="나라가쏜다는 정부·지자체의 공개 정책 정보를 정리한 비공식 안내 서비스예요. 지원 자격이나 지급을 판정·보장하지 않아요." />
            <DetailBlock title="정보 확인" text="공공기관의 변경 사항이 반영되기까지 시차가 있을 수 있어요. 신청 조건, 금액, 마감일은 반드시 공식 기관 페이지에서 최종 확인해 주세요." />
            <DetailBlock title="외부 페이지" text="공식 기관 페이지를 열면 해당 기관의 이용약관과 개인정보처리방침이 적용돼요." />
            <DetailBlock title="유료 서비스" text="맞춤 복지 리포트는 1회 990원의 소비성 인앱결제 상품이에요. 결제 완료 후 리포트 생성에 실패하면 상품 지급이 완료되지 않도록 처리하며, 결제·환불은 앱 마켓 및 앱인토스 정책을 따라요." />
            <DetailBlock title="문의" text="서비스 문의: fogtemplar@gmail.com" />
          </>
        )}
        <button className="more-button" onClick={() => void openExternal(`${API_BASE}/${privacy ? "privacy" : "terms"}`)}>전체 내용 보기</button>
      </section>
    </div>
  );
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return <div className="detail-block"><h3>{title}</h3><p>{text}</p></div>;
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function ReportChoice({ title, required, options, value, onChange }: { title: string; required?: boolean; options: string[][]; value: string; onChange: (value: string) => void }) {
  return <div className="report-question"><strong>{title}{required && <b> *</b>}</strong><div className="report-chips">{options.map(([key, label]) => <button type="button" key={key} className={value === key ? "active" : ""} onClick={() => onChange(key)}>{label}</button>)}</div></div>;
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return "확인 중";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default App;
