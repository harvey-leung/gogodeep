export function BlueSpeech({
  loading,
  blueSpeech,
  plan,
  onUpgrade,
}: {
  loading: boolean;
  blueSpeech: string;
  plan: string | undefined;
  onUpgrade: () => void;
}) {
  return (
    <div className="flex flex-col items-center pt-2">
      {/* Speech bubble — top */}
      <div className="relative">
        <div className="rounded-[18px] border border-border bg-secondary px-5 py-3.5 text-center text-sm font-bold text-foreground shadow-[0_8px_32px_hsl(var(--primary)/0.10)] max-w-[210px]">
          {loading ? "…" : blueSpeech}
        </div>
        <div
          className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 h-0 w-0"
          style={{
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: "8px solid hsl(var(--secondary))",
          }}
        />
      </div>

      {/* Blue + Upgrade — pushed to bottom so Blue's base aligns with stats */}
      <div className="mt-auto flex flex-col items-center gap-3">
        <img
          src="/blue.png"
          alt="Blue"
          draggable={false}
          className="blue-bob w-full max-w-[240px] object-contain select-none"
          style={{ filter: "drop-shadow(0 16px 40px hsl(var(--primary)/0.20))" }}
        />
        {plan !== "deep" && (
          <button onClick={onUpgrade} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
            Upgrade →
          </button>
        )}
      </div>
    </div>
  );
}
