import { visionIndiaIdCardSvg, type IdCardDetails, type IdCardSide } from "./visionIndiaIdCard";

export function VisionIndiaIdCardPreview({ details }: { details: IdCardDetails }) {
  return <div className="space-y-2.5">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Company ID template</p><p className="text-sm font-semibold text-white">Vision India</p></div>
      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">Official · Locked</span>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {(["front", "back"] as IdCardSide[]).map((side) => <div key={side}>
        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">{side}</p>
        <div className="overflow-hidden rounded-lg border border-white/20 bg-white shadow-xl" dangerouslySetInnerHTML={{ __html: visionIndiaIdCardSvg(side, details) }} />
      </div>)}
    </div>
  </div>;
}
