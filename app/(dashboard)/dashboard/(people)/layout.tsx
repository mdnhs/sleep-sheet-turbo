import { SectionShell } from "@/components/section-shell";

export default function PeopleSectionLayout({ children }: { children: React.ReactNode }) {
  return <SectionShell section="people">{children}</SectionShell>;
}
