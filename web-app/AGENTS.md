# AGENTS
- App state lives in a single persisted zustand store (src/lib/store.ts, localStorage, skipHydration + rehydrate in AppShell) — no backend yet; swap to Lovable Cloud when real accounts/alerts are needed.
- AppShell gates page content and background monitoring on completed store hydration; demo history uses a fixed reference timestamp so saved dates and live countdowns never render against premature defaults.
- Real Web Bluetooth data and simulated Demo Mode data are tagged with `source: "real" | "demo"`; always render a DEMO badge for demo data.
- Browser-only map (Leaflet) is lazy-loaded behind ClientOnly to keep SSR safe.
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
