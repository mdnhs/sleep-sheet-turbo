import { SectionShell } from "@/components/section-shell";

export default function CatalogSectionLayout({ children }: { children: React.ReactNode }) {
  return <SectionShell section="catalog">{children}</SectionShell>;
}
