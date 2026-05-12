import { Hero } from "@/components/home/Hero";
import { KpiStrip } from "@/components/home/KpiStrip";
import { MineIntro } from "@/components/home/MineIntro";
import { SupplyMap } from "@/components/home/SupplyMap";
import { ProductsBento } from "@/components/home/ProductsBento";
import { SustainabilityDashboard } from "@/components/home/SustainabilityDashboard";
import { ApplicationsGrid } from "@/components/home/ApplicationsGrid";
import { PartnersMarquee } from "@/components/home/PartnersMarquee";
import { AiPreview } from "@/components/home/AiPreview";
import { ClosingCta } from "@/components/home/ClosingCta";
import { MinePhotosStrip } from "@/components/home/MinePhotosStrip";

/**
 * Mada Graphite — homepage (Industrial-Futurism redesign).
 *
 * Composition rationale (top → bottom):
 *
 *   1. Hero                  — oversized headline + AI co-pilot terminal
 *                              card + dual CTA + ⌘K hint
 *   2. LiveTicker            — (rendered inside Hero) trade-desk activity
 *   3. KpiStrip              — animated count-up of the 4 canonical stats
 *   4. MineIntro             — heritage / mine context (asymmetric)
 *   5. SupplyMap             — China+1 strategic case as interactive map
 *   6. ProductsBento         — MADA1 / MADA2 / Custom in bento layout
 *   7. SustainabilityDashboard — Recharts dashboard + 365-day calendar
 *   8. ApplicationsGrid      — eight applications, icon-led
 *   9. AiPreview             — embedded chat mockup answering Li-ion query
 *  10. PartnersMarquee       — auto-scrolling logo rails
 *  11. ClosingCta            — gradient finale CTA
 *  12. MinePhotosStrip       — cinematic photo strip
 *
 * All non-trivial copy from the previous version is preserved verbatim
 * inside the new components. Heritage gold remains a secondary accent
 * (custom bento card, hero highlight gradient); electric cyan is the new
 * signature.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <KpiStrip />
      <MineIntro />
      <SupplyMap />
      <ProductsBento />
      <SustainabilityDashboard />
      <ApplicationsGrid />
      <AiPreview />
      <PartnersMarquee />
      <ClosingCta />
      <MinePhotosStrip />
    </>
  );
}
