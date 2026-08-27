import { MemberShell } from "@/components/member-shell";
import { requireApprovedUser } from "@/lib/auth";
import "./member-redesign.css";
import "./reference-ui.css";
import "./reference-detail-random.css";
import "./reference-profile.css";
import "./reference-profile-fixes.css";
import "./reference-final-fixes.css";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireApprovedUser();
  return <MemberShell user={user}>{children}</MemberShell>;
}
