const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.platform || navigator.userAgent);

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center rounded border border-primary/40 bg-primary/10 w-9 h-9 text-base font-bold text-primary leading-none">
      {children}
    </span>
  );
}

export function ScreenshotKeys() {
  if (isMac) return (
    <span className="flex items-center gap-1">
      <Key>⌘</Key><Key>⇧</Key><Key>4</Key>
    </span>
  );
  if (isWindows) return (
    <span className="flex items-center gap-1">
      <Key>⊞</Key><Key>⇧</Key><Key>S</Key>
    </span>
  );
  return <Key>PrtSc</Key>;
}
