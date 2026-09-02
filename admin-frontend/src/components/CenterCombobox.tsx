import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

export interface CenterOption {
  code: string;
  name: string;
  city: string;
  company?: string;
}

interface Props {
  centers: CenterOption[];
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  dark?: boolean;
  required?: boolean;
  disabled?: boolean;
  showCompany?: boolean;
  className?: string;
}

const centerLabel = (center: CenterOption, showCompany = false) => {
  const place = center.name === center.city ? center.name : `${center.name}, ${center.city}`;
  return `${center.code} · ${place}${showCompany && center.company ? ` · ${center.company}` : ""}`;
};

export function CenterCombobox({ centers, value, onChange, placeholder = "Search center…", dark = false, required, disabled, showCompany = false, className = "" }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [menuBox, setMenuBox] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number }>({ left: 0, top: 0, width: 0, maxHeight: 256 });
  const selected = centers.find(center => center.code === value);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return centers;
    return centers.filter(center => `${center.code} ${center.name} ${center.city} ${center.company || ""}`.toLowerCase().includes(term));
  }, [centers, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const rect = field.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const openUp = below < 260 && above > below;
      const maxHeight = Math.max(120, Math.min(320, (openUp ? above : below) - 6));
      setMenuBox({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        width: rect.width,
        maxHeight,
      });
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open]);

  const choose = (center: CenterOption) => {
    onChange(center.code); setQuery(""); setOpen(false);
  };
  const fieldTone = dark
    ? "border-white/15 bg-slate-900/55 text-slate-100 placeholder:text-slate-400 focus:border-indigo-300/50 focus:ring-indigo-400/35"
    : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:ring-slate-300/50";
  const menuTone = dark ? "border-white/15 bg-slate-900/95 text-slate-100" : "border-slate-200 bg-white text-slate-800";

  return <div ref={root} className={`relative ${className}`}>
    <div className="relative">
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${dark ? "text-slate-400" : "text-slate-500"}`} />
      <input
        ref={field}
        value={open ? query : selected ? centerLabel(selected, showCompany) : ""}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(""); } }}
        onChange={event => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(index + 1, filtered.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
          if (event.key === "Enter" && open && filtered[active]) { event.preventDefault(); choose(filtered[active]); }
          if (event.key === "Escape") setOpen(false);
        }}
        className={`w-full rounded-lg border py-2 pl-9 pr-8 text-xs outline-none ring-0 transition focus:ring-2 disabled:cursor-wait disabled:opacity-50 ${fieldTone}`}
        role="combobox" aria-expanded={open} aria-autocomplete="list"
      />
      <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${dark ? "text-slate-400" : "text-slate-500"}`} />
    </div>
    {open && typeof document !== "undefined" && createPortal(<div ref={menu} role="listbox"
      style={{ left: menuBox.left, top: menuBox.top, bottom: menuBox.bottom, width: menuBox.width, maxHeight: menuBox.maxHeight }}
      className={`request-scrollbar fixed z-[200] overflow-y-auto rounded-xl border p-1 shadow-2xl ${menuTone}`}>
      {filtered.length ? filtered.map((center, index) => <button
        key={center.code} type="button" role="option" aria-selected={center.code === value}
        onMouseEnter={() => setActive(index)} onClick={() => choose(center)}
        className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-xs ${index === active ? (dark ? "bg-white/10" : "bg-slate-100") : ""}`}
      >
        <span className="min-w-0 flex-1"><b className="font-mono">{center.code}</b><span className={dark ? "text-slate-300" : "text-slate-600"}> · {center.name}{center.city !== center.name ? `, ${center.city}` : ""}{showCompany && center.company ? ` · ${center.company}` : ""}</span></span>
        {center.code === value && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />}
      </button>) : <p className={`px-3 py-5 text-center text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>No center found</p>}
    </div>, document.body)}
  </div>;
}
