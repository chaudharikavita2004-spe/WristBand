import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Eye, Trash2, Lock } from "lucide-react";
import { useApp, uid, fmt, type Evidence } from "@/lib/store";
import { seo } from "@/lib/seo";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/vault")({
  head: () => seo("Evidence Vault", "Store photos, audio and documents as private evidence with timestamps."),
  component: Vault,
});

const MAX = 2 * 1024 * 1024;

function Vault() {
  const s = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [desc, setDesc] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<Evidence | null>(null);

  const upload = () => {
    if (!file) { toast.error("Choose a file"); return; }
    if (file.size > MAX) { toast.error("File exceeds 2 MB limit (on-device vault)"); return; }
    const r = new FileReader();
    r.onload = () => {
      setProgress(0);
      let p = 0;
      const id = setInterval(() => {
        p += 20; setProgress(p);
        if (p >= 100) {
          clearInterval(id);
          try {
            useApp.getState().set({ evidence: [{ id: uid(), name: file.name, type: file.type, size: file.size, description: desc, t: Date.now(), dataUrl: r.result as string }, ...useApp.getState().evidence] });
            toast.success("Evidence stored securely on this device");
          } catch { toast.error("Device storage full"); }
          setFile(null); setDesc(""); setProgress(null);
        }
      }, 200);
    };
    r.readAsDataURL(file);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Evidence Vault" desc="Files stay on this device. Max 2 MB per file." />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Add evidence</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div><Label htmlFor="f">File (image, audio, video, PDF)</Label><Input id="f" type="file" accept="image/*,audio/*,video/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          {file && <p className={`text-xs ${file.size > MAX ? "text-destructive" : "text-muted-foreground"}`}>{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
          <div><Label htmlFor="d">Description</Label><Textarea id="d" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What, where, who…" /></div>
          {progress !== null && <div className="h-2 rounded bg-muted"><div className="h-full rounded bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
          <Button onClick={upload} disabled={progress !== null}>Upload to vault</Button>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {s.evidence.map((e) => (
          <Card key={e.id}><CardContent className="space-y-2 p-4">
            <div className="truncate font-medium">{e.name}</div>
            <div className="text-xs text-muted-foreground">{fmt(e.t)} · {(e.size / 1024).toFixed(1)} KB</div>
            <p className="line-clamp-2 text-sm">{e.description || "No description"}</p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setPreview(e)}><Eye className="mr-1 h-3 w-3" />Preview</Button>
              <Button size="sm" variant="outline" asChild><a href={e.dataUrl} download={e.name}><Download className="mr-1 h-3 w-3" />Download</a></Button>
              <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => { if (confirm("Delete this evidence permanently?")) s.set({ evidence: s.evidence.filter((x) => x.id !== e.id) }); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent></Card>
        ))}
        {!s.evidence.length && <p className="text-sm text-muted-foreground">Vault is empty.</p>}
      </div>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{preview?.name}</DialogTitle></DialogHeader>
          {preview && (preview.type.startsWith("image") ? <img src={preview.dataUrl} alt={preview.description || preview.name} className="max-h-[60vh] w-full object-contain" />
            : preview.type.startsWith("audio") ? <audio controls src={preview.dataUrl} className="w-full" />
            : preview.type.startsWith("video") ? <video controls src={preview.dataUrl} className="w-full" />
            : <p className="text-sm text-muted-foreground">No inline preview — use Download.</p>)}
          <p className="text-sm">{preview?.description}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
