import { openURL } from "@apps-in-toss/web-framework";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "https://kor-welfare-hub.vercel.app";
const PAGE_SIZE = 30;
const SAVED_KEY = "kor-welfare-hub:ait:saved:v1";

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
  ["health", "의료"],
  ["lowincome", "긴급·생계"],
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
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Policy[]>([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Policy | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });

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
        setError("혜택 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [category, debouncedQuery, page, region]);

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

  const toggleSaved = (id: string) => {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
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

  return (
    <main className="app-shell">
      <header className="hero">
        <span className="eyebrow">정부 혜택 {total.toLocaleString()}개 통합</span>
        <h1>내가 받을 수 있는 혜택을<br />빠르게 찾아보세요</h1>
        <p>복지로·정부24·청년정책을 한곳에서 확인할 수 있어요.</p>
      </header>

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
            onClick={() => changeCategory(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="list-heading">
        <strong>{savedOnly ? `저장한 혜택 ${visibleItems.length}건` : `${count.toLocaleString()}건의 혜택`}</strong>
        <button className={savedOnly ? "saved-filter active" : "saved-filter"} onClick={() => setSavedOnly((value) => !value)}>
          ♥ 저장 {saved.size}
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}
      {loading && page === 0 ? (
        <div className="skeleton-list" aria-label="불러오는 중">
          {[0, 1, 2].map((item) => <div className="skeleton" key={item} />)}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="notice">조건에 맞는 혜택이 없어요.</div>
      ) : (
        <section className="policy-list">
          {visibleItems.map((policy) => (
            <article className="policy-card" key={policy.id} onClick={() => setSelected(policy)}>
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
              <h2>{policy.title}</h2>
              <p>{policy.summary || policy.benefit}</p>
              <small>{policy.agency}</small>
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
          <button onClick={() => void openExternal(`${API_BASE}/terms`)}>이용약관</button>
          <button onClick={() => void openExternal(`${API_BASE}/privacy`)}>개인정보처리방침</button>
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
            <button className="apply-button" onClick={() => void openExternal(selected.url)}>공식 페이지에서 확인</button>
          </section>
        </div>
      )}
    </main>
  );
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return <div className="detail-block"><h3>{title}</h3><p>{text}</p></div>;
}

export default App;
