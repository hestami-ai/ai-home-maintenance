"use client";

import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type RovingKeyEvent = KeyboardEvent<HTMLButtonElement>;

function useRovingSelection(length: number, initial = 0) {
  const [active, setActive] = useState(initial);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: RovingKeyEvent, index: number) {
    let next = index;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + length) % length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = length - 1;
    else return;

    event.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }

  return { active, setActive, refs, onKeyDown };
}

const capabilityField = [
  {
    label: "Intent",
    title: "The obligation that must survive decomposition.",
    detail: "Intent anchors every unit of work to the change in reality that justified the work in the first place.",
    role: "Anchors the whole",
    className: "node-one",
  },
  {
    label: "Evidence",
    title: "The basis for claims, not an afterthought.",
    detail: "Evidence connects action, artifact, assessment, and observed outcome so downstream decisions remain inspectable.",
    role: "Supports justified claims",
    className: "node-two",
  },
  {
    label: "Judgment",
    title: "Professional discretion remains explicit.",
    detail: "Human and delegated agent judgments are bounded by role, authority, context, and the consequences of being wrong.",
    role: "Interprets in context",
    className: "node-three",
  },
  {
    label: "Assurance",
    title: "The control fabric of material transformation.",
    detail: "Assurance Services invoke required validators—including the locked Reasoning Review floor—record assessments and evidence, and enforce required gates; governance retains reserved decisions.",
    role: "Qualifies progression",
    className: "node-four",
  },
] as const;

export function InteractiveCapabilityField() {
  const { active, setActive, refs, onKeyDown } = useRovingSelection(capabilityField.length);
  const selected = capabilityField[active];
  const fieldBounds = useRef<DOMRect | null>(null);
  const animationFrame = useRef<number | null>(null);

  function captureField(event: PointerEvent<HTMLDivElement>) {
    fieldBounds.current = event.currentTarget.getBoundingClientRect();
  }

  function moveField(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = fieldBounds.current ?? event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    const field = event.currentTarget;

    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
    animationFrame.current = window.requestAnimationFrame(() => {
      field.style.setProperty("--field-x", x.toFixed(3));
      field.style.setProperty("--field-y", y.toFixed(3));
    });
  }

  function resetField(event: PointerEvent<HTMLDivElement>) {
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
    fieldBounds.current = null;
    event.currentTarget.style.setProperty("--field-x", "0");
    event.currentTarget.style.setProperty("--field-y", "0");
  }

  return (
    <div
      className="hero-field hero-field-interactive"
      data-explorer="capability-field"
      role="group"
      onPointerEnter={captureField}
      onPointerMove={moveField}
      onPointerLeave={resetField}
      aria-label="Explore how intent, evidence, judgment, and assurance sustain professional capability"
    >
      <div className="field-orbit orbit-one" />
      <div className="field-orbit orbit-two" />
      <div className="field-orbit orbit-three" />
      <div className="field-axis field-axis-x" />
      <div className="field-axis field-axis-y" />

      <div className="field-tablist" role="tablist" aria-label="Professional capability connective elements">
        {capabilityField.map((item, index) => (
          <button
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="tab"
            id={`capability-tab-${index}`}
            key={item.label}
            className={`field-node ${item.className}${active === index ? " is-active" : ""}`}
            aria-selected={active === index}
            aria-controls="capability-field-detail"
            tabIndex={active === index ? 0 : -1}
            onPointerEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onClick={() => setActive(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <i aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="field-core">
        <span className="core-kicker">{selected.label.toUpperCase()}</span>
        <strong>{selected.role}</strong>
      </div>
      <div
        className="field-detail-card"
        id="capability-field-detail"
        role="tabpanel"
        aria-labelledby={`capability-tab-${active}`}
        key={selected.label}
      >
        <span>{selected.title}</span>
        <p>{selected.detail}</p>
      </div>
      <div className="field-prompt" aria-hidden="true">HOVER · FOCUS · TAP TO EXPLORE</div>
      <div className="field-time">
        <span>Now</span>
        <i />
        <span>Across generations</span>
      </div>
    </div>
  );
}

const manifestations = [
  {
    index: "01",
    name: "Software",
    image: "/images/professional-manifestations/software.webp",
    imageCredit: "TECNIC Bioprocess Solutions",
    imagePosition: "50% 48%",
    artifact: "A commit is not a successful product.",
    evidence: "Intent lineage, behavior, acceptance evidence, verification, release posture, and operational observation.",
    outcome: "People can achieve the intended behavior safely and reliably in the operating context.",
  },
  {
    index: "02",
    name: "Law",
    image: "/images/professional-manifestations/law.webp",
    imageCredit: "Gabrielle Henderson",
    imagePosition: "50% 45%",
    artifact: "A signed agreement is not a successful merger.",
    evidence: "Authority, privilege boundaries, jurisdictional analysis, negotiated obligations, approvals, and closing conditions.",
    outcome: "The transaction produces the intended legal and commercial state without concealed exposure.",
  },
  {
    index: "03",
    name: "Healthcare",
    image: "/images/professional-manifestations/healthcare.webp",
    imageCredit: "Regena Kowitz · Navy Medicine",
    imagePosition: "50% 42%",
    artifact: "A dossier is not a recovered patient.",
    evidence: "Longitudinal findings, uncertainty, clinical judgment, informed authority, intervention, and observed response.",
    outcome: "The patient experiences the intended health change with safety, dignity, and continuity of care.",
  },
  {
    index: "04",
    name: "Construction",
    image: "/images/professional-manifestations/construction.webp",
    imageCredit: "RONNAKORN TRIRAGANON",
    imagePosition: "50% 44%",
    artifact: "A schedule is not a safe building.",
    evidence: "Design intent, field conditions, dependency readiness, inspection, provenance, and verified installation.",
    outcome: "The built environment performs safely and durably for the people and systems it serves.",
  },
] as const;

export function ManifestationExplorer() {
  const { active, setActive, refs, onKeyDown } = useRovingSelection(manifestations.length);
  const selected = manifestations[active];

  return (
    <div className="manifestation-explorer" data-explorer="artifact-outcome" role="group" aria-label="Artifact and outcome explorer">
      <div className="manifestation-grid" role="tablist" aria-label="Explore the difference between professional artifacts and outcomes">
        {manifestations.map((item, index) => (
          <div role="presentation" key={item.name} className="manifestation-item">
            <button
              ref={(node) => { refs.current[index] = node; }}
              type="button"
              role="tab"
              id={`manifestation-tab-${index}`}
              className={`manifestation-card${active === index ? " is-active" : ""}`}
              aria-selected={active === index}
              aria-controls="manifestation-detail"
              tabIndex={active === index ? 0 : -1}
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span>{item.index}</span>
              <span className="manifestation-material" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt=""
                  width="1600"
                  height="1067"
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: item.imagePosition }}
                />
                <span className="manifestation-photo-credit">PHOTO · {item.imageCredit}</span>
              </span>
              <span className="manifestation-title">{item.name}</span>
              <span className="manifestation-copy">{item.artifact}</span>
              <span className="manifestation-action">{active === index ? "EXPLORING" : "EXPLORE"} <i aria-hidden="true">↘</i></span>
            </button>
          </div>
        ))}
      </div>
      <div
        className="manifestation-detail"
        id="manifestation-detail"
        role="tabpanel"
        aria-labelledby={`manifestation-tab-${active}`}
        key={selected.name}
      >
        <div>
          <span>THE ARTIFACT CAN EVIDENCE</span>
          <p>{selected.evidence}</p>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>THE OUTCOME OBLIGATION</span>
          <p>{selected.outcome}</p>
        </div>
      </div>
    </div>
  );
}

const regenerativeCycle = [
  {
    title: "Knowledge & institutions",
    explanation: "Accumulated research, standards, culture, institutions, and practice preserve what society has learned—and the conditions under which that learning remains trustworthy.",
    receives: "Governed learning, historical evidence, lived experience, and inherited practice.",
    transforms: "Distributed experience into durable, transmissible professional understanding.",
    passesForward: "Knowledge, norms, standards, and legitimacy that enable professional systems.",
  },
  {
    title: "Professional systems",
    explanation: "A candidate higher-order concept for the people, organizations, tools, infrastructure, authority, and operating arrangements that combine to realize capability at a particular time.",
    receives: "Civilizational knowledge, institutional mandate, resources, and constraints.",
    transforms: "Stored understanding into operational socio-technical capacity.",
    passesForward: "Qualified providers, readiness, dependencies, and evidence of available capability.",
  },
  {
    title: "Professional capability",
    explanation: "A candidate higher-order concept describing what a professional system can demonstrably and legitimately accomplish, under which conditions, and across time.",
    receives: "System capacity, authority, operating conditions, readiness, and evidence.",
    transforms: "Operational supply into a bounded, evidence-backed claim of conditional ability.",
    passesForward: "Capability that may be matched to consequential scenarios.",
  },
  {
    title: "Professional scenarios",
    explanation: "A candidate Professional Scenario preserves the evolving reality, uncertainty, constraints, actors, authority, and possible futures to which work must respond.",
    receives: "Observed and asserted state, stakeholder intent, risk, constraints, and available capability.",
    transforms: "A consequential situation into explicit professional demand without mistaking its representation for reality.",
    passesForward: "Scenario class, intended outcomes, uncertainty, constraints, and authority context.",
  },
  {
    title: "Shape Engineering",
    explanation: "Shape Engineering is a candidate design discipline—not current canonical product semantics—for discovering, validating, encoding, and evolving the executable shape of professional work.",
    receives: "Scenario classes, intended outcomes, capability, obligations, evidence needs, authority, and risk.",
    transforms: "Professional understanding into inspectable and testable work-architecture designs.",
    passesForward: "Governed PWA candidates and their assurance obligations.",
  },
  {
    title: "PWAs & Undertakings",
    explanation: "A versioned PWA owns recursively composed PWU Types; an Undertaking binds an exact PWA version and instantiates applicable Types as concrete PWU Instances in its Professional Work Graph.",
    receives: "A governed PWA version plus concrete intent, participants, authority, constraints, and compatibility decisions.",
    transforms: "Reusable architecture into a committed body of concrete professional work.",
    passesForward: "A Professional Work Graph of PWU Instances, dependencies, evidence duties, and protected transitions.",
  },
  {
    title: "Human-agent execution",
    explanation: "Humans, agents, tools, and external systems perform bounded PWU obligations while every material AI output remains subject to the locked Reasoning Review floor.",
    receives: "PWU Instances, context, inputs, permissions, policies, and assurance bindings.",
    transforms: "Professional intent into actions and artifacts through observable, recoverable execution.",
    passesForward: "Claims, evidence, actions, artifacts, provenance, and exceptions.",
  },
  {
    title: "Evidence & outcomes",
    explanation: "Validators assess claims. Assurance Services bind and run controls, record assessments and evidence, and enforce protected transitions; governance makes reserved decisions such as waiver, risk acceptance, and promotion. Outcomes record changed reality rather than mere artifact completion.",
    receives: "Execution traces, claims, artifacts, provenance, validator assessments, observations, and exceptions.",
    transforms: "What happened into qualified assurance results, decisions, and reconciled outcomes.",
    passesForward: "Trusted outcome evidence, capability evidence, unresolved uncertainty, and required remediation.",
  },
  {
    title: "Governed learning",
    explanation: "Narrative continuity and governed review turn experience into traceable proposals for improvement without silently rewriting baselines, erasing provenance, or breaching confidentiality.",
    receives: "Outcomes, decisions, evidence, exceptions, interventions, and temporally situated Narrative Memory.",
    transforms: "Observed experience into qualified lessons and controlled change proposals.",
    passesForward: "Authorized updates to knowledge, capability claims, assurance policies, and future PWA versions.",
  },
] as const;

export function RegenerativeCycleExplorer() {
  const { active, setActive, refs, onKeyDown } = useRovingSelection(regenerativeCycle.length);
  const selected = regenerativeCycle[active];

  return (
    <div className="cycle-explorer" data-explorer="regenerative-cycle" role="group" aria-label="Regenerative cycle explorer">
      <p className="explorer-instruction">Move across the cycle to inspect what each stage receives, changes, and passes forward. Use arrow keys, hover, focus, or tap.</p>
      <div className="cycle-flow" role="tablist" aria-label="Interactive regenerative professional capability cycle">
        {regenerativeCycle.map((item, index) => (
          <div role="presentation" key={item.title} className={active === index ? "is-active" : undefined}>
            <button
              ref={(node) => { refs.current[index] = node; }}
              type="button"
              role="tab"
              id={`cycle-tab-${index}`}
              aria-selected={active === index}
              aria-controls="cycle-detail"
              tabIndex={active === index ? 0 : -1}
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <i aria-hidden="true">{index === regenerativeCycle.length - 1 ? "↻" : "→"}</i>
            </button>
          </div>
        ))}
      </div>

      <div
        className="cycle-detail"
        id="cycle-detail"
        role="tabpanel"
        aria-labelledby={`cycle-tab-${active}`}
        key={selected.title}
      >
        <div className="cycle-detail-heading">
          <span>{String(active + 1).padStart(2, "0")} / {String(regenerativeCycle.length).padStart(2, "0")}</span>
          <h3>{selected.title}</h3>
          <p>{selected.explanation}</p>
        </div>
        <dl className="cycle-detail-facts">
          <div><dt>Receives</dt><dd>{selected.receives}</dd></div>
          <div><dt>Transforms</dt><dd>{selected.transforms}</dd></div>
          <div><dt>Passes forward</dt><dd>{selected.passesForward}</dd></div>
        </dl>
        <div className="cycle-progress" aria-hidden="true">
          {regenerativeCycle.map((item, index) => <i key={item.title} className={index === active ? "is-active" : undefined} />)}
        </div>
      </div>
      <p className="cycle-caption">This cycle connects canonical execution semantics with candidate higher-order concepts. Candidate concepts guide the vision but do not alter current product contracts.</p>
    </div>
  );
}

const capabilityLayers = [
  ["01", "Civilizational knowledge", "Distributed inheritance: research, standards, institutions, culture, and accumulated practice."],
  ["02", "Professional capability", "Candidate evidence-backed ability to produce and sustain outcomes under declared conditions."],
  ["03", "Professional systems", "Candidate socio-technical arrangements of people, organizations, tools, infrastructure, authority, and relationships that realize capability."],
  ["04", "Professional scenarios", "Candidate time-evolving representations of situations that make professional demand and consequence explicit."],
  ["05", "Shape Engineering", "Candidate discipline for discovering and evolving the executable shape of professional work."],
  ["06", "Work architectures", "Versioned PWAs define reusable, recursive PWU Types and their obligations."],
  ["07", "Work units", "Concrete PWU Instances preserve local responsibility while remaining connected to the whole."],
  ["08", "Human + agent execution", "Bounded, observable action under explicit context, authority, and assurance."],
  ["09", "Evidence-bearing artifacts", "Artifacts preserve and evidence work; reconciled outcomes determine whether reality changed."],
] as const;

export function CapabilityStackExplorer() {
  const [active, setActive] = useState(0);

  return (
    <div className="capability-stack capability-stack-interactive" data-explorer="capability-hierarchy" role="group" aria-label="Explore the Janumi professional capability hierarchy">
      <p className="stack-instruction">EXPLORE THE LAYERS · HOVER · FOCUS · TAP</p>
      <div role="list">
        {capabilityLayers.map(([number, label, detail], index) => (
          <div key={number} role="listitem" className="stack-layer-item">
            <button
              type="button"
              id={`stack-trigger-${index}`}
              className={`stack-layer${active === index ? " is-active" : ""}`}
              aria-expanded={active === index}
              aria-controls={`stack-detail-${index}`}
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onClick={() => setActive(index)}
            >
              <span>{number}</span>
              <strong>{label}</strong>
              <i aria-hidden="true">{active === index ? "—" : "+"}</i>
            </button>
            <p
              className="stack-layer-detail"
              id={`stack-detail-${index}`}
              aria-labelledby={`stack-trigger-${index}`}
              hidden={active !== index}
            >
              {detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
