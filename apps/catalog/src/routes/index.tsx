import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import focusTimerPreview from "../../../../examples/slops/focus-timer/screenshots/preview.png";
import invoicePreview from "../../../../examples/slops/invoice/screenshots/preview.png";
import randomPickerPreview from "../../../../examples/slops/random-picker/screenshots/preview.png";
import { api } from "../convex";

const DOWNLOAD_URL = "https://github.com/hitslop/hitslop/releases/latest";
const REPOSITORY_URL = "https://github.com/hitslop/hitslop";
const AUTHORING_URL = "https://github.com/hitslop/hitslop/blob/main/docs/authoring.md";

const searchQuery = (term: string) => convexQuery(api.catalog.search, {
  term,
  limit: 50,
});

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

const featuredSlops = [
  { id: "focus", title: "Pomodoro", family: "Instrument", description: "A focused timer with local session history.", image: focusTimerPreview, alt: "Circular Pomodoro slop showing a 25 minute focus timer" },
  { id: "invoice", title: "Invoice", family: "Paper", description: "A precise document for line items, tax, and status.", image: invoicePreview, alt: "Invoice slop showing an invoice for Northwind Studio" },
  { id: "picker", title: "Random Picker", family: "Instrument", description: "A playful capsule for making one small decision.", image: randomPickerPreview, alt: "Blue capsule-shaped Random Picker slop" },
] as const;

const faqs = [
  { question: "What is a .slop?", answer: "A .slop is a small app or living document you can open, move, duplicate, and keep. Its interface and document data travel together as one package." },
  { question: "Where does my data live?", answer: "In the writable document on your Mac. A slop can create JSON, SQLite, and named media stores as it needs them. Published templates never include your personal stores." },
  { question: "Can an AI update a slop?", answer: "Yes. External tools can work with the same ordinary local JSON or SQLite data. The host watches for revisions so an open slop can follow external changes without sending the document to a hitSlop account." },
  { question: "Do slops work offline?", answer: "Local interfaces and stores do. A particular slop may still use the network when its purpose calls for it, such as streaming audio or fetching a public service." },
  { question: "How do I make and share one?", answer: "The supported v1 authoring path is Bun and Svelte 5. The CLI creates, previews, validates, builds, installs, signs, and publishes a source-free runtime package." },
] as const;

export const Route = createFileRoute("/")({ component: Catalog });

function Catalog() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 180);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <main className="catalog-shell" id="main-content">
      <a className="skip-link" href="#hero-title">Skip to content</a>

      <header className="masthead">
        <a className="wordmark" href="/" aria-label="hitSlop home">
          <span className="brand-mark"><img src="/assets/appicon.png" alt="" /></span>
          <span>hitSlop</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#why">Why hitSlop</a>
          <a href="#make">Make one</a>
          <a href="#templates">Browse</a>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <a className="nav-download" href={DOWNLOAD_URL} target="_blank" rel="noreferrer">Download <span aria-hidden="true">↘</span></a>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Local-first software for macOS</p>
          <h1 id="hero-title">Tiny apps &amp; docs that live on your desktop.</h1>
          <p className="hero-lede">
            Each <code>.slop</code> is a local-first file you can open, move, duplicate, and keep. Its interface, JSON or SQLite data, and media stay together on your Mac—no account required.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={DOWNLOAD_URL} target="_blank" rel="noreferrer"><span aria-hidden="true">↓</span> Download for macOS</a>
            <a className="button button-secondary" href="#templates">Explore slops <span aria-hidden="true">↘</span></a>
          </div>
          <ul className="hero-facts" aria-label="Key hitSlop features">
            <li>One movable file</li>
            <li>Local JSON, SQLite &amp; media</li>
            <li>Open source</li>
          </ul>
        </div>

        <figure className="desktop-still">
          <div className="desktop-still-frame">
            <img src="/assets/desktop-hero.webp" alt="A Mac desktop filled with colorful focused apps, documents, and .slop files" width="1448" height="1086" fetchPriority="high" />
          </div>
          <figcaption>Your tools where you expect them: on your desktop, beside everything else.</figcaption>
        </figure>
      </section>

      <section className="featured" aria-labelledby="featured-title">
        <div className="section-intro">
          <p className="eyebrow">One format, many personalities</p>
          <h2 id="featured-title">Little apps. Real objects.</h2>
          <p>A slop can read like paper, operate like an instrument, or take on a shape of its own. The job decides the form.</p>
        </div>
        <div className="object-gallery">
          {featuredSlops.map((slop) => (
            <figure className={`featured-object featured-object-${slop.id}`} key={slop.id}>
              <div className="featured-stage"><img src={slop.image} alt={slop.alt} loading="lazy" /></div>
              <figcaption>
                <span><strong>{slop.title}</strong>{slop.description}</span>
                <small>{slop.family}</small>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="local-section" id="why" aria-labelledby="local-title">
        <div className="local-copy">
          <p className="eyebrow">Local means local</p>
          <h2 id="local-title">Everything travels with the document.</h2>
          <p>A slop is not an account, a dashboard, or a thin shell around somebody else&apos;s cloud. It is a file you own, with a native window and durable stores managed by the host.</p>
          <div className="local-points">
            <p><span>01</span><strong>Open it.</strong> Double-click a focused tool or document.</p>
            <p><span>02</span><strong>Move it.</strong> File it, duplicate it, back it up, or share it.</p>
            <p><span>03</span><strong>Keep it.</strong> Your personal state stays in your writable copy.</p>
          </div>
        </div>

        <div className="package-anatomy" aria-label="Contents of a slop document">
          <div className="package-tab"><img src="/assets/appicon.png" alt="" /><span>my-work.slop</span></div>
          <div className="package-files">
            <div className="file-row immutable"><span>manifest.json</span><small>identity + presentation</small></div>
            <div className="file-row immutable"><span>app.html</span><small>the interface</small></div>
            <div className="file-row immutable"><span>assets/</span><small>immutable app media</small></div>
            <div className="store-group">
              <div className="store-label"><span>stores/</span><small>your local data</small></div>
              <div className="file-row"><span>data.json</span><small>settings + documents</small></div>
              <div className="file-row"><span>data.sqlite</span><small>collections + queries</small></div>
              <div className="file-row"><span>media/</span><small>images + named files</small></div>
            </div>
          </div>
          <p className="package-note">The app stays stable. Your data stays editable.</p>
        </div>
      </section>

      <section className="ai-section" aria-labelledby="ai-title">
        <div className="ai-visual" aria-label="An external AI updates local slop data">
          <div className="agent-prompt"><span>Ask your tool</span><p>“Move the client call to 2:30 and mark the invoice paid.”</p></div>
          <div className="data-change">
            <div className="data-change-header"><span className="status-dot" /><code>stores/data.json</code><small>local</small></div>
            <div className="json-line"><span>"clientCall"</span>: <del>"2:00 PM"</del></div>
            <div className="json-line added"><span>"clientCall"</span>: <ins>"2:30 PM"</ins></div>
            <div className="json-line added"><span>"invoiceStatus"</span>: <ins>"paid"</ins></div>
          </div>
          <div className="revision-chip"><span>✓</span> Slop followed the new revision</div>
        </div>
        <div className="ai-copy">
          <p className="eyebrow">Human and machine editable</p>
          <h2 id="ai-title">Your AI can work on the same local data.</h2>
          <p>JSON and SQLite are ordinary, legible formats. External tools can update them on your machine, and an open slop can follow the change. There is no proprietary cloud record standing between you and your work.</p>
          <p className="ai-detail">hitSlop handles revision checks and host change notifications so the UI and the file do not silently overwrite each other.</p>
        </div>
      </section>

      <section className="make-section" id="make" aria-labelledby="make-title">
        <div className="make-heading">
          <p className="eyebrow">From idea to tiny software</p>
          <h2 id="make-title">Make one. Keep the source. Ship only the slop.</h2>
          <p>Start with the supported Bun + Svelte workflow. Preview against isolated local stores, then build a clean, source-free package.</p>
          <a className="text-link" href={AUTHORING_URL} target="_blank" rel="noreferrer">Read the authoring guide <span aria-hidden="true">↗</span></a>
        </div>
        <div className="terminal" aria-label="Commands to create a slop">
          <div className="terminal-bar"><span><i /><i /><i /></span><code>Terminal</code></div>
          <pre><code><span className="terminal-comment"># Start a focused app</span>{"\n"}bunx @hitslop/cli init my-tiny-app{"\n"}cd my-tiny-app &amp;&amp; bun install{"\n\n"}<span className="terminal-comment"># Preview with isolated local data</span>{"\n"}bun run dev{"\n\n"}<span className="terminal-comment"># Create the source-free package</span>{"\n"}bun run build</code></pre>
          <div className="terminal-output"><span>✓</span> dist/my-tiny-app.slop</div>
        </div>
        <ol className="make-steps">
          <li><span>01</span><strong>Define one job</strong><p>Manifest first: purpose, title, categories, and initial window.</p></li>
          <li><span>02</span><strong>Use the right store</strong><p>No persistence, compact JSON, queryable SQLite, or named media.</p></li>
          <li><span>03</span><strong>Capture the object</strong><p>Preview and icon show the slop itself, not an editor around it.</p></li>
        </ol>
      </section>

      <section className="publish-section" aria-labelledby="publish-title">
        <div className="publish-copy">
          <p className="eyebrow">Share the template, not the person</p>
          <h2 id="publish-title">Publish without publishing your data.</h2>
          <p>The CLI builds and captures one immutable artifact, signs its hash and size, and sends it to the catalog. Personal stores never enter the published template.</p>
          <code className="publish-command">bun run publish</code>
        </div>
        <div className="publish-flow" aria-label="Publishing flow">
          <div><span>1</span><strong>Authoring project</strong><small>source + dependencies</small></div><i aria-hidden="true">→</i>
          <div><span>2</span><strong>Signed .slop</strong><small>runtime + preview + icon</small></div><i aria-hidden="true">→</i>
          <div><span>3</span><strong>Catalog template</strong><small>immutable and store-free</small></div>
        </div>
      </section>

      <section className="capability-strip" aria-label="hitSlop capabilities">
        <p>Framework-neutral runtime</p><span>HTML</span><span>Svelte</span><span>React</span><span>JSON</span><span>SQLite</span><span>Named media</span><span>Quick Look</span>
      </section>

      <section className="catalog-section" id="templates" aria-labelledby="catalog-title">
        <div className="catalog-heading">
          <div><p className="eyebrow">The public catalog</p><h2 id="catalog-title">Find a useful starting point.</h2></div>
          <p>Download a template, create a writable copy, and adapt it to the way you work.</p>
        </div>
        <div className="search-tools">
          <label className="search-field">
            <span className="visually-hidden">Search templates</span>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search timers, invoices, games, tools…" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button> : <kbd>⌘ K</kbd>}
          </label>
          <div className="category-list" aria-label="Template categories">
            {categories.map(([id, label]) => <button type="button" key={id} aria-pressed={id === category} className={id === category ? "active" : ""} onClick={() => setCategory(id)}>{label}</button>)}
          </div>
        </div>
        <Suspense fallback={<CatalogSkeleton />}><Shelf query={query} term={term} category={category} /></Suspense>
      </section>

      <section className="faq-section" aria-labelledby="faq-title">
        <div><p className="eyebrow">Questions, answered</p><h2 id="faq-title">The small print, in plain English.</h2></div>
        <div className="faq-list">
          {faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}
        </div>
      </section>

      <section className="final-cta" aria-labelledby="final-cta-title">
        <div><p className="eyebrow">Small files. Big ideas.</p><h2 id="final-cta-title">Put your next tiny tool on your desktop.</h2></div>
        <a className="button button-yellow" href={DOWNLOAD_URL} target="_blank" rel="noreferrer">Download hitSlop <span aria-hidden="true">↓</span></a>
        <div className="cta-art" aria-hidden="true"><span /><span /><img src="/assets/appicon.png" alt="" /></div>
      </section>

      <footer className="site-footer">
        <a className="wordmark" href="/" aria-label="hitSlop home"><span className="brand-mark"><img src="/assets/appicon.png" alt="" /></span><span>hitSlop</span></a>
        <p>Local-first small software for macOS.</p>
        <nav aria-label="Footer navigation"><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">GitHub</a><a href={AUTHORING_URL} target="_blank" rel="noreferrer">Docs</a><span>MIT © 2026</span></nav>
      </footer>
    </main>
  );
}

function Shelf({ query, term, category }: { query: string; term: string; category: string }) {
  const { data: results } = useSuspenseQuery(searchQuery(term));
  const visible = category === "all"
    ? results
    : results.filter((item) => item.categories.includes(category));
  return (
    <div className="template-shelf" aria-live="polite">
      <div className="shelf-heading">
        <h3>{query ? `Results for “${query}”` : category === "all" ? "Popular slops" : categoryLabel(category)}</h3>
        <span>{visible.length} {visible.length === 1 ? "result" : "results"}</span>
      </div>
      {visible.length > 0 ? (
        <div className="template-grid">
          {visible.map((item) => (
            <article className="template-card" key={item._id}>
              <div className="template-preview-stage">
                {item.currentPreviewKey ? <img src={`/api/artifact?key=${encodeURIComponent(item.currentPreviewKey)}`} alt={`Preview of ${item.title}`} loading="lazy" /> : <div className="template-fallback" aria-hidden="true">✦</div>}
              </div>
              <div className="template-copy">
                <div className="template-title-row"><h4>{item.title}</h4><span>{item.creations} created</span></div>
                <p>{item.description}</p>
                <div className="template-footer">
                  <span className="template-categories">{item.categories.map((cat: string) => categoryLabel(cat)).join(" · ")}</span>
                  {item.currentReleaseId ? <a href={`/api/download/${item.currentReleaseId}`} download>Get .slop <span aria-hidden="true">↓</span></a> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-shelf"><span aria-hidden="true">⌕</span><div><h3>No matching slops yet.</h3><p>Try a broader search or choose another category.</p></div></div>
      )}
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="template-shelf" aria-label="Loading catalog">
      <div className="shelf-heading"><span className="skeleton skeleton-heading" /></div>
      <div className="template-grid">
        {[0, 1, 2, 3, 4, 5].map((item) => <div className="template-card" key={item}><div className="skeleton skeleton-preview" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line skeleton-line-short" /></div>)}
      </div>
    </div>
  );
}
