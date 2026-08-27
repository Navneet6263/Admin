const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  hq_admin: "HQ Admin",
  center_admin: "Center Admin",
  finance_head: "Finance Head",
  finance: "Finance",
  employee: "Employee",
};

export function displayRole(role?: string | null, fallback = "Administrator") {
  if (!role) return fallback;
  return (
    roleLabels[role] || role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function displayName(name: string) {
  const withoutMetadata = name.split(/\s+[·|]\s+/)[0].trim();
  return (
    withoutMetadata
      .replace(
        /\s*\((?:Super Admin|HQ Admin|Center Admin|Finance Head|Finance|Employee)\)\s*$/i,
        "",
      )
      .trim() || "User"
  );
}

export function displayInitials(name: string) {
  const words = displayName(name)
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (!words.length) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words.at(-1)?.[0] || ""}`.toUpperCase();
}
