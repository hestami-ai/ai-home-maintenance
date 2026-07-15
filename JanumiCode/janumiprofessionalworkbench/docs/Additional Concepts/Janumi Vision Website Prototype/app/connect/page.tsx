import type { Metadata } from "next";
import { Eyebrow, InteriorHero, SiteShell } from "../components";
import { ConnectForms } from "./ConnectForms";

export const metadata: Metadata = {
  title: "Connect",
  description: "Join the Janumi waitlist or request a demonstration of governed professional work.",
};

export default function ConnectPage() {
  return (
    <SiteShell>
      <InteriorHero
        eyebrow="CONNECT WITH JANUMI"
        index="08"
        tone="forest"
        title={<>Help shape the future of <em>professional work.</em></>}
        body={<>We are beginning with enterprise design partners, developers, investors, researchers, and professional-domain collaborators who believe generation alone is not enough.</>}
      >
        <div className="connect-hero-art" aria-hidden="true"><i /><span>BUILD</span><i /><span>CHALLENGE</span><i /><span>PROVE</span></div>
      </InteriorHero>
      <section className="connect-intro">
        <div className="shell"><Eyebrow>PROTOTYPE FORMS</Eyebrow><p>These forms demonstrate the intended experience. They intentionally transmit and store no information until official Janumi destinations are available.</p></div>
      </section>
      <div className="shell"><ConnectForms /></div>
    </SiteShell>
  );
}
