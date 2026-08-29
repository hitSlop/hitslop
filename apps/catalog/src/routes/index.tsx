import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api } from "../convex";

const searchQuery = (term: string) => convexQuery(api.catalog.search, { term, limit: 36 });

export const Route = createFileRoute("/")({
  component: Catalog,
});

function Catalog() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("All");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 180);
    return () => clearTimeout(timer);
  }, [query]);
  return <main className="catalog-shell">
    <header className="masthead"><a className="wordmark" href="/">hitSlop<span>●</span></a><nav><a href="#popular">Browse</a><a href="https://github.com/longtaillabs/hitslop">Build a slop</a></nav></header>
    <section className="search-stage"><p className="eyebrow">Tiny apps. Local data. Yours to keep.</p><h1>What are you<br />working on?</h1>
      <label className="search-box"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="A timer, an invoice, a strange little tool…" /><kbd>⌘ K</kbd></label>
      <Suspense fallback={<div className="categories" aria-hidden="true" />}>
        <Categories term={term} category={category} onChange={setCategory} />
      </Suspense>
    </section>
    <Suspense fallback={<section className="shelf" id="popular"><p className="eyebrow">Loading the shelf…</p></section>}>
      <Shelf query={query} term={term} category={category} />
    </Suspense>
    <footer><p>Small software for the rest of us.</p><span>Local-first on macOS · Open source</span></footer>
  </main>;
}

function Categories({ term, category, onChange }: { term: string; category: string; onChange: (value: string) => void }) {
  const { data: templates } = useSuspenseQuery(searchQuery(term));
  const categories = useMemo(() => ["All", ...new Set(templates.flatMap((item) => item.categories))], [templates]);
  return <div className="categories" aria-label="Categories">{categories.map((item) => <button className={item === category ? "active" : ""} onClick={() => onChange(item)} key={item}>{item}</button>)}</div>;
}

function Shelf({ query, term, category }: { query: string; term: string; category: string }) {
  const { data: templates } = useSuspenseQuery(searchQuery(term));
  const visible = templates.filter((item) => category === "All" || item.categories.includes(category));
  return <section className="shelf" id="popular"><div className="section-heading"><div><p className="eyebrow">The shelf</p><h2>{query ? "Matches" : "Popular right now"}</h2></div><p>{visible.length.toString().padStart(2, "0")} small tools</p></div>
    <div className="template-list">{visible.map((item, index) => <article className="template-row" key={item._id}><span className="index">{String(index + 1).padStart(2, "0")}</span><div className={`specimen specimen-${index % 4}`}>{item.currentScreenshotKey ? <img src={`/api/artifact?key=${encodeURIComponent(item.currentScreenshotKey)}`} alt="" /> : <span>{item.title.slice(0, 1)}</span>}</div><div className="template-copy"><p>{item.categories.join(" · ")}</p><h3>{item.title}</h3><span>{item.description}</span></div><div className="template-meta"><span>{item.favorites} saved</span>{item.currentReleaseId ? <a href={`/api/download/${item.currentReleaseId}`}>Download ↘</a> : <span>Coming soon</span>}</div></article>)}</div>
  </section>;
}
