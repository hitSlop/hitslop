import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../convex";

const searchQuery = (term: string) => convexQuery(api.catalog.search, { term, limit: 36 });

export const Route = createFileRoute("/")({ component: Catalog });

function Catalog() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("All");
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 180);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return <main className="catalog-shell" id="main-content">
    <a className="skip-link" href="#templates">Skip to templates</a>
    <header className="masthead">
      <a className="wordmark" href="/" aria-label="hitSlop home"><span className="brand-mark">✦</span>hitSlop</a>
      <nav aria-label="Primary"><a href="#templates">Browse</a><a className="build-link" href="https://github.com/longtaillabs/hitslop">Build a slop <span aria-hidden="true">↗</span></a></nav>
    </header>

    <section className="search-stage" aria-labelledby="hero-title">
      <div className="search-glow search-glow-blue" /><div className="search-glow search-glow-pink" />
      <div className="hero-copy"><p className="eyebrow">Tiny apps · local data · yours to keep</p><h1 id="hero-title">What are you working on?</h1><p className="hero-note">Pick a small tool, save it anywhere, and keep the data on your Mac.</p></div>
      <label className="search-box">
        <span className="visually-hidden">Search templates</span><span className="search-icon" aria-hidden="true">⌕</span>
        <input ref={search} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="A timer, an invoice, a strange little tool…" />
        {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button> : <kbd>⌘ K</kbd>}
      </label>
      <Suspense fallback={<div className="category-skeleton" aria-hidden="true" />}>
        <Categories term={term} category={category} onChange={setCategory} />
      </Suspense>
    </section>

    <Suspense fallback={<CatalogSkeleton />}>
      <Shelf query={query} term={term} category={category} />
    </Suspense>

    <footer><a className="wordmark" href="/">hitSlop</a><p>Small software for the thing in front of you.</p><span>Local-first on macOS · Open source</span></footer>
  </main>;
}

function Categories({ term, category, onChange }: { term: string; category: string; onChange: (value: string) => void }) {
  const { data: templates } = useSuspenseQuery(searchQuery(term));
  const categories = useMemo(() => ["All", ...new Set(templates.flatMap((item) => item.categories))], [templates]);
  return <div className="categories" aria-label="Template categories">{categories.map((item) => <button type="button" aria-pressed={item === category} className={item === category ? "active" : ""} onClick={() => onChange(item)} key={item}>{item}</button>)}</div>;
}

function Shelf({ query, term, category }: { query: string; term: string; category: string }) {
  const { data: templates } = useSuspenseQuery(searchQuery(term));
  const visible = templates.filter((item) => category === "All" || item.categories.includes(category));
  return <section className="shelf" id="templates" aria-live="polite">
    <div className="section-heading"><div><p className="eyebrow">The collection</p><h2>{query ? "Search results" : category === "All" ? "Popular right now" : category}</h2></div><p>{visible.length} {visible.length === 1 ? "template" : "templates"}</p></div>
    {visible.length ? <div className="template-grid">{visible.map((item) => <article className="template-card" key={item._id}>
      <a className="template-preview" href={item.currentReleaseId ? `/api/download/${item.currentReleaseId}` : undefined} aria-label={item.currentReleaseId ? `Download ${item.title}` : item.title}>
        {item.currentScreenshotKey ? <img src={`/api/artifact?key=${encodeURIComponent(item.currentScreenshotKey)}`} alt={`Preview of ${item.title}`} /> : <span className="preview-fallback" aria-hidden="true">✦</span>}
        <span className="preview-badge">CATALOG</span>{item.currentReleaseId && <span className="preview-action">Get <span aria-hidden="true">↓</span></span>}
      </a>
      <div className="template-copy"><div className="template-title"><h3>{item.title}</h3><span className="favorite-count" title={`${item.favorites} favorites`}>☆ {item.favorites}</span></div><p>{item.description}</p><span className="template-categories">{item.categories.join(" · ")}</span></div>
    </article>)}</div> : <div className="empty-state"><span aria-hidden="true">⌕</span><div><h3>No tiny tools found</h3><p>Try a broader word or choose another category.</p></div></div>}
  </section>;
}

function CatalogSkeleton() {
  return <section className="shelf" aria-label="Loading templates"><div className="section-heading"><div className="skeleton skeleton-title" /></div><div className="template-grid">{[0, 1, 2, 3].map((item) => <div className="template-card" key={item}><div className="skeleton skeleton-preview" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-copy" /></div>)}</div></section>;
}
