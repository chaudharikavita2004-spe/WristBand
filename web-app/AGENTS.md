# WristBand Project Notes

- App state lives in a persisted Zustand store (`src/lib/store.ts`) using localStorage and hydration in AppShell.
- AppShell waits for store hydration before rendering page content and background monitoring.
- Real Web Bluetooth data and simulated Demo Mode data use `source: "real" | "demo"`; always show a DEMO badge for demo data.
- The Leaflet map is lazy-loaded behind ClientOnly to keep server-side rendering safe.
