import type { Metadata } from "next";
import {
  CTASection,
  Eyebrow,
  InteriorHero,
  MetricStrip,
  SectionHeading,
  SiteShell,
} from "../components";

export const metadata: Metadata = {
  title: "Enterprise",
  description: "Governed professional intelligence within explicit enterprise trust boundaries.",
};

export default function EnterprisePage() {
  return (
    <SiteShell>
      <InteriorHero
        eyebrow="ENTERPRISE"
        index="04"
        tone="forest"
        title={<>Professional intelligence within explicit <em>trust boundaries.</em></>}
        body={<>Janumi is designed for organizations that must combine human and agent execution without surrendering tenant isolation, authority, auditability, deployment control, or professional accountability.</>}
      >
        <div className="trust-hero-art" aria-hidden="true"><div><span>TENANT</span><strong>TRUST PLANE</strong><i>governed state</i></div><div><span>EXECUTION</span><strong>AGENT PLANE</strong><i>least privilege</i></div></div>
      </InteriorHero>

      <section className="enterprise-principles section-pad">
        <div className="shell">
          <SectionHeading eyebrow="ENTERPRISE BY ARCHITECTURE" title={<>Control is a property of the system—not a procurement add-on.</>} body={<>Professional semantics remain constant while deployment, isolation, identity, policy, and operational controls scale with organizational needs.</>} />
          <div className="enterprise-feature-grid">
            {[
              ["Isolated trust planes", "Separate trusted professional state and governance from ephemeral execution of agents, tools, builds, and untrusted content."],
              ["Tenant & principal scope", "Carry authenticated tenant and human, machine, workload, or agent identity through every command, event, artifact, and audit record."],
              ["Delegated authority", "Record who delegated which scope, under what policy, and until when. Agent capability never silently becomes human authority."],
              ["Defense in depth", "Combine application authorization, row-level security, short-lived credentials, redaction, sandboxing, and tamper-evident audit."],
              ["Deployment choice", "Preserve professional semantics across smaller self-hosted, enterprise self-hosted, private, air-gapped, and managed-cloud topologies."],
              ["Evidence-ready architecture", "Support regulated and compliance-sensitive environments without claiming certification before evidence exists."],
            ].map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="tenant-section section-pad">
        <div className="shell tenant-grid">
          <div>
            <Eyebrow light>COMPARTMENTED PROFESSIONAL MEMORY</Eyebrow>
            <h2>Access follows authority, purpose, and provenance.</h2>
            <p>Narrative memory can help authorized people and agent proxies understand how work evolved. It cannot become a shadow source of truth or a silent channel across client, matter, ethical-wall, or tenant boundaries.</p>
          </div>
          <div className="tenant-map" role="img" aria-label="Conceptual tenant and matter isolation visualization">
            <div className="tenant-boundary tenant-a"><span>TENANT A</span><div>MATTER 01</div><div>MATTER 02 · WALLED</div></div>
            <div className="tenant-boundary tenant-b"><span>TENANT B</span><div>UNDERTAKING 17</div></div>
            <div className="principal-token"><span>AUTHORIZED PRINCIPAL</span><strong>Human + delegated agent</strong><i>scope · purpose · expiry</i></div>
          </div>
        </div>
      </section>

      <section className="enterprise-deployment section-pad">
        <div className="shell">
          <SectionHeading eyebrow="DEPLOYMENT WITHOUT SEMANTIC DRIFT" title={<>One professional model. Multiple operating topologies.</>} />
          <MetricStrip items={[
            { value: "01", label: "Community self-hosted direction" },
            { value: "02", label: "Enterprise private deployment" },
            { value: "03", label: "Air-gapped and controlled environments" },
            { value: "04", label: "Managed cloud direction" },
          ]} />
          <p className="availability-note">Deployment expressions are design direction for this prototype. Availability, certification, and committed roadmap dates require current product evidence.</p>
        </div>
      </section>

      <CTASection title="Discuss the trust boundary your work requires." body="Schedule an architecture demonstration focused on authority, isolation, assurance, and deployment control." />
    </SiteShell>
  );
}
