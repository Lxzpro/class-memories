import { MemberHomeBoard } from "@/components/member-home-board";
import { requireApprovedUser } from "@/lib/auth";
import { getVisiblePhotos } from "@/lib/photos";

export default async function MemoriesPage() {
  const user = await requireApprovedUser();
  const photos = await getVisiblePhotos(user);

  return <MemberHomeBoard photos={photos} displayName={user.displayName} />;
}
