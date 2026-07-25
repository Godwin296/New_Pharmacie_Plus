import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PlansSection } from "@/components/PlansSection";
import { CTAFooter } from "@/components/CTAFooter";

export const metadata: Metadata = {
  title: "Forfaits — Pharmacie+",
  description:
    "Découvrez les forfaits Pharmacie+ : gestion de stock, caisse, Mobile Money et boutique en ligne pour votre pharmacie, à partir de 15 000 FCFA/mois.",
};

export default function Forfaits() {
  return (
    <>
      <Nav />
      <main className="bg-white dark:bg-[#0b1a16]">
        <PlansSection />
      </main>
      <CTAFooter />
    </>
  );
}
