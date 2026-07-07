import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { PharmacySection } from "@/components/PharmacySection";
import { ClientSection } from "@/components/ClientSection";
import { TrustSection } from "@/components/TrustSection";
import { CTAFooter } from "@/components/CTAFooter";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <PharmacySection />
        <ClientSection />
        <TrustSection />
        <CTAFooter />
      </main>
    </>
  );
}
