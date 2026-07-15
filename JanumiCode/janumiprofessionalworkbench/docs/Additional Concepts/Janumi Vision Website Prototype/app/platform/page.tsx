import type { Metadata } from "next";
import {
  ArrowLink,
  CTASection,
  DefinitionCard,
  Eyebrow,
  InteriorHero,
  SectionHeading,
  SiteShell,
} from "../components";
import { AssuranceVisual, PwaDesignerVisual, UndertakingVisual } from "../visuals";

export const metadata: Metadata = {
  title: "Janumi Professional Workbench",
  description: "Design reusable Professional Work Architectures and operate concrete Undertakings with evidence, assurance, and authority intact.",
};

export default function PlatformPage() {
  return (
    <SiteShell>
      <InteriorHero
        eyebrow="THE PLATFORM PRODUCT"
        index="01"
        title={<>The environment for governed <em>professional work.</em></>}
        body={<>Janumi Professional Workbench is the general environment for designing reusable Professional Work Architectures and operating concrete Undertakings through execution, assurance, governance, traceability, and baselining.</>}
      >
        <div className="platform-hero-art" aria-hidden="true"><span>PWA</span><i /><span>UNDERTAKING</span><i /><span>OUTCOME</span></div>
      </InteriorHero>

      <section className="product-status-note"><div className="shell"><span>PRODUCT STATUS · UNDER ACTIVE CONSTRUCTION</span><p>This prototype expresses the intended platform contract and experience. Individual capabilities remain subject to current implementation and conformance evidence.</p></div></section>

      <section className="platform-model section-pad">
        <div className="shell">
          <SectionHeading
            eyebrow="ONE MODEL, MANY VIEWS"
            title={<>Move through the work without creating competing truths.</>}
            body={<>Intent, understanding, execution, assurance, evidence, decisions, reconciliation, and history are different views over one governed professional record.</>}
          />
          <div className="model-view-grid">
            {["Intent", "Architecture", "Execution", "Assurance", "Evidence", "Decisions", "Reconciliation", "History"].map((item, index) => (
              <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-designer section-pad">
        <div className="shell">
          <div className="product-page-heading">
            <div><Eyebrow>PWA DESIGNER</Eyebrow><h2>Author a reusable architecture—not a disguised workflow.</h2></div>
            <p>A PWA version owns PWU Types, their recursive composition rules, obligations, constraints, roles, applicability, recomposition, and required assurance treatment.</p>
          </div>
          <PwaDesignerVisual />
          <div className="definition-grid definition-grid-three platform-definitions">
            <DefinitionCard number="01" term="PWA" accent="moss">A reusable, versioned architecture owned at the type-definition level; not primarily a sequence or running process.</DefinitionCard>
            <DefinitionCard number="02" term="PWU Type" accent="ochre">A reusable work definition in a PWA, including permitted child types and the obligation the unit must satisfy.</DefinitionCard>
            <DefinitionCard number="03" term="PWA Work Architecture View" accent="blue">The recursive graph of PWU Types and permitted composition. It is not the concrete Professional Work Graph.</DefinitionCard>
          </div>
        </div>
      </section>

      <section className="platform-undertaking section-pad">
        <div className="shell">
          <div className="product-page-heading product-page-heading-light">
            <div><Eyebrow light>UNDERTAKING WORKBENCH</Eyebrow><h2>Operate the concrete work against an exact architecture version.</h2></div>
            <p>An Undertaking owns its PWU Instances, state, evidence, assessments, decisions, and baselines. The Professional Work Graph is the concrete structure of those instances and related governed objects.</p>
          </div>
          <UndertakingVisual />
          <div className="canonical-model-lanes" aria-label="Canonical PWA, Undertaking, PWU Type, and PWU Instance ownership model">
            <div className="canonical-lane canonical-definition-lane">
              <span className="canonical-lane-label">REUSABLE DEFINITION LANE</span>
              <div><small>01 · ARCHITECTURE</small><strong>PWA version</strong><b>owns</b></div>
              <i aria-hidden="true">→</i>
              <div><small>02 · REUSABLE DEFINITIONS</small><strong>PWU Types</strong><b>recursively compose</b></div>
            </div>
            <div className="canonical-binding">
              <span>EXACT VERSION BINDING</span>
              <strong>An Undertaking binds one PWA/profile/version.</strong>
              <i aria-hidden="true">↓</i>
            </div>
            <div className="canonical-lane canonical-instance-lane">
              <span className="canonical-lane-label">CONCRETE PROFESSIONAL WORK LANE</span>
              <div><small>03 · WORK ROOT</small><strong>Undertaking</strong><b>owns</b></div>
              <i aria-hidden="true">→</i>
              <div><small>04 · CONCRETE WORK</small><strong>PWU Instances</strong><b>each instantiates a PWU Type</b></div>
            </div>
          </div>
        </div>
      </section>

      <section className="platform-assurance section-pad">
        <div className="shell">
          <div className="product-page-heading product-page-heading-light">
            <div><Eyebrow light>VISIBLE ASSURANCE</Eyebrow><h2>Show required treatment and actual execution at the correct layer.</h2></div>
            <p>A policy attachment is not an assessment. A configured Validator is not an invocation. The product must reveal definition-time requirements, deployment-time capability, and runtime result separately.</p>
          </div>
          <AssuranceVisual compact />
          <div className="center-link"><ArrowLink href="/assurance" light>Go deeper into Assurance Engineering</ArrowLink></div>
        </div>
      </section>

      <section className="workbench-capabilities section-pad">
        <div className="shell">
          <SectionHeading eyebrow="PLATFORM CAPABILITIES" title={<>Structure enough to govern. Flexibility enough to practice.</>} />
          <div className="feature-grid feature-grid-six">
            {[
              ["Recursive architecture", "Define nested professional obligations with explicit composition and recomposition."],
              ["Governed execution", "Coordinate humans, agents, tools, waits, retries, and corrective work through durable plans."],
              ["Evidence fabric", "Bind claims, artifacts, observations, and provenance to exact subjects and versions."],
              ["Version-bound governance", "Make authoritative decisions over the exact result, evidence set, and residual risk."],
              ["Governed reconciliation", "Compare expected and observed conditions, assess impact, and reopen assumptions or work when evidence changes."],
              ["Traceable memory", "Preserve narrative continuity without allowing interpretation to replace canonical state."],
            ].map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </div>
      </section>

      <CTASection title="See how the Workbench can shape your professional domain." body="Schedule a demonstration, join the early-access waitlist, or inspect the open foundation as it emerges." />
    </SiteShell>
  );
}
