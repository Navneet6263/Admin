import { useMemo, useRef, useState } from "react";
import { Check, Crop, X } from "lucide-react";

const VIEW_W = 300;
const VIEW_H = 350;
const OUTPUT_W = 480;
const OUTPUT_H = 560;

export function PhotoCropper({ source, onApply, onCancel }: { source: string; onApply: (photo: string) => void; onCancel: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [natural, setNatural] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ left: 0, top: 0 });
  const base = Math.max(VIEW_W / natural.width, VIEW_H / natural.height);
  const size = useMemo(() => ({ width: natural.width * base * zoom, height: natural.height * base * zoom }), [natural, base, zoom]);
  const clamp = (left: number, top: number, width = size.width, height = size.height) => ({
    left: Math.min(0, Math.max(VIEW_W - width, left)), top: Math.min(0, Math.max(VIEW_H - height, top)),
  });
  const changeZoom = (next: number) => {
    const ratio = next / zoom; const width = size.width * ratio, height = size.height * ratio;
    setOffset(clamp(VIEW_W / 2 - (VIEW_W / 2 - offset.left) * ratio,
      VIEW_H / 2 - (VIEW_H / 2 - offset.top) * ratio, width, height));
    setZoom(next);
  };
  const apply = () => {
    const image = imageRef.current; if (!image) return;
    const scale = base * zoom; const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_W; canvas.height = OUTPUT_H;
    canvas.getContext("2d")?.drawImage(image, -offset.left / scale, -offset.top / scale,
      VIEW_W / scale, VIEW_H / scale, 0, 0, OUTPUT_W, OUTPUT_H);
    onApply(canvas.toDataURL("image/jpeg", .88));
  };
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md">
    <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950 p-5 shadow-2xl">
      <div className="mb-4 flex items-start justify-between"><div><p className="flex items-center gap-2 text-sm font-bold text-white"><Crop className="h-4 w-4" /> Crop employee photo</p>
        <p className="mt-1 text-xs text-slate-400">Drag the photo and zoom until the face fits inside the frame.</p></div>
        <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div>
      <div className="mx-auto overflow-hidden rounded-xl border-2 border-white bg-slate-800 shadow-xl touch-none" style={{ width: VIEW_W, height: VIEW_H }}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, ...offset }; }}
        onPointerMove={(event) => { if (!drag.current) return; setOffset(clamp(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y)); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <img ref={imageRef} src={source} alt="Crop source" draggable={false} className="pointer-events-none max-w-none select-none"
          style={{ width: size.width, height: size.height, transform: `translate(${offset.left}px,${offset.top}px)`, transformOrigin: "top left" }}
          onLoad={(event) => { const image = event.currentTarget; const next = { width: image.naturalWidth, height: image.naturalHeight };
            const nextBase = Math.max(VIEW_W / next.width, VIEW_H / next.height); setNatural(next); setZoom(1);
            setOffset({ left: (VIEW_W - next.width * nextBase) / 2, top: (VIEW_H - next.height * nextBase) / 2 }); }} />
      </div>
      <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Zoom</label>
      <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} className="mt-2 w-full accent-indigo-500" />
      <div className="mt-4 flex gap-2"><button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/15 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
        <button type="button" onClick={apply} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"><Check className="h-4 w-4" /> Use this crop</button></div>
    </div>
  </div>;
}
