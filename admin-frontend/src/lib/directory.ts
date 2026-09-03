import { useEffect, useState } from "react";
import { request } from "@/lib/api";

export interface CompanyRow {
  id: number;
  code: string;
  name: string;
  legal_name: string;
}

let companyCache: CompanyRow[] | null = null;
let companyCacheAt = 0;
let companyRequest: Promise<CompanyRow[]> | null = null;
const companyCacheTtl = 5 * 60_000;

function loadCompanies() {
  if (companyCache && Date.now() - companyCacheAt < companyCacheTtl) return Promise.resolve(companyCache);
  if (!companyRequest) {
    companyRequest = request<CompanyRow[]>("/api/companies")
      .then((rows) => { companyCache = rows; companyCacheAt = Date.now(); return rows; })
      .finally(() => { companyRequest = null; });
  }
  return companyRequest;
}

export function useCompanies() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  useEffect(() => {
    let active = true;
    loadCompanies()
      .then((rows) => { if (active) setCompanies(rows); })
      .catch((error) => console.error("Unable to load companies", error));
    return () => { active = false; };
  }, []);

  return companies;
}
