import { useState } from "react";

export const normalizeIndianMobile = (input: string) => {
  const digits = input.replace(/\D/g, "");
  const national = digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
  return national.slice(0, 10);
};

export const isValidIndianMobile = (input: string) => /^[6-9]\d{9}$/.test(input);

export function IndianMobileField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && !isValidIndianMobile(value);
  return <div>
    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-300">
      {label} <span className="text-rose-300">*</span>
    </label>
    <input type="tel" inputMode="numeric" autoComplete="tel-national" value={value}
      onBlur={() => setTouched(true)} onChange={(event) => onChange(normalizeIndianMobile(event.target.value))}
      placeholder="9876543210" aria-invalid={invalid}
      className={`w-full rounded-xl border bg-slate-900/55 px-3.5 py-2.5 text-sm font-medium text-slate-100 outline-none transition-all placeholder:text-slate-400 focus:ring-2 ${invalid
        ? "border-rose-400/70 focus:ring-rose-400/30"
        : "border-white/15 focus:border-indigo-300/50 focus:ring-indigo-400/35"}`} />
    <p className={`mt-1 text-[10px] ${invalid ? "text-rose-300" : "text-slate-400"}`}>
      {invalid ? "Enter a valid 10-digit Indian mobile number starting with 6–9." : "10 digits only. Country code is not required."}
    </p>
  </div>;
}
