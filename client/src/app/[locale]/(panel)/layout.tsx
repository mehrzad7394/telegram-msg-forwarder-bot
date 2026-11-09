import { Shell } from "@/components/shell";
import { getProfile } from "@/lib/queries";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  return <Shell profile={profile}>{children}</Shell>;
}
