import { serverClient } from "@/lib/auth/server";
import { Workspace } from "@/components/workspace";
import { ModulePage } from "@/components/module-page";
import { modules } from "@/lib/domain";
import { redirect, notFound } from "next/navigation";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const { module } = await params;
  if (!modules.some((m) => m[0] === module)) notFound();
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: members } = await db
    .from("memberships")
    .select("organization_id,is_admin,status")
    .eq("user_id", user.id);
  const active = members?.filter((m) => m.status === "active") ?? [];
  const requested = (await searchParams).org;
  const org =
    active.find((m) => m.organization_id === requested)?.organization_id ??
    active[0]?.organization_id;
  if (!org) redirect("/login");
  const aal = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (
    active.find((m) => m.organization_id === org)?.is_admin &&
    aal.data?.currentLevel !== "aal2"
  )
    redirect("/login");
  const { data: organizations } = await db
    .from("organizations")
    .select("id,name,logo_path");
  return (
    <Workspace organizations={organizations ?? []} org={org} userId={user.id}>
      <ModulePage key={org+module} module={module} org={org} />
    </Workspace>
  );
}
