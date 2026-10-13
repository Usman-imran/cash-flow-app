import type { Metadata } from "next";
import DenominationCalculator from "@/components/denomination/DenominationCalculator";

export const metadata: Metadata = { title: "Denomination" };

export default function DenominationPage() {
  return <DenominationCalculator />;
}
