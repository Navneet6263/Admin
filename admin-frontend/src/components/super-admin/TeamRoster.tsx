import { useEffect, useMemo, useState } from "react";
import type { CenterOption } from "@/components/CenterCombobox";
import { TableLoadingSkeleton } from "@/components/LoadingSkeletons";
import { PaginationBar } from "@/components/PaginationBar";
import { TeamRosterFilters } from "./TeamRosterFilters";
import { TeamRosterTable } from "./TeamRosterTable";
import type { RosterFilterValues, UserRow } from "./teamRosterTypes";

export type { UserRow } from "./teamRosterTypes";

interface Props {
  users: UserRow[];
  centers: Array<CenterOption & { is_active?: boolean }>;
  mode: "super" | "hq";
  loading: boolean;
  assigningId: number | null;
  assignmentError: string;
  searchQuery: string;
  userApiBase: string;
  onAssign: (userId: number, centerCode: string) => void;
}

export function TeamRoster(props: Props) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [center, setCenter] = useState("all");
  const [company, setCompany] = useState("all");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const activeCenters = useMemo(
    () => props.centers.filter((item) => item.is_active !== false),
    [props.centers],
  );
  const values = useMemo<RosterFilterValues>(
    () => ({
      roles: unique(props.users.map((user) => user.role)),
      centers: unique(activeCenters.map((item) => item.code)),
      companies: unique(props.users.map((user) => user.company)),
      departments: unique(props.users.map((user) => user.dept)),
    }),
    [activeCenters, props.users],
  );
  const filtered = useMemo(() => {
    const searches = [query, props.searchQuery]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    return props.users.filter((user) => {
      const text = [
        user.name,
        user.email,
        user.role,
        user.company,
        user.dept,
        user.center_code,
        user.center_name,
        user.id,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return (
        searches.every((value) => text.includes(value)) &&
        (role === "all" || user.role === role) &&
        (center === "all" ||
          (center === "unassigned" ? !user.center_code : user.center_code === center)) &&
        (company === "all" || user.company === company) &&
        (department === "all" || user.dept === department) &&
        (status === "all" || (status === "active") === Boolean(user.is_active))
      );
    });
  }, [center, company, department, props.searchQuery, props.users, query, role, status]);
  useEffect(
    () => setPage(1),
    [center, company, department, props.searchQuery, query, role, status],
  );
  const hasFilters =
    Boolean(query) || [role, center, company, department, status].some((value) => value !== "all");
  const reset = () => {
    setQuery("");
    setRole("all");
    setCenter("all");
    setCompany("all");
    setDepartment("all");
    setStatus("all");
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
          {props.mode === "super" ? "Group" : "HQ"} Team Roster
        </h3>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Showing {filtered.length} of {props.users.length} users
        </p>
      </header>
      <TeamRosterFilters
        query={query}
        role={role}
        center={center}
        company={company}
        department={department}
        status={status}
        values={values}
        hasFilters={hasFilters}
        onQuery={setQuery}
        onRole={setRole}
        onCenter={setCenter}
        onCompany={setCompany}
        onDepartment={setDepartment}
        onStatus={setStatus}
        onReset={reset}
      />
      {props.assignmentError && (
        <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {props.assignmentError}
        </p>
      )}
      {props.loading ? (
        <TableLoadingSkeleton rows={8} columns={7} />
      ) : (
        <TeamRosterTable
          rows={filtered.slice((page - 1) * pageSize, page * pageSize)}
          centers={activeCenters}
          assigningId={props.assigningId}
          userApiBase={props.userApiBase}
          onAssign={props.onAssign}
        />
      )}
      {!props.loading && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}
