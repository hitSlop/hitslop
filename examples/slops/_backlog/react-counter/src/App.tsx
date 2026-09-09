import { useJsonStore } from "@hitslop/react";
import { capture } from "@hitslop/runtime";

export default function App() {
  const state = useJsonStore({ count: 0 });
  const renderTargets = capture.isRenderer();

  return (
    <main data-slop-selection="none">
      <section className="counter" aria-labelledby="counter-title">
        <header>
          <p>Quick counter</p>
          <h1 id="counter-title">Counter</h1>
        </header>
        <div className="readout">
          <output aria-live="polite" aria-label={`Current count: ${state.value.count}`}>
            {state.value.count}
          </output>
          <span>things counted</span>
        </div>
        <div className="controls" data-slop-export="hide">
          <button onClick={() => state.update((draft) => { draft.count -= 1; })} aria-label="Decrease count">−</button>
          <button className="primary" onClick={() => state.update((draft) => { draft.count += 1; })} aria-label="Increase count">+</button>
          <button className="reset" onClick={() => state.set({ count: 0 })}>Reset</button>
        </div>
      </section>
      {renderTargets && (
        <section className="counter-render" data-slop-render="icon" aria-hidden="true">
          <div className="icon-tile"><span>+</span></div>
        </section>
      )}
    </main>
  );
}
