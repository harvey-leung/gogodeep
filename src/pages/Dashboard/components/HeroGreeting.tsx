import { createPortal } from "react-dom";

/** Full-screen greeting overlay that fades out after the entrance animation. */
export function HeroGreeting({
  heroPhase,
  setHeroPhase,
  greeting,
  username,
}: {
  heroPhase: 0 | 1 | 2;
  setHeroPhase: (p: 0 | 1 | 2) => void;
  greeting: string;
  username: string;
}) {
  if (heroPhase >= 2) return null;
  return createPortal(
    <div
      onClick={() => setHeroPhase(2)}
      className="fixed inset-0 flex items-center justify-center bg-background px-6 cursor-pointer"
      style={{
        zIndex: 9999,
        opacity: heroPhase === 1 ? 0 : 1,
        transform: heroPhase === 1 ? "translateY(-40px)" : "translateY(0)",
        transition: heroPhase === 1 ? "opacity 0.65s ease-in, transform 0.65s ease-in" : undefined,
        pointerEvents: heroPhase === 1 ? "none" : "auto",
      }}
    >
      <h1 className="hero-in text-center text-6xl sm:text-8xl font-black tracking-tighter text-foreground leading-tight">
        {greeting},
        <br /><span className="text-primary">{username}</span>
      </h1>
    </div>,
    document.body
  );
}
