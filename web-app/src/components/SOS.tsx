import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp, type Incident } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.value = 0.15; o.start(); o.stop(ctx.currentTime + 0.18);
  } catch { /* noop */ }
}

export function SOSButton({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<Incident["trigger"]>("button");
  useEffect(() => {
    const h = (e: Event) => { setTrigger(((e as CustomEvent).detail as Incident["trigger"]) ?? "button"); setOpen(true); };
    if (!compact) return;
    window.addEventListener("wb-sos", h);
    return () => window.removeEventListener("wb-sos", h);
  }, [compact]);
  return (
    <>
      {compact ? (
        <Button variant="destructive" size="sm" className="font-bold" onClick={() => { setTrigger("button"); setOpen(true); }}>{t("sos")}</Button>
      ) : (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("wb-sos", { detail: "button" }))}
          className="sos-pulse mx-auto flex h-40 w-40 flex-col items-center justify-center rounded-full bg-destructive font-display text-destructive-foreground shadow-xl transition-transform hover:scale-105 focus-visible:scale-105"
          aria-label="Trigger SOS emergency alert"
        >
          <span className="text-4xl font-extrabold">SOS</span>
          <span className="text-xs opacity-90">{t("sendSos")}</span>
        </button>
      )}
      {compact && open && <SOSDialog trigger={trigger} onClose={() => setOpen(false)} />}
    </>
  );
}

function SOSDialog({ trigger, onClose }: { trigger: Incident["trigger"]; onClose: () => void }) {
  const t = useT();
  const s = useApp();
  const [left, setLeft] = useState(s.sosCountdown);
  const [pin, setPin] = useState("");
  const [sent, setSent] = useState<Incident | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (sent) return;
    if (left <= 0 && !fired.current) {
      fired.current = true;
      const inc = s.triggerSOS(trigger);
      setSent(inc);
      if ("vibrate" in navigator) navigator.vibrate?.([300, 100, 300]);
      return;
    }
    if (s.sosSound) beep();
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left, sent]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = () => {
    if (pin === s.duressPin) {
      // Duress: appear cancelled but silently send
      if (!fired.current) { fired.current = true; s.triggerSOS("duress", true); }
      else if (sent) useApp.getState().set({ incidents: useApp.getState().incidents.map((i) => i.id === sent.id ? { ...i, silent: true, trigger: "duress" } : i) });
      toast("SOS cancelled");
      onClose();
      return;
    }
    if (pin !== s.unlockPin) { toast.error("Incorrect PIN"); return; }
    if (sent) s.resolveIncident(sent.id, "cancelled");
    toast("SOS cancelled");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="border-destructive" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-destructive">{sent ? "SOS SENT" : `${t("sendingIn")} ${left}s`}</DialogTitle>
          <DialogDescription>
            Trigger: {trigger}. {sent ? `Alerted ${s.contacts.length} contact(s). ${sent.lat ? `Location ${sent.lat.toFixed(5)}, ${sent.lng?.toFixed(5)}` : "Location unavailable"}. ${sent.synced ? "" : "Offline — queued locally, will sync automatically."}` : "Enter your PIN to cancel."}
          </DialogDescription>
        </DialogHeader>
        {!sent && <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-destructive transition-all" style={{ width: `${(left / s.sosCountdown) * 100}%` }} /></div>}
        <div className="flex gap-2">
          <Input type="password" inputMode="numeric" placeholder="PIN (demo 1234)" value={pin} onChange={(e) => setPin(e.target.value)} aria-label="Cancel PIN" />
          <Button variant="outline" onClick={cancel}>{t("cancel")}</Button>
        </div>
        {sent && <Button onClick={() => { s.resolveIncident(sent.id); onClose(); toast.success("Incident marked resolved"); }}>I'm safe now — resolve</Button>}
        {!sent && <Button variant="destructive" onClick={() => setLeft(0)}>Send now</Button>}
      </DialogContent>
    </Dialog>
  );
}
