import { useEffect, useState } from "react";
import { request } from "@/lib/api";

export interface CompanyRow {
  id: number;
  code: string;
  name: string;
  legal_name: string;
}

export function useCompanies() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  useEffect(() => {
    let active = true;
    request<CompanyRow[]>("/api/companies")
      .then((rows) => { if (active) setCompanies(rows); })
      .catch((error) => console.error("Unable to load companies", error));
    return () => { active = false; };
  }, []);

  return companies;
}
