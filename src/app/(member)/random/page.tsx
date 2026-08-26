import { RandomMemory } from "@/components/random-memory";
import { requireApprovedUser } from "@/lib/auth";
import { getVisiblePhotos } from "@/lib/photos";

export default async function RandomPage({ searchParams }: PageProps<"/random">) {
  const user = await requireApprovedUser();
  const photos = await getVisiblePhotos(user);
  const mode = (await searchParams).mode === "camera" ? "camera" : "shuffle";
  return <RandomMemory photos={photos} initialMode={mode} />;
}
