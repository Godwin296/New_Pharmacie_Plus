import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { PharmacySection } from "@/components/PharmacySection";
import { ComparisonSection } from "@/components/ComparisonSection";
import { ClientSection } from "@/components/ClientSection";
import { TrustSection } from "@/components/TrustSection";
import { PilotSection } from "@/components/PilotSection";
import { Faq } from "@/components/Faq";
import { CTAFooter } from "@/components/CTAFooter";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <PharmacySection />
        <ComparisonSection />
        <ClientSection />
        <TrustSection />
        <PilotSection />
        <Faq />
        <CTAFooter />
      </main>
    </>
  );
}
