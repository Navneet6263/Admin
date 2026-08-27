import type { RosterFilterValues } from "./teamRosterTypes";

interface Props {
  query: string;
  role: string;
  center: string;
  company: string;
  department: string;
  status: string;
  values: RosterFilterValues;
  hasFilters: boolean;
  onQuery: (value: string) => void;
  onRole: (value: string) => void;
  onCenter: (value: string) => void;
  onCompany: (value: string) => void;
  onDepartment: (value: string) => void;
  onStatus: (value: string) => void;
  onReset: () => void;
}

export function TeamRosterFilters(props: Props) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-7">
      <div className="flex gap-2 sm:col-span-2 xl:col-span-2">
        <input
          type="search"
          value={props.query}
          onChange={(event) => props.onQuery(event.target.value)}
          placeholder="Search name, email, ID or center"
          aria-label="Search team roster"
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50/70 px-3 text-xs outline-none focus:border-slate-400 focus:bg-white"
        />
        {props.query && (
          <button
            type="button"
            onClick={() => props.onQuery("")}
            className="h-9 rounded-md border border-slate-200 px-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>
      <Filter
        label="All roles"
        value={props.role}
        onChange={props.onRole}
        options={props.values.roles}
      />
      <Filter
        label="All centers"
        value={props.center}
        onChange={props.onCenter}
        options={["unassigned", ...props.values.centers]}
      />
      <Filter
        label="All companies"
        value={props.company}
        onChange={props.onCompany}
        options={props.values.companies}
      />
      <Filter
        label="All departments"
        value={props.department}
        onChange={props.onDepartment}
        options={props.values.departments}
      />
      <div className="flex gap-2">
        <Filter
          label="All statuses"
          value={props.status}
          onChange={props.onStatus}
          options={["active", "inactive"]}
        />
        {props.hasFilters && (
          <button
            type="button"
            onClick={props.onReset}
            className="h-9 rounded-md border border-slate-200 px-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className="h-9 min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 text-xs capitalize text-slate-700 outline-none focus:border-slate-400"
    >
      <option value="all">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option === "unassigned" ? "Global / unassigned" : option.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
