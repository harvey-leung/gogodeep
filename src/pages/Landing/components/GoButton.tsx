import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function GoButton({ to = "/dive", label = "Try without signup" }: { to?: string; label?: ReactNode }) {
  return (
    <Link to={to} className="block w-full">
      <button className="group relative w-full rounded-2xl bg-primary py-4 text-base font-bold text-white select-none overflow-hidden transition-all duration-300 shadow-[0_0_24px_4px_rgba(91,127,239,0.3)] hover:scale-[1.02] hover:shadow-[0_0_44px_10px_rgba(91,127,239,0.45)] active:scale-[0.98]">
        <span className="pointer-events-none absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-[150%]" />
        <span className="relative z-10">{label}</span>
      </button>
    </Link>
  );
}
