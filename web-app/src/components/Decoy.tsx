import { useState } from "react";
import { useApp } from "@/lib/store";

// Harmless-looking calculator + notes. Typing the unlock PIN then "=" returns to the app.
export function Decoy() {
  const s = useApp();
  const [expr, setExpr] = useState("");
  const [note, setNote] = useState("Groceries: milk, bread, tomatoes");
  const press = (k: string) => {
    if (k === "=") {
      if (expr === s.unlockPin) { s.set({ decoy: false }); setExpr(""); return; }
      if (expr === s.duressPin) { s.triggerSOS("duress", true); setExpr("0"); return; }
      try { setExpr(String(Function(`"use strict";return (${expr.replace(/[^0-9+\-*/.()]/g, "")})`)())); } catch { setExpr("Error"); }
    } else if (k === "C") setExpr("");
    else setExpr((e) => (e === "Error" ? k : e + k));
  };
  return (
    <div className="mx-auto grid min-h-screen max-w-3xl gap-6 bg-background p-6 md:grid-cols-2">
      <div className="rounded-2xl border bg-card p-4">
        <h1 className="mb-3 text-lg font-semibold">Calculator</h1>
        <div className="mb-3 h-14 rounded bg-muted p-3 text-right text-2xl tabular-nums" aria-live="polite">{expr || "0"}</div>
        <div className="grid grid-cols-4 gap-2">
          {["7","8","9","/","4","5","6","*","1","2","3","-","0",".","C","+"].map((k) => (
            <button key={k} onClick={() => press(k)} className="rounded-lg bg-secondary py-3 text-lg font-medium hover:bg-accent">{k}</button>
          ))}
          <button onClick={() => press("=")} className="col-span-4 rounded-lg bg-primary py-3 text-lg font-semibold text-primary-foreground">=</button>
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Notes</h2>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className="h-72 w-full resize-none rounded bg-muted p-3 text-sm" aria-label="Notes" />
      </div>
    </div>
  );
}
