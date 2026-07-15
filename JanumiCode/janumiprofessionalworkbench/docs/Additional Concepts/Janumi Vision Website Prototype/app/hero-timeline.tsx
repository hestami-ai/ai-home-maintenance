"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Milestone = {
  id: string;
  date: string;
  shortDate: string;
  title: string;
  position: number;
  photo: string;
  photoAlt: string;
  objectPosition: string;
  statement: string;
  evidence: string;
  systems: [string, string, string];
  lenses: {
    knowledge: string;
    coordination: string;
    assurance: string;
    horizon: string;
  };
  photoCredit: string;
  photoSource: string;
  photoQualifier: string;
  factSource: string;
};

const milestones: Milestone[] = [
  {
    id: "giza",
    date: "c. 2560 BCE",
    shortDate: "2560 BCE",
    title: "Great Pyramid of Giza",
    position: 0,
    photo: "/images/capability-timeline/giza.webp",
    photoAlt: "The Great Sphinx and the pyramids at Giza",
    objectPosition: "50% 45%",
    statement:
      "Geometry became logistics, materials, labor, and institutional continuity at civilizational scale.",
    evidence:
      "The monument is visible. The enduring achievement is the coordinated capability that made millions of individual acts cohere.",
    systems: ["GEOMETRY", "MATERIAL FLOW", "INSTITUTIONAL TIME"],
    lenses: {
      knowledge: "Surveying, geometry, quarrying, transport, and craft knowledge had to converge.",
      coordination: "People, stone, tools, food, and sequence became one operating system.",
      assurance: "Alignment, level, fit, and structural stability were continuously made observable.",
      horizon: "Decades of execution; millennia of consequence.",
    },
    photoCredit: "Alex Azabache · Unsplash",
    photoSource:
      "https://unsplash.com/photos/the-great-pyramid-of-giza-tomb-in-egypt-MoonoldXeqs",
    photoQualifier: "Giza complex, with the Sphinx in the foreground",
    factSource: "https://whc.unesco.org/en/list/86/",
  },
  {
    id: "colosseum",
    date: "80 CE",
    shortDate: "80 CE",
    title: "Roman Colosseum",
    position: 10.2,
    photo: "/images/capability-timeline/colosseum.webp",
    photoAlt: "The exterior arches of the Roman Colosseum",
    objectPosition: "52% 45%",
    statement:
      "Structure, circulation, civic infrastructure, and continuing operation became one public system.",
    evidence:
      "Its material form depended on an equally consequential architecture of access, safety, maintenance, authority, and use.",
    systems: ["CIVIC SYSTEM", "CIRCULATION", "OPERATIONS"],
    lenses: {
      knowledge: "Concrete, vaulting, crowd movement, water, and public administration were integrated.",
      coordination: "A civic institution synchronized builders, operators, performers, and audiences.",
      assurance: "Load paths, entrances, routes, and operating rules constrained safe use.",
      horizon: "A decade to build; centuries of adaptation.",
    },
    photoCredit: "Mathew Schwartz · Unsplash",
    photoSource: "https://unsplash.com/photos/the-colosseum-rome-Kyxejaf39vM",
    photoQualifier: "Exact exterior view of the Colosseum",
    factSource: "https://colosseo.it/en/area/the-colosseum/",
  },
  {
    id: "cathedral",
    date: "1248–1880",
    shortDate: "1248",
    title: "Cologne Cathedral",
    position: 20.6,
    photo: "/images/capability-timeline/cologne-cathedral.webp",
    photoAlt: "Cologne Cathedral illuminated at dusk beside the Rhine",
    objectPosition: "42% 50%",
    statement:
      "Professional intent and craft knowledge crossed institutions, interruptions, and generations.",
    evidence:
      "The long interruption is part of the lesson: capability survives only when knowledge, representations, and purpose can be recovered.",
    systems: ["KNOWLEDGE LINEAGE", "CRAFT", "GENERATIONS"],
    lenses: {
      knowledge: "Geometry, stone craft, iconography, and structural judgment were carried forward.",
      coordination: "Many generations resumed, revised, and completed a shared professional intent.",
      assurance: "Templates, drawings, guild practice, inspection, and restoration preserved coherence.",
      horizon: "Centuries between foundation and completion; continuing stewardship thereafter.",
    },
    photoCredit: "Soroush H. Zargarbashi · Unsplash",
    photoSource:
      "https://unsplash.com/photos/cologne-cathedral-at-dusk-reflected-in-the-water-kSyNwLkjvHw",
    photoQualifier: "Construction began in the medieval era and concluded in 1880",
    factSource: "https://whc.unesco.org/en/list/292/",
  },
  {
    id: "boeing-747",
    date: "1969",
    shortDate: "1969",
    title: "Boeing 747",
    position: 51.9,
    photo: "/images/capability-timeline/boeing-747.webp",
    photoAlt: "A Boeing 747 climbing through a cloudy sky",
    objectPosition: "54% 44%",
    statement:
      "Systems integration, certification, manufacturing, and a global supply network made unprecedented scale fly.",
    evidence:
      "The aircraft is one delivered outcome of a distributed professional system whose obligations had to reconcile before flight.",
    systems: ["SYSTEMS ENGINEERING", "SUPPLY NETWORK", "CERTIFICATION"],
    lenses: {
      knowledge: "Aerodynamics, structures, propulsion, avionics, human factors, and manufacturing converged.",
      coordination: "A vast supplier and production network resolved interfaces into one aircraft.",
      assurance: "Test evidence and certification justified the transition from design to passenger service.",
      horizon: "Years of development; decades of global operation and maintenance.",
    },
    photoCredit: "Cody F. · Unsplash",
    photoSource:
      "https://unsplash.com/photos/a-large-jetliner-flying-through-a-cloudy-sky-mwqTIEVMkOM",
    photoQualifier: "Exact Boeing 747; visible livery is incidental",
    factSource: "https://www.boeing.com/commercial/747-8",
  },
  {
    id: "lhc",
    date: "2008",
    shortDate: "2008",
    title: "Large Hadron Collider",
    position: 65.1,
    photo: "/images/capability-timeline/lhc.webp",
    photoAlt: "A tunnel and accelerator equipment at CERN's Large Hadron Collider",
    objectPosition: "50% 48%",
    statement:
      "Thousands of specialists and institutions became one distributed scientific instrument.",
    evidence:
      "Discovery required far more than a machine: shared models, interfaces, calibration, operations, and evidence at global scale.",
    systems: ["GLOBAL COLLABORATION", "EXTREME PRECISION", "EVIDENCE"],
    lenses: {
      knowledge: "Physics, cryogenics, vacuum, computation, controls, detectors, and analysis were inseparable.",
      coordination: "Institutions and companies around the world delivered one 27-kilometre instrument.",
      assurance: "Commissioning, calibration, traceability, and peer review made observations defensible.",
      horizon: "Decades from concept to first beam; a continuing experimental program.",
    },
    photoCredit: "Erwan Martin · Unsplash",
    photoSource: "https://unsplash.com/photos/gray-tunnl-X6Kp8_AgI_4",
    photoQualifier: "Exact LHC tunnel at CERN",
    factSource: "https://home.cern/science/accelerators/large-hadron-collider/",
  },
  {
    id: "euv",
    date: "2017 · industrial scale",
    shortDate: "2017",
    title: "ASML EUV Lithography",
    position: 72.7,
    photo: "/images/capability-timeline/asml-euv.webp",
    photoAlt: "Cleanroom engineers assembling an EUV lithography system",
    objectPosition: "52% 50%",
    statement:
      "An interdependent industrial ecosystem controlled light and matter at the edge of physics.",
    evidence:
      "EUV became viable through decades of feedback among optics, plasma, mechatronics, software, metrology, suppliers, and chipmakers.",
    systems: ["13.5 NM LIGHT", "SUPPLIER ECOSYSTEM", "PROCESS CONTROL"],
    lenses: {
      knowledge: "Plasma physics, multilayer optics, vacuum, motion, metrology, and computation were fused.",
      coordination: "ASML, ZEISS, Cymer, chipmakers, research institutes, and specialist suppliers co-evolved.",
      assurance: "Nanometre-scale measurement and closed-loop correction govern every exposure.",
      horizon: "More than two decades from industrial research to high-volume manufacturing.",
    },
    photoCredit: "ASML · official product history",
    photoSource: "https://www.asml.com/en/en/products/euv-lithography-systems",
    photoQualifier: "Cleanroom assembly of an EUV source; local prototype use",
    factSource: "https://www.asml.com/en/en/news/stories/2022/making-euv-lab-to-fab",
  },
  {
    id: "starship",
    date: "2023–ongoing",
    shortDate: "2023",
    title: "SpaceX Starship",
    position: 83.6,
    photo: "/images/capability-timeline/starship.webp",
    photoAlt: "SpaceX Starship rising through orange cloud during a flight test",
    objectPosition: "52% 48%",
    statement:
      "Software, manufacturing, flight operations, regulation, and physical systems co-evolve through evidence-rich iteration.",
    evidence:
      "This is an active program, not a finished artifact: each test changes what the professional system knows and what it must do next.",
    systems: ["CYBERPHYSICAL", "RAPID ITERATION", "FLIGHT EVIDENCE"],
    lenses: {
      knowledge: "Propulsion, structures, software, ground systems, operations, and regulation evolve together.",
      coordination: "Design, manufacturing, launch, range safety, recovery, and learning form one loop.",
      assurance: "Telemetry and test evidence expose failure, justify change, and constrain the next flight.",
      horizon: "A continuing campaign whose capability matures through governed iteration.",
    },
    photoCredit: "nader saremi · Unsplash",
    photoSource:
      "https://unsplash.com/photos/a-rocket-is-flying-through-the-air-on-a-foggy-day-o6VKrOogZpw",
    photoQualifier: "Exact Starship flight-test image",
    factSource: "https://www.spacex.com/launches/starship-flight-test",
  },
  {
    id: "surgery",
    date: "2026 · preclinical",
    shortDate: "2026",
    title: "Teleoperated Humanoid Surgery",
    position: 100,
    photo: "/images/capability-timeline/humanoid-surgery-hero.webp",
    photoAlt:
      "Two humanoid robots and a clinical team in the 2026 preclinical teleoperated surgery study",
    objectPosition: "48% 50%",
    statement:
      "Surgeons, engineers, robots, controls, calibration, and safety formed a new human-machine operating system.",
    evidence:
      "The study was teleoperated—not autonomous—and preclinical, on large nonprimate mammals. Its significance lies in the integrated team and assurance problem it reveals.",
    systems: ["HUMAN–ROBOT TEAM", "TELEOPERATION", "CLINICAL ASSURANCE"],
    lenses: {
      knowledge: "Surgical technique, robotics, controls, perception, calibration, and safety were combined.",
      coordination: "One study included human–robot and robot–robot teams operating under expert control.",
      assurance: "Latency, recalibration, procedural evidence, and patient-safety translation remain explicit constraints.",
      horizon: "A 2026 preclinical demonstration pointing toward a long, governed clinical pathway.",
    },
    photoCredit: "Liang et al. · Figure 4 · CC BY 4.0",
    photoSource: "https://arxiv.org/abs/2607.07972",
    photoQualifier: "Cropped study figure; porcine model; not autonomous or human clinical surgery",
    factSource: "https://humanoid-surgeon.github.io/",
  },
];

const SYSTEM_VIEW_HOLD = 450;
const REVEAL_DURATION = 4300;
const MILESTONE_DURATION = 5500;

export function HistoricalCapabilityHero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reveal, setReveal] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [playback, setPlayback] = useState<"playing" | "paused">("playing");
  const [sequenceEpoch, setSequenceEpoch] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const active = milestones[activeIndex];

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!isPageVisible || playback !== "playing") return;
    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % milestones.length);
    }, MILESTONE_DURATION);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isPageVisible, playback, sequenceEpoch]);

  useEffect(() => {
    if (!isPageVisible || playback !== "playing") return;
    let animationFrame = 0;
    let startedAt: number | null = null;

    const animateReveal = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const elapsed = timestamp - startedAt;
      const progress = Math.min(Math.max(elapsed - SYSTEM_VIEW_HOLD, 0) / REVEAL_DURATION, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      setReveal(eased * 100);
      if (progress < 1) animationFrame = window.requestAnimationFrame(animateReveal);
    };

    animationFrame = window.requestAnimationFrame(animateReveal);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeIndex, isPageVisible, playback, sequenceEpoch]);

  useEffect(() => {
    const next = milestones[(activeIndex + 1) % milestones.length];
    const image = new Image();
    image.src = next.photo;
  }, [activeIndex]);

  useEffect(() => {
    const rail = railRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!rail || !tab || rail.scrollWidth <= rail.clientWidth) return;
    const left = tab.offsetLeft - rail.clientWidth / 2 + tab.offsetWidth / 2;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    rail.scrollTo({ left: Math.max(0, left), behavior });
  }, [activeIndex]);

  const selectMilestone = useCallback(
    (index: number, focus = false) => {
      setPlayback("paused");
      setActiveIndex(index);
      setSequenceEpoch((epoch) => epoch + 1);
      if (focus) {
        window.requestAnimationFrame(() => tabRefs.current[index]?.focus());
      }
    },
    [],
  );

  const onTimelineKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % milestones.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + milestones.length) % milestones.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = milestones.length - 1;
    else return;
    event.preventDefault();
    selectMilestone(next, true);
  };

  const togglePlayback = () => {
    if (playback === "playing") {
      setPlayback("paused");
      return;
    }
    setSequenceEpoch((epoch) => epoch + 1);
    setPlayback("playing");
  };

  const updateReveal = (value: number) => {
    setPlayback("paused");
    setReveal(value);
  };

  const mediaStyle = {
    "--history-object-position": active.objectPosition,
    "--history-reveal": `${reveal}%`,
  } as CSSProperties;

  return (
    <div
      className="history-hero-explorer"
      data-explorer="historical-capability"
      data-playback={playback}
      data-reveal={Math.round(reveal)}
    >
      <div className="history-hero-main">
        <div className="hero-copy history-hero-copy">
          <div className="eyebrow">4,500 YEARS OF PROFESSIONAL CAPABILITY</div>
          <h1>
            Infrastructure for humanity&apos;s <em>professional capability.</em>
          </h1>
          <p className="hero-grounding">
            Across eras, the visible artifact is only the surface. Behind it:
            knowledge, institutions, tools, judgment, assurance, and coordinated work
            sustained long enough to make intent real.
          </p>
          <p className="hero-support">
            Janumi turns that enduring pattern into governed, evidence-bearing work
            architectures—so humans and AI can execute complex work without losing
            intent, assurance, or accountability.
          </p>
          <div className="button-row hero-buttons">
            <Link className="button button-dark" href="/connect#waitlist">
              Join the waitlist <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-quiet" href="/open-source">
              Explore open source <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-quiet" href="/connect#demo">
              Schedule a demonstration
            </Link>
          </div>
        </div>

        <figure className="history-stage" style={mediaStyle} aria-labelledby={`history-title-${active.id}`}>
          <div className="history-stage-topline">
            <span>
              MILESTONE {String(activeIndex + 1).padStart(2, "0")} / {String(milestones.length).padStart(2, "0")}
            </span>
            <span>{active.date}</span>
          </div>

          <div className="history-media-slot">
            <div
              className={`history-media ${activeIndex % 2 === 0 ? "is-cycle-even" : "is-cycle-odd"}${isDragging ? " is-dragging" : ""}`}
            >
              <div className="history-system-layer" aria-hidden="true">
                {/* The same licensed photograph is analytically treated; this is not presented as an archival blueprint. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active.photo} alt="" width="1920" height="1200" />
                <div className="history-analysis-grid" />
                <div className="history-crosshair history-crosshair-a" />
                <div className="history-crosshair history-crosshair-b" />
                <span className="history-system-label">SYSTEM VIEW · ANALYTICAL TREATMENT</span>
                {active.systems.map((system, index) => (
                  <span className={`history-callout history-callout-${index + 1}`} key={system}>
                    <i /> {system}
                  </span>
                ))}
              </div>
              <div className="history-reality-layer" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active.photo} alt="" width="1920" height="1200" />
                <span>PHOTOGRAPHIC REALITY</span>
              </div>
              <div className="history-reveal-line" aria-hidden="true">
                <i />
              </div>
              {/* The semantic image remains separate from the visual comparison layers. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="history-semantic-image" src={active.photo} alt={active.photoAlt} width="1920" height="1200" />
            </div>
          </div>

          <div
            className="history-active-panel"
            id="history-milestone-panel"
            role="tabpanel"
            aria-labelledby={`history-tab-${active.id}`}
            tabIndex={0}
          >
            <div className="history-active-heading">
              <span>{active.date}</span>
              <h2 id={`history-title-${active.id}`}>{active.title}</h2>
            </div>
            <div className="history-active-copy">
              <p>{active.statement}</p>
              <small>{active.evidence}</small>
            </div>
          </div>

          <figcaption className="history-credit">
            <span>{active.photoQualifier}</span>
            <span>
              Image: <a href={active.photoSource} target="_blank" rel="noreferrer">{active.photoCredit}</a>
              <i aria-hidden="true">·</i>
              <a href={active.factSource} target="_blank" rel="noreferrer">Milestone source ↗</a>
            </span>
          </figcaption>

          <div className="history-reveal-control">
            <span>SYSTEM VIEW</span>
            <label>
              <span className="sr-only">Reveal photographic reality</span>
              <input
                type="range"
                min="0"
                max="100"
                value={reveal}
                aria-label="Reveal photographic reality"
                aria-valuetext={`${reveal}% photographic reality`}
                onPointerDown={() => {
                  setIsDragging(true);
                  setPlayback("paused");
                }}
                onPointerUp={() => setIsDragging(false)}
                onPointerCancel={() => setIsDragging(false)}
                onLostPointerCapture={() => setIsDragging(false)}
                onBlur={() => setIsDragging(false)}
                onChange={(event) => updateReveal(Number(event.target.value))}
              />
            </label>
            <span>REALITY</span>
          </div>
        </figure>
      </div>

      <div className="history-timeline-shell">
        <div className="history-timeline-header">
          <div>
            <span>TIME BEFORE PRESENT · LOGARITHMIC</span>
            <small>Auto-cycling from system view to reality. Marker spacing represents time—not complexity.</small>
          </div>
          <button
            className="history-playback"
            type="button"
            aria-pressed={playback !== "playing"}
            onClick={togglePlayback}
          >
            <span className="history-playback-icon" aria-hidden="true">
              {playback === "playing" ? "Ⅱ" : "▶"}
            </span>
            {playback === "playing" ? "Pause timeline" : "Resume timeline"}
          </button>
        </div>
        <div className="history-timeline-scroll" ref={railRef}>
          <div
            className="history-timeline"
            role="tablist"
            aria-label="Professional capability across history"
            aria-orientation="horizontal"
          >
            <div className="history-timeline-line" aria-hidden="true" />
            {milestones.map((milestone, index) => (
              <button
                className={`history-marker${index === activeIndex ? " is-active" : ""}`}
                id={`history-tab-${milestone.id}`}
                key={milestone.id}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-controls="history-milestone-panel"
                tabIndex={index === activeIndex ? 0 : -1}
                style={{ "--marker-position": `${milestone.position}%` } as CSSProperties}
                onClick={() => selectMilestone(index)}
                onKeyDown={(event) => onTimelineKeyDown(event, index)}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
              >
                <span className="history-marker-dot" />
                <span className="history-marker-label">
                  <b>{milestone.shortDate}</b>
                  <i>{milestone.title}</i>
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="history-study-note">
          <strong>2026 RESEARCH BOUNDARY</strong>
          Teleoperated—not autonomous—and preclinical, using large nonprimate mammals;
          not human clinical surgery.
        </p>
      </div>

      <div className="history-lenses" aria-label={`Capability dimensions for ${active.title}`}>
        <div>
          <span>KNOWLEDGE</span>
          <p>{active.lenses.knowledge}</p>
        </div>
        <div>
          <span>COORDINATION</span>
          <p>{active.lenses.coordination}</p>
        </div>
        <div>
          <span>ASSURANCE</span>
          <p>{active.lenses.assurance}</p>
        </div>
        <div>
          <span>TIME HORIZON</span>
          <p>{active.lenses.horizon}</p>
        </div>
      </div>

      <div className="history-handoff">
        <p>The artifact is visible. <em>The capability behind it is the enduring asset.</em></p>
        <div className="history-capability-flow" aria-label="Janumi capability progression">
          <span>INTENT</span><i />
          <span>GOVERNED WORK</span><i />
          <span>HUMAN–AGENT EXECUTION</span><i />
          <span>EVIDENCE + ASSURANCE</span><i />
          <span>GOVERNED LEARNING</span>
        </div>
        <a className="history-product-link" href="#professional-workbench">
          Explore the infrastructure behind the achievement <span aria-hidden="true">↓</span>
        </a>
      </div>
    </div>
  );
}
