import type { Metadata } from "next";
import {
  CTASection,
  DefinitionCard,
  Eyebrow,
  InteriorHero,
  SectionHeading,
  SiteShell,
} from "../components";
import { ScenarioReconciliationVisual } from "../visuals";

export const metadata: Metadata = {
  title: "Research & Ideas",
  description: "A challengeable research program for professional work, assurance, scenarios, capability, and governed learning.",
};

const questions = [
  "Can a universal semantic grammar represent professional work without erasing domain-specific meaning?",
  "Does explicit recursive work and recomposition preserve intent better than task decomposition alone?",
  "Can invocation-level and compositional Assurance Engineering reduce plausible-but-wrong professional output?",
  "Can scenario-aware systems coordinate changing evidence, authority, and possible futures across Undertakings?",
  "Can capability portfolios expose readiness, degradation, dependency, and succession risk more honestly than service catalogs?",
  "Can governed learning accumulate capability without violating privilege, consent, tenant isolation, or provenance?",
];

export default function ResearchPage() {
  return (
    <SiteShell>
      <InteriorHero
        eyebrow="EXPLORATORY RESEARCH"
        index="06"
        tone="clay"
        title={<>An ambitious thesis should remain <em>challengeable.</em></>}
        body={<>Janumi’s long-term vision is a research program as much as a product direction. Its abstractions must be tested against professional reality, measurable outcomes, failure analysis, domain expertise, and the limits of what technology can safely represent.</>}
      >
        <div className="research-hero-art" aria-hidden="true"><span>HYPOTHESIS</span><i>?</i><span>EVIDENCE</span><i>↻</i><span>LEARNING</span></div>
      </InteriorHero>

      <section className="questions-section section-pad">
        <div className="shell">
          <SectionHeading eyebrow="QUESTIONS WORTH PROVING" title={<>Research begins where certainty ends.</>} />
          <div className="question-list">
            {questions.map((question, index) => <article key={question}><span>{String(index + 1).padStart(2, "0")}</span><p>{question}</p></article>)}
          </div>
        </div>
      </section>

      <section className="research-candidates section-pad">
        <div className="shell">
          <div className="candidate-notice">EXPLORATORY · NOT YET CANONICAL</div>
          <SectionHeading eyebrow="CANDIDATE CONCEPTS" title={<>Useful hypotheses, not implemented product claims.</>} />
          <div className="definition-grid definition-grid-five">
            <DefinitionCard number="01" term="Professional Scenario" accent="clay">Situated professional demand within an evolving consequential reality.</DefinitionCard>
            <DefinitionCard number="02" term="Professional System" accent="blue">The socio-technical arrangement through which capability is realized.</DefinitionCard>
            <DefinitionCard number="03" term="Professional Capability" accent="moss">Conditional, evidence-backed professional ability.</DefinitionCard>
            <DefinitionCard number="04" term="Civilizational Capability" accent="ochre">Capability distributed across institutions, infrastructures, and generations.</DefinitionCard>
            <DefinitionCard number="05" term="Narrative Memory" accent="blue">Provenance-linked interpretation of how scenarios and capabilities evolved.</DefinitionCard>
          </div>
        </div>
      </section>

      <section className="merger-exemplar section-pad">
        <div className="shell">
          <div className="two-column-editorial">
            <div><Eyebrow light>CONSEQUENTIAL MERGER EXEMPLAR</Eyebrow><h2>One scenario. Many bodies of work. No omniscient view.</h2></div>
            <div className="editorial-prose editorial-prose-light"><p className="lead">A multinational acquisition spans antitrust, national security, sanctions, financing, tax, privacy, employment, intellectual property, disclosure, and integration.</p><p>Each stream has different authority and information constraints. A remedy in one jurisdiction can undermine strategic intent and reopen work elsewhere.</p></div>
          </div>
          <ScenarioReconciliationVisual />
        </div>
      </section>

      <section className="evidence-program section-pad">
        <div className="shell evidence-program-grid">
          <div><Eyebrow>THE VISION EARNS CREDIBILITY THROUGH EVIDENCE</Eyebrow><h2>No abstraction becomes true because it is elegant.</h2></div>
          <div className="evidence-methods">
            <span>Reference Undertakings</span><span>Executable conformance</span><span>Customer outcomes</span><span>Escaped-defect observation</span><span>Longitudinal studies</span><span>Professional review</span><span>Explicit failure analysis</span>
          </div>
        </div>
      </section>

      <section className="limits-section section-pad">
        <div className="shell">
          <SectionHeading eyebrow="DESIGN LIMITS" title={<>What Janumi must never become.</>} />
          <div className="limits-grid">
            {["An omniscient model of reality", "A universal central database", "An artifact factory that mistakes output for outcome", "A self-authorizing professional actor", "A machine for concealing uncertainty", "A silent cross-client learning system", "Assurance theater of scores and green badges", "A replacement for legitimate professional judgment"].map((item, index) => <div key={item}><span>×</span><strong>{item}</strong><small>{String(index + 1).padStart(2, "0")}</small></div>)}
          </div>
        </div>
      </section>

      <CTASection title="Bring a hard professional problem to the research program." body="We are interested in domains where coherence, assurance, evidence, authority, and time are genuinely consequential." />
    </SiteShell>
  );
}
