import type { Metadata } from "next";
import {
  ArrowLink,
  CTASection,
  DefinitionCard,
  Eyebrow,
  InteriorHero,
  SectionHeading,
  SiteShell,
  StatementBand,
} from "../components";
import {
  CapabilityPortfolioVisual,
  CapabilityTimelineVisual,
  ScenarioCapabilityVisual,
  ScenarioReconciliationVisual,
} from "../visuals";
import {
  CapabilityStackExplorer,
  RegenerativeCycleExplorer,
} from "../interactions";

export const metadata: Metadata = {
  title: "Vision",
  description: "Janumi’s north star: the intergenerational stewardship of professional and civilizational capability.",
};

export default function VisionPage() {
  return (
    <SiteShell>
      <InteriorHero
        eyebrow="VISIONARY & NON-NORMATIVE"
        index="V"
        tone="forest"
        title={<>From Shape Engineering to the intergenerational stewardship of <em>civilizational capability.</em></>}
        body={<>Professional work is not fundamentally a sequence of tasks or a collection of artifacts. It is the exercise of professional capability within a changing, uncertain, and consequential reality.</>}
      >
        <div className="vision-orbit-art" aria-hidden="true"><i /><i /><i /><span>TIME</span><strong>CAPABILITY</strong></div>
      </InteriorHero>

      <section className="authority-note">
        <div className="shell">
          <span>AUTHORITY NOTE</span>
          <p>This page describes Janumi&apos;s north star. Candidate concepts do not alter the current canonical product model or constitute roadmap commitments.</p>
        </div>
      </section>

      <section className="section-pad">
        <div className="shell two-column-editorial">
          <div>
            <Eyebrow>THE ENDURING ASSET</Eyebrow>
            <h2>The enduring asset is the ability.</h2>
          </div>
          <div className="editorial-prose">
            <p className="lead">Software, contracts, diagnoses, buildings, spacecraft, and scientific instruments are visible outputs.</p>
            <p>Beneath each is a professional system of people, institutions, knowledge, methods, tools, relationships, authority, memory, and coordinated work accumulated over time.</p>
            <p>The deeper asset is the capability to produce, sustain, adapt, validate, and reproduce valuable outcomes as conditions change.</p>
          </div>
        </div>
      </section>

      <StatementBand label="THE REGENERATIVE CYCLE">
        Work changes reality. Reality must change the work.
      </StatementBand>

      <section className="cycle-section section-pad">
        <div className="shell">
          <RegenerativeCycleExplorer />
        </div>
      </section>

      <section className="candidate-section section-pad">
        <div className="shell">
          <SectionHeading
            eyebrow="CANDIDATE STRATEGIC MODEL"
            title={<>A richer context for consequential work.</>}
            body={<>The following concepts extend beyond the current product ontology. They are research candidates: useful precisely because they can be examined, challenged, or rejected.</>}
          />
          <ScenarioCapabilityVisual />
          <div className="definition-grid definition-grid-three">
            <DefinitionCard number="01" term="Professional Scenario" accent="clay">A time-evolving, epistemically qualified, access-bounded representation of a consequential situation across relevant past, present, and possible futures.</DefinitionCard>
            <DefinitionCard number="02" term="Professional Capability" accent="moss">An evidence-backed, versioned, temporally qualified ability to transform a class of scenarios under declared conditions, authority, constraints, risk, and assurance.</DefinitionCard>
            <DefinitionCard number="03" term="Capability Portfolio" accent="ochre">A situated view of what an organization can credibly mobilize now, where readiness is degrading, and what must be renewed or reconstituted.</DefinitionCard>
          </div>
        </div>
      </section>

      <section className="portfolio-section section-pad">
        <div className="shell">
          <div className="candidate-notice">LONG-TERM VISION · CANDIDATE CONCEPT · NOT YET CANONICAL</div>
          <SectionHeading
            eyebrow="CAPABILITY PORTFOLIO"
            title={<>From a service catalogue to a qualified view of organizational ability.</>}
            body={<>A future capability portfolio would make scope, qualification, current evidence, authority, capacity, dependency, degradation, renewal, and succession risk inspectable across time. A declared service is only a claim; posture must remain evidence-backed and situated.</>}
          />
          <CapabilityPortfolioVisual />
        </div>
      </section>

      <section className="vision-reconciliation section-pad">
        <div className="shell">
          <div className="two-column-editorial">
            <div>
              <Eyebrow light>SCENARIO-AWARE COHERENCE</Eyebrow>
              <h2>New evidence should change more than the record.</h2>
            </div>
            <div className="editorial-prose editorial-prose-light">
              <p className="lead">A consequential situation continues to evolve while professional work is underway.</p>
              <p>When new evidence invalidates an assumption, Janumi&apos;s long horizon is a system that can locate the dependent claims and decisions, reopen governed work, and preserve why the professional posture changed.</p>
            </div>
          </div>
          <ScenarioReconciliationVisual />
        </div>
      </section>

      <section className="time-vision section-pad">
        <div className="shell">
          <SectionHeading
            eyebrow="TIME AS A DIMENSION OF MEANING"
            title={<>Across organizations. Across technologies. Across generations.</>}
            body={<>A capability may survive through lineage rather than literal sameness. The decisive question is not only whether an artifact still exists, but whether the professional ecosystem retains the ability to understand, maintain, adapt, and reproduce what it represents.</>}
          />
          <CapabilityTimelineVisual />
        </div>
      </section>

      <section className="civilization-vision section-pad">
        <div className="shell civilization-vision-grid">
          <div>
            <div className="candidate-notice candidate-notice-light">DIRECTIONAL NORTH STAR · CANDIDATE CONCEPT</div>
            <Eyebrow light>CIVILIZATIONAL CAPABILITY</Eyebrow>
            <h2>Some capabilities must outlive every participant.</h2>
            <p>A Civilizational Capability is envisioned as a durable, distributed, and intergenerational ability of a societal ecosystem to produce, sustain, adapt, or reconstitute consequential outcomes across time—despite discontinuity in people, organizations, institutions, infrastructure, knowledge custodians, and technologies.</p>
            <p>No individual understands the whole. No single organization owns all necessary knowledge or authority. Continuity may depend on suppliers, universities, regulators, professions, facilities, standards, apprenticeship, culture, trust, and generations of accumulated practice.</p>
          </div>
          <CapabilityStackExplorer />
        </div>
      </section>

      <section className="stewardship-section section-pad">
        <div className="shell stewardship-grid">
          <span className="stewardship-index">∞</span>
          <div>
            <Eyebrow>STEWARDSHIP, NOT CENTRALIZED CONTROL</Eyebrow>
            <h2>Distributed knowledge. Explicit provenance. Legitimate authority.</h2>
          </div>
          <div className="editorial-prose">
            <p>Janumi does not aspire to create an omniscient model of reality or a universal central database.</p>
            <p>Its long-term role is to make professional capability more explicit, inspectable, evidence-backed, resilient, transferable, and capable of governed learning—while knowledge, custody, and authority remain appropriately distributed.</p>
            <ArrowLink href="/research">Challenge the research thesis</ArrowLink>
          </div>
        </div>
      </section>

      <CTASection
        eyebrow="THE CLOSING THESIS"
        title="Steward professional capability across complex scenarios, institutions, technological eras, and time."
        body="The horizon informs the architecture. The work begins with a practical platform and evidence that the platform improves professional outcomes."
      />
    </SiteShell>
  );
}
