export const inputCls =
  "w-full text-sm font-medium border border-white/15 rounded-xl px-3.5 py-2.5 text-slate-100 bg-slate-900/55 placeholder:text-slate-400 focus:outline-none focus:bg-slate-900/75 focus:ring-2 focus:ring-indigo-400/35 focus:border-indigo-300/50 transition-all [color-scheme:dark]";
export const labelCls = "text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-1.5 block";

export function TextField({
  label, value, onChange, placeholder, type = "text", min, max,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; min?: string; max?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  );
}

export function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
