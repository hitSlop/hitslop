import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

type Template = { _id: string; slug: string; title: string; description: string; categories: string[]; installs: number; favorites: number; currentReleaseId?: string };
const fallback: Template[] = [
  { _id: "focus", slug: "focus-timer", title: "Focus Timer", description: "A quiet timer for getting one thing finished.", categories: ["Productivity"], installs: 0, favorites: 0 },
  { _id: "invoice", slug: "invoice", title: "Invoice", description: "Make a clear invoice without adopting an accounting platform.", categories: ["Finance"], installs: 0, favorites: 0 },
  { _id: "kanban", slug: "kanban-board", title: "Kanban Board", description: "A compact board that keeps project state in one local file.", categories: ["Productivity"], installs: 0, favorites: 0 },
  { _id: "picker", slug: "random-picker", title: "Random Picker", description: "Make an indecisive moment pleasantly final.", categories: ["Utilities"], installs: 0, favorites: 0 },
];

export const Route = createFileRoute("/")({ component: Catalog });

function Catalog() {
  const [query, setQuery] = useState(""); const [templates, setTemplates] = useState<Template[]>(fallback); const [category, setCategory] = useState("All");
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => { fetch(`/api/catalog?term=${encodeURIComponent(query)}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((value) => { if (Array.isArray(value) && (value.length || query)) setTemplates(value as Template[]); }).catch(() => undefined); }, 180); return () => { clearTimeout(timer); controller.abort(); }; }, [query]);
  const categories = useMemo(() => ["All", ...new Set(templates.flatMap((item) => item.categories))], [templates]);
  const visible = templates.filter((item) => category === "All" || item.categories.includes(category));
  return <main className="catalog-shell">
    <header className="masthead"><a className="wordmark" href="/">hitSlop<span>●</span></a><nav><a href="#popular">Browse</a><a href="https://github.com/longtaillabs/hitslop">Build a slop</a></nav></header>
    <section className="search-stage"><p className="eyebrow">Tiny apps. Local data. Yours to keep.</p><h1>What are you<br />working on?</h1>
      <label className="search-box"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="A timer, an invoice, a strange little tool…" /><kbd>⌘ K</kbd></label>
      <div className="categories" aria-label="Categories">{categories.map((item) => <button className={item === category ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
    </section>
    <section className="shelf" id="popular"><div className="section-heading"><div><p className="eyebrow">The shelf</p><h2>{query ? "Matches" : "Popular right now"}</h2></div><p>{visible.length.toString().padStart(2, "0")} small tools</p></div>
      <div className="template-list">{visible.map((item, index) => <article className="template-row" key={item._id}><span className="index">{String(index + 1).padStart(2, "0")}</span><div className={`specimen specimen-${index % 4}`}><span>{item.title.slice(0, 1)}</span></div><div className="template-copy"><p>{item.categories.join(" · ")}</p><h3>{item.title}</h3><span>{item.description}</span></div><div className="template-meta"><span>{item.favorites} saved</span>{item.currentReleaseId ? <a href={`/api/download/${item.currentReleaseId}`}>Download ↘</a> : <span>Coming soon</span>}</div></article>)}</div>
    </section>
    <footer><p>Small software for the rest of us.</p><span>Local-first on macOS · Open source</span></footer>
  </main>;
}
