import { CenterCombobox, type CenterOption } from "@/components/CenterCombobox";
import { CenterAccessEditor } from "./CenterAccessEditor";
import type { UserRow } from "./teamRosterTypes";

interface Props {
  rows: UserRow[];
  centers: CenterOption[];
  assigningId: number | null;
  userApiBase: string;
  onAssign: (userId: number, centerCode: string) => void;
}

const badges: Record<string, string> = {
  super_admin: "border-purple-200 bg-purple-50 text-purple-800",
  hq_admin: "border-slate-200 bg-slate-50 text-slate-800",
  center_admin: "border-indigo-200 bg-indigo-50 text-indigo-800",
  finance: "border-emerald-200 bg-emerald-50 text-emerald-800",
  finance_head: "border-teal-200 bg-teal-50 text-teal-800",
  employee: "border-sky-200 bg-sky-50 text-sky-800",
};

const columns = [
  "ID",
  "Name",
  "Email",
  "Role",
  "Entity",
  "Center",
  "Center permissions",
  "Team / Dept",
  "Status",
];

export function TeamRosterTable(props: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            {columns.map((title) => (
              <th
                key={title}
                className={`px-4 py-2.5 ${title === "Center permissions" ? "min-w-72" : ""}`}
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {props.rows.map((user) => (
            <RosterRow
              key={user.id}
              user={user}
              centers={props.centers}
              assigning={props.assigningId === user.id}
              apiBase={props.userApiBase}
              onAssign={props.onAssign}
            />
          ))}
          {!props.rows.length && (
            <tr>
              <td colSpan={9} className="p-12 text-center text-xs text-slate-500">
                No users match the selected filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RosterRow({
  user,
  centers,
  assigning,
  apiBase,
  onAssign,
}: {
  user: UserRow;
  centers: CenterOption[];
  assigning: boolean;
  apiBase: string;
  onAssign: Props["onAssign"];
}) {
  const global = ["hq_admin", "super_admin"].includes(user.role);
  const centerScoped = ["employee", "center_admin"].includes(user.role);
  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">#{user.id}</td>
      <td className="px-4 py-3 font-semibold text-slate-900">{user.name}</td>
      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{user.email}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-semibold capitalize ${badges[user.role] || badges.hq_admin}`}
        >
          {user.role.replaceAll("_", " ")}
        </span>
      </td>
      <td className="px-4 py-3 text-[11px] font-semibold text-slate-700">{user.company}</td>
      <td className="px-4 py-3">
        {global ? (
          <span className="text-[10px] text-violet-700">All centers</span>
        ) : user.center_code ? (
          <>
            <span className="font-mono text-[11px] font-semibold text-indigo-700">
              {user.center_code}
            </span>
            <p className="max-w-40 truncate text-[10px] text-slate-400">{user.center_name}</p>
          </>
        ) : (
          <span className="text-[10px] text-slate-400">Not assigned</span>
        )}
      </td>
      <td className="px-4 py-2">
        {centerScoped ? (
          <>
            <div className="flex min-w-60 items-center gap-2">
              <CenterCombobox
                centers={centers}
                value={user.center_code || ""}
                onChange={(code) => onAssign(user.id, code)}
                disabled={assigning}
                placeholder="Search center"
                className="w-full"
              />
              {assigning && <span className="text-[10px] text-indigo-600">Saving…</span>}
            </div>
            {user.role === "center_admin" && (
              <CenterAccessEditor
                userId={user.id}
                homeCenter={user.center_code}
                centers={centers}
                apiBase={apiBase}
              />
            )}
          </>
        ) : (
          <span className="text-[10px] text-slate-400">
            {global ? "Global access" : "Not applicable"}
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-medium text-slate-600">{user.dept || "—"}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-medium ${
            user.is_active
              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-100 text-slate-500"
          }`}
        >
          {user.is_active ? "Active" : "Inactive"}
        </span>
      </td>
    </tr>
  );
}
