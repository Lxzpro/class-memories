import { MemberShell } from "@/components/member-shell";
import { requireApprovedUser } from "@/lib/auth";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requireApprovedUser();
  return <MemberShell user={user}>{children}</MemberShell>;
}
