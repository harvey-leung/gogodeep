import { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  BookOpen, ArrowLeft, TriangleAlert, Lightbulb, ClipboardList,
  ChevronRight, ArrowRight, FileSearch, Lock, Loader2, Waves, CheckCircle2, Layers, X, Send, ChevronsRight, ChevronLeft, Smile,
} from "lucide-react";
import { UnitCircle, LawOfSinesCosines, TrigIdentities, PythagoreanTheorem, QuadraticEquations, TheDerivative, DefiniteIntegrals, LimitsAndContinuity, TaylorSeries, DifferentialEquations, LinearRegression, BinomialDistribution, Vectors2D, ComplexNumbers, Logarithms, ConicSections, MatrixTransformations, SequencesSeries, Optimization, SimilarTriangles, Inequalities } from "@/components/interact/MathModels2";
import { NormalDistribution } from "@/components/interact/MathCSModels";
import { SHM, EMInduction, CentripetalForce, Optics, WaveInterference, ElectricCircuits, DopplerEffect, Momentum, HeatTransfer, KineticTheory, RotationalInertia } from "@/components/interact/PhysicsModels";
import { BohrModel, TitrationCurves, ReactionKinetics, IdealGasLaw, PHScale, RadioactiveDecay, GalvanicCells, LeChatelier } from "@/components/interact/ChemistryModels";
import { MitosisMeiosis, DNADoubleHelix, Photosynthesis, CirculatorySystem, OsmosisDiffusion, EnzymeSubstrate, CellMembrane, ActionPotential } from "@/components/interact/BiologyModels";
import { KeplerLaws, StellarLifecycle, GreenhouseEffect, AtmosphereLayers } from "@/components/interact/EarthSpaceModels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import EducatorLayout from "@/components/EducatorLayout";
import { RichText } from "@/components/RichText";
import { supabase } from "@/integrations/supabase/client";
import { SCAN_CACHE_KEY } from "@/lib/supabase";
import { FREE_FOR_ALL } from "@/lib/featureFlags";
import { scanImageStore } from "@/lib/pendingFile";
import { whaleToast } from "@/lib/whaleToast";
import { cn } from "@/lib/utils";
import { calcScanXP, addBonusXP, PRACTICE_CORRECT_XP } from "@/lib/xp";

const SESSION_REPORT_KEY = "gogodeep_pending_report";

/** Read location state, fall back to sessionStorage if tab was suspended/restored */
function resolveReportState(locationState: unknown): NavState {
  const ls = (locationState as NavState | null) ?? {};
  if (ls.diagnosis) return ls;
  try {
    const stored = sessionStorage.getItem(SESSION_REPORT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<NavState>;
      if (parsed.diagnosis) return { ...ls, ...parsed } as NavState;
    }
  } catch { /* ignore */ }
  return ls;
}

function questionToBase64(text: string): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const padding = 28;
  const lineHeight = 26;
  const maxTextWidth = 656;
  ctx.font = "17px system-ui, sans-serif";
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines[lines.length - 1] ?? "";
    const test = last ? last + " " + word : word;
    if (ctx.measureText(test).width > maxTextWidth && last) lines.push(word);
    else lines[lines.length === 0 ? 0 : lines.length - 1] = test;
  }
  if (!lines.length) lines.push(text);
  canvas.width = 712;
  canvas.height = padding * 2 + lines.length * lineHeight;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  ctx.font = "17px system-ui, sans-serif";
  lines.forEach((l, i) => ctx.fillText(l, padding, padding + (i + 1) * lineHeight - 4));
  return canvas.toDataURL("image/png").split(",")[1];
}

type PracticeItem = { id: number; question: string; answer: string; options?: string[] };

type IdentifyDiagnosis = {
  mode: "identify";
  error_category: string;
  error_tag: string;
  explanation: string;
  what_happened?: string;
  core_concept?: string;
  recognition_cue?: string;
  underlying_concept?: string;
  practice_problems: PracticeItem[];
};

type GuideDiagnosis = {
  mode: "guide";
  question_summary: string;
  what_happened?: string;
  core_concept?: string;
  recognition_cue?: string;
  underlying_concept?: string;
  steps: string[];
  practice_problems: PracticeItem[];
};

type Diagnosis = IdentifyDiagnosis | GuideDiagnosis;

type NavState = {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  inputText?: string;
  diagnosis?: Diagnosis;
  mode?: "guide" | "identify";
  guest?: boolean;
};

type ReportTab = "steps" | "error" | "concept" | "practice" | "model";

// ── Model matching ────────────────────────────────────────────────────────────

interface ModelEntry { title: string; Component: React.ComponentType }

// Ordered list of keyword → model mappings. All matches are returned.
const MODEL_MAP: { keywords: string[]; model: ModelEntry }[] = [
  { keywords: ["unit circle","sin","cos","tan","sine","cosine","tangent","radian","trig ratio"], model: { title: "Unit Circle", Component: UnitCircle } },
  { keywords: ["law of sine","law of cosine","sine rule","cosine rule","non-right triangle","oblique"], model: { title: "Law of Sines & Cosines", Component: LawOfSinesCosines } },
  { keywords: ["trig identit","pythagorean identit","double angle","sum to product","compound angle"], model: { title: "Trig Identities", Component: TrigIdentities } },
  { keywords: ["pythagorean theorem","right triangle","hypotenuse","a² + b²"], model: { title: "Pythagorean Theorem", Component: PythagoreanTheorem } },
  { keywords: ["similar triangle","scale factor","proportional sides"], model: { title: "Similar Triangles", Component: SimilarTriangles } },
  { keywords: ["quadratic","parabola","discriminant","vertex","roots of","factori"], model: { title: "Quadratic Equations", Component: QuadraticEquations } },
  { keywords: ["conic","ellipse","hyperbola","parabola equation","eccentricity"], model: { title: "Conic Sections", Component: ConicSections } },
  { keywords: ["derivative","differentiat","chain rule","product rule","quotient rule","slope of","rate of change","gradient"], model: { title: "The Derivative", Component: TheDerivative } },
  { keywords: ["integral","integrat","area under","antiderivative","fundamental theorem"], model: { title: "Definite Integrals", Component: DefiniteIntegrals } },
  { keywords: ["limit","continuity","approaching","l'hôpital","l'hopital"], model: { title: "Limits & Continuity", Component: LimitsAndContinuity } },
  { keywords: ["taylor","maclaurin","power series expansion"], model: { title: "Taylor Series", Component: TaylorSeries } },
  { keywords: ["differential equation","ode","separation of variable","first order","second order"], model: { title: "Differential Equations", Component: DifferentialEquations } },
  { keywords: ["logarithm","log base","ln ","natural log","exponential equation"], model: { title: "Logarithms", Component: Logarithms } },
  { keywords: ["sequence","series","arithmetic","geometric sequence","geometric series","convergence","divergence","sigma"], model: { title: "Sequences & Series", Component: SequencesSeries } },
  { keywords: ["complex number","argand","modulus argument","imaginary","real part"], model: { title: "Complex Numbers", Component: ComplexNumbers } },
  { keywords: ["vector","dot product","cross product","magnitude direction"], model: { title: "Vectors 2D", Component: Vectors2D } },
  { keywords: ["matrix","transformation","eigenvalue","determinant","linear map"], model: { title: "Matrix Transformations", Component: MatrixTransformations } },
  { keywords: ["optimis","optimiz","maxima","minima","critical point","second derivative test"], model: { title: "Optimisation", Component: Optimization } },
  { keywords: ["linear regression","correlation","line of best fit","least squares"], model: { title: "Linear Regression", Component: LinearRegression } },
  { keywords: ["binomial distribution","binomial probability","n choose r","combination"], model: { title: "Binomial Distribution", Component: BinomialDistribution } },
  { keywords: ["normal distribution","bell curve","z-score","standard deviation","gaussian"], model: { title: "Normal Distribution", Component: NormalDistribution } },
  { keywords: ["inequality","inequalit","number line","absolute value"], model: { title: "Inequalities", Component: Inequalities } },
  { keywords: ["simple harmonic","oscillat","spring","pendulum","shm"], model: { title: "Simple Harmonic Motion", Component: SHM } },
  { keywords: ["wave interference","diffraction","superposition","double slit","young"], model: { title: "Wave Interference", Component: WaveInterference } },
  { keywords: ["optic","refract","reflect","snell","lens","mirror","focal"], model: { title: "Optics", Component: Optics } },
  { keywords: ["circuit","resistor","capacitor","ohm","kirchhoff","voltage","current","emf"], model: { title: "Electric Circuits", Component: ElectricCircuits } },
  { keywords: ["electromagnetic induction","faraday","lenz","flux","induced emf"], model: { title: "EM Induction", Component: EMInduction } },
  { keywords: ["centripetal","circular motion","angular velocity","centrifug"], model: { title: "Centripetal Force", Component: CentripetalForce } },
  { keywords: ["momentum","impulse","conservation of momentum","collision","elastic","inelastic"], model: { title: "Momentum & Impulse", Component: Momentum } },
  { keywords: ["heat transfer","conduction","convection","radiation","thermal"], model: { title: "Heat Transfer", Component: HeatTransfer } },
  { keywords: ["kinetic theory","ideal gas","boltzmann","rms speed","pressure of gas"], model: { title: "Kinetic Theory", Component: KineticTheory } },
  { keywords: ["rotational","moment of inertia","torque","angular momentum"], model: { title: "Rotational Inertia", Component: RotationalInertia } },
  { keywords: ["doppler","frequency shift","moving source"], model: { title: "Doppler Effect", Component: DopplerEffect } },
  { keywords: ["bohr model","atomic orbital","energy level","hydrogen atom","emission spectrum"], model: { title: "Bohr Model", Component: BohrModel } },
  { keywords: ["titration","acid base","buffer","equivalence point","neutralis"], model: { title: "Titration Curves", Component: TitrationCurves } },
  { keywords: ["reaction kinetics","rate constant","activation energy","arrhenius","rate law"], model: { title: "Reaction Kinetics", Component: ReactionKinetics } },
  { keywords: ["ideal gas law","pv=nrt","boyle","charles","avogadro"], model: { title: "Ideal Gas Law", Component: IdealGasLaw } },
  { keywords: ["ph scale","acid","base","hydroxide","hydrogen ion","logarithmic scale"], model: { title: "pH Scale", Component: PHScale } },
  { keywords: ["radioactive decay","half-life","nuclear","alpha","beta","gamma decay"], model: { title: "Radioactive Decay", Component: RadioactiveDecay } },
  { keywords: ["galvanic cell","electrochemical","oxidation","reduction","redox","electrode potential"], model: { title: "Galvanic Cells", Component: GalvanicCells } },
  { keywords: ["le chatelier","equilibrium","equilibrium constant","kc","kp","shift in equilibrium"], model: { title: "Le Chatelier's Principle", Component: LeChatelier } },
  { keywords: ["mitosis","meiosis","cell division","chromosome"], model: { title: "Mitosis & Meiosis", Component: MitosisMeiosis } },
  { keywords: ["dna","double helix","base pair","nucleotide","transcription","replication"], model: { title: "DNA Double Helix", Component: DNADoubleHelix } },
  { keywords: ["photosynthesis","chloroplast","light reaction","calvin cycle","glucose"], model: { title: "Photosynthesis", Component: Photosynthesis } },
  { keywords: ["osmosis","diffusion","concentration gradient","semipermeable"], model: { title: "Osmosis & Diffusion", Component: OsmosisDiffusion } },
  { keywords: ["enzyme","substrate","active site","inhibitor","km","vmax"], model: { title: "Enzyme–Substrate", Component: EnzymeSubstrate } },
  { keywords: ["action potential","neuron","depolarisation","repolarisation","sodium pump"], model: { title: "Action Potential", Component: ActionPotential } },
  { keywords: ["kepler","orbital","elliptical orbit","planet","eccentricity of orbit"], model: { title: "Kepler's Laws", Component: KeplerLaws } },
  { keywords: ["stellar","main sequence","star","hertzsprung","red giant","white dwarf"], model: { title: "Stellar Lifecycle", Component: StellarLifecycle } },
  { keywords: ["greenhouse","global warming","climate","co2","carbon dioxide effect"], model: { title: "Greenhouse Effect", Component: GreenhouseEffect } },
];

function findRelatedModels(diagnosis: Diagnosis | undefined): ModelEntry[] {
  if (!diagnosis) return [];
  const text = [
    (diagnosis as any)?.concept_label,
    (diagnosis as any)?.question_summary,
    (diagnosis as any)?.error_tag,
    (diagnosis as any)?.core_concept,
    (diagnosis as any)?.what_happened,
    (diagnosis as any)?.underlying_concept,
  ].filter(Boolean).join(" ").toLowerCase();

  return MODEL_MAP.filter(({ keywords }) => keywords.some((kw) => text.includes(kw))).map(({ model }) => model);
}

function resolveImageSrc(state: NavState): string | null {
  if (state.imageUrl) return state.imageUrl;
  if (state.imageBase64 && state.mimeType) return `data:${state.mimeType};base64,${state.imageBase64}`;
  return null;
}

// ── Shared upgrade dialog ─────────────────────────────────────────────────────

function UpgradeDialog({ open, onClose, deep = false }: { open: boolean; onClose: () => void; deep?: boolean }) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Lock className={cn("h-4 w-4", deep ? "text-yellow-400" : "text-primary")} />
            {deep ? "Deep plan required" : "Upgrade to unlock"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {deep
              ? "Generating more practice questions is exclusive to the Deep plan."
              : "Upgrade to Intermediate or Deep to access full concept explanations and all practice questions."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex justify-end">
          <Button
            className={deep ? "bg-yellow-400 text-black hover:bg-yellow-400/90" : "bg-primary hover:bg-primary/90"}
            onClick={() => navigate("/pricing")}
          >
            {deep ? "Upgrade to Deep" : "View plans"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Practice tab ──────────────────────────────────────────────────────────────

type MCState = { shuffled: string[]; correctIdx: number; selected: number | null };

function PracticeTab({ problems, plan, onGenerateMore, isGeneratingMore, isLoadingPractice, onAskWhale, userId }: {
  problems: PracticeItem[];
  plan: string;
  onGenerateMore: () => Promise<void>;
  isGeneratingMore: boolean;
  isLoadingPractice: boolean;
  onAskWhale: (text: string) => void;
  userId: string | null;
}) {
  const [mcState, setMcState] = useState<Record<number, MCState>>({});
  const [earnedIds, setEarnedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setMcState(prev => {
      const next = { ...prev };
      for (const p of problems) {
        if (next[p.id] || !p.options || p.options.length < 2) continue;
        const correct = p.options[0];
        const shuffled = [...p.options].sort(() => Math.random() - 0.5);
        next[p.id] = { shuffled, correctIdx: shuffled.indexOf(correct), selected: null };
      }
      return next;
    });
  }, [problems]);

  function handleSelect(id: number, idx: number) {
    const state = mcState[id];
    if (!state || state.selected !== null) return;
    setMcState(prev => ({ ...prev, [id]: { ...prev[id], selected: idx } }));
    const isCorrect = idx === state.correctIdx;
    if (isCorrect && userId && !earnedIds.has(id)) {
      addBonusXP(userId, PRACTICE_CORRECT_XP, "practice");
      setEarnedIds(prev => new Set(prev).add(id));
      window.dispatchEvent(new CustomEvent("whale-notify", {
        detail: { message: `+${PRACTICE_CORRECT_XP} XP — correct!`, type: "success" },
      }));
    }
  }

  if (isLoadingPractice) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Generating practice questions…</p>
        </div>
      </div>
    );
  }

  if (!Array.isArray(problems) || problems.length === 0) {
    return <p className="text-sm text-muted-foreground">No practice problems available.</p>;
  }

  return (
    <>
      <div className="space-y-3">
        {problems.map((p, idx) => {
          const state = mcState[p.id];
          const answered = state?.selected !== null && state?.selected !== undefined;
          return (
            <div key={p.id} className="rounded-lg border border-border bg-secondary/40 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both" style={{ animationDelay: `${idx * 70}ms` }}>
              <p className="mb-3 text-sm font-medium text-foreground">
                <span className="mr-2 text-muted-foreground/60">Q{idx + 1}.</span>
                <RichText text={p.question} />
              </p>

              {state ? (
                <div className="space-y-2">
                  {state.shuffled.map((opt, i) => {
                    const isCorrect = i === state.correctIdx;
                    const isSelected = state.selected === i;
                    let cls = "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ";
                    if (!answered) {
                      cls += "border-border bg-secondary/60 hover:border-primary/40 hover:bg-secondary text-foreground";
                    } else if (isCorrect) {
                      cls += "border-green-500/40 bg-green-500/10 text-green-400 font-semibold";
                    } else if (isSelected) {
                      cls += "border-red-500/30 bg-red-500/10 text-red-400";
                    } else {
                      cls += "border-border/40 bg-secondary/30 text-muted-foreground/50";
                    }
                    return (
                      <button key={i} disabled={answered} onClick={() => handleSelect(p.id, i)} className={cls}>
                        <RichText text={opt} />
                      </button>
                    );
                  })}
                  {answered && (
                    <div className="mt-1 flex items-center justify-between">
                      {state.selected === state.correctIdx ? (
                        <span className="text-xs font-semibold text-green-400">Correct! +{PRACTICE_CORRECT_XP} XP</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Correct answer: <span className="font-semibold text-foreground"><RichText text={state.shuffled[state.correctIdx]} /></span>
                        </span>
                      )}
                      <button
                        onClick={() => onAskWhale(`Help me understand this practice question: ${p.question}`)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                      >
                        <img src="/blue.png" alt="" draggable={false} className="whale-img h-3.5 w-3.5 rounded-full object-cover" />
                        Ask Blue
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Fallback for legacy items without options
                <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                  <RichText text={p.answer} />
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Button
        variant="outline"
        className="mt-4 w-full border-border"
        disabled={isGeneratingMore}
        onClick={onGenerateMore}
      >
        {isGeneratingMore
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <ChevronRight className="mr-2 h-4 w-4" />}
        {isGeneratingMore ? "Generating…" : "Generate more questions"}
      </Button>
    </>
  );
}

// ── Concept tab ───────────────────────────────────────────────────────────────

function ConceptTab({
  whatHappened, coreConcept, recognitionCue, legacyConcept, plan, onMasterClick, isLoadingConcept, onAskWhale,
}: {
  whatHappened?: string; coreConcept?: string; recognitionCue?: string;
  legacyConcept?: string; plan: string; onMasterClick: () => void; isLoadingConcept?: boolean;
  onAskWhale: (text: string) => void;
}) {
  const isPaid = true; // concept tab open to all
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Legacy fallback for old cached scans
  if (!whatHappened) {
    const concept = legacyConcept ?? "";
    const firstSentence = concept.split(/(?<=[.!?])\s+/)[0] ?? concept;
    const hasMore = concept.length > firstSentence.length;
    return (
      <>
        <div className="rounded-lg border border-border bg-secondary/40 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Key Concept</p>
          </div>
          {isPaid ? (
            <p className="text-sm leading-relaxed text-foreground"><RichText text={concept} /></p>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <p className="text-sm leading-relaxed text-foreground line-clamp-2"><RichText text={concept} /></p>
                {hasMore && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-secondary/80 to-transparent" />
                )}
              </div>
              {hasMore && (
                <button onClick={() => setShowUpgrade(true)} className="flex items-center gap-1.5 text-xs text-primary underline underline-offset-2 hover:text-primary/80">
                  <Lock className="h-3 w-3" />
                  Upgrade to read the full explanation
                </button>
              )}
            </div>
          )}
          <Button className="mt-4 w-full bg-primary hover:bg-primary/90" onClick={onMasterClick}>
            Master this concept <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <UpgradeDialog open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      </>
    );
  }

  const sections = [
    {
      id: "concept",
      label: "Explain like I'm 5",
      Icon: Smile,
      content: coreConcept,
      locked: !isPaid,
      cardClass: "border-primary/20 bg-primary/5",
      labelClass: "text-primary",
      iconClass: "text-primary",
      askText: "Explain this concept in more detail",
    },
    {
      id: "cue",
      label: "When you see this",
      Icon: ArrowRight,
      content: recognitionCue,
      locked: !isPaid,
      cardClass: "border-border bg-secondary/60",
      labelClass: "text-muted-foreground",
      iconClass: "text-muted-foreground",
      askText: "When should I use this concept and how do I recognise it?",
    },
  ];

  return (
    <>
      <div className="space-y-3" data-feature="root-cause-analysis-exam-mistakes" data-content="ai-analysis-breakdown,underlying-concept,targeted-practice">
        {sections.map(({ id, label, Icon, content, locked, cardClass, labelClass, iconClass, askText }, idx) => (
          <div key={id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both" style={{ animationDelay: `${idx * 80}ms` }}>
            <div
              className={`relative rounded-lg border p-5 ${cardClass} ${locked ? "cursor-pointer" : ""}`}
              style={{ minHeight: "8rem" }}
              onClick={locked ? () => setShowUpgrade(true) : undefined}
            >
              <div className="mb-2.5 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${iconClass}`} />
                <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${labelClass}`}>{label}</p>
              </div>
              {isLoadingConcept && locked ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading…</span>
                </div>
              ) : locked ? (
                <div className="relative">
                  <div className="overflow-hidden" style={{ maxHeight: "4.2rem" }}>
                    <p className="text-sm leading-relaxed text-foreground select-none">
                      <RichText text={content ?? ""} />
                    </p>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0 bg-gradient-to-b from-transparent via-card/70 to-card" style={{ top: "1.4rem" }} />
                  <div className="relative mt-2 flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-primary" />
                    <span className="text-xs font-semibold text-primary">Upgrade to unlock</span>
                  </div>
                </div>
              ) : isLoadingConcept ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading…</span>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-foreground">
                    <RichText text={content ?? ""} />
                  </p>
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <button
                      onClick={() => onAskWhale(askText)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                      <img src="/blue.png" alt="" draggable={false} className="whale-img h-3.5 w-3.5 rounded-full object-cover" />
                      Ask Blue
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        <Button className="w-full bg-primary hover:bg-primary/90" onClick={onMasterClick}>
          Practice this concept <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <UpgradeDialog open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}

// ── Identify error tab ────────────────────────────────────────────────────────

function IdentifyErrorTab({ diagnosis }: { diagnosis: IdentifyDiagnosis }) {
  const categoryColor: Record<string, string> = {
    Conceptual: "bg-destructive/10 text-destructive border-destructive/20",
    Procedural: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
    Computational: "bg-orange-400/10 text-orange-400 border-orange-400/20",
    Notational: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  };

  if (diagnosis.error_category === "Correct") {
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-5">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-green-500">All correct</p>
        </div>
        <p className="text-sm leading-relaxed text-foreground">Your working is correct. Check the Concept and Practice tabs to strengthen your understanding.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("border text-xs font-semibold", categoryColor[diagnosis.error_category] ?? "bg-secondary text-foreground")}>
          {diagnosis.error_category}
        </Badge>
        <span className="rounded-full border border-border bg-secondary px-3 py-0.5 text-xs font-medium text-foreground">
          {diagnosis.error_tag}
        </span>
      </div>
      <div className="rounded-lg border border-border bg-secondary/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 text-destructive" />
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Where you went wrong</p>
        </div>
        <p className="text-sm leading-relaxed text-foreground"><RichText text={diagnosis.explanation} /></p>
      </div>
    </div>
  );
}

// ── Steps tab ─────────────────────────────────────────────────────────────────

// ── Blue markdown renderer ─────────────────────────────────────────────────

function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\$\$[^$]+\$\$|\*\*[^*]+\*\*|\$[^$]+\$)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold text-primary">{part.slice(2, -2)}</strong>;
        if (part.startsWith("$") && part.endsWith("$"))
          return <RichText key={i} text={part} />;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function WhaleMd({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      nodes.push(<p key={i} className="mt-2 mb-0.5 text-xs font-semibold text-foreground"><InlineMd text={line.slice(4)} /></p>);
    } else if (line.startsWith("## ")) {
      nodes.push(<p key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wide text-primary first:mt-0"><InlineMd text={line.slice(3)} /></p>);
    } else if (line.startsWith("# ")) {
      nodes.push(<p key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wide text-primary first:mt-0"><InlineMd text={line.slice(2)} /></p>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-1.5 space-y-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm leading-snug text-foreground">
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span><InlineMd text={item} /></span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === "") {
      nodes.push(<div key={i} className="h-1.5" />);
    } else {
      nodes.push(<p key={i} className="text-sm leading-relaxed text-foreground"><InlineMd text={line} /></p>);
    }
    i++;
  }
  return <div className="space-y-0.5">{nodes}</div>;
}

// ── Blue inline chat ────────────────────────────────────────────────────────

type ChatMsg = { role: "user" | "assistant"; content: string; attachment?: { label: string; content: string } };

const WHALE_CREDIT_LIMIT = 100;

function WhaleCreditCircle({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(used / limit, 1);
  const r = 8;
  const circ = 2 * Math.PI * r;
  const filled = pct * circ;
  const isOut = used >= limit;
  const stroke = isOut ? "#ef4444" : pct >= 0.75 ? "#f59e0b" : "hsl(var(--primary))";
  return (
    <div className="group relative shrink-0 self-center cursor-default">
      <svg width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r={r} fill="none" strokeWidth="3" stroke="hsl(var(--border))" />
        {filled > 0 && (
          <circle cx="11" cy="11" r={r} fill="none" strokeWidth="3" stroke={stroke}
            strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" transform="rotate(-90 11 11)" />
        )}
      </svg>
      <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 z-50">
        {isOut ? "Daily limit reached. Resets at midnight." : `${100 - Math.round(pct * 100)}% left`}
      </div>
    </div>
  );
}

function WhaleChatPanel({ diagnosis, onClose, pendingMessage, onMessageHandled, plan }: {
  diagnosis: Diagnosis | undefined;
  onClose: () => void;
  pendingMessage?: string | null;
  onMessageHandled?: () => void;
  plan: string;
}) {
  const conceptLabel = (diagnosis as any)?.concept_label ?? "";
  const questionSummary = (diagnosis as any)?.question_summary ?? "";
  const whatHappened = (diagnosis as any)?.what_happened ?? "";
  const coreConcept = (diagnosis as any)?.core_concept ?? "";
  const underlyingConcept = (diagnosis as any)?.underlying_concept ?? "";
  const errorTag = (diagnosis as any)?.error_tag ?? "";
  const topic = conceptLabel || questionSummary;
  const greeting = topic
    ? `I've read your scan on **${topic}**. What would you like to understand better?`
    : "I've read your scan. What would you like to understand better?";
  const stepContext = [
    "The user has a scan loaded. Answer questions based on this context and do not ask them to upload a screenshot.",
    topic && `Topic: ${topic}`,
    questionSummary && `Question: ${questionSummary}`,
    whatHappened && `Problem context: ${whatHappened}`,
    coreConcept && `Core concept: ${coreConcept}`,
    underlyingConcept && `Underlying concept: ${underlyingConcept}`,
    errorTag && `Error identified: ${errorTag}`,
  ].filter(Boolean).join("\n");

  const SUGGESTIONS = [
    "Explain this concept in simpler terms",
    "What's the most common mistake here?",
    "Give me a tip to remember this for exams",
  ];

  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [attachment, setAttachment] = useState<{ label: string; content: string; original: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function parseAttachment(text: string): { label: string; content: string; original: string } {
    const stepMatch = text.match(/^Explain step (\d+): ([\s\S]*)$/);
    if (stepMatch) return { label: `Step ${stepMatch[1]}`, content: stepMatch[2], original: text };
    const practiceMatch = text.match(/^Help me understand this practice question: ([\s\S]*)$/);
    if (practiceMatch) return { label: "Practice question", content: practiceMatch[1], original: text };
    return { label: "Context", content: text, original: text };
  }

  useEffect(() => {
    if (plan === "deep") return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await (supabase as any).from("profiles").select("whale_chat_credits,whale_chat_date").eq("id", user.id).single();
      if (!data) return;
      const today = new Date().toISOString().split("T")[0];
      setCreditsUsed(data.whale_chat_date === today ? (data.whale_chat_credits ?? 0) : 0);
    });
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (pendingMessage) {
      setAttachment(parseAttachment(pendingMessage));
      setInput("");
      setShowSuggestions(false);
      onMessageHandled?.();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pendingMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text: string) {
    const trimmed = text.trim();
    const combined = attachment
      ? (trimmed ? `${trimmed}\n\n${attachment.original}` : attachment.original)
      : trimmed;
    if (!combined || loading) return;
    if (plan !== "deep" && creditsUsed >= WHALE_CREDIT_LIMIT) {
      setShowLimitDialog(true);
      return;
    }
    setShowSuggestions(false);
    setInput("");
    const displayLabel = attachment
      ? (trimmed ? trimmed : `[${attachment.label}]`)
      : trimmed;
    const currentAttachment = attachment;
    setAttachment(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
    // Show a clean display message; send full combined content to AI
    const displayMsg: ChatMsg = { role: "user", content: displayLabel, attachment: currentAttachment };
    const apiMsg: ChatMsg = { role: "user", content: combined };
    setMessages((prev) => [...prev, displayMsg]);
    const apiHistory = [...messages, apiMsg];
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-assistant", {
        body: { messages: apiHistory, stepContext },
      });
      if ((data as any)?.error === "daily_limit_reached") {
        setCreditsUsed(WHALE_CREDIT_LIMIT);
        setMessages((prev) => [...prev, { role: "assistant", content: "You've reached your daily Blue limit. Come back tomorrow, or upgrade to Deep for unlimited chats." }]);
        setLoading(false);
        return;
      }
      const reply = (!error && (data as any)?.reply) ? (data as any).reply : "Something went wrong. Try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if ((data as any)?.creditsUsed !== undefined) setCreditsUsed((data as any).creditsUsed);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    }
    setLoading(false);
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/blue.png" alt="" draggable={false} className="whale-img h-5 w-5 object-contain" />
          <span className="text-sm font-semibold text-foreground">Blue</span>
        </div>
        <button
          onClick={onClose}
          title="Slide out"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i}>
            {m.role === "user" ? (
              <div className="flex justify-end">
                <div className="flex flex-col gap-2 max-w-[85%]">
                  {m.attachment && (
                    <div className="rounded-xl border border-border bg-secondary/60 px-3 py-2 text-xs self-end">
                      <div className="font-semibold text-foreground mb-1">{m.attachment.label}</div>
                      <p className="text-muted-foreground line-clamp-2 leading-relaxed">{m.attachment.content}</p>
                    </div>
                  )}
                  <div className="rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                </div>
              </div>
            ) : (
              <WhaleMd text={m.content} />
            )}
          </div>
        ))}

        {/* Suggestion chips */}
        {showSuggestions && !loading && (
          <div className="flex flex-col gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="w-fit rounded-xl border border-border bg-secondary/50 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">Thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-3 space-y-2">
        {/* Step attachment chip */}
        {attachment && (
          <div className="rounded-xl border border-border bg-secondary/60 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-foreground">{attachment.label}</span>
              <button
                onClick={() => setAttachment(null)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-muted-foreground line-clamp-2 leading-relaxed">{attachment.content}</p>
          </div>
        )}
        <div className="flex items-end gap-2">
          {plan !== "deep" && <WhaleCreditCircle used={creditsUsed} limit={WHALE_CREDIT_LIMIT} />}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); if (e.target.value) setShowSuggestions(false); }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={attachment ? "Ask about this step…" : "Ask anything…"}
            className="flex-1 resize-none rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            style={{ maxHeight: 120, overflowY: "auto" }}
          />
          <button
            onClick={() => send(input)}
            disabled={(!input.trim() && !attachment) || loading}
            className="rounded-xl bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Get Deep dialog when daily limit is reached */}
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent className="border border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <img src="/blue.png" alt="" draggable={false} className="whale-img h-7 w-7 object-contain" />
              Daily limit reached
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You've used all your daily Blue messages. Upgrade to Deep for unlimited chats — no daily cap, ever.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end">
            <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate("/pricing")}>
              Get Deep
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepsTab({ diagnosis, steps, revealed, setRevealed, plan, isLoading, imageSrc, inputText, onImageClick, onAskWhale, onRetry }: {
  diagnosis: GuideDiagnosis;
  steps: string[];
  revealed: number;
  setRevealed: React.Dispatch<React.SetStateAction<number>>;
  plan: string;
  isLoading?: boolean;
  imageSrc?: string | null;
  inputText?: string | null;
  onImageClick?: () => void;
  onAskWhale: (text: string) => void;
  onRetry?: () => void;
}) {
  const isPaid = true; // concept tab open to all

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Generating steps…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Uploaded image or typed question at the top */}
      {imageSrc ? (
        <div className="sticky top-0 z-10 rounded-xl border border-border bg-secondary/40 p-2 flex items-center justify-center">
          <img
            src={imageSrc}
            alt="Your question"
            className="max-h-56 w-full cursor-zoom-in rounded-lg object-contain"
            onClick={onImageClick}
          />
        </div>
      ) : inputText ? (
        <div className="sticky top-0 z-10 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
          <p className="whitespace-pre-wrap leading-relaxed">{inputText}</p>
        </div>
      ) : null}
      {steps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading steps…</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {steps.slice(0, revealed).map((step, i) => (
              <div key={i} className="rounded-lg border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground leading-relaxed"><RichText text={step} /></p>
                </div>
                {isPaid && (
                  <div className="mt-3 border-t border-primary/10 pt-3">
                    <button
                      onClick={() => onAskWhale(`Explain step ${i + 1}: ${step}`)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                      <img src="/blue.png" alt="" draggable={false} className="whale-img h-3.5 w-3.5 rounded-full object-cover" />
                      Ask Blue about this step
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {revealed < steps.length ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setRevealed((v) => v + 1)}>
                Show next step
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" className="border-border" onClick={() => setRevealed(steps.length)}>
                Show all
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">All steps revealed.</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const BlindSpotReport = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const state = resolveReportState(location.state);
  const diagnosis = state.diagnosis;
  const mode = state.mode ?? (diagnosis as any)?.mode ?? "guide";
  const imageSrc = resolveImageSrc(state);
  const inputText = state.inputText ?? null;
  const scanId = (state as any).scanId as string | undefined;
  const isGuest = !!(state as any).guest;

  const [displaySrc, setDisplaySrc] = useState<string | null>(imageSrc);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [whaleOpen, setWhaleOpen] = useState(true);
  const [pendingWhaleMessage, setPendingWhaleMessage] = useState<string | null>(null);

  function askWhale(text: string) {
    setWhaleOpen(true);
    setPendingWhaleMessage(text);
  }
  const [splitLeft, setSplitLeft] = useState(60);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 35), 78);
      if (leftPaneRef.current) leftPaneRef.current.style.width = `${pct}%`;
      if (rightPaneRef.current) rightPaneRef.current.style.width = `calc(${100 - pct}% - 6px)`;
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Re-enable transition after drag ends
      if (leftPaneRef.current) leftPaneRef.current.style.transition = "";
      if (rightPaneRef.current) rightPaneRef.current.style.transition = "";
      if (splitContainerRef.current && leftPaneRef.current) {
        const rect = splitContainerRef.current.getBoundingClientRect();
        const pct = (leftPaneRef.current.getBoundingClientRect().width / rect.width) * 100;
        setSplitLeft(Math.min(Math.max(pct, 35), 78));
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // Editable scan title — also syncs when navigating between scans
  const derivedTitle = () => {
    if (scanId) {
      try {
        const labState = JSON.parse(localStorage.getItem("gogodeep_lab_v1") ?? "{}");
        if (labState.names?.[scanId]) return labState.names[scanId];
      } catch { /* ignore */ }
    }
    return (diagnosis as any)?.concept_label ?? (diagnosis as any)?.question_summary ?? "Scan";
  };
  const [scanTitle, setScanTitle] = useState<string>(derivedTitle);
  useEffect(() => { setScanTitle(derivedTitle()); }, [scanId, (diagnosis as any)?.concept_label, (diagnosis as any)?.question_summary]); // eslint-disable-line react-hooks/exhaustive-deps
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  function startTitleEdit() {
    if (!scanId) return;
    setTitleDraft(scanTitle);
    setTitleEditing(true);
  }

  function commitTitleRename() {
    const trimmed = titleDraft.trim();
    if (!trimmed || !scanId) { setTitleEditing(false); return; }
    setScanTitle(trimmed);
    setTitleEditing(false);
    try {
      const key = "gogodeep_lab_v1";
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      const names = { ...(stored.names ?? {}), [scanId]: trimmed };
      const next = { ...stored, names };
      localStorage.setItem(key, JSON.stringify(next));
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) (supabase as any).from("profiles").update({ lab_state: next }).eq("id", user.id);
      });
      window.dispatchEvent(new CustomEvent("gogodeep-scan-renamed", { detail: { scanId, name: trimmed } }));
    } catch { /* ignore */ }
  }

  const [plan, setPlan] = useState<string>("free");
  const [planLoaded, setPlanLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>(mode === "guide" ? "steps" : "error");
  const [revealedSteps, setRevealedSteps] = useState(1);
  const [extraProblems, setExtraProblems] = useState<PracticeItem[]>([]);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [lazyConceptData, setLazyConceptData] = useState<{ core_concept?: string; recognition_cue?: string } | null>(null);
  const [lazyPractice, setLazyPractice] = useState<PracticeItem[] | null>(null);
  const [lazySteps, setLazySteps] = useState<string[] | null>(null);
  const [loadingConcept, setLoadingConcept] = useState(false);
  const [loadingPractice, setLoadingPractice] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const fetchStepsMounted = useRef(true);
  useEffect(() => { return () => { fetchStepsMounted.current = false; }; }, []);

  // Keep displaySrc in sync when navigation brings a new image
  useEffect(() => {
    setDisplaySrc(imageSrc);
  }, [imageSrc]);

  // Revoke blob URL on unmount to avoid memory leak
  useEffect(() => {
    return () => {
      if (imageSrc?.startsWith("blob:")) URL.revokeObjectURL(imageSrc);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return;
      if (!user) { setPlanLoaded(true); return; }
      const { data } = await (supabase as any)
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();
      if (mounted) { setPlan(data?.plan ?? "free"); setPlanLoaded(true); setUserId(user.id); }
    });
    return () => { mounted = false; };
  }, []);

  // Lazy load steps if they are missing from the diagnosis (always fetch — credit-independent)
  const fetchSteps = useCallback(() => {
    if (loadingSteps) return;
    const topic = (diagnosis as any)?.concept_label ?? (diagnosis as any)?.underlying_concept ?? (diagnosis as any)?.error_tag ?? (diagnosis as any)?.question_summary ?? "STEM";
    const questionSummary = (diagnosis as any)?.question_summary ?? (diagnosis as any)?.what_happened ?? "";
    setLoadingSteps(true);
    supabase.functions.invoke("diagnose-image", {
      body: { text: questionSummary || topic, mode: "guide_steps", complexity: 2 },
    }).then(({ data, error }) => {
      if (!fetchStepsMounted.current) return;
      setLoadingSteps(false);
      if (error || (data as any)?.error) return;
      const steps: string[] = Array.isArray((data as any)?.steps) ? (data as any).steps : [];
      if (steps.length) {
        setLazySteps(steps);
        setRevealedSteps(1);
        if (scanId) {
          try {
            const key = SCAN_CACHE_KEY(scanId);
            const cached = localStorage.getItem(key);
            if (cached) {
              const parsed = JSON.parse(cached);
              parsed.diagnosis = { ...parsed.diagnosis, steps };
              localStorage.setItem(key, JSON.stringify(parsed));
            }
          } catch { /* ignore */ }
        }
      }
    });
  }, [diagnosis, loadingSteps, scanId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const existingSteps = Array.isArray((diagnosis as any)?.steps) ? (diagnosis as any).steps as string[] : [];
    if (existingSteps.length > 0) return;
    if (lazySteps !== null) return;
    fetchSteps();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy load concept when Concept tab is first clicked
  useEffect(() => {
    if (activeTab !== "concept") return;
    if (loadingConcept || lazyConceptData) return;
    if ((diagnosis as any)?.core_concept) return; // already in cached diagnosis
    const topic = (diagnosis as any)?.concept_label ?? (diagnosis as any)?.question_summary ?? "STEM";
    const complexity = parseInt(localStorage.getItem("gogodeep_complexity") ?? "2", 10);
    let mounted = true;
    setLoadingConcept(true);
    supabase.functions.invoke("diagnose-image", {
      body: { mode: "guide_concept", topic, what_happened: (diagnosis as any)?.what_happened, complexity },
    }).then(({ data, error }) => {
      if (!mounted) return;
      setLoadingConcept(false);
      if (error || (data as any)?.error) { whaleToast.error("Failed to load concept."); return; }
      const result = { core_concept: (data as any)?.core_concept, recognition_cue: (data as any)?.recognition_cue };
      setLazyConceptData(result);
      if (scanId) {
        try {
          const key = SCAN_CACHE_KEY(scanId);
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            parsed.diagnosis = { ...parsed.diagnosis, ...result };
            localStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch { /* ignore */ }
      }
    });
    return () => { mounted = false; };
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy load practice when Practice tab is first clicked (waits for plan)
  useEffect(() => {
    if (activeTab !== "practice") return;
    if (!planLoaded) return;
    if (loadingPractice || lazyPractice !== null) return;
    if (Array.isArray((diagnosis as any)?.practice_problems) && (diagnosis as any).practice_problems.length > 0) return;
    const topic = (diagnosis as any)?.concept_label ?? (diagnosis as any)?.question_summary ?? "STEM";
    const practice_count = 3;
    let mounted = true;
    setLoadingPractice(true);
    supabase.functions.invoke("diagnose-image", {
      body: { mode: "more_practice", topic, practice_count, start_id: 1 },
    }).then(({ data, error }) => {
      if (!mounted) return;
      setLoadingPractice(false);
      if (error || (data as any)?.error) { whaleToast.error("Failed to load practice questions."); return; }
      const problems: PracticeItem[] = (data as any)?.practice_problems ?? [];
      setLazyPractice(problems);
      if (scanId) {
        try {
          const key = SCAN_CACHE_KEY(scanId);
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            parsed.diagnosis = { ...parsed.diagnosis, practice_problems: problems };
            localStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch { /* ignore */ }
      }
    });
    return () => { mounted = false; };
  }, [activeTab, planLoaded]); // eslint-disable-line react-hooks/exhaustive-deps


  const generateMoreProblems = useCallback(async () => {
    if (isGeneratingMore) return;
    setIsGeneratingMore(true);
    const basePractice = lazyPractice ?? (Array.isArray(diagnosis?.practice_problems) ? diagnosis.practice_problems : []);
    const allProblems = [...basePractice, ...extraProblems];
    const topic = (diagnosis as any)?.concept_label ?? (diagnosis as any)?.question_summary ?? "STEM";
    const { data, error } = await supabase.functions.invoke("diagnose-image", {
      body: { mode: "more_practice", topic, practice_count: 2, start_id: allProblems.length + 1 },
    });
    setIsGeneratingMore(false);
    if (error || (data as any)?.error) {
      whaleToast.error("Failed to generate more questions.");
      return;
    }
    const newProblems: PracticeItem[] = (data as any)?.practice_problems ?? [];
    setExtraProblems((prev) => [...prev, ...newProblems]);
  }, [diagnosis, extraProblems, isGeneratingMore]);

  if (!diagnosis) {
    return (
      <EducatorLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="space-y-4 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">No report available</p>
            <p className="text-sm text-muted-foreground">Upload an image in the Workspace first.</p>
            <Link to="/workspace">
              <Button variant="outline" className="mt-4 gap-2 border-border">
                <ArrowLeft className="h-3.5 w-3.5" />
                Go to Lab
              </Button>
            </Link>
          </div>
        </div>
      </EducatorLayout>
    );
  }

  const effectiveSteps = (lazySteps ?? (Array.isArray((diagnosis as any).steps) ? (diagnosis as any).steps as string[] : [])).filter((s: string) => s.trim());
  const basePractice = lazyPractice ?? (Array.isArray(diagnosis.practice_problems) ? diagnosis.practice_problems : []);
  const practice = [...basePractice, ...extraProblems];
  const effectiveConcept = lazyConceptData?.core_concept ?? (diagnosis as any)?.core_concept;
  const effectiveRecognitionCue = lazyConceptData?.recognition_cue ?? (diagnosis as any)?.recognition_cue;
  const relatedModels = findRelatedModels(diagnosis);

  const scanXP = calcScanXP(
    (diagnosis as any)?.concept_label ?? (diagnosis as any)?.question_summary ?? null,
    (diagnosis as any)?.error_category ?? null
  );

  const titleHeaderContent = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="min-w-0 flex-1">
        {titleEditing ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitleRename();
              if (e.key === "Escape") setTitleEditing(false);
            }}
            className="w-full bg-transparent text-2xl font-bold tracking-tight text-foreground outline-none border-b border-primary"
          />
        ) : (
          <h1
            onClick={startTitleEdit}
            title={scanId ? "Click to rename" : undefined}
            className={cn("truncate text-2xl font-bold tracking-tight text-foreground", scanId && "cursor-text hover:text-primary/80 transition-colors")}
          >
            {scanTitle}
          </h1>
        )}
      </div>
      <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-black text-primary">
        +{scanXP} XP
      </span>
    </div>
  );

  const tabList = mode === "guide"
    ? [
        { value: "steps" as ReportTab, label: "Step by Step", Icon: ArrowRight },
        { value: "concept" as ReportTab, label: "Concept", Icon: Lightbulb },
        { value: "practice" as ReportTab, label: "Practice", Icon: ClipboardList },
      ]
    : [
        { value: "error" as ReportTab, label: "Error Found", Icon: TriangleAlert },
        { value: "concept" as ReportTab, label: "Concept", Icon: Lightbulb },
        { value: "practice" as ReportTab, label: "Practice", Icon: ClipboardList },
      ];
  const activeIdx = tabList.findIndex((t) => t.value === activeTab);

  return (
    <EducatorLayout headerContent={titleHeaderContent} fullBleed noSidebar>
      <Helmet>
        <title>Report</title>
        <meta name="description" content="See the root cause of your mistake, the underlying concept explained, and targeted practice to close the gap. AI working analysis for IB, AP, and A-Level STEM subjects." />
        <link rel="canonical" href="https://gogodeep.com/report" />
      </Helmet>

      {/* Resizable split container */}
      <div ref={splitContainerRef} className="relative flex h-full min-h-0">

        {/* ── Left: tabs ───────────────────────────────────────────────────── */}
        <div
          ref={leftPaneRef}
          style={{ width: whaleOpen ? `${splitLeft}%` : "100%" }}
          className="flex min-w-0 flex-col overflow-y-auto transition-[width] duration-300 ease-in-out"
        >
          <div className="p-6 space-y-4">
            {/* Guest signup banner */}
            {isGuest && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Save your results</p>
                  <p className="text-xs text-muted-foreground">Create a free account to keep this scan and get more.</p>
                </div>
                <Button className="shrink-0 bg-primary hover:bg-primary/90 text-xs h-8 px-3" onClick={() => navigate("/signup")}>
                  Sign up free
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {/* Tab bar */}
            <div className="relative flex w-full rounded-md border border-border bg-secondary p-1">
              <div
                className="absolute bottom-1 top-1 rounded-sm bg-card shadow-sm transition-transform duration-200 ease-out"
                style={{ width: `calc((100% - 8px) / ${tabList.length})`, transform: `translateX(calc(${activeIdx} * 100%))` }}
              />
              {tabList.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-sm py-1.5 text-xs sm:text-sm font-medium transition-colors duration-200 ${
                    activeTab === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
                  <span className="hidden sm:inline truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both">
              {activeTab === "steps" && (
                <StepsTab
                  diagnosis={diagnosis as GuideDiagnosis}
                  steps={effectiveSteps}
                  revealed={revealedSteps}
                  setRevealed={setRevealedSteps}
                  plan={plan}
                  isLoading={loadingSteps}
                  imageSrc={displaySrc}
                  inputText={inputText}
                  onImageClick={() => setLightboxOpen(true)}
                  onAskWhale={askWhale}
                  onRetry={fetchSteps}
                />
              )}
              {activeTab === "error" && <IdentifyErrorTab diagnosis={diagnosis as IdentifyDiagnosis} />}
              {activeTab === "concept" && (
                <ConceptTab
                  whatHappened={diagnosis.what_happened}
                  coreConcept={effectiveConcept}
                  recognitionCue={effectiveRecognitionCue}
                  legacyConcept={diagnosis.underlying_concept}
                  plan={plan}
                  onMasterClick={() => setActiveTab("practice")}
                  isLoadingConcept={loadingConcept}
                  onAskWhale={askWhale}
                />
              )}
              {activeTab === "practice" && (
                <PracticeTab
                  problems={practice}
                  plan={plan}
                  onGenerateMore={generateMoreProblems}
                  isGeneratingMore={isGeneratingMore}
                  isLoadingPractice={loadingPractice}
                  onAskWhale={askWhale}
                  userId={userId}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Draggable divider ─────────────────────────────────────────────── */}
        <div
          className={cn(
            "shrink-0 cursor-col-resize bg-border transition-all duration-300 hover:bg-primary/30",
            whaleOpen ? "w-1.5" : "w-0"
          )}
          onMouseDown={() => {
            if (!whaleOpen) return;
            dragging.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            // Kill transition during drag so it follows mouse instantly
            if (leftPaneRef.current) leftPaneRef.current.style.transition = "none";
            if (rightPaneRef.current) rightPaneRef.current.style.transition = "none";
          }}
        />

        {/* ── Right: Blue chat ───────────────────────────────────────────── */}
        <div
          ref={rightPaneRef}
          style={{ width: whaleOpen ? `calc(${100 - splitLeft}% - 6px)` : "0" }}
          className="min-w-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
        >
          <WhaleChatPanel diagnosis={diagnosis} onClose={() => setWhaleOpen(false)} pendingMessage={pendingWhaleMessage} onMessageHandled={() => setPendingWhaleMessage(null)} plan={plan} />
        </div>

        {/* ── Pull tab when Blue is closed ───────────────────────────────── */}
        <div
          className={cn(
            "absolute right-0 top-1/2 z-20 -translate-y-1/2 transition-all duration-300",
            whaleOpen ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
          )}
        >
          <button
            onClick={() => setWhaleOpen(true)}
            title="Open Blue"
            className="flex flex-col items-center gap-2 rounded-l-xl border border-r-0 border-border bg-card px-2 py-5 shadow-lg transition-colors hover:bg-secondary"
          >
            <img src="/blue.png" alt="" draggable={false} className="whale-img h-5 w-5 object-contain" />
            <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && displaySrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={displaySrc}
            alt="Uploaded work"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </EducatorLayout>
  );
};

export default BlindSpotReport;
