(async () => {
  await requireLogin();
  const list = document.getElementById("evidence-list");
  async function load() {
    const rows = await api.get("/evidence");
    list.innerHTML = rows.map((r) => `<li><span>${esc(r.file_name)} — ${(r.size_bytes / 1024).toFixed(1)} KB — ${fmt(r.created_at)} ${esc(r.note || "")}</span>
      <span><button class="ghost" data-open="${r.id}">Open</button><button class="ghost" data-del="${r.id}">Delete</button></span></li>`).join("") || "<li>No evidence stored.</li>";
  }
  list.onclick = async (e) => {
    const { open, del } = e.target.dataset;
    try {
      if (open) window.open((await api.get(`/evidence/${open}/url`)).url, "_blank", "noopener");
      if (del && confirm("Delete this evidence permanently?")) { await api.del(`/evidence/${del}`); load(); }
    } catch (err) { flash(err.message, "error"); }
  };
  const f = document.getElementById("upload-form");
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api.upload("/evidence", new FormData(f)); f.reset(); load(); flash("Uploaded securely.", "ok"); } catch (err) { flash(err.message, "error"); }
  };
  load().catch((e) => flash(e.message, "error"));
})();
