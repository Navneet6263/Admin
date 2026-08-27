import { CenterCombobox } from "@/components/CenterCombobox";
import type { UserRoleOption } from "./userRoleOptions";

interface Props {
  selectedRole: UserRoleOption;
  name: string;
  email: string;
  company: string;
  department: string;
  centerCode: string;
  companies: Array<{ id: number; name: string }>;
  teams: Array<{ id: number; name: string }>;
  centers: Array<{ id: number; code: string; name: string; city: string }>;
  needsCompany: boolean;
  needsDepartment: boolean;
  needsCenter: boolean;
  onName: (value: string) => void;
  onEmail: (value: string) => void;
  onCompany: (value: string) => void;
  onDepartment: (value: string) => void;
  onCenter: (value: string) => void;
  onBack: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30";
const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600";

export function UserDetailsStep(props: Props) {
  return (
    <form onSubmit={props.onSubmit}>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div>
          <p className="font-semibold text-slate-800">{props.selectedRole.label}</p>
          <p className="text-xs text-slate-500">{props.selectedRole.description}</p>
        </div>
        <button
          type="button"
          onClick={props.onBack}
          className="ml-auto text-xs font-medium text-indigo-600 hover:underline"
        >
          Change
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label>
          <span className={labelClass}>Full Name *</span>
          <input
            value={props.name}
            onChange={(event) => props.onName(event.target.value)}
            placeholder="Full name"
            className={inputClass}
            required
          />
        </label>
        <label>
          <span className={labelClass}>Work Email *</span>
          <input
            type="email"
            value={props.email}
            onChange={(event) => props.onEmail(event.target.value)}
            placeholder="Work email"
            className={inputClass}
            required
          />
        </label>
        {props.needsCompany && (
          <label>
            <span className={labelClass}>Company / Brand *</span>
            <select
              value={props.company}
              onChange={(event) => props.onCompany(event.target.value)}
              className={`${inputClass} bg-white`}
              required
            >
              {props.companies.map((company) => (
                <option key={company.id} value={company.name}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {props.needsDepartment && (
          <label>
            <span className={labelClass}>Department *</span>
            <select
              value={props.department}
              onChange={(event) => props.onDepartment(event.target.value)}
              className={`${inputClass} bg-white`}
              required
            >
              {props.teams.map((team) => (
                <option key={team.id} value={team.name}>
                  {team.name}
                </option>
              ))}
              <option value="Other">Other / Custom</option>
            </select>
          </label>
        )}
        {props.needsCenter && (
          <label className="sm:col-span-2">
            <span className={labelClass}>Home Center *</span>
            <CenterCombobox
              centers={props.centers}
              value={props.centerCode}
              onChange={props.onCenter}
              placeholder={props.centers.length ? "Search center, city or code" : "Loading centers"}
              required
            />
          </label>
        )}
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
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Continue to password
        </button>
      </div>
    </form>
  );
}
