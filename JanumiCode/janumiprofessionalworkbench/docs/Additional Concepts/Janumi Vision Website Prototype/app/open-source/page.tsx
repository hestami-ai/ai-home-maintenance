import type { Metadata } from "next";
import Link from "next/link";
import {
  CTASection,
  Eyebrow,
  InteriorHero,
  SectionHeading,
  SiteShell,
} from "../components";

export const metadata: Metadata = {
  title: "Open Source",
  description: "An inspectable, extensible foundation for governed professional-work infrastructure.",
};

export default function OpenSourcePage() {
  return (
    <SiteShell>
      <InteriorHero
        eyebrow="OPEN FOUNDATION · DEFINED DIRECTION"
        index="05"
        title={<>Professional-work infrastructure developers can <em>inspect, extend, and operate.</em></>}
        body={<>The Community edition is defined as an AGPL, single-tenant, self-hosted foundation with BYOK, core RPH and Workbench capabilities, sandboxed execution, self-hosted version-control integration, and base audit and encryption.</>}
      >
        <div className="oss-hero-art" aria-hidden="true"><span>AGPL</span><i /><strong>ONE<br />SEMANTIC<br />CORE</strong><i /><span>BYOK</span></div>
      </InteriorHero>

      <section className="repo-callout section-pad">
        <div className="shell repo-card" id="repository">
          <div className="repo-mark" aria-hidden="true">&lt;/&gt;</div>
          <div><Eyebrow>REPOSITORY PLACEHOLDER</Eyebrow><h2>Follow the build in the open.</h2><p>The public repository destination will be connected when the project link is confirmed. This prototype intentionally does not invent one.</p></div>
          <button className="button button-disabled" type="button" disabled>Repository link forthcoming</button>
        </div>
      </section>

      <section className="oss-principles section-pad">
        <div className="shell">
          <SectionHeading eyebrow="WHY AN OPEN FOUNDATION" title={<>Trustworthy foundations should be available beyond the enterprise tier.</>} />
          <div className="oss-grid">
            {[
              ["One semantic core", "Community, Enterprise, and Cloud share the same canonical model, contracts, migrations, and client semantics."],
              ["Bring your own models", "Bind model and agent capabilities without coupling Professional Work Architectures to one provider."],
              ["Domain extensibility", "Add PWAs, profiles, policies, Validators, views, and declared extensions without forking professional meaning."],
              ["Inspectable governance", "Keep state transitions, evidence, assurance, and authority explicit rather than hidden inside agent prompts."],
              ["Portable professional state", "Preserve the work model across deployment choices, technology change, and edition boundaries."],
              ["A path to enterprise", "Add organizational capabilities through governed entitlements, not incompatible edition-specific data models."],
            ].map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="builder-path section-pad">
        <div className="shell builder-grid">
          <div><Eyebrow light>FOR DEVELOPERS & VIBE CODERS</Eyebrow><h2>Build with agents without making the prompt the architecture.</h2></div>
          <div>
            <p>Janumi makes the professional obligation, generated artifacts, evidence, required review, findings, and authorized transitions inspectable outside the chat transcript.</p>
            <div className="builder-steps">
              <span><b>01</b> Model the intent</span>
              <span><b>02</b> Select or shape a PWA</span>
              <span><b>03</b> Execute through bounded agents</span>
              <span><b>04</b> Inspect evidence and assurance</span>
              <span><b>05</b> Promote only by authority</span>
            </div>
            <Link className="button button-bone" href="/connect#waitlist">Join the developer waitlist <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>

      <CTASection title="Help make professional-work infrastructure inspectable." body="Join the waitlist for repository announcements, early builds, and opportunities to test the open foundation." />
    </SiteShell>
  );
}
