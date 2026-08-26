(() => {
  const json = (r) => {
    if (!r.ok) {
      return r.json().then((body) => {
        const err = new Error(body.error || r.statusText);
        err.status = r.status;
        throw err;
      });
    }
    return r.json();
  };

  const post = (path, payload) =>
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then(json);

  const listeners = new Set();

  const slop = {
    async query(sql, params = []) {
      const res = await post("/slop/query", { sql, params });
      return res.rows;
    },
    async exec(sql, params = []) {
      return post("/slop/exec", { sql, params });
    },
    async meta() {
      return fetch("/slop/meta").then(json);
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };

  window.slop = slop;

  const connect = () => {
    const es = new EventSource("/slop/events");
    es.addEventListener("change", (ev) => {
      let info = { type: "data" };
      try {
        info = JSON.parse(ev.data);
      } catch {
        /* keep default */
      }
      if (info.type === "view") {
        location.reload();
        return;
      }
      for (const cb of listeners) cb(info);
      window.dispatchEvent(new CustomEvent("slop:change", { detail: info }));
    });
    es.onerror = () => {
      es.close();
      setTimeout(connect, 800);
    };
  };
  connect();
})();
