import { USER_ROLE_OPTIONS, type UserRoleKey } from "./userRoleOptions";

interface Props {
  role: UserRoleKey | "";
  allowedRoles?: UserRoleKey[];
  onSelect: (role: UserRoleKey) => void;
}

export function UserRoleStep({ role, allowedRoles, onSelect }: Props) {
  const options = USER_ROLE_OPTIONS.filter(
    (option) => !allowedRoles || allowedRoles.includes(option.role),
  );
  return (
    <div>
      <p className="mb-3 text-xs font-semibold text-slate-700">Select account role</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.role}
            type="button"
            onClick={() => onSelect(option.role)}
            className={`rounded-lg border-2 p-3 text-left transition-colors ${
              role === option.role ? option.activeClass : option.idleClass
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-800">{option.label}</span>
              <span className="text-[10px] font-semibold text-indigo-600">Select</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
