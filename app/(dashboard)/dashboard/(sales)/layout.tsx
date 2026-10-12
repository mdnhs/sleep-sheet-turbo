import { SectionShell } from "@/components/section-shell";

export default function SalesSectionLayout({ children }: { children: React.ReactNode }) {
  return <SectionShell section="sales">{children}</SectionShell>;
}
