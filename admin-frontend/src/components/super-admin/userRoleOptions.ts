export const USER_ROLE_OPTIONS = [
  {
    role: "employee",
    label: "Employee",
    description: "Raises requests for travel, stationery, ID cards and other services.",
    idleClass: "border-sky-300 bg-sky-50",
    activeClass: "border-sky-500 bg-sky-100 ring-2 ring-sky-300",
  },
  {
    role: "center_admin",
    label: "Center Admin",
    description: "Approves requests for assigned centers.",
    idleClass: "border-indigo-200 bg-indigo-50",
    activeClass: "border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300",
  },
  {
    role: "hq_admin",
    label: "HQ Admin",
    description: "Manages HQ requests, inventory and escalations.",
    idleClass: "border-slate-300 bg-slate-50",
    activeClass: "border-slate-600 bg-slate-100 ring-2 ring-slate-400",
  },
  {
    role: "finance",
    label: "Finance Executive",
    description: "Reviews recorded expenses after operations are complete.",
    idleClass: "border-emerald-200 bg-emerald-50",
    activeClass: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-300",
  },
  {
    role: "finance_head",
    label: "Finance Head",
    description: "Confirms expenses, exceptions and financial analytics.",
    idleClass: "border-teal-200 bg-teal-50",
    activeClass: "border-teal-500 bg-teal-100 ring-2 ring-teal-300",
  },
  {
    role: "super_admin",
    label: "Super Admin",
    description: "Has full system access and group-level authority.",
    idleClass: "border-amber-200 bg-amber-50",
    activeClass: "border-amber-500 bg-amber-100 ring-2 ring-amber-300",
  },
] as const;

export type UserRoleKey = (typeof USER_ROLE_OPTIONS)[number]["role"];
export type UserRoleOption = (typeof USER_ROLE_OPTIONS)[number];
