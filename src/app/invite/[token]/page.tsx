import { JoinForm } from "@/modules/users/join";
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <JoinForm token={token} invitation />;
}
