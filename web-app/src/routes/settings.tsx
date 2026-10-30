
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useApp, fmt, downloadCSV } from "@/lib/store";
import { seo } from "@/lib/seo";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/AppShell";
import { DeliveryPill } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

void fmt;
void downloadCSV;
void DeliveryPill;
void Textarea;

export const Route = createFileRoute("/settings")({
  head: () =>
    seo(
      "Profile, Settings & Privacy",
      "Profile, duress PIN, shake detection and consent center.",
    ),
  component: Settings,
});

function Settings() {
  const s = useApp();
  const p = s.profile;

  const [savingProfile, setSavingProfile] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error("Please log in again.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: p.name.trim(),
          phone: p.phone.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Could not update your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Profile, Settings & Privacy" />

      <div className="grid gap-4 md:grid-cols-2">

        {/* PROFILE */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {(["name", "email", "phone", "city"] as const).map((k) => (
              <div key={k}>
                <Label className="capitalize">{k}</Label>

                <Input
                  value={p[k]}
                  onChange={(e) =>
                    s.set({
                      profile: {
                        ...p,
                        [k]: e.target.value,
                      },
                    })
                  }
                  disabled={k === "email"}
                  type={k === "email" ? "email" : "text"}
                />
              </div>
            ))}

            <Button
              className="w-full"
              onClick={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Your name and phone number are saved to your secure profile.
              Email changes are not supported here.
            </p>
          </CardContent>
        </Card>

        {/* PINS & SOS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PINs & SOS</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div>
              <Label>Unlock / cancel PIN</Label>
              <Input
                value={s.unlockPin}
                onChange={(e) =>
                  s.set({ unlockPin: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Duress PIN</Label>
              <Input
                value={s.duressPin}
                onChange={(e) =>
                  s.set({ duressPin: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Entering this appears to cancel but silently sends SOS.
              </p>
            </div>

            <div>
              <Label>SOS countdown: {s.sosCountdown}s</Label>
              <Slider
                min={0}
                max={15}
                value={[s.sosCountdown]}
                onValueChange={([v]) =>
                  s.set({ sosCountdown: v ?? 5 })
                }
              />
            </div>

            <label className="flex justify-between text-sm">
              Countdown sound
              <Switch
                checked={s.sosSound}
                onCheckedChange={(v) => s.set({ sosSound: v })}
              />
            </label>
          </CardContent>
        </Card>

        {/* SHAKE TO SOS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shake-to-SOS</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <label className="flex justify-between text-sm">
              Enabled
              <Switch
                checked={s.shakeEnabled}
                onCheckedChange={async (v) => {
                  const D = DeviceMotionEvent as unknown as {
                    requestPermission?: () => Promise<string>;
                  };

                  if (v && D.requestPermission) {
                    await D.requestPermission().catch(() => {});
                  }

                  s.set({ shakeEnabled: v });
                }}
              />
            </label>

            <div>
              <Label>Sensitivity: {s.shakeSensitivity}</Label>
              <Slider
                min={1}
                max={30}
                value={[s.shakeSensitivity]}
                onValueChange={([v]) =>
                  s.set({ shakeSensitivity: v ?? 18 })
                }
              />
            </div>

            <Button
              variant="outline"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("wb-sos", {
                    detail: "shake",
                  }),
                )
              }
            >
              Manual test (simulate shake)
            </Button>
          </CardContent>
        </Card>

        {/* CONSENT CENTER */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consent center</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {(["location", "medical", "guardian"] as const).map((k) => (
              <label
                key={k}
                className="flex justify-between text-sm capitalize"
              >
                {k} sharing
                <Switch
                  checked={s.consent[k]}
                  onCheckedChange={(v) =>
                    s.set({
                      consent: {
                        ...s.consent,
                        [k]: v,
                      },
                    })
                  }
                />
              </label>
            ))}

            <Button
              variant="outline"
              onClick={() => {
                const st = useApp.getState();

                const a = document.createElement("a");

                a.href = URL.createObjectURL(
                  new Blob(
                    [
                      JSON.stringify(
                        {
                          ...st,
                          evidence: st.evidence.map((e) => ({
                            ...e,
                            dataUrl: undefined,
                          })),
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  ),
                );

                a.download = "wristband-data.json";
                a.click();

                URL.revokeObjectURL(a.href);
              }}
            >
              Export my data
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                if (
                  confirm("Delete all WristBand data on this device?")
                ) {
                  s.resetAll();
                  toast("Data reset");
                }
              }}
            >
              Delete all data
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
