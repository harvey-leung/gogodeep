export const ScreenshotCard = ({ dimmed = false }: { dimmed?: boolean }) => (
  <div className={`w-52 rounded-xl bg-blue-50 p-3.5 shadow-xl border border-blue-100 ${dimmed ? "opacity-40" : ""}`}>
    <p className="mb-3 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Algebra — Question 4</p>
    <div className="space-y-2.5">
      <div className="h-1.5 w-4/5 rounded" style={{ background: "#d1d5db" }} />
      <div className="h-1.5 w-2/3 rounded" style={{ background: "#e5e7eb" }} />
      <div className="h-1.5 w-5/6 rounded" style={{ background: "#d1d5db" }} />
    </div>
  </div>
);
