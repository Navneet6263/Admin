import { businessCardTemplate, type BusinessCardDetails, type CardSide } from "./businessCardTemplates";

export function BusinessCardPreview({ details }: { details: BusinessCardDetails }) {
  const template = businessCardTemplate(details.brand);
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Selected company template</p>
          <p className="text-sm font-semibold text-white">{template.name}</p>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">Official · Locked</span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {template.sides.map((side) => <Card key={side.id} side={side} details={details} image={side.image || template.image} sourceWidth={template.sourceWidth} sourceHeight={template.sourceHeight} />)}
      </div>
    </div>
  );
}

function Card({ side, details, image, sourceWidth, sourceHeight }: { side: CardSide; details: BusinessCardDetails; image: string; sourceWidth: number; sourceHeight: number }) {
  return (
    <div>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">{side.label}</p>
      <div className="overflow-hidden rounded-lg border border-white/20 bg-white shadow-lg">
        <svg viewBox={`0 0 ${side.crop.width} ${side.crop.height}`} className="block h-auto w-full" role="img" aria-label={`${side.label} business card preview`}>
          <image href={image} x={-side.crop.x} y={-side.crop.y} width={sourceWidth} height={sourceHeight} preserveAspectRatio="none" />
          {side.masks.map((mask, index) => <rect key={index} x={mask.x} y={mask.y} width={mask.width} height={mask.height} fill={mask.color} />)}
          {side.texts.map((text) => {
            const value = `${text.prefix || ""}${details[text.field] || (text.field === "name" ? "Your Name" : text.field === "designation" ? "Designation" : "—")}`;
            const estimatedWidth = value.length * text.size * 0.56;
            const fittedSize = text.maxWidth && estimatedWidth > text.maxWidth
              ? Math.max(14, text.size * text.maxWidth / estimatedWidth) : text.size;
            return <text key={`${text.field}-${text.y}`} x={text.x} y={text.y} textAnchor={text.anchor} fill={text.color}
              fontFamily="Arial, sans-serif" fontSize={fittedSize} fontWeight={text.weight}>{value}</text>;
          })}
        </svg>
      </div>
    </div>
  );
}
