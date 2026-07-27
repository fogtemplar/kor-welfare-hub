import { appLogin, getConsentedUserData, openURL, SafeAreaInsets, Storage } from "@apps-in-toss/web-framework";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "https://kor-welfare-hub.vercel.app";
const PAGE_SIZE = 30;
const SAVED_KEY = "kor-welfare-hub:ait:saved:v1";
const USER_DATA_KEY = import.meta.env.VITE_TOSS_USER_DATA_KEY?.trim() || "cud_61f829e0613c4f1296aa2d8386f7d34d";

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
};

type PoliciesResponse = {
  count: number;
  total: number;
  hasMore: boolean;
  items: Policy[];
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
  const [profile, setProfile] = useState<TossProfile | null>(null);
  const [consentedData, setConsentedData] = useState<ConsentedData | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loginAvailable, setLoginAvailable] = useState(false);

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

  const visibleItems = useMemo(
    () => (savedOnly ? items.filter((policy) => saved.has(policy.id)) : items),
    [items, saved, savedOnly],
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
      const message = reason instanceof Error ? reason.message : "";
      setAuthError(message.includes("NOT_CONFIGURED") ? "로그인 서버 설정을 완료한 뒤 사용할 수 있어요." : "토스 로그인을 완료하지 못했어요.");
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
    } catch {
      setAuthError("동의가 취소됐거나 사용자 정보를 불러오지 못했어요.");
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

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="account-row">
          <span className="eyebrow">정부 혜택 {total.toLocaleString()}개 통합</span>
          <div className="account-actions">
            <button className="user-data-button" onClick={() => consentedData ? setAccountOpen(true) : void handleUserData()} disabled={authLoading}>
              {consentedData ? "내 정보" : "맞춤 찾기"}
            </button>
            {(loginAvailable || profile) && (
              <button className="account-button" onClick={() => profile ? setAccountOpen(true) : void handleTossLogin()} disabled={authLoading}>
                {profile ? `${profile.name || "토스 사용자"}님` : authLoading ? "연결 중…" : "토스 로그인"}
              </button>
            )}
          </div>
        </div>
        <h1>내가 받을 수 있는 혜택을<br />빠르게 찾아보세요</h1>
        <p>복지로·정부24·청년정책을 한곳에서 확인할 수 있어요.</p>
      </header>

      {authError && <div className="network-banner auth-error" role="alert">{authError}</div>}
      {consentedData && <div className="personalized-banner" role="status">{age !== null ? `${age}세` : "내 정보"}{region !== "전국" ? ` · ${region}` : ""} 기준으로 혜택을 찾고 있어요.</div>}

      {!online && <div className="network-banner" role="status">오프라인 상태예요. 연결되면 다시 시도해 주세요.</div>}

      <section className="search-panel" aria-label="혜택 검색">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="월세, 청년, 출산처럼 검색해 보세요"
          />
        </label>
        <select value={region} onChange={(event) => changeRegion(event.target.value)}>
          {regions.map((item) => <option key={item}>{item}</option>)}
        </select>
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
        <strong>{savedOnly ? `저장한 혜택 ${visibleItems.length}건` : `${count.toLocaleString()}건의 혜택`}</strong>
        <button aria-pressed={savedOnly} className={savedOnly ? "saved-filter active" : "saved-filter"} onClick={() => setSavedOnly((value) => !value)}>
          ♥ 저장 {saved.size}
        </button>
      </div>

      {error && (
        <div className="notice error" role="alert">
          <span>{error}</span>
          <button onClick={() => setRetryNonce((value) => value + 1)}>다시 시도</button>
        </div>
      )}
      {loading && page === 0 ? (
        <div className="skeleton-list" aria-label="혜택을 불러오는 중" aria-busy="true">
          {[0, 1, 2].map((item) => <div className="skeleton" key={item} />)}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="notice">조건에 맞는 혜택이 없어요.</div>
      ) : (
        <section className="policy-list">
          {visibleItems.map((policy) => (
            <article className="policy-card" key={policy.id}>
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
                <small>{policy.agency}</small>
              </button>
            </article>
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
            <p className="external-note">공공기관의 공식 페이지가 외부 브라우저에서 열려요.</p>
            <button className="apply-button" onClick={() => void openExternal(selected.url)}>공식 기관 페이지 열기</button>
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
              {(consentedData?.USER_GENDER || profile?.gender) && <ProfileItem label="성별" value={consentedData?.USER_GENDER || profile?.gender || ""} />}
              {consentedData?.USER_ADDRESS && <ProfileItem label="주소" value={consentedData.USER_ADDRESS} />}
              {(consentedData?.USER_EMAIL || profile?.email) && <ProfileItem label="이메일" value={consentedData?.USER_EMAIL || profile?.email || ""} />}
            </div>
            <button className="apply-button" disabled={authLoading} onClick={() => void handleUserData()}>내 정보 다시 불러오기</button>
            {profile && <button className="logout-button" disabled={authLoading} onClick={() => void handleLogout()}>로그아웃 및 연결 끊기</button>}
          </section>
        </div>
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
            <DetailBlock title="문의" text="개인정보 관련 문의: fogtemplar@gmail.com" />
          </>
        ) : (
          <>
            <DetailBlock title="서비스 성격" text="나라가쏜다는 정부·지자체의 공개 정책 정보를 정리한 비공식 안내 서비스예요. 지원 자격이나 지급을 판정·보장하지 않아요." />
            <DetailBlock title="정보 확인" text="공공기관의 변경 사항이 반영되기까지 시차가 있을 수 있어요. 신청 조건, 금액, 마감일은 반드시 공식 기관 페이지에서 최종 확인해 주세요." />
            <DetailBlock title="외부 페이지" text="공식 기관 페이지를 열면 해당 기관의 이용약관과 개인정보처리방침이 적용돼요." />
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

export default App;
