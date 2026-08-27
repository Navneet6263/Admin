const labels = ["Choose Role", "User Details", "Set Password"];

export function UserFormProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, index) => {
        const current = index + 1;
        const done = step > current;
        const active = step === current;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-indigo-600 text-white"
                    : active
                      ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {current}
              </div>
              <span
                className={`hidden text-xs font-medium sm:block ${
                  active ? "text-indigo-700" : done ? "text-slate-600" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {index < labels.length - 1 && (
              <div
                className={`mx-3 h-0.5 flex-1 rounded ${done ? "bg-indigo-600" : "bg-slate-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
