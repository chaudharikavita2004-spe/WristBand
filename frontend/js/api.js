(function () {
  const cfg = window.WB_CONFIG;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  async function token() {
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.access_token : null;
  }

  async function request(method, path, body, isForm) {
    const t = await token();
    const headers = t ? { Authorization: "Bearer " + t } : {};
    if (body && !isForm) headers["Content-Type"] = "application/json";
    const res = await fetch(cfg.API_BASE + path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
    if (res.status === 401 && !location.pathname.endsWith("login.html")) { location.href = "login.html"; return; }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error + (data.details ? ": " + JSON.stringify(data.details) : ""));
    return data;
  }

  window.api = {
    sb,
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b || {}),
    patch: (p, b) => request("PATCH", p, b),
    del: (p) => request("DELETE", p),
    upload: (p, form) => request("POST", p, form, true),
  };

  window.flash = function (msg, kind) {
    const el = document.getElementById("flash");
    if (!el) return alert(msg);
    el.textContent = msg; el.className = kind || "info";
  };
  window.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  window.fmt = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  window.requireLogin = async function () {
    if (!(await token())) location.href = "login.html";
    const out = document.getElementById("logout");
    if (out) out.onclick = async () => { await sb.auth.signOut(); location.href = "login.html"; };
  };
})();
