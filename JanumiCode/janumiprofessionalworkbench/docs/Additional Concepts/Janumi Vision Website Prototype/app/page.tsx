import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLink,
  CTASection,
  DefinitionCard,
  Eyebrow,
  SectionHeading,
  SiteShell,
} from "./components";
import {
  AssuranceVisual,
  CapabilityTimelineVisual,
  JanumiCodeVisual,
  PwaDesignerVisual,
  ScenarioCapabilityVisual,
  ShapeEngineeringVisual,
  UndertakingVisual,
} from "./visuals";
import {
  CapabilityStackExplorer,
  ManifestationExplorer,
} from "./interactions";
import { HistoricalCapabilityHero } from "./hero-timeline";

export const metadata: Metadata = {
  title: { absolute: "Janumi — Infrastructure for humanity’s professional capability" },
  description:
    "Janumi turns professional intent into governed, evidence-bearing work architectures for accountable human-agent execution.",
};

const futureExpressions = [
  {
    name: "JanumiLegal",
    detail: "Privilege, precedent, jurisdiction, ethical walls, and consequential matters.",
  },
  {
    name: "JanumiHealth",
    detail: "Longitudinal evidence, uncertainty, specialist authority, privacy, and patient safety.",
  },
  {
    name: "JanumiConstruction",
    detail: "Physical dependencies, field conditions, inspection, readiness, and distributed delivery.",
  },
];

export default function Home() {
  return (
    <SiteShell>
      <section className="home-hero">
        <div className="hero-grain" />
        <div className="shell">
          <HistoricalCapabilityHero />
        </div>
      </section>

      <section className="problem-section section-pad">
        <div className="shell problem-grid">
          <div className="problem-lead reveal">
            <Eyebrow>THE REAL ENTERPRISE PROBLEM</Eyebrow>
            <h2>AI can generate more work. The harder problem is keeping that work <em>whole.</em></h2>
          </div>
          <div className="problem-body reveal">
            <p>
              Professional outcomes depend on relationships that task systems and
              chat-based agents routinely lose: original intent, cross-functional
              obligations, assumptions, authority, evidence, constraints, and the
              consequences of change.
            </p>
            <p>
              Janumi provides a structure for decomposing work without surrendering
              the meaning of the whole—and for proving that completed activity
              justifies downstream action.
            </p>
            <ArrowLink href="/vision">Read the Janumi vision</ArrowLink>
          </div>
        </div>
        <div className="shell">
          <ManifestationExplorer />
        </div>
        <div className="shell artifact-thesis">
          <span>Artifacts matter.</span>
          <strong>Outcomes govern.</strong>
          <p>
            The artifact preserves, communicates, authorizes, constrains, or
            evidences professional work. Janumi keeps it connected to the obligation
            it serves and the reality it is intended to change.
          </p>
        </div>
      </section>

      <section className="scenario-section section-pad">
        <div className="shell">
          <SectionHeading
            eyebrow="THE LONG HORIZON"
            title={<>Situations demand capability—not another disconnected workflow.</>}
            body={<>Janumi’s current product model begins with governed work. Its candidate strategic model reaches outward to the changing scenario and upward to the capability an organization can justifiably claim.</>}
          />
          <div className="scenario-layout">
            <ScenarioCapabilityVisual />
            <div className="candidate-definitions">
              <div className="candidate-notice">LONG-TERM VISION · CANDIDATE CONCEPTS · NOT YET CANONICAL</div>
              <DefinitionCard number="A" term="Professional Scenario" accent="clay">
                A durable, time-evolving, access-bounded representation of a consequential situation that may sponsor many Undertakings.
              </DefinitionCard>
              <DefinitionCard number="B" term="Professional Capability" accent="moss">
                An evidence-backed, temporally qualified ability to transform a class of scenarios under declared conditions and authority.
              </DefinitionCard>
            </div>
          </div>
        </div>
      </section>

      <section className="shape-section section-pad">
        <div className="shell shape-grid-copy">
          <div>
            <SectionHeading
              eyebrow="CANDIDATE DESIGN DIRECTION · SHAPE ENGINEERING"
              title={<>Design the executable shape of professional work.</>}
              body={<>Shape Engineering is the proposed discipline for discovering, modeling, validating, and evolving executable professional work architectures. Its durable principles inform this prototype; the named discipline and associated language remain candidate designs pending ratification.</>}
            />
            <div className="shape-sequence">
              <span>Desired outcome</span><i>→</i><span>Governed PWA</span><i>→</i><span>Assured result</span><i>→</i><span>Observed outcome</span>
            </div>
          </div>
          <ShapeEngineeringVisual />
        </div>
      </section>

      <section className="platform-intro section-pad" id="professional-workbench">
        <div className="shell platform-intro-grid">
          <div>
            <Eyebrow light>JANUMI PROFESSIONAL WORKBENCH</Eyebrow>
            <h2>Design the architecture of professional work. Operate it without losing intent.</h2>
          </div>
          <div>
            <p>
              A general environment for designing reusable Professional Work
              Architectures and operating concrete Undertakings through execution,
              assurance, governance, traceability, and baselining.
            </p>
            <ArrowLink href="/platform" light>Explore the Workbench</ArrowLink>
          </div>
        </div>
      </section>

      <section className="product-stage product-stage-pwa section-pad">
        <div className="shell">
          <div className="stage-heading">
            <span className="stage-number">01</span>
            <div>
              <Eyebrow>PWA DESIGNER</Eyebrow>
              <h2>Encode the work before automating it.</h2>
            </div>
            <p>
              Author recursive PWU Types, explicit child rules, obligations,
              applicability, recomposition, roles, and assurance coverage. The view
              is an architecture of reusable types—not a running workflow.
            </p>
          </div>
          <PwaDesignerVisual />
        </div>
      </section>

      <section className="product-stage product-stage-assurance section-pad">
        <div className="shell">
          <div className="stage-heading stage-heading-light">
            <span className="stage-number">02</span>
            <div>
              <Eyebrow light>ASSURANCE ENGINEERING</Eyebrow>
              <h2>Not a final gate. The control fabric of the work.</h2>
            </div>
            <p>
              Every material professional transformation has an explicit coverage
              decision. Every required control is durably bound, executed, recorded,
              inspectable, and enforced before its protected downstream transition.
            </p>
          </div>
          <AssuranceVisual />
          <div className="assurance-principle">
            <span><b>Definition time</b> required treatment</span>
            <span><b>Deployment time</b> conforming capability</span>
            <span><b>Runtime</b> exact execution, disposition, evidence, and gate</span>
          </div>
          <div className="center-link"><ArrowLink href="/assurance" light>See how assurance works</ArrowLink></div>
        </div>
      </section>

      <section className="product-stage product-stage-undertaking section-pad">
        <div className="shell">
          <div className="stage-heading">
            <span className="stage-number">03</span>
            <div>
              <Eyebrow>UNDERTAKING WORKBENCH</Eyebrow>
              <h2>Turn architecture into accountable professional action.</h2>
            </div>
            <p>
              Bind an exact PWA version and operate concrete PWU Instances through a
              Professional Work Graph—alongside execution, evidence, assessments,
              decisions, and immutable baselines.
            </p>
          </div>
          <UndertakingVisual />
        </div>
      </section>

      <section className="janumicode-section section-pad">
        <div className="shell janumicode-grid">
          <div className="janumicode-copy">
            <Eyebrow light>FIRST DOMAIN REALIZATION</Eyebrow>
            <h2>Software engineering is the proving ground.</h2>
            <p>
              JanumiCode demonstrates that producing code is not the same as
              satisfying a product obligation. It preserves product intent from
              discovery through implementation, verification, release, and
              continuing observation.
            </p>
            <div className="code-principles">
              <span>Outcome over artifact volume</span>
              <span>Evidence over self-description</span>
              <span>Human authority made explicit</span>
            </div>
            <ArrowLink href="/janumicode" light>Explore JanumiCode</ArrowLink>
          </div>
          <JanumiCodeVisual />
        </div>
      </section>

      <section className="access-section section-pad">
        <div className="shell access-heading">
          <SectionHeading
            eyebrow="ONE SEMANTIC CORE"
            title={<>From open foundation to enterprise trust boundary.</>}
            body={<>A shared professional model can serve individual builders and governed organizations without fragmenting the meaning of the work.</>}
          />
        </div>
        <div className="shell access-grid">
          <article className="access-card access-community">
            <span className="access-index">01</span>
            <Eyebrow>COMMUNITY · DEFINED DIRECTION</Eyebrow>
            <h3>Inspect, extend, and operate the foundation.</h3>
            <p>AGPL, single-tenant, self-hosted, BYOK, with core RPH and Workbench capabilities designed to remain semantically compatible with every tier.</p>
            <ArrowLink href="/open-source">Explore open source</ArrowLink>
          </article>
          <article className="access-card access-enterprise">
            <span className="access-index">02</span>
            <Eyebrow light>ENTERPRISE · DESIGNED DIRECTION</Eyebrow>
            <h3>Professional intelligence inside explicit trust boundaries.</h3>
            <p>Tenant and principal scope, delegated authority, policy enforcement, isolated execution, deployment choice, and tamper-evident audit.</p>
            <ArrowLink href="/enterprise" light>Explore enterprise</ArrowLink>
          </article>
        </div>
      </section>

      <section className="professions-section section-pad">
        <div className="shell">
          <SectionHeading
            eyebrow="ONE FRAMEWORK, MANY PROFESSIONS"
            title={<>Different professional topologies. One underlying grammar.</>}
            body={<>Janumi supplies universal semantics for intent, outcomes, obligation, work, claims, evidence, authority, assurance, provenance, reconciliation, and time. Domain ontologies and PWAs supply professional meaning.</>}
          />
          <div className="profession-grid">
            <article className="profession-card profession-current">
              <div className="profession-status">CURRENT FOCUS · FIRST DOMAIN REALIZATION</div>
              <span className="profession-number">01</span>
              <h3>JanumiCode</h3>
              <p>Software product realization, operations, modernization, migration, incidents, and recovery.</p>
              <Link href="/janumicode">Explore <span aria-hidden="true">↗</span></Link>
            </article>
            {futureExpressions.map((item, index) => (
              <article className="profession-card profession-future" key={item.name}>
                <div className="profession-status">FUTURE EXPRESSION · NOT CURRENTLY AVAILABLE</div>
                <span className="profession-number">0{index + 2}</span>
                <h3>{item.name}</h3>
                <p>{item.detail}</p>
                <span className="future-tag">VISION CONCEPT</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="time-section section-pad">
        <div className="shell time-grid">
          <div className="time-copy">
            <Eyebrow light>THE DIMENSION OF TIME</Eyebrow>
            <h2>Capability has a trajectory.</h2>
            <p>
              People leave. Tools become obsolete. Institutions change. Evidence grows
              stale. Outcomes may become visible years after the work that produced them.
            </p>
            <p>
              Janumi&apos;s long-term architecture treats time not as metadata, but as a
              dimension of meaning, authority, evidence, continuity, and stewardship.
            </p>
          </div>
          <CapabilityTimelineVisual />
        </div>
      </section>

      <section className="civilizational-section section-pad">
        <div className="shell civilizational-grid">
          <div className="civilizational-copy">
            <div className="candidate-notice candidate-notice-light">DIRECTIONAL NORTH STAR · CANDIDATE CONCEPT</div>
            <Eyebrow light>CIVILIZATIONAL CAPABILITY</Eyebrow>
            <h2>Some capabilities must outlive every participant.</h2>
            <p>
              A durable, distributed, intergenerational ability of a societal
              ecosystem to produce, sustain, adapt, or reconstitute consequential
              outcomes across time—despite discontinuity in people, institutions,
              infrastructure, custodians, and technologies.
            </p>
            <blockquote>
              “Stewardship, not centralized control.”
            </blockquote>
            <ArrowLink href="/vision" light>Enter the grand vision</ArrowLink>
          </div>
          <CapabilityStackExplorer />
        </div>
      </section>

      <section className="research-teaser section-pad">
        <div className="shell research-grid">
          <div>
            <Eyebrow>RESEARCH & IDEAS</Eyebrow>
            <h2>An ambitious thesis should remain challengeable.</h2>
          </div>
          <div className="research-questions">
            <p>Can recursive work preserve intent better than task decomposition?</p>
            <p>Can invocation-level Assurance Engineering reduce plausible-but-wrong output?</p>
            <p>Can capability persist across organizations, technologies, and generations?</p>
            <ArrowLink href="/research">Explore the research program</ArrowLink>
          </div>
        </div>
      </section>

      <CTASection
        eyebrow="THE WORK AHEAD"
        title="From producing artifacts to stewarding capability."
        body="Janumi begins with a practical enterprise problem: helping humans and AI perform consequential work without losing coherence. Its horizon is the preservation and evolution of the capabilities on which future organizations—and future generations—depend."
      />
    </SiteShell>
  );
}
