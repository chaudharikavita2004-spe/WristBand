(async () => {
  await requireLogin();
  const list = document.getElementById("contact-list");
  async function load() {
    const rows = await api.get("/contacts");
    list.innerHTML = rows.map((c) => `<li><span><strong>${esc(c.name)}</strong> ${esc(c.relation || "")} — ${esc(c.phone)} (priority ${c.priority})</span><button data-id="${c.id}" class="ghost">Remove</button></li>`).join("") || "<li>No contacts yet.</li>";
  }
  list.onclick = async (e) => { const id = e.target.dataset.id; if (id) { await api.del(`/contacts/${id}`); load(); } };
  const f = document.getElementById("contact-form");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = { name: f.name.value, phone: f.phone.value, priority: Number(f.priority.value) };
    if (f.relation.value) body.relation = f.relation.value;
    try { await api.post("/contacts", body); f.reset(); load(); flash("Contact added.", "ok"); } catch (err) { flash(err.message, "error"); }
  };
  load().catch((e) => flash(e.message, "error"));
})();
