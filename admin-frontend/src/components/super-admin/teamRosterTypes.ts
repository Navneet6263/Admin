export interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  company: string;
  dept: string;
  center_code?: string | null;
  center_name?: string | null;
  center_city?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RosterFilterValues {
  roles: string[];
  centers: string[];
  companies: string[];
  departments: string[];
}
