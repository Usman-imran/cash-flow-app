import { Loader2 } from "lucide-react";

export default function Spinner({ className = "h-5 w-5 text-emerald-600", label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex">
      <Loader2 className={`animate-spin ${className}`} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
