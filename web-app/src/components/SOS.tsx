
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp, type Incident } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.15;

    o.start();
    o.stop(ctx.currentTime + 0.18);
  } catch {
    // Audio is optional.
  }
}

export function SOSButton({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<Incident["trigger"]>("button");

  useEffect(() => {
    const h = (e: Event) => {
      setTrigger(
        ((e as CustomEvent).detail as Incident["trigger"]) ?? "button",
      );
      setOpen(true);
    };

    if (!compact) return;

    window.addEventListener("wb-sos", h);
    return () => window.removeEventListener("wb-sos", h);
  }, [compact]);

  return (
    <>
      {compact ? (
        <Button
          variant="destructive"
          size="sm"
          className="font-bold"
          onClick={() => {
            setTrigger("button");
            setOpen(true);
          }}
        >
          {t("sos")}
        </Button>
      ) : (
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("wb-sos", { detail: "button" }),
            )
          }
          className="sos-pulse mx-auto flex h-40 w-40 flex-col items-center justify-center rounded-full bg-destructive font-display text-destructive-foreground shadow-xl transition-transform hover:scale-105 focus-visible:scale-105"
          aria-label="Trigger SOS emergency alert"
        >
          <span className="text-4xl font-extrabold">SOS</span>
          <span className="text-xs opacity-90">{t("sendSos")}</span>
        </button>
      )}

      {compact && open && (
        <SOSDialog
          trigger={trigger}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SOSDialog({
  trigger,
  onClose,
}: {
  trigger: Incident["trigger"];
  onClose: () => void;
}) {
  const t = useT();
  const s = useApp();

  const [left, setLeft] = useState(s.sosCountdown);
  const [pin, setPin] = useState("");
  const [sent, setSent] = useState<Incident | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const fired = useRef(false);

  useEffect(() => {
    if (sent || error) return;

    if (left <= 0 && !fired.current) {
      fired.current = true;
      setSending(true);

      const send = async () => {
        try {
          if (s.demoMode) {
            const incident = s.triggerSOS(trigger);
            setSent(incident);
            setAlertMessage(
              "Demo only: this SOS was simulated. No real SMS alerts were sent.",
            );
          } else {
            const result = await s.triggerSOSRemote(trigger);

            setSent(result.incident);
            setAlertMessage(result.alerts.message);
          }

          if ("vibrate" in navigator) {
            navigator.vibrate?.([300, 100, 300]);
          }
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to send SOS. Please try again or call 112 directly.",
          );
        } finally {
          setSending(false);
        }
      };

      void send();
      return;
    }

    if (left > 0) {
      if (s.sosSound) beep();

      const id = setTimeout(() => {
        setLeft((value) => value - 1);
      }, 1000);

      return () => clearTimeout(id);
    }
  }, [left, sent, error, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async () => {
    if (sending) return;

    // Duress PIN: discreetly trigger or preserve the SOS.
    if (pin === s.duressPin) {
      try {
        if (!sent) {
          if (s.demoMode) {
            s.triggerSOS("duress", true);
            toast("Demo duress SOS simulated — no real alert sent.");
          } else {
            const result = await s.triggerSOSRemote("duress", true);

            toast(
              result.alerts.sent > 0
                ? `Discreet SOS processed. ${result.alerts.sent} SMS alert(s) sent.`
                : `Discreet SOS recorded. ${result.alerts.message}`,
            );
          }
        } else if (s.demoMode) {
          useApp.getState().set({
            incidents: useApp.getState().incidents.map((incident) =>
              incident.id === sent.id
                ? {
                    ...incident,
                    silent: true,
                    trigger: "duress",
                  }
                : incident,
            ),
          });

          toast("Demo duress activated — no real alert sent.");
        } else {
          const result = await s.cancelSOSRemote(sent.id, pin);

          if (result !== "active") {
            throw new Error(
              "Could not verify that the discreet SOS remains active.",
            );
          }

          toast("Discreet SOS remains active.");
        }

        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Unable to complete discreet SOS request.",
        );
      }

      return;
    }

    // Normal cancellation PIN.
    if (pin !== s.unlockPin) {
      toast.error("Incorrect PIN");
      return;
    }

    try {
      if (sent) {
        if (s.demoMode) {
          s.resolveIncident(sent.id, "cancelled");
        } else {
          const result = await s.cancelSOSRemote(sent.id, pin);

          if (result === "active") {
            toast.error(
              "SOS is still active. Cancellation was not confirmed.",
            );
            return;
          }
        }
      }

      toast("SOS cancelled");
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to cancel SOS.",
      );
    }
  };

  const retry = () => {
    setError("");
    fired.current = false;
    setRetryCount((value) => value + 1);
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="border-destructive"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-destructive">
            {error
              ? "SOS NOT CONFIRMED"
              : sending
                ? "SENDING SOS..."
                : sent
                  ? "SOS REQUEST PROCESSED"
                  : `${t("sendingIn")} ${left}s`}
          </DialogTitle>

          <DialogDescription>
            {error ? (
              error
            ) : sending ? (
              "Contacting the emergency alert service. Please wait."
            ) : sent ? (
              <>
                {s.demoMode ? "Demo Mode: " : ""}
                {alertMessage}
                {sent.lat != null
                  ? ` Location: ${sent.lat.toFixed(5)}, ${sent.lng?.toFixed(5) ?? "unknown"}.`
                  : " Location unavailable."}
              </>
            ) : (
              <>
                Trigger: {trigger}. Enter your PIN to cancel.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!sent && !error && (
          <div className="h-2 overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-destructive transition-all"
              style={{
                width: `${Math.max(0, (left / s.sosCountdown) * 100)}%`,
              }}
            />
          </div>
        )}

        {!error && (
          <div className="flex gap-2">
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              aria-label="Cancel PIN"
              disabled={sending}
            />

            <Button
              variant="outline"
              onClick={cancel}
              disabled={sending || !pin}
            >
              {t("cancel")}
            </Button>
          </div>
        )}

        {sent && (
          <Button
            onClick={cancel}
            disabled={sending || !pin}
          >
            I'm safe now — cancel SOS
          </Button>
        )}

        {error && (
          <div className="flex gap-2">
            <Button variant="destructive" onClick={retry}>
              Retry SOS
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {!sent && !error && !sending && (
          <Button
            variant="destructive"
            onClick={() => setLeft(0)}
          >
            Send now
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
