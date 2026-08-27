import type { UserRoleOption } from "./userRoleOptions";

interface Props {
  selectedRole: UserRoleOption;
  email: string;
  centerCode: string;
  company: string;
  password: string;
  saving: boolean;
  onPassword: (value: string) => void;
  onBack: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function UserPasswordStep(props: Props) {
  return (
    <form onSubmit={props.onSubmit}>
      <div className="mb-5 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Account summary
        </p>
        <div className="flex flex-wrap gap-2">
          {[props.selectedRole.label, props.email, props.centerCode, props.company]
            .filter(Boolean)
            .map((value) => (
              <span
                key={value}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
              >
                {value}
              </span>
            ))}
        </div>
        <button
          type="button"
          onClick={props.onBack}
          className="mt-1 text-xs text-indigo-600 hover:underline"
        >
          Edit details
        </button>
      </div>
      <div className="max-w-sm">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          Set Initial Password *
        </label>
        <input
          type="password"
          value={props.password}
          onChange={(event) => props.onPassword(event.target.value)}
          placeholder="12+ characters with mixed character types"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
          required
          minLength={12}
          maxLength={128}
          autoFocus
        />
        <p className="mt-1.5 text-xs text-slate-400">
          Include uppercase, lowercase, number and special character.
        </p>
      </div>
      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={props.saving}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {props.saving ? "Creating account…" : "Create account"}
        </button>
      </div>
    </form>
  );
}
