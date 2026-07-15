import Link from "next/link";
import type { ReactNode } from "react";

const primaryNavigation = [
  { href: "/vision", label: "Vision" },
  { href: "/platform", label: "Workbench" },
  { href: "/janumicode", label: "JanumiCode" },
  { href: "/assurance", label: "Assurance" },
];

const extendedNavigation = [
  { href: "/enterprise", label: "Enterprise" },
  { href: "/open-source", label: "Open source" },
  { href: "/research", label: "Research & ideas" },
  { href: "/company", label: "Company" },
];

export function JanumiMark() {
  return (
    <span className="janumi-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="wordmark" href="/" aria-label="Janumi home">
          <JanumiMark />
          <span className="wordmark-type">JANUMI</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {primaryNavigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link className="text-link header-open" href="/open-source">
            Open source
          </Link>
          <Link className="button button-small button-dark" href="/connect#demo">
            Schedule a demonstration <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Open site navigation">
            <span />
            <span />
          </summary>
          <nav aria-label="Mobile navigation">
            {[...primaryNavigation, ...extendedNavigation].map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className="button button-dark" href="/connect">
              Join the conversation
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-thesis">
          <Link className="wordmark wordmark-light" href="/" aria-label="Janumi home">
            <JanumiMark />
            <span className="wordmark-type">JANUMI</span>
          </Link>
          <p>Infrastructure for humanity&apos;s professional capability.</p>
          <span className="prototype-note">Vision website prototype · July 2026</span>
        </div>
        <div className="footer-column">
          <span className="footer-label">Explore</span>
          {primaryNavigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="footer-column">
          <span className="footer-label">Engage</span>
          {extendedNavigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/connect">Waitlist & demo</Link>
        </div>
        <div className="footer-column footer-aside">
          <span className="footer-label">Current realization</span>
          <p>
            Janumi Professional Workbench is the platform. JanumiCode is its first
            domain realization.
          </p>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 Janumi</span>
        <span>Logo and destination links are prototype placeholders.</span>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <p className={`eyebrow${light ? " eyebrow-light" : ""}`}>{children}</p>;
}

export function ArrowLink({ href, children, light = false }: { href: string; children: ReactNode; light?: boolean }) {
  return (
    <Link className={`arrow-link${light ? " arrow-link-light" : ""}`} href={href}>
      <span>{children}</span>
      <span className="arrow-line" aria-hidden="true" />
      <span aria-hidden="true">↗</span>
    </Link>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  light = false,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  body?: ReactNode;
  light?: boolean;
  align?: "left" | "center";
}) {
  return (
    <div className={`section-heading section-heading-${align}${light ? " section-heading-light" : ""}`}>
      <Eyebrow light={light}>{eyebrow}</Eyebrow>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

export function InteriorHero({
  eyebrow,
  title,
  body,
  index,
  tone = "light",
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  body: ReactNode;
  index: string;
  tone?: "light" | "forest" | "clay";
  children?: ReactNode;
}) {
  return (
    <section className={`interior-hero interior-hero-${tone}`}>
      <div className="shell interior-hero-grid">
        <div className="interior-index" aria-hidden="true">
          {index}
        </div>
        <div className="interior-copy">
          <Eyebrow light={tone !== "light"}>{eyebrow}</Eyebrow>
          <h1>{title}</h1>
          <p>{body}</p>
        </div>
        {children ? <div className="interior-art">{children}</div> : null}
      </div>
    </section>
  );
}

export function MetricStrip({ items }: { items: Array<{ value: string; label: string }> }) {
  return (
    <div className="metric-strip" role="list">
      {items.map((item) => (
        <div key={item.label} className="metric" role="listitem">
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function StatementBand({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className="statement-band">
      <div className="shell statement-grid">
        <Eyebrow light>{label}</Eyebrow>
        <blockquote>{children}</blockquote>
      </div>
    </section>
  );
}

export function CTASection({
  eyebrow = "Begin here",
  title = "Bring governed professional work into focus.",
  body = "Join the waitlist, explore the open-source project, or schedule a working session with Janumi.",
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
}) {
  return (
    <section className="cta-section">
      <div className="shell cta-grid">
        <div>
          <Eyebrow light>{eyebrow}</Eyebrow>
          <h2>{title}</h2>
        </div>
        <div className="cta-action-block">
          <p>{body}</p>
          <div className="button-row">
            <Link className="button button-bone" href="/connect#waitlist">
              Join the waitlist <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-outline-light" href="/open-source">
              Explore open source
            </Link>
            <Link className="button button-outline-light" href="/connect#demo">
              Schedule a demonstration
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DefinitionCard({
  number,
  term,
  children,
  accent = "moss",
}: {
  number: string;
  term: string;
  children: ReactNode;
  accent?: "moss" | "clay" | "ochre" | "blue";
}) {
  return (
    <article className={`definition-card definition-${accent}`}>
      <span className="definition-number">{number}</span>
      <h3>{term}</h3>
      <p>{children}</p>
    </article>
  );
}
