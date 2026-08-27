import { useCallback, useEffect, useState } from "react";
import { request } from "@/lib/api";
import type { CenterOption } from "@/components/CenterCombobox";
import { DirectorySetupPanel } from "./DirectorySetupPanel";
import { SmartUserForm } from "./SmartUserForm";
import { TeamRoster, type UserRow } from "./TeamRoster";

interface Props {
  mode?: "super" | "hq";
  searchQuery?: string;
}

type Company = { id: number; code: string; name: string; legal_name: string };
type Team = { id: number; name: string; company: string };
type Center = CenterOption & { is_active?: boolean };

export function TeamTab({ mode = "super", searchQuery = "" }: Props) {
  const userApiBase = mode === "hq" ? "/api/admin/users" : "/api/super-admin/users";
  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignmentError, setAssignmentError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [userRows, teamRows, companyRows, centerRows] = await Promise.all([
        request<UserRow[]>(userApiBase),
        request<Team[]>("/api/teams"),
        request<Company[]>("/api/companies").catch(() => []),
        request<Center[]>("/api/centers"),
      ]);
      setUsers(userRows);
      setTeams(teamRows);
      setCompanies(companyRows);
      setCenters(centerRows);
    } catch (cause) {
      console.error(cause);
    } finally {
      setLoading(false);
    }
  }, [userApiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const assignCenter = async (userId: number, centerCode: string) => {
    setAssigningId(userId);
    setAssignmentError("");
    try {
      const updated = await request<{
        center_code: string;
        center_name: string;
        center_city: string;
      }>(`${userApiBase}/${userId}/assign-center`, {
        method: "POST",
        body: { center_code: centerCode },
      });
      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                center_code: updated.center_code,
                center_name: updated.center_name,
                center_city: updated.center_city,
              }
            : user,
        ),
      );
    } catch (cause) {
      setAssignmentError(cause instanceof Error ? cause.message : "Center assignment failed");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.45fr)]">
        <DirectorySetupPanel
          companies={companies}
          canCreateCompany={mode === "super"}
          onChanged={load}
        />
        <SmartUserForm
          companiesList={companies}
          teams={teams}
          onCreated={load}
          userApiBase={userApiBase}
          allowedRoles={
            mode === "super" ? undefined : ["employee", "center_admin", "finance", "finance_head"]
          }
        />
      </div>
      <TeamRoster
        users={users}
        centers={centers}
        mode={mode}
        loading={loading}
        assigningId={assigningId}
        assignmentError={assignmentError}
        searchQuery={searchQuery}
        userApiBase={userApiBase}
        onAssign={(id, code) => void assignCenter(id, code)}
      />
    </div>
  );
}
