export function allowed(
  member: { is_admin: boolean; overrides: Record<string, string> },
  permissions: string[],
  code: string,
) {
  if (member.is_admin) return true;
  const override = member.overrides[code];
  if (override === "allow") return true;
  if (override === "deny") return false;
  return permissions.includes(code);
}
