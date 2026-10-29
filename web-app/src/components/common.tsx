import { useEffect, useState } from "react";

export function useNow(ms = 1000) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setN(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return n;
}

export function Empty({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

export function DeliveryPill({ d }: { d: string }) {
  const c = d === "failed" ? "bg-destructive/15 text-destructive" : d === "acknowledged" || d === "delivered" ? "bg-success/15 text-success" : "bg-warning/20";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${c}`}>{d}</span>;
}
