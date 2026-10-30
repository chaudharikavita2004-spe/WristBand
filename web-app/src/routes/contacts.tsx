
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { useApp, uid, fmt, type Contact } from "@/lib/store";
import { seo } from "@/lib/seo";
import { DeliveryPill } from "@/components/common";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/contacts")({
  head: () =>
    seo(
      "Emergency Contacts",
      "Manage trusted contacts, escalation priority and sharing permissions.",
    ),
  component: Contacts,
});

const blank = (): Contact => ({
  id: "",
  name: "",
  relationship: "",
  phone: "",
  email: "",
  priority: 1,
  shareLocation: true,
  shareMedical: false,
  verified: false,
  guardianAccess: false,
});

// Convert a Supabase contact row into the frontend Contact format.
const mapDatabaseContact = (row: any): Contact => ({
  id: row.id,
  name: row.name ?? "",
  relationship: row.relationship ?? "",
  phone: row.phone ?? "",
  email: row.email ?? "",
  priority: row.priority ?? 1,
  shareLocation: row.can_view_location ?? true,
  shareMedical: row.can_view_medical ?? false,
  verified: Boolean(row.verified_at),
  guardianAccess: false,
});

function Contacts() {
  const s = useApp();

  const [edit, setEdit] = useState<Contact | null>(null);
  const [dbContacts, setDbContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load contacts only for a real signed-in account.
  useEffect(() => {
    if (s.demoMode) {
      setDbContacts([]);
      return;
    }

    let active = true;

    const loadContacts = async () => {
      setLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          throw new Error("Please sign in to view your contacts.");
        }

        const { data, error } = await supabase
          .from("emergency_contacts")
          .select("*")
          .eq("user_id", user.id)
          .order("priority", { ascending: true });

        if (error) throw error;

        if (active) {
          setDbContacts((data ?? []).map(mapDatabaseContact));
        }
      } catch (error) {
        console.error("Error loading emergency contacts:", error);
        if (active) {
          toast.error("Unable to load emergency contacts");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadContacts();

    return () => {
      active = false;
    };
  }, [s.demoMode]);

  // Choose demo contacts or real account contacts.
  const contacts = s.demoMode ? s.contacts : dbContacts;

  const sorted = [...contacts].sort(
    (a, b) => a.priority - b.priority,
  );

  const save = async () => {
    if (!edit || saving) return;

    if (
      !edit.name.trim() ||
      !/^\+?[\d\s-]{7,}$/.test(edit.phone)
    ) {
      return toast.error(
        "Name and a valid phone number are required",
      );
    }

    if (edit.email && !/^\S+@\S+\.\S+$/.test(edit.email)) {
      return toast.error("Invalid email");
    }

    // Demo mode: retain the existing local storage behavior.
    if (s.demoMode) {
      if (edit.id) {
        s.set({
          contacts: s.contacts.map((c) =>
            c.id === edit.id ? edit : c,
          ),
        });
      } else {
        s.set({
          contacts: [...s.contacts, { ...edit, id: uid() }],
        });
      }

      setEdit(null);
      toast.success("Contact saved");
      return;
    }

    // Real account mode: save to Supabase.
    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const contactData = {
        user_id: user.id,
        name: edit.name.trim(),
        relationship: edit.relationship.trim(),
        phone: edit.phone.trim(),
        email: edit.email.trim() || null,
        priority: edit.priority,
        can_view_location: edit.shareLocation,
        can_view_medical: edit.shareMedical,
      };

      if (edit.id) {
        const { data, error } = await supabase
          .from("emergency_contacts")
          .update(contactData)
          .eq("id", edit.id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        setDbContacts((previous) =>
          previous.map((c) =>
            c.id === edit.id ? mapDatabaseContact(data) : c,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("emergency_contacts")
          .insert(contactData)
          .select()
          .single();

        if (error) throw error;

        setDbContacts((previous) => [
          ...previous,
          mapDatabaseContact(data),
        ]);
      }

      setEdit(null);
      toast.success("Contact saved successfully");
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error("Unable to save contact");
    } finally {
      setSaving(false);
    }
  };

  // Verification remains simulated. It does not verify a real phone number.
  const verify = (c: Contact) => {
    toast(
      `Verification code sent to ${c.phone} (simulated only)`,
    );

    if (s.demoMode) {
      setTimeout(() => {
        useApp.getState().set({
          contacts: useApp
            .getState()
            .contacts.map((x) =>
              x.id === c.id ? { ...x, verified: true } : x,
            ),
        });

        toast.success(`${c.name} marked verified in demo mode`);
      }, 1500);
    } else {
      toast.info(
        "Real phone verification is not connected yet.",
      );
    }
  };

  const removeContact = async (c: Contact) => {
    if (!confirm(`Delete ${c.name}?`)) return;

    if (s.demoMode) {
      s.set({
        contacts: s.contacts.filter((x) => x.id !== c.id),
      });
      toast.success("Contact deleted");
      return;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const { error } = await supabase
        .from("emergency_contacts")
        .delete()
        .eq("id", c.id)
        .eq("user_id", user.id);

      if (error) throw error;

      setDbContacts((previous) =>
        previous.filter((x) => x.id !== c.id),
      );

      toast.success("Contact deleted");
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Unable to delete contact");
    }
  };

  const toggle = async (
    c: Contact,
    k: "shareLocation" | "shareMedical" | "guardianAccess",
  ) => {
    // Demo mode: preserve existing local behavior.
    if (s.demoMode) {
      s.set({
        contacts: s.contacts.map((x) =>
          x.id === c.id ? { ...x, [k]: !x[k] } : x,
        ),
      });
      return;
    }

    // Guardian dashboard access is not currently a database column.
    if (k === "guardianAccess") {
      setDbContacts((previous) =>
        previous.map((x) =>
          x.id === c.id ? { ...x, guardianAccess: !x.guardianAccess } : x,
        ),
      );

      toast.info(
        "Guardian dashboard access is currently a local setting and is not saved to Supabase.",
      );
      return;
    }

    const newValue = !c[k];

    const databaseField =
      k === "shareLocation"
        ? "can_view_location"
        : "can_view_medical";

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const { error } = await supabase
        .from("emergency_contacts")
        .update({ [databaseField]: newValue })
        .eq("id", c.id)
        .eq("user_id", user.id);

      if (error) throw error;

      setDbContacts((previous) =>
        previous.map((x) =>
          x.id === c.id ? { ...x, [k]: newValue } : x,
        ),
      );
    } catch (error) {
      console.error("Error updating contact permission:", error);
      toast.error("Unable to update sharing permission");
    }
  };

  const logs = s.notifs.filter((n) => n.to).slice(0, 15);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Emergency Contacts"
        desc="Contacts are alerted in priority order when SOS fires."
      >
        <Button onClick={() => setEdit(blank())}>
          Add contact
        </Button>
      </PageHeader>

      {loading && (
        <p className="mb-4 text-sm text-muted-foreground">
          Loading your emergency contacts...
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    {c.name}
                    {c.verified && (
                      <CheckCircle2
                        className="h-4 w-4 text-success"
                        aria-label="Verified"
                      />
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {c.relationship} · Priority {c.priority}
                  </div>

                  <div className="text-sm">
                    {c.phone}
                    {c.email && ` · ${c.email}`}
                  </div>
                </div>

                <div className="flex">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit"
                    onClick={() => setEdit(c)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={() => removeContact(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <label className="flex justify-between">
                  Share live location
                  <Switch
                    checked={c.shareLocation}
                    onCheckedChange={() =>
                      toggle(c, "shareLocation")
                    }
                  />
                </label>

                <label className="flex justify-between">
                  Share medical details
                  <Switch
                    checked={c.shareMedical}
                    onCheckedChange={() =>
                      toggle(c, "shareMedical")
                    }
                  />
                </label>

                <label className="flex justify-between">
                  Guardian dashboard access
                  <Switch
                    checked={c.guardianAccess}
                    onCheckedChange={() =>
                      toggle(c, "guardianAccess")
                    }
                  />
                </label>
              </div>

              {!c.verified && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => verify(c)}
                >
                  Send verification (simulated)
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {!loading && !sorted.length && (
          <p className="text-sm text-muted-foreground">
            No contacts yet. Add at least one trusted person.
          </p>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Delivery logs
          </CardTitle>
        </CardHeader>

        <CardContent>
          <ul className="divide-y text-sm">
            {logs.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span>{n.title}</span>
                <span className="text-xs">
                  <DeliveryPill d={n.delivery} />{" "}
                  <span className="text-muted-foreground">
                    {fmt(n.t)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Edit contact" : "Add contact"}
            </DialogTitle>
          </DialogHeader>

          {edit && (
            <div className="grid gap-3">
              {(
                ["name", "relationship", "phone", "email"] as const
              ).map((k) => (
                <div key={k}>
                  <Label htmlFor={k} className="capitalize">
                    {k}
                  </Label>
                  <Input
                    id={k}
                    value={edit[k]}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        [k]: e.target.value,
                      })
                    }
                  />
                </div>
              ))}

              <div>
                <Label htmlFor="pr">
                  Escalation priority (1 = first)
                </Label>
                <Input
                  id="pr"
                  type="number"
                  min={1}
                  max={10}
                  value={edit.priority}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      priority: +e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}