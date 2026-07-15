import type { Metadata } from "next";
import {
  CTASection,
  Eyebrow,
  InteriorHero,
  SectionHeading,
  SiteShell,
} from "../components";

export const metadata: Metadata = {
  title: "Company",
  description: "Janumi is building infrastructure for accountable professional work between humans and AI.",
};

export default function CompanyPage() {
  return (
    <SiteShell>
      <InteriorHero
        eyebrow="THE COMPANY"
        index="07"
        title={<>Building infrastructure for <em>accountable professional work.</em></>}
        body={<>Janumi is developing a new foundation for professional environments in which humans and AI must work together without losing intent, evidence, authority, or responsibility.</>}
      >
        <div className="company-hero-art" aria-hidden="true"><span>HUMAN</span><i>+</i><span>AGENT</span><strong>ACCOUNTABLE<br />WORK</strong></div>
      </InteriorHero>

      <section className="why-section section-pad">
        <div className="shell two-column-editorial">
          <div><Eyebrow>WHY JANUMI</Eyebrow><h2>Generation is accelerating. Coherence is not.</h2></div>
          <div className="editorial-prose"><p className="lead">AI greatly expands the amount of professional activity that can be attempted.</p><p>It does not automatically preserve truth, wholeness, authority, institutional memory, or professional accountability. Without a stronger architecture, increased generation can produce increased fragmentation.</p><p>Janumi&apos;s opportunity is to provide that architecture.</p></div>
        </div>
      </section>

      <section className="founder-statement section-pad">
        <div className="shell">
          <Eyebrow light>WHY WE ARE BUILDING</Eyebrow>
          <blockquote>“We are building Janumi because the future of professional work cannot depend on agents that merely sound capable. It requires systems that keep professional purpose visible, make uncertainty challengeable, preserve authority, and show why work was permitted to advance.”</blockquote>
        </div>
      </section>

      <section className="company-build section-pad">
        <div className="shell">
          <SectionHeading eyebrow="WHAT WE ARE BUILDING" title={<>A practical platform with a long horizon.</>} body={<>Janumi Professional Workbench is the platform environment. JanumiCode is its first domain realization and the proving ground for recursive professional work, Assurance Engineering, and the candidate Shape Engineering discipline.</>} />
          <div className="company-product-chain">
            <div><span>01</span><strong>Janumi</strong><p>The company and professional capability thesis.</p></div>
            <div><span>02</span><strong>Professional Workbench</strong><p>The general platform for governed professional work.</p></div>
            <div><span>03</span><strong>JanumiCode</strong><p>The first domain realization in software engineering.</p></div>
          </div>
        </div>
      </section>

      <section className="principles-section section-pad">
        <div className="shell">
          <SectionHeading eyebrow="COMPANY PRINCIPLES" title={<>The commitments that shape the architecture.</>} />
          <div className="principle-list">
            {[
              "Outcomes over artifact volume",
              "Explicit uncertainty over synthetic confidence",
              "Evidence over self-description",
              "Governed delegation over autonomous authority",
              "Recomposition over disconnected task completion",
              "Portable semantics over dependence on one model or cloud",
              "Professional judgment supported, never silently displaced",
              "Trustworthy foundations available beyond the enterprise tier",
            ].map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>)}
          </div>
        </div>
      </section>

      <section className="company-horizon section-pad">
        <div className="shell horizon-grid">
          <div><Eyebrow light>COMPANY HORIZON</Eyebrow><h2>Start where value is demonstrable. Build so the horizon remains possible.</h2></div>
          <div><p>Janumi begins by testing the candidate Shape Engineering thesis through software delivery. From there, the platform may support reusable capability supply, additional professional domains, organizational capability portfolios, and federated professional systems.</p><p>The immediate objective is measurable improvement in completeness, intent preservation, evidence quality, recovery, defect escape, and human trust.</p><strong>The horizon informs the architecture. It does not substitute for present evidence.</strong></div>
        </div>
      </section>

      <CTASection title="Join the people shaping accountable professional work." body="Connect as an enterprise design partner, developer, investor, researcher, or professional-domain collaborator." />
    </SiteShell>
  );
}
