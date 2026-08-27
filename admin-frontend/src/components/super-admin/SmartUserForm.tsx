import { useEffect, useState } from "react";
import { request } from "@/lib/api";
import { UserDetailsStep } from "./UserDetailsStep";
import { UserFormProgress } from "./UserFormProgress";
import { UserPasswordStep } from "./UserPasswordStep";
import { UserRoleStep } from "./UserRoleStep";
import { USER_ROLE_OPTIONS, type UserRoleKey } from "./userRoleOptions";

interface Props {
  companiesList: Array<{ id: number; code: string; name: string; legal_name: string }>;
  teams: Array<{ id: number; name: string; company: string }>;
  onCreated: () => void;
  userApiBase?: string;
  allowedRoles?: UserRoleKey[];
}

type Center = { id: number; code: string; name: string; city: string };

export function SmartUserForm({
  companiesList,
  teams,
  onCreated,
  userApiBase = "/api/super-admin/users",
  allowedRoles,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<UserRoleKey | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  const [centerCode, setCenterCode] = useState("");
  const [centers, setCenters] = useState<Center[]>([]);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!["center_admin", "employee"].includes(role) || centers.length) return;
    void request<Center[]>("/api/centers").then(setCenters).catch(console.error);
  }, [centers.length, role]);

  const selectedRole = USER_ROLE_OPTIONS.find((option) => option.role === role);
  const needsCenter = role === "center_admin" || role === "employee";
  const needsDepartment = role === "employee" || role === "finance" || role === "finance_head";
  const needsCompany = role !== "super_admin";

  const selectRole = (nextRole: UserRoleKey) => {
    setRole(nextRole);
    setError("");
    setSuccess("");
    setCompany(companiesList[0]?.name || "");
    setDepartment(teams[0]?.name || "");
    setStep(2);
  };

  const continueToPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return setError("Name and email are required");
    if (needsCenter && !centerCode)
      return setError("A center assignment is required for this role");
    if (needsCompany && !company) return setError("Please select a company");
    if (needsDepartment && !department) return setError("Please select a department");
    setError("");
    setStep(3);
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validPassword(password)) {
      setError("Use 12–128 characters with uppercase, lowercase, number and special character");
      return;
    }
    if (!role) return;
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        email: email.trim(),
        role,
        password,
      };
      if (needsCompany) payload.company = company;
      if (needsDepartment) payload.dept = department;
      if (centerCode) payload.center_code = centerCode;
      const created = await request<{ name: string; email: string }>(userApiBase, {
        method: "POST",
        body: payload,
      });
      if (centerCode) await ensureCenterAssignment(userApiBase, created.email, centerCode);
      setSuccess(`${created.name} (${created.email}) was created successfully.`);
      resetForm();
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "User account could not be created");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setRole("");
    setName("");
    setEmail("");
    setCompany("");
    setDepartment("");
    setCenterCode("");
    setPassword("");
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 pb-3 pt-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Create user account</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Select a role and complete the required account details.
          </p>
        </div>
        <UserFormProgress step={step} />
      </header>
      <div className="p-4 sm:p-5">
        {success && (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            {success}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600">
            {error}
          </p>
        )}
        {step === 1 && (
          <UserRoleStep role={role} allowedRoles={allowedRoles} onSelect={selectRole} />
        )}
        {step === 2 && selectedRole && (
          <UserDetailsStep
            selectedRole={selectedRole}
            name={name}
            email={email}
            company={company}
            department={department}
            centerCode={centerCode}
            companies={companiesList}
            teams={teams}
            centers={centers}
            needsCompany={needsCompany}
            needsDepartment={needsDepartment}
            needsCenter={needsCenter}
            onName={setName}
            onEmail={setEmail}
            onCompany={setCompany}
            onDepartment={setDepartment}
            onCenter={setCenterCode}
            onBack={() => setStep(1)}
            onSubmit={continueToPassword}
          />
        )}
        {step === 3 && selectedRole && (
          <UserPasswordStep
            selectedRole={selectedRole}
            email={email}
            centerCode={centerCode}
            company={company}
            password={password}
            saving={saving}
            onPassword={setPassword}
            onBack={() => setStep(2)}
            onSubmit={createUser}
          />
        )}
      </div>
    </section>
  );
}

function validPassword(password: string) {
  return (
    password.length >= 12 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

async function ensureCenterAssignment(apiBase: string, email: string, centerCode: string) {
  const users = await request<Array<{ id: number; email: string }>>(apiBase);
  const created = users.find((user) => user.email === email);
  if (created)
    await request(`${apiBase}/${created.id}/assign-center`, {
      method: "POST",
      body: { center_code: centerCode },
    });
}
