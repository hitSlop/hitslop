(() => {
  const call = (op, sql, params) =>
    window.webkit.messageHandlers.slop.postMessage({
      op,
      sql: sql || "",
      params: params || [],
    });

  window.slop = {
    async query(sql, params = []) {
      const res = await call("query", sql, params);
      if (res && res.error) throw new Error(res.error);
      return res.rows;
    },
    async exec(sql, params = []) {
      const res = await call("exec", sql, params);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    async meta() {
      return call("meta", "", []);
    },
    onChange(cb) {
      const fn = (e) => cb(e.detail);
      window.addEventListener("slop:change", fn);
      return () => window.removeEventListener("slop:change", fn);
    },
  };
})();
