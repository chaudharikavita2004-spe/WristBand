(async () => {
  await requireLogin();
  try {
    const s = await api.get("/admin/stats");
    document.getElementById("stats").innerHTML = Object.entries(s).map(([k, v]) => `<article class="card"><h2>${esc(k.replace(/_/g, " "))}</h2><p class="big">${v}</p></article>`).join("");
    const rows = await api.get("/admin/sos");
    document.getElementById("admin-sos").innerHTML = rows.map((r) => `<li>${fmt(r.created_at)} — ${esc(r.trigger)} — ${esc(r.status)} — user ${esc(r.user_id.slice(0, 8))}</li>`).join("") || "<li>None</li>";
  } catch (e) { flash(e.message, "error"); }
})();
