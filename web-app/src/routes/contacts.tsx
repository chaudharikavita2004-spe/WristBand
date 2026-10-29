import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { useApp, uid, fmt, type Contact } from "@/lib/store";
import { seo } from "@/lib/seo";
import { DeliveryPill } from "@/components/common";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/contacts")({
  head: () => seo("Emergency Contacts", "Manage trusted contacts, escalation priority and sharing permissions."),
  component: Contacts,
});

const blank = (): Contact => ({ id: "", name: "", relationship: "", phone: "", email: "", priority: 1, shareLocation: true, shareMedical: false, verified: false, guardianAccess: false });

function Contacts() {
  const s = useApp();
  const [edit, setEdit] = useState<Contact | null>(null);
  const sorted = [...s.contacts].sort((a, b) => a.priority - b.priority);
  const save = () => {
    if (!edit) return;
    if (!edit.name.trim() || !/^\+?[\d\s-]{7,}$/.test(edit.phone)) return toast.error("Name and a valid phone number are required");
    if (edit.email && !/^\S+@\S+\.\S+$/.test(edit.email)) return toast.error("Invalid email");
    if (edit.id) s.set({ contacts: s.contacts.map((c) => (c.id === edit.id ? edit : c)) });
    else s.set({ contacts: [...s.contacts, { ...edit, id: uid() }] });
    setEdit(null);
    toast.success("Contact saved");
    return undefined;
  };
  const verify = (c: Contact) => {
    toast(`Verification code sent to ${c.phone} (simulated)`);
    setTimeout(() => { useApp.getState().set({ contacts: useApp.getState().contacts.map((x) => x.id === c.id ? { ...x, verified: true } : x) }); toast.success(`${c.name} verified`); }, 1500);
  };
  const toggle = (c: Contact, k: keyof Contact) => s.set({ contacts: s.contacts.map((x) => (x.id === c.id ? { ...x, [k]: !x[k] } : x)) });
  const logs = s.notifs.filter((n) => n.to).slice(0, 15);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Emergency Contacts" desc="Contacts are alerted in priority order when SOS fires."><Button onClick={() => setEdit(blank())}>Add contact</Button></PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold">{c.name} {c.verified && <CheckCircle2 className="h-4 w-4 text-success" aria-label="Verified" />}</div>
                  <div className="text-sm text-muted-foreground">{c.relationship} · Priority {c.priority}</div>
                  <div className="text-sm">{c.phone}{c.email && ` · ${c.email}`}</div>
                </div>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => { if (confirm(`Delete ${c.name}?`)) s.set({ contacts: s.contacts.filter((x) => x.id !== c.id) }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid gap-2 text-sm">
                <label className="flex justify-between">Share live location <Switch checked={c.shareLocation} onCheckedChange={() => toggle(c, "shareLocation")} /></label>
                <label className="flex justify-between">Share medical details <Switch checked={c.shareMedical} onCheckedChange={() => toggle(c, "shareMedical")} /></label>
                <label className="flex justify-between">Guardian dashboard access <Switch checked={c.guardianAccess} onCheckedChange={() => toggle(c, "guardianAccess")} /></label>
              </div>
              {!c.verified && <Button size="sm" variant="outline" onClick={() => verify(c)}>Send verification (simulated)</Button>}
            </CardContent>
          </Card>
        ))}
        {!sorted.length && <p className="text-sm text-muted-foreground">No contacts yet. Add at least one trusted person.</p>}
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Delivery logs</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">{logs.map((n) => <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{n.title}</span><span className="text-xs"><DeliveryPill d={n.delivery} /> <span className="text-muted-foreground">{fmt(n.t)}</span></span></li>)}</ul>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit contact" : "Add contact"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              {(["name", "relationship", "phone", "email"] as const).map((k) => (
                <div key={k}><Label htmlFor={k} className="capitalize">{k}</Label><Input id={k} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></div>
              ))}
              <div><Label htmlFor="pr">Escalation priority (1 = first)</Label><Input id="pr" type="number" min={1} max={10} value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: +e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
