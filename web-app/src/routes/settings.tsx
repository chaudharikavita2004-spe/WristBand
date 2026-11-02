
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [locationActionLoading, setLocationActionLoading] = useState(false);

  // Load the profile belonging to the currently signed-in account.
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          throw new Error("Please log in again.");
        }

        const { data: profileData, error: profileError } =
          await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (cancelled) return;

        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "";

        s.set({
          profile: {
            ...useApp.getState().profile,
            name:
              profileData?.full_name ||
              metadataName ||
              "",
            email: user.email || "",
            phone: profileData?.phone || "",
          },
        });
      } catch (error) {
        console.error("Profile loading error:", error);

        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not load your profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please log in again.");
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          full_name: p.name.trim(),
          phone: p.phone.trim() || null,
        })
        .eq("id", user.id)
        .select("full_name, phone")
        .single();

      if (error) throw error;

      s.set({
        profile: {
          ...useApp.getState().profile,
          name: data.full_name || "",
          email: user.email || "",
          phone: data.phone || "",
        },
      });

      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Profile update error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update your profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // Start live location sharing.
  const startLocationSharing = async () => {
    if (locationActionLoading) return;

    if (s.demoMode) {
      toast.error("Live location sharing is unavailable in Demo Mode.");
      return;
    }

    if (!("geolocation" in navigator)) {
      toast.error("Your browser does not support location sharing.");
      return;
    }

    setLocationActionLoading(true);

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        throw new Error("Please log in again.");
      }

      useApp.getState().set({ liveLocationSharing: true });

      toast.success("Live location sharing started. Allow GPS access if prompted.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not start location sharing.",
      );
    } finally {
      setLocationActionLoading(false);
    }
  };

  // Stop GPS tracking and delete the saved location.
  const stopLocationSharing = async () => {
    if (locationActionLoading) return;

    setLocationActionLoading(true);

    // Stop the GPS watcher immediately.
    useApp.getState().set({ liveLocationSharing: false });

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please log in again.");
      }

      const { error } = await supabase
        .from("live_locations")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Live sharing stopped and saved location deleted.");
    } catch (error) {
      console.error("Could not delete live location:", error);

      toast.error(
        error instanceof Error
          ? `Sharing stopped, but location deletion failed: ${error.message}`
          : "Sharing stopped, but saved location could not be deleted.",
      );
    } finally {
      setLocationActionLoading(false);
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
                        ...useApp.getState().profile,
                        [k]: e.target.value,
                      },
                    })
                  }
                  disabled={
                    k === "email" ||
                    loadingProfile ||
                    savingProfile
                  }
                  type={k === "email" ? "email" : "text"}
                />
              </div>
            ))}

            <Button
              className="w-full"
              onClick={saveProfile}
              disabled={savingProfile || loadingProfile}
            >
              {loadingProfile
                ? "Loading Profile..."
                : savingProfile
                  ? "Saving..."
                  : "Save Profile"}
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

        {/* LIVE LOCATION SHARING */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Live Location Sharing
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Sharing status
              </span>

              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  s.liveLocationSharing
                    ? "bg-green-500/15 text-green-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.liveLocationSharing ? "Sharing ON" : "Sharing OFF"}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              When enabled, your current GPS coordinates are updated in
              your secure WristBand account. Guardians with active
              location permission can view your shared location.
            </p>

            {s.liveLocationSharing ? (
              <Button
                className="w-full"
                variant="destructive"
                onClick={() => void stopLocationSharing()}
                disabled={locationActionLoading}
              >
                {locationActionLoading
                  ? "Stopping..."
                  : "Stop Sharing"}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => void startLocationSharing()}
                disabled={locationActionLoading || s.demoMode}
              >
                {locationActionLoading
                  ? "Starting..."
                  : "Start Sharing"}
              </Button>
            )}

            {s.demoMode && (
              <p className="text-xs text-amber-600">
                Switch off Demo Mode to use real GPS sharing.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Sharing works while the app is open and location permission
              is enabled. Stop Sharing deletes your last saved location.
            </p>
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
