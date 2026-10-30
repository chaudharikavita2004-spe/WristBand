
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useApp, fmt } from "@/lib/store";
import { seo } from "@/lib/seo";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type GuardianGrant = {
  id: string;
  guardian_user_id: string;
  can_view_alerts: boolean;
  can_view_location: boolean;
  expires_at: string | null;
  revoked_at: string | null;
};

type SosEvent = {
  id: string;
  trigger_type: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

export const Route = createFileRoute("/guardian")({
  head: () =>
    seo("Guardian Dashboard", "Authorized guardians see alerts and shared location."),
  component: Guardian,
});

function Guardian() {
  const s = useApp();

  const [grants, setGrants] = useState<GuardianGrant[]>([]);
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Demo mode continues using the existing local sample data.
  const demoGranted = s.contacts.filter((c) => c.guardianAccess);
  const demoActive = s.incidents.filter((i) => i.status === "active");

  useEffect(() => {
    if (s.demoMode) return;

    let cancelled = false;

    async function loadGuardianData() {
      setLoading(true);

      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;

        const user = userData.user;
        if (!user) throw new Error("Please sign in again.");

        const [grantResult, eventResult] = await Promise.all([
          supabase
            .from("guardian_access")
            .select(
              "id, guardian_user_id, can_view_alerts, can_view_location, expires_at, revoked_at",
            )
            .eq("user_id", user.id)
            .is("revoked_at", null)
            .order("created_at", { ascending: false }),

          supabase
            .from("sos_events")
            .select(
              "id, trigger_type, status, latitude, longitude, created_at",
            )
            .eq("user_id", user.id)
            .eq("is_demo", false)
            .in("status", [
              "initiated",
              "pending_synchronization",
              "alert_sent",
            ])
            .order("created_at", { ascending: false }),
        ]);

        if (grantResult.error) throw grantResult.error;
        if (eventResult.error) throw eventResult.error;

        if (!cancelled) {
          setGrants((grantResult.data ?? []) as GuardianGrant[]);
          setEvents((eventResult.data ?? []) as SosEvent[]);
        }
      } catch (error) {
        console.error("Guardian dashboard loading error:", error);

        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not load guardian dashboard.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGuardianData();

    return () => {
      cancelled = true;
    };
  }, [s.demoMode]);

  async function revokeGuardian(grantId: string) {
    setSavingId(grantId);

    try {
      const { error } = await supabase
        .from("guardian_access")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", grantId);

      if (error) throw error;

      setGrants((current) =>
        current.filter((grant) => grant.id !== grantId),
      );

      toast.success("Guardian access revoked.");
    } catch (error) {
      console.error("Guardian revoke error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Could not revoke guardian access.",
      );
    } finally {
      setSavingId(null);
    }
  }

  const grantedCount = s.demoMode ? demoGranted.length : grants.length;
  const activeCount = s.demoMode ? demoActive.length : events.length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Guardian Dashboard"
        desc={`Preview of what authorized guardians see for ${s.profile.name}.`}
      />

      {!s.consent.guardian && (
        <p className="mb-4 rounded bg-destructive/15 p-3 text-sm text-destructive">
          Guardian access is disabled in the consent center.
        </p>
      )}

      {loading && (
        <p className="mb-4 text-sm text-muted-foreground">
          Loading guardian information...
        </p>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Granted guardians</p>
            <p className="text-2xl font-semibold">{grantedCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Active emergency alerts
            </p>
            <p className="text-2xl font-semibold">{activeCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Granted guardians</CardTitle>
          </CardHeader>

          <CardContent className="divide-y">
            {s.demoMode ? (
              <>
                {demoGranted.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span>
                      {contact.name} ·{" "}
                      {contact.shareLocation ? "location" : "no location"}
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        s.set({
                          contacts: s.contacts.map((item) =>
                            item.id === contact.id
                              ? { ...item, guardianAccess: false }
                              : item,
                          ),
                        })
                      }
                    >
                      Revoke
                    </Button>
                  </div>
                ))}

                {!demoGranted.length && (
                  <p className="text-sm text-muted-foreground">
                    No guardians granted.
                  </p>
                )}
              </>
            ) : (
              <>
                {grants.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex flex-col gap-2 py-3 text-sm"
                  >
                    <p className="break-all font-medium">
                      Guardian ID: {grant.guardian_user_id}
                    </p>

                    <p className="text-muted-foreground">
                      {grant.can_view_alerts
                        ? "Alerts allowed"
                        : "Alerts not allowed"}
                      {" · "}
                      {grant.can_view_location
                        ? "Location allowed"
                        : "Location not allowed"}
                    </p>

                    {grant.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        Expires:{" "}
                        {new Date(grant.expires_at).toLocaleString()}
                      </p>
                    )}

                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingId === grant.id}
                        onClick={() => revokeGuardian(grant.id)}
                      >
                        {savingId === grant.id ? "Revoking..." : "Revoke"}
                      </Button>
                    </div>
                  </div>
                ))}

                {!grants.length && (
                  <p className="text-sm text-muted-foreground">
                    No active guardians granted.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live shared location</CardTitle>
          </CardHeader>

          <CardContent className="text-sm">
            {s.demoMode ? (
              s.consent.guardian && s.location ? (
                `${s.location.lat.toFixed(5)}, ${s.location.lng.toFixed(5)} (updated ${fmt(s.location.t)})`
              ) : (
                "Not shared"
              )
            ) : (
              "Live location is not yet connected to Supabase."
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Active emergency alerts
            </CardTitle>
          </CardHeader>

          <CardContent className="divide-y">
            {s.demoMode ? (
              <>
                {demoActive.map((incident) => (
                  <div
                    key={incident.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="text-destructive">
                      SOS ({incident.trigger}) · {fmt(incident.t)}
                    </span>

                    <Button
                      size="sm"
                      onClick={() => {
                        s.set({
                          notifs: s.notifs.map((notification) =>
                            notification.category === "emergency" &&
                            notification.t >= incident.t
                              ? { ...notification, delivery: "acknowledged" }
                              : notification,
                          ),
                        });

                        toast.success("Acknowledged in demo mode.");
                      }}
                    >
                      Acknowledge
                    </Button>
                  </div>
                ))}

                {!demoActive.length && (
                  <p className="text-sm text-muted-foreground">
                    No active alerts.
                  </p>
                )}
              </>
            ) : (
              <>
                {events.map((event) => (
                  <div key={event.id} className="py-3 text-sm">
                    <p className="font-medium text-destructive">
                      SOS · {event.trigger_type}
                    </p>

                    <p className="text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </p>

                    {event.latitude != null &&
                      event.longitude != null && (
                        <p className="mt-1 text-muted-foreground">
                          Location: {event.latitude.toFixed(5)},{" "}
                          {event.longitude.toFixed(5)}
                        </p>
                      )}

                    <p className="mt-1 text-xs text-muted-foreground">
                      Status: {event.status}
                    </p>
                  </div>
                ))}

                {!events.length && (
                  <p className="text-sm text-muted-foreground">
                    No active real SOS events.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {!s.demoMode && (
        <p className="mt-4 text-xs text-muted-foreground">
          Real-account mode reads active guardian permissions and non-demo SOS
          events. Demo notifications and demo location are not real emergency
          alerts or live location sharing.
        </p>
      )}
    </div>
  );
}
