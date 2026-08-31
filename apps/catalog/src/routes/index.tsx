import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import { api } from "../convex";

const searchQuery = (term: string, category: string) => convexQuery(api.catalog.search, { term, ...(category === "all" ? {} : { category }), limit: 36 });
const categories = [
  ["all", "All"],
  ["productivity", "Productivity"],
  ["utilities", "Utilities"],
  ["finance", "Finance"],
  ["media", "Media"],
  ["games", "Games"],
  ["developer-tools", "Developer Tools"],
  ["education", "Education"],
  ["business", "Business"],
  ["personal", "Personal"],
  ["other", "Other"],
] as const;
const categoryLabel = (id: string): string => categories.find(([value]) => value === id)?.[1] ?? id;

export const Route = createFileRoute("/")({ component: Catalog });

function Catalog() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");
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
      <Categories category={category} onChange={setCategory} />
    </section>

    <Suspense fallback={<CatalogSkeleton />}>
      <Shelf query={query} term={term} category={category} />
    </Suspense>

    <footer><a className="wordmark" href="/">hitSlop</a><p>Small software for the thing in front of you.</p><span>Local-first on macOS · Open source</span></footer>
  </main>;
}

function Categories({ category, onChange }: { category: string; onChange: (value: string) => void }) {
  return <div className="categories" aria-label="Template categories">{categories.map(([id, label]) => <button type="button" aria-pressed={id === category} className={id === category ? "active" : ""} onClick={() => onChange(id)} key={id}>{label}</button>)}</div>;
}

function Shelf({ query, term, category }: { query: string; term: string; category: string }) {
  const { data: visible } = useSuspenseQuery(searchQuery(term, category));
  return <section className="shelf" id="templates" aria-live="polite">
    <div className="section-heading"><div><p className="eyebrow">The collection</p><h2>{query ? "Search results" : category === "all" ? "Popular right now" : categoryLabel(category)}</h2></div><p>{visible.length} {visible.length === 1 ? "template" : "templates"}</p></div>
    {visible.length ? <div className="template-grid">{visible.map((item) => <article className="template-card" key={item._id}>
      <a className="template-preview" href={item.currentReleaseId ? `/api/download/${item.currentReleaseId}` : undefined} aria-label={item.currentReleaseId ? `Download ${item.title}` : item.title}>
        {item.currentPreviewKey ? <img src={`/api/artifact?key=${encodeURIComponent(item.currentPreviewKey)}`} alt={`Preview of ${item.title}`} /> : <span className="preview-fallback" aria-hidden="true">✦</span>}
        <span className="preview-badge">CATALOG</span>{item.currentReleaseId && <span className="preview-action">Get <span aria-hidden="true">↓</span></span>}
      </a>
      <div className="template-copy"><div className="template-title"><h3>{item.title}</h3><span className="creation-count" title={`${item.creations} documents created`}>{item.creations} created</span></div><p>{item.description}</p><span className="template-categories">{item.categories.map(categoryLabel).join(" · ")}</span></div>
    </article>)}</div> : <div className="empty-state"><span aria-hidden="true">⌕</span><div><h3>No tiny tools found</h3><p>Try a broader word or choose another category.</p></div></div>}
  </section>;
}

function CatalogSkeleton() {
  return <section className="shelf" aria-label="Loading templates"><div className="section-heading"><div className="skeleton skeleton-title" /></div><div className="template-grid">{[0, 1, 2, 3].map((item) => <div className="template-card" key={item}><div className="skeleton skeleton-preview" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-copy" /></div>)}</div></section>;
}
