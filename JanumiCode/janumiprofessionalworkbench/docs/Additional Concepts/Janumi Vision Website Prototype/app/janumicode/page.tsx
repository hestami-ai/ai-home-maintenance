import type { Metadata } from "next";
import {
  CTASection,
  Eyebrow,
  InteriorHero,
  SectionHeading,
  SiteShell,
} from "../components";
import { JanumiCodeVisual } from "../visuals";

export const metadata: Metadata = {
  title: "JanumiCode",
  description: "The first Janumi domain realization: software delivery with intent, evidence, assurance, and authority intact.",
};

export default function JanumiCodePage() {
  return (
    <SiteShell>
      <InteriorHero
        eyebrow="FIRST DOMAIN REALIZATION"
        index="03"
        tone="forest"
        title={<>Software delivery with intent, evidence, and <em>authority intact.</em></>}
        body={<>JanumiCode is the first domain realization of the Professional Workbench: a software-product environment combining multiple software PWAs with domain-specific policies, agents, views, and engineering integrations.</>}
      >
        <div className="code-hero-art" aria-hidden="true"><span>{"{"}</span><i>intent</i><i>evidence</i><i>assurance</i><span>{"}"}</span></div>
      </InteriorHero>

      <section className="product-status-note"><div className="shell"><span>PRODUCT STATUS · FIRST DOMAIN REALIZATION IN DEVELOPMENT</span><p>JanumiCode is the current proving ground. This site distinguishes intended product behavior from claims of complete feature availability.</p></div></section>

      <section className="code-showcase section-pad">
        <div className="shell"><JanumiCodeVisual /></div>
      </section>

      <section className="code-problem section-pad">
        <div className="shell two-column-editorial">
          <div><Eyebrow>THE PROVING GROUND</Eyebrow><h2>Producing code is not the same as satisfying a product obligation.</h2></div>
          <div className="editorial-prose">
            <p className="lead">Generated code, successful builds, and passing tests are valuable—but scoped—evidence.</p>
            <p>JanumiCode connects change to intent, desired outcomes, journeys, requirements, architecture decisions, verification evidence, releases, and post-deployment observations.</p>
            <p>Completion requires more than activity. It requires an assured, traceable, authoritatively accepted software baseline.</p>
          </div>
        </div>
      </section>

      <section className="software-pwas section-pad">
        <div className="shell">
          <SectionHeading eyebrow="MORE THAN ONE LIFECYCLE" title={<>One product. Many professional architectures.</>} body={<>JanumiCode is a domain product that contains multiple software PWAs—not one monolithic PWA forced over every kind of engineering work.</>} />
          <div className="software-pwa-grid">
            {[
              ["Product realization", "From underspecified intent to implemented, assured, accepted product baseline."],
              ["Brownfield modernization", "Understand existing behavior, constraints, dependencies, and migration risk before intervention."],
              ["Security maintenance", "Coordinate disclosure, impact, remediation, validation, release, and operational evidence."],
              ["Incident & recovery", "Preserve timeline, authority, observations, hypotheses, actions, and post-incident learning."],
              ["Migration", "Plan and assure state transition, compatibility, reversibility, and cutover evidence."],
              ["Continuing operations", "Reconcile observed outcomes and degradation against the accepted product baseline."],
            ].map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="trajectory-section section-pad">
        <div className="shell">
          <SectionHeading eyebrow="PRODUCT REALIZATION" title={<>Keep the semantic thread from discovery to observation.</>} />
          <div className="trajectory-rail" role="list">
            {[
              "Intent & JTBD",
              "Product behavior",
              "Architecture & verification",
              "Implementation planning",
              "Product implementation",
              "Integrated validation",
              "Baseline promotion",
              "Observed outcomes",
            ].map((item, index) => <div role="listitem" key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><i /></div>)}
          </div>
          <p className="trajectory-note">This is a semantic trajectory, not a claim that the PWA is a single linear workflow. Recursive work, feedback, recomposition, and change remain explicit.</p>
        </div>
      </section>

      <section className="code-assurance-section section-pad">
        <div className="shell code-assurance-grid">
          <div><Eyebrow light>ASSURANCE THROUGHOUT</Eyebrow><h2>Challenge plausible output before it becomes product truth.</h2></div>
          <div className="assurance-levels">
            <span><b>Local</b> assess each material transformation</span>
            <span><b>Compositional</b> prove parent obligations from child results</span>
            <span><b>Product-level</b> validate integrated fitness and intended outcomes</span>
            <span><b>Meta-assurance</b> evaluate the control system itself</span>
          </div>
        </div>
      </section>

      <CTASection title="Build software without losing the product." body="Join the JanumiCode waitlist, inspect the open-source direction, or schedule a product demonstration." />
    </SiteShell>
  );
}
