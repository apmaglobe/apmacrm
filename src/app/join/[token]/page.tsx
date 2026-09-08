import { JoinForm } from "@/modules/users/join";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <JoinForm token={(await params).token} />;
}
