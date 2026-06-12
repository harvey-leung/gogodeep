import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import PageTransition from "@/components/PageTransition";
import { useAuthUser } from "@/api/auth";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { FaqSection } from "./components/FaqSection";
import { QuoteCard } from "./components/QuoteCard";

const Landing = () => {
  // Always show the landing page in dark mode regardless of the user's theme preference
  useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "blue");
    return () => {
      if (prev) document.documentElement.setAttribute("data-theme", prev);
      else document.documentElement.removeAttribute("data-theme");
    };
  }, []);

  const howItWorksRef = useRef<HTMLElement>(null);
  const [highlightedStep, setHighlightedStep] = useState<0 | 1 | 2>(0);
  const [chevronVisible, setChevronVisible] = useState(true);
  const [deeperY, setDeeperY] = useState(0);
  const highlightFired = useRef(false);

  const landingUser = useAuthUser();
  const isSignedIn = !!landingUser;

  const runHighlight = useCallback(() => {
    if (highlightFired.current) return;
    highlightFired.current = true;
    setTimeout(() => setHighlightedStep(1), 200);
    setTimeout(() => setHighlightedStep(2), 900);
    setTimeout(() => setHighlightedStep(0), 2100);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setChevronVisible(window.scrollY < 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Trigger highlight when "How it works" section scrolls into view
  useEffect(() => {
    const el = howItWorksRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) runHighlight(); },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [runHighlight]);

  const scrollToHowItWorks = useCallback(() => {
    setChevronVisible(false);
    const el = howItWorksRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    }
    highlightFired.current = false;
    setTimeout(runHighlight, 600);
  }, [runHighlight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // "deeper" sinks as mouse moves down the viewport
      const ratio = e.clientY / window.innerHeight; // 0 = top, 1 = bottom
      setDeeperY(ratio * 10);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <PageTransition>
      <Helmet>
        <title>Gogodeep</title>
        <meta name="description" content="Trace any difficult question down to its roots with AI. Gogodeep finds the exact error in your STEM working, explains the underlying concept, and builds targeted practice to fix the gap. Free for IB, AP, and A-Level students." />
        <link rel="canonical" href="https://gogodeep.com/" />
      </Helmet>
      <div className="relative z-10 min-h-screen pt-28">

        <Hero
          isSignedIn={isSignedIn}
          deeperY={deeperY}
          chevronVisible={chevronVisible}
          onScrollToHowItWorks={scrollToHowItWorks}
        />

        <HowItWorks sectionRef={howItWorksRef} highlightedStep={highlightedStep} />

        {/* ── FAQ ── */}
        <section className="container pb-12">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">FAQ</h2>
            <FaqSection />
          </div>
        </section>

        {/* ── Quote ── */}
        <section className="container pb-12">
          <div className="mx-auto max-w-2xl">
            <QuoteCard />
          </div>
        </section>

      </div>
    </PageTransition>
  );
};

export default Landing;
