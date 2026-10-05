import { cockpitMetadata } from "@/lib/server/cockpit-metadata";

export const metadata = cockpitMetadata("Parallax OS · Sign in");

export default function CommandLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
