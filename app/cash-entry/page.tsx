import type { Metadata } from "next";
import CashEntryForm from "@/components/cash-entry/CashEntryForm";

export const metadata: Metadata = { title: "Cash Entry" };

export default function CashEntryPage() {
  return <CashEntryForm />;
}
