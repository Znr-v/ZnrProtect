import { Providers } from "@/components/Providers";

export default function ConfigsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}