import { useEffect, useState } from "react";
import { request } from "@/lib/api";

type Company = { id: number; code: string; name: string; legal_name: string };

interface Props {
  companies: Company[];
  canCreateCompany: boolean;
  onChanged: () => void | Promise<void>;
}

export function DirectorySetupPanel({ companies, canCreateCompany, onChanged }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentCompany, setDepartmentCompany] = useState("");
  const [saving, setSaving] = useState<"company" | "department" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companies.some((company) => company.name === departmentCompany)) {
      setDepartmentCompany(companies[0]?.name || "");
    }
  }, [companies, departmentCompany]);

  const createCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyName.trim()) return setError("Please enter a company name");
    setSaving("company");
    setError("");
    setMessage("");
    try {
      const created = await request<{ name: string }>("/api/companies/create", {
        method: "POST",
        body: { name: companyName.trim() },
      });
      setCompanyName("");
      setMessage(`Company “${created.name}” created successfully.`);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Company could not be created");
    } finally {
      setSaving(null);
    }
  };

  const createDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!departmentName.trim()) return setError("Please enter a department name");
    if (!departmentCompany) return setError("Please select a company");
    setSaving("department");
    setError("");
    setMessage("");
    try {
      const created = await request<{ name: string; company: string }>("/api/teams/create", {
        method: "POST",
        body: { name: departmentName.trim(), company: departmentCompany },
      });
      setDepartmentName("");
      setMessage(`Department “${created.name}” created for ${created.company}.`);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Department could not be created");
    } finally {
      setSaving(null);
    }
  };

  const inputClass =
    "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
  const labelClass = "mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Organization setup</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Manage companies and departments used for user accounts.
        </p>
      </header>

      {canCreateCompany && (
        <form onSubmit={createCompany} className="border-b border-slate-100 p-4">
          <h3 className="text-xs font-semibold text-slate-800">Company or brand</h3>
          <div className="mt-3 flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className={labelClass}>Name</span>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Enter company name"
                className={inputClass}
                required
              />
            </label>
            <button
              type="submit"
              disabled={saving !== null}
              className="h-9 shrink-0 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {saving === "company" ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      <form onSubmit={createDepartment} className="p-4">
        <h3 className="text-xs font-semibold text-slate-800">Department</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label>
            <span className={labelClass}>Department name</span>
            <input
              value={departmentName}
              onChange={(event) => setDepartmentName(event.target.value)}
              placeholder="Enter department name"
              className={inputClass}
              required
            />
          </label>
          <label>
            <span className={labelClass}>Company</span>
            <select
              value={departmentCompany}
              onChange={(event) => setDepartmentCompany(event.target.value)}
              className={inputClass}
              required
            >
              {companies.map((company) => (
                <option key={company.id} value={company.name}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={saving !== null || !companies.length}
          className="mt-3 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {saving === "department" ? "Creating…" : "Create department"}
        </button>
      </form>

      {(error || message) && (
        <p
          className={`border-t px-4 py-2 text-[11px] ${error ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}
        >
          {error || message}
        </p>
      )}
    </section>
  );
}
