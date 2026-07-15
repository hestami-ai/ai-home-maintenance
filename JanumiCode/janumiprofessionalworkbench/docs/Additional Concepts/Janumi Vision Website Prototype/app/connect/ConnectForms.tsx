"use client";

import { FormEvent, useState } from "react";

type FormKind = "waitlist" | "demo";

function PrototypeForm({ kind }: { kind: FormKind }) {
  const [submitted, setSubmitted] = useState(false);
  const isDemo = kind === "demo";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="form-success" role="status">
        <span aria-hidden="true">✓</span>
        <h3>Prototype interaction complete.</h3>
        <p>No information was transmitted or stored. The production form destination will be connected when Janumi&apos;s contact systems are confirmed.</p>
        <button type="button" onClick={() => setSubmitted(false)}>Return to the form</button>
      </div>
    );
  }

  return (
    <form className="connect-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>First name<input name={`${kind}-first-name`} autoComplete="given-name" required /></label>
        <label>Last name<input name={`${kind}-last-name`} autoComplete="family-name" required /></label>
      </div>
      <label>Work email<input type="email" name={`${kind}-email`} autoComplete="email" required /></label>
      <label>Organization<input name={`${kind}-organization`} autoComplete="organization" /></label>
      <label>
        I&apos;m engaging as
        <select name={`${kind}-role`} defaultValue="enterprise">
          <option value="enterprise">Enterprise or professional firm</option>
          <option value="developer">Developer or vibe coder</option>
          <option value="investor">Investor</option>
          <option value="research">Researcher or thought leader</option>
          <option value="other">Other collaborator</option>
        </select>
      </label>
      {isDemo ? <label>What would make a demonstration useful?<textarea name="demo-context" rows={4} placeholder="Professional domain, current challenge, or assurance concern" /></label> : null}
      <button className="button button-dark" type="submit">{isDemo ? "Request a demonstration" : "Join the waitlist"} <span aria-hidden="true">↗</span></button>
      <p className="form-disclaimer">Prototype only: submitting demonstrates the interaction but sends and stores no data.</p>
    </form>
  );
}

export function ConnectForms() {
  return (
    <div className="connect-panels">
      <section id="waitlist" className="connect-panel">
        <div className="connect-panel-copy"><span>01</span><h2>Join the waitlist.</h2><p>Receive future product, early-access, and open-source announcements when the production list becomes available.</p></div>
        <PrototypeForm kind="waitlist" />
      </section>
      <section id="demo" className="connect-panel connect-panel-demo">
        <div className="connect-panel-copy"><span>02</span><h2>Schedule a demonstration.</h2><p>Explore the PWA Designer, Undertaking Workbench, and visible Assurance Engineering through your professional context.</p></div>
        <PrototypeForm kind="demo" />
      </section>
    </div>
  );
}
