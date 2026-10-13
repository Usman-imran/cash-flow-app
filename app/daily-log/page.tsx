import type { Metadata } from "next";
import DailyLog from "@/components/daily-log/DailyLog";

export const metadata: Metadata = { title: "Daily Log" };

export default function DailyLogPage() {
  return <DailyLog />;
}
