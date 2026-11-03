
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api";
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
  trigger: string;
  status: string;
  lat: number | null;
  lng: number | null;
  accuracy_m?: number | null;
  created_at: string;
};

type ReceivedGuardianGrant = {
  id: string;
  user_id: string;
  guardian_user_id: string;
  owner_name?: string;
  can_view_alerts: boolean;
  can_view_location: boolean;
  expires_at: string | null;
  revoked_at: string | null;
};

type SharedAlert = SosEvent & {
  owner_user_id: string;
  owner_name?: string;
  accuracy_m?: number | null;
};

type SharedAlertsResponse = {
  grants: ReceivedGuardianGrant[];
  events: SharedAlert[];
};

type LiveLocation = {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  updated_at: string;
};

export const Route = createFileRoute("/guardian")({
  head: () =>
    seo("Guardian Dashboard", "Authorized guardians see alerts and shared location."),
  component: Guardian,
});

function Guardian() {
  const s = useApp();

  const [profileName, setProfileName] = useState(s.profile.name);

  const [grants, setGrants] = useState<GuardianGrant[]>([]);
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [receivedGrants, setReceivedGrants] =
    useState<ReceivedGuardianGrant[]>([]);
  const [sharedEvents, setSharedEvents] = useState<SharedAlert[]>([]);

  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [guardianUserId, setGuardianUserId] = useState("");
  const [canViewAlerts, setCanViewAlerts] = useState(true);
  const [canViewLocation, setCanViewLocation] = useState(false);
  const [creatingGrant, setCreatingGrant] = useState(false);

  // Demo mode continues using existing local sample data.
  const demoGranted = s.contacts.filter((c) => c.guardianAccess);
  const demoActive = s.incidents.filter((i) => i.status === "active");

  useEffect(() => {
    if (s.demoMode) {
      setProfileName(s.profile.name);
      return;
    }

    let cancelled = false;

    async function loadGuardianData() {
      setLoading(true);

      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) throw userError;

        const user = userData.user;
        if (!user) throw new Error("Please sign in again.");

        // Load the name belonging to the currently authenticated account.
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const accountName =
          profileData?.full_name ||
          user.user_metadata?.full_name ||
          "User";

        if (!cancelled) {
          setProfileName(accountName);
        }

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error("Please sign in again.");
        }

        const [grantData, eventResult, sharedData] = await Promise.all([
          // Grants created by the currently signed-in owner.
          apiRequest<GuardianGrant[]>(
            "/api/guardian/grants",
            accessToken,
          ),

          // The current account's own real, active SOS events.
          supabase
            .from("sos_events")
            .select(
              "id, trigger, status, lat, lng, accuracy_m, created_at",
            )
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("created_at", { ascending: false }),

          // Active grants and alerts shared with this guardian account.
          apiRequest<SharedAlertsResponse>(
            "/api/guardian/shared-alerts",
            accessToken,
          ),
        ]);

        if (eventResult.error) throw eventResult.error;

        if (!cancelled) {
          setGrants(grantData);
          setEvents((eventResult.data ?? []) as SosEvent[]);
          setReceivedGrants(sharedData.grants ?? []);
          setSharedEvents(sharedData.events ?? []);
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
  }, [s.demoMode, s.profile.name]);

  // Fetch locations shared by accounts that granted location permission.
  useEffect(() => {
    if (s.demoMode) {
      setLiveLocations([]);
      return;
    }

    const ownerIds = receivedGrants
      .filter(
        (grant) => grant.can_view_location && !grant.revoked_at,
      )
      .filter(
        (grant) =>
          !grant.expires_at ||
          new Date(grant.expires_at).getTime() > Date.now(),
      )
      .map((grant) => grant.user_id);

    if (!ownerIds.length) {
      setLiveLocations([]);
      return;
    }

    let cancelled = false;

    async function fetchLiveLocations() {
      setLocationLoading(true);

      try {
        const { data, error } = await supabase
          .from("live_locations")
          .select(
            "user_id, latitude, longitude, accuracy_m, updated_at",
          )
          .in("user_id", ownerIds);

        if (error) throw error;

        if (!cancelled) {
          setLiveLocations((data ?? []) as LiveLocation[]);
        }
      } catch (error) {
        console.error("Live location loading error:", error);

        if (!cancelled) {
          toast.error("Could not load shared live locations.");
        }
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    }

    fetchLiveLocations();

    const intervalId = window.setInterval(
      fetchLiveLocations,
      15000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [s.demoMode, receivedGrants]);

  async function createGuardianGrant() {
    if (!s.consent.guardian) {
      toast.error("Enable Guardian Access in the consent center first.");
      return;
    }

    const normalizedId = guardianUserId.trim();

    if (!normalizedId) {
      toast.error("Please enter the guardian's User ID.");
      return;
    }

    setCreatingGrant(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in again.");
      }

      const newGrant = await apiRequest<GuardianGrant>(
        "/api/guardian/grants",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            guardian_user_id: normalizedId,
            can_view_alerts: canViewAlerts,
            can_view_location: canViewLocation,
          }),
        },
      );

      setGrants((current) => [newGrant, ...current]);
      setGuardianUserId("");

      toast.success("Guardian access granted.");
    } catch (error) {
      console.error("Guardian grant creation error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Could not grant guardian access.",
      );
    } finally {
      setCreatingGrant(false);
    }
  }

  async function revokeGuardian(grantId: string) {
    setSavingId(grantId);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in again.");
      }

      await apiRequest<{ message: string }>(
        `/api/guardian/grants/${grantId}/revoke`,
        accessToken,
        {
          method: "PATCH",
        },
      );

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
        desc={`Preview of what authorized guardians see for ${profileName}.`}
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
        {/* Existing owner-side guardian management */}
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
                <div className="space-y-3 border-b pb-4">
                  <div>
                    <label
                      htmlFor="guardian-user-id"
                      className="mb-1 block text-sm font-medium"
                    >
                      Guardian User ID
                    </label>

                    <input
                      id="guardian-user-id"
                      type="text"
                      value={guardianUserId}
                      onChange={(event) =>
                        setGuardianUserId(event.target.value)
                      }
                      placeholder="Paste the guardian's Supabase User ID"
                      disabled={creatingGrant || !s.consent.guardian}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={canViewAlerts}
                      onChange={(event) =>
                        setCanViewAlerts(event.target.checked)
                      }
                      disabled={creatingGrant || !s.consent.guardian}
                    />
                    Allow emergency alerts
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={canViewLocation}
                      onChange={(event) =>
                        setCanViewLocation(event.target.checked)
                      }
                      disabled={creatingGrant || !s.consent.guardian}
                    />
                    Allow location access
                  </label>

                  <Button
                    onClick={createGuardianGrant}
                    disabled={
                      creatingGrant ||
                      !guardianUserId.trim() ||
                      !s.consent.guardian
                    }
                  >
                    {creatingGrant ? "Granting..." : "Grant access"}
                  </Button>

                  {!s.consent.guardian && (
                    <p className="text-xs text-destructive">
                      Enable Guardian Access in consent settings before granting.
                    </p>
                  )}
                </div>

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
                  <p className="pt-3 text-sm text-muted-foreground">
                    No active guardians granted.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Guardian-side received permissions */}
        {!s.demoMode && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Accounts sharing access with you
              </CardTitle>
            </CardHeader>

            <CardContent className="divide-y">
              {receivedGrants.map((grant) => (
                <div key={grant.id} className="space-y-1 py-3 text-sm">
                  <p className="font-medium">
                    {grant.owner_name || "Shared account"}
                  </p>

                  <p className="text-muted-foreground">
                    {grant.can_view_alerts
                      ? "Emergency alerts allowed"
                      : "Emergency alerts not allowed"}
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
                </div>
              ))}

              {!receivedGrants.length && (
                <p className="text-sm text-muted-foreground">
                  No accounts have shared guardian access with you.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Live shared location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live shared location</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            {s.demoMode ? (
              s.consent.guardian && s.location ? (
                <p>
                  {s.location.lat.toFixed(5)}, {s.location.lng.toFixed(5)}
                  {" · Updated "}
                  {fmt(s.location.t)}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Not shared in demo mode.
                </p>
              )
            ) : locationLoading && !liveLocations.length ? (
              <p className="text-muted-foreground">
                Loading shared locations...
              </p>
            ) : !receivedGrants.some(
                (grant) =>
                  grant.can_view_location &&
                  !grant.revoked_at &&
                  (!grant.expires_at ||
                    new Date(grant.expires_at).getTime() > Date.now()),
              ) ? (
              <p className="text-muted-foreground">
                No accounts have granted you location access.
              </p>
            ) : !liveLocations.length ? (
              <p className="text-muted-foreground">
                No location is currently being shared. The owner may have
                stopped sharing or their app may be closed.
              </p>
            ) : (
              liveLocations.map((location) => {
                const grant = receivedGrants.find(
                  (item) => item.user_id === location.user_id,
                );

                const ageMs =
                  Date.now() - new Date(location.updated_at).getTime();

                const isStale = ageMs > 5 * 60 * 1000;

                return (
                  <div
                    key={location.user_id}
                    className="space-y-2 rounded-lg border p-3"
                  >
                    <p className="font-medium">
                      {grant?.owner_name || "Shared account"}
                    </p>

                    {isStale && (
                      <p className="rounded bg-destructive/10 p-2 text-destructive">
                        This location may be outdated (last updated over 5
                        minutes ago).
                      </p>
                    )}

                    <p>
                      Latitude: {location.latitude.toFixed(6)}
                      <br />
                      Longitude: {location.longitude.toFixed(6)}
                    </p>

                    {location.accuracy_m != null && (
                      <p className="text-muted-foreground">
                        GPS accuracy: approximately{" "}
                        {Math.round(location.accuracy_m)} m
                      </p>
                    )}

                    <p className="text-muted-foreground">
                      Last updated:{" "}
                      {new Date(location.updated_at).toLocaleString()}
                    </p>

                    <a
                      href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-primary underline underline-offset-4"
                    >
                      View on Google Maps
                    </a>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Existing owner's own active alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Your active emergency alerts
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
                      SOS · {event.trigger}
                    </p>

                    <p className="text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </p>

                    {event.lat != null &&
                      event.lng != null && (
                        <p className="mt-1 text-muted-foreground">
                          Location: {event.lat.toFixed(5)},{" "}
                          {event.lng.toFixed(5)}
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

        {/* Guardian-side shared alerts */}
        {!s.demoMode && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                Emergency alerts shared with you
              </CardTitle>
            </CardHeader>

            <CardContent className="divide-y">
              {sharedEvents.map((event) => (
                <div key={event.id} className="space-y-1 py-3 text-sm">
                  <p className="font-medium text-destructive">
                    SOS · {event.trigger}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Shared by: {event.owner_name || "Shared account"}
                  </p>

                  <p className="text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </p>

                  {event.lat != null &&
                    event.lng != null && (
                      <p className="text-muted-foreground">
                        Shared location: {event.lat.toFixed(5)},{" "}
                        {event.lng.toFixed(5)}
                      </p>
                    )}

                  <p className="text-xs text-muted-foreground">
                    Status: {event.status}
                  </p>
                </div>
              ))}

              {!sharedEvents.length && (
                <p className="text-sm text-muted-foreground">
                  No active real SOS alerts have been shared with you.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {!s.demoMode && (
        <p className="mt-4 text-xs text-muted-foreground">
          Real-account mode reads active guardian permissions and active SOS
          events. Shared alert locations are displayed only when the owner has
          granted location permission. Live location updates require the
          owner's app to remain open. Real SMS alerts and emergency phone
          calls are not implemented. Demo notifications and demo location
          are not real emergency alerts or live location sharing.
        </p>
      )}
    </div>
  );
}
