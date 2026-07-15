import type { Metadata } from "next";
import {
  CTASection,
  DefinitionCard,
  Eyebrow,
  InteriorHero,
  SectionHeading,
  SiteShell,
  StatementBand,
} from "../components";
import { AssuranceVisual } from "../visuals";

export const metadata: Metadata = {
  title: "Assurance Engineering",
  description: "Janumi Assurance Engineering is the evidence-and-control fabric that protects professional transitions at micro and macro scale.",
};

const reasoningRisks = [
  "Shortcut substitution",
  "Problem displacement",
  "Unsupported inference",
  "False completeness",
  "Hidden uncertainty",
  "Contradiction",
  "Evidence misuse",
  "Constraint omission",
];

export default function AssurancePage() {
  return (
    <SiteShell>
      <InteriorHero
        eyebrow="ASSURANCE ENGINEERING"
        index="02"
        tone="clay"
        title={<>Trust must be <em>engineered into the work.</em></>}
        body={<>Assurance Engineering is Janumi&apos;s design discipline for the versioned evidence-and-control system that determines whether professional work remains justified as it evolves—and whether an exact result may safely support its next protected transition.</>}
      >
        <div className="assurance-hero-art" aria-hidden="true"><div>REASON</div><i /><div>ASSESS</div><i /><div>DECIDE</div></div>
      </InteriorHero>

      <section className="product-status-note product-status-note-clay"><div className="shell"><span>PRODUCT STATUS · CONTRACT + IMPLEMENTATION DIRECTION</span><p>The Reasoning Review floor and core assurance boundaries are governing context. Some generalized wire contracts, topology, and meta-assurance mechanisms remain active design and implementation work.</p></div></section>

      <StatementBand label="THE CONNECTIVE PRINCIPLE">
        Every material professional transformation has an explicit coverage decision. Every required control is durably bound, executed, recorded, inspectable, and enforced before its protected downstream transition.
      </StatementBand>

      <section className="assurance-detail section-pad">
        <div className="shell">
          <SectionHeading
            eyebrow="CONTROL AT EVERY SCALE"
            title={<>Macro outcome assurance. Micro transformation assurance. One coherent fabric.</>}
            body={<>Product-level validation is necessary but insufficient. Each material agent-produced result can introduce a reasoning defect long before an integrated outcome exists to validate.</>}
          />
          <AssuranceVisual />
        </div>
      </section>

      <section className="reasoning-floor section-pad">
        <div className="shell reasoning-grid">
          <div className="reasoning-copy">
            <div className="locked-badge">LOCKED DE MINIMIS CONTROL</div>
            <Eyebrow>REASONING REVIEW</Eyebrow>
            <h2>The mandatory floor for every material AI-produced result.</h2>
            <p>Reasoning Review is an independently executed policy concern—not an informal second prompt. It challenges whether the response actually satisfies the stated obligation and whether the path to that response is professionally defensible.</p>
          </div>
          <div className="risk-matrix" role="list" aria-label="Recurring reasoning risks">
            {reasoningRisks.map((risk, index) => <div role="listitem" key={risk}><span>{String(index + 1).padStart(2, "0")}</span><strong>{risk}</strong><i>CHALLENGE</i></div>)}
          </div>
        </div>
      </section>

      <section className="assurance-layers section-pad">
        <div className="shell">
          <SectionHeading eyebrow="THREE DIFFERENT FACTS" title={<>Required. Available. Executed.</>} body={<>The interface must never collapse an assurance requirement, an available evaluator, and an actual assessment into one green badge.</>} />
          <div className="layer-grid">
            <article><span>01</span><Eyebrow>DEFINITION TIME</Eyebrow><h3>Required treatment</h3><p>The PWA and Assurance Policy declare applicability, criteria, evidence, independence, disposition, remediation, escalation, and waiver rules.</p></article>
            <article><span>02</span><Eyebrow>DEPLOYMENT TIME</Eyebrow><h3>Conforming capability</h3><p>The environment proves that an eligible, compatible, versioned Validator capability is available under the required trust and independence conditions.</p></article>
            <article><span>03</span><Eyebrow>RUNTIME</Eyebrow><h3>Actual assessment</h3><p>The exact subject version is evaluated, the result is validated and recorded, and its canonical disposition is enforced against the protected transition.</p></article>
          </div>
        </div>
      </section>

      <section className="role-boundaries section-pad">
        <div className="shell">
          <SectionHeading eyebrow="SEPARATION OF RESPONSIBILITY" title={<>Evaluation is not authority.</>} body={<>The system stays trustworthy by refusing to let one component assess, enforce, repair, and authorize its own work.</>} />
          <div className="definition-grid definition-grid-three">
            <DefinitionCard number="01" term="Validator" accent="blue">A replaceable evaluator implementing bounded policy concerns. It assesses; it cannot authorize, repair, decide, or mutate professional state.</DefinitionCard>
            <DefinitionCard number="02" term="Assurance Service" accent="moss">Validates Validator results, applies policy, records canonical Assessment dispositions, and enforces required gate effects.</DefinitionCard>
            <DefinitionCard number="03" term="Governance" accent="clay">Exercises legitimate authority over acceptance, waiver, risk acceptance, rejection, abandonment, and baseline promotion.</DefinitionCard>
          </div>
        </div>
      </section>

      <section className="assurance-failure section-pad">
        <div className="shell failure-grid">
          <div><Eyebrow light>FAIL CLOSED WHERE IT MATTERS</Eyebrow><h2>Missing assurance is not neutral.</h2></div>
          <div>
            <p>Missing, stale, failed, malformed, or independence-invalid required assurance leaves the output provisional and blocks dependent consumption.</p>
            <ul>
              <li>Findings remain bound to the exact assessed version.</li>
              <li>Repair creates a new version; it does not rewrite history.</li>
              <li>Waivers and accepted risk require authorized, durable decisions.</li>
              <li>Validator fidelity and common-mode risk are themselves subject to assurance.</li>
            </ul>
          </div>
        </div>
      </section>

      <CTASection title="Make assurance visible before trust is required." body="See the Workbench model, schedule a demonstration, or join the early-access conversation about governed human-agent work." />
    </SiteShell>
  );
}
