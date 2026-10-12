import { SectionShell } from "@/components/section-shell";

export default function ReportsSectionLayout({ children }: { children: React.ReactNode }) {
  return <SectionShell section="reports">{children}</SectionShell>;
}
