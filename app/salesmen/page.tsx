import type { Metadata } from "next";
import SalesmenManager from "@/components/salesmen/SalesmenManager";

export const metadata: Metadata = { title: "Salesmen" };

export default function SalesmenPage() {
  return <SalesmenManager />;
}
