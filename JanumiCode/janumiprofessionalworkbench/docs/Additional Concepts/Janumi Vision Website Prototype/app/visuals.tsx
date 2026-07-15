export function HeroCapabilityField() {
  return (
    <div className="hero-field" role="img" aria-label="Conceptual visualization of professional capability evolving across people, systems, and time">
      <div className="field-orbit orbit-one" />
      <div className="field-orbit orbit-two" />
      <div className="field-orbit orbit-three" />
      <div className="field-axis field-axis-x" />
      <div className="field-axis field-axis-y" />
      <div className="field-node node-one"><span>Intent</span></div>
      <div className="field-node node-two"><span>Evidence</span></div>
      <div className="field-node node-three"><span>Judgment</span></div>
      <div className="field-node node-four"><span>Assurance</span></div>
      <div className="field-core">
        <span className="core-kicker">CAPABILITY</span>
        <strong>Preserved.<br />Evolved.<br />Executed.</strong>
      </div>
      <div className="field-time">
        <span>Now</span>
        <i />
        <span>Across generations</span>
      </div>
    </div>
  );
}

export function CapabilityStack() {
  const layers = [
    ["01", "Civilizational knowledge"],
    ["02", "Professional capability"],
    ["03", "Professional systems"],
    ["04", "Professional scenarios"],
    ["05", "Shape Engineering"],
    ["06", "Work architectures"],
    ["07", "Work units"],
    ["08", "Human + agent execution"],
    ["09", "Evidence-bearing artifacts"],
  ];
  return (
    <div className="capability-stack" role="list" aria-label="Janumi professional capability hierarchy">
      {layers.map(([number, label]) => (
        <div key={number} className="stack-layer" role="listitem">
          <span>{number}</span>
          <strong>{label}</strong>
        </div>
      ))}
    </div>
  );
}

export function ScenarioCapabilityVisual() {
  return (
    <figure className="scenario-visual">
      <figcaption>Candidate strategic model · conceptual visualization</figcaption>
      <div className="scenario-card">
        <span className="visual-label">PROFESSIONAL SCENARIO</span>
        <strong>Cross-border merger under regulatory challenge</strong>
        <p>Live facts · jurisdictions · parties · constraints · uncertainty · stakes</p>
      </div>
      <div className="scenario-bridge">
        <span>shapes</span>
        <i />
        <span>mobilizes</span>
      </div>
      <div className="capability-cluster">
        <span className="visual-label">PROFESSIONAL CAPABILITY</span>
        <div className="capability-pills">
          <span>Antitrust</span>
          <span>Transaction</span>
          <span>Data sovereignty</span>
          <span>Evidence synthesis</span>
          <span>Negotiation</span>
          <span>Governance</span>
        </div>
        <p>Qualified, situated ability to produce trusted outcomes under real conditions.</p>
      </div>
    </figure>
  );
}

export function PwaDesignerVisual({ compact = false }: { compact?: boolean }) {
  return (
    <figure className={`product-visual pwa-visual${compact ? " product-visual-compact" : ""}`}>
      <figcaption><span>Conceptual product visualization</span><strong>PWA Designer</strong></figcaption>
      <div className="pv-toolbar">
        <div><i className="status-dot" /> ProdReal 1.0 <span className="pv-badge">DRAFT</span></div>
        <span>Professional Work Architecture</span>
      </div>
      <div className="pwa-layout">
        <div className="agent-panel">
          <span className="panel-title">AI ARCHITECT</span>
          <p>Draft an SDLC PWA using V-model systems engineering, UCD, and JTBD.</p>
          <div className="agent-response"><i />Interpreting professional intent</div>
          <div className="agent-response"><i />Resolving canonical PWU Types</div>
          <div className="agent-response"><i />Binding assurance coverage</div>
          <div className="agent-cursor">_</div>
        </div>
        <div className="graph-panel">
          <div className="graph-node graph-root"><small>ROOT PWU TYPE</small><strong>Product Realization</strong><span className="validator-pin">RR · required</span></div>
          <div className="graph-peers" aria-label="Peer child PWU Types beneath the root">
            <div className="graph-branch">
              <div className="graph-node graph-parent"><small>PEER CHILD PWU TYPE · 01</small><strong>Intent Definition</strong><span className="validator-pin">RR · required</span></div>
              <div className="graph-children">
                <div className="graph-node graph-child"><small>NESTED CHILD TYPE</small><strong>JTBD inquiry</strong><span className="validator-pin validator-pin-child">RR · required</span></div>
                <div className="graph-node graph-child"><small>NESTED CHILD TYPE</small><strong>Intent synthesis</strong><span className="validator-pin validator-pin-child">RR · required</span></div>
                <div className="graph-node graph-child"><small>NESTED CHILD TYPE</small><strong>Acceptance framing</strong><span className="validator-pin validator-pin-child">RR · required</span></div>
              </div>
            </div>
            <div className="graph-branch">
              <div className="graph-node graph-parent graph-parent-blue"><small>PEER CHILD PWU TYPE · 02</small><strong>Behavior Definition</strong><span className="validator-pin">RR · required</span></div>
              <div className="graph-children">
                <div className="graph-node graph-child"><small>NESTED CHILD TYPE</small><strong>Persona & journey</strong><span className="validator-pin validator-pin-child">RR · required</span></div>
                <div className="graph-node graph-child"><small>NESTED CHILD TYPE</small><strong>Scenario modeling</strong><span className="validator-pin validator-pin-child">RR · required</span></div>
                <div className="graph-node graph-child"><small>NESTED CHILD TYPE</small><strong>Acceptance model</strong><span className="validator-pin validator-pin-child">RR · required</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="inspector-panel">
          <span className="panel-title">PWU TYPE</span>
          <h4>Intent Synthesis</h4>
          <dl>
            <div><dt>Kind</dt><dd>INTENT_DEFINITION</dd></div>
            <div><dt>Cardinality</dt><dd>1..n</dd></div>
            <div><dt>Applicability</dt><dd>Context resolved</dd></div>
            <div><dt>Required output</dt><dd>intent-baseline</dd></div>
            <div><dt>Completion</dt><dd>Assurance satisfied</dd></div>
          </dl>
          <div className="inspector-assurance"><i />Reasoning Review <b>LOCKED</b></div>
        </div>
      </div>
    </figure>
  );
}

export function AssuranceVisual({ compact = false }: { compact?: boolean }) {
  return (
    <figure className={`product-visual assurance-visual${compact ? " product-visual-compact" : ""}`}>
      <figcaption><span>Conceptual product visualization</span><strong>Assurance Engineering</strong></figcaption>
      <div className="assurance-canvas">
        <div className="assurance-left">
          <span className="visual-label">MICRO ASSURANCE · EVERY MATERIAL AI TRANSFORMATION</span>
          <div className="transformation-flow">
            <div className="flow-box"><small>INPUT</small><strong>Professional intent</strong></div>
            <div className="flow-arrow">→</div>
            <div className="flow-box flow-ai"><small>AGENT</small><strong>Reason + transform</strong></div>
            <div className="flow-arrow protected">→<span>PROTECTED</span></div>
            <div className="flow-box"><small>OUTPUT</small><strong>Candidate artifact</strong></div>
          </div>
          <div className="validator-row">
            <div className="validator-card required"><span>01</span><strong>Reasoning Review</strong><b>REQUIRED · LOCKED</b></div>
            <div className="validator-card"><span>02</span><strong>Evidence Grounding</strong><b>POLICY RESOLVED</b></div>
            <div className="validator-card"><span>03</span><strong>Domain Constraint</strong><b>CONTEXTUAL</b></div>
          </div>
          <div className="evidence-ledger"><span>Evidence record</span><code>assurance.run/7F31 · PASS · signed</code></div>
        </div>
        <div className="assurance-right">
          <span className="visual-label">MACRO ASSURANCE · UNDERTAKING OUTCOME</span>
          <div className="macro-ring">
            <div className="macro-core"><small>DECISION</small><strong>Release baseline?</strong></div>
            <span className="ring-item item-one">Architecture</span>
            <span className="ring-item item-two">Verification</span>
            <span className="ring-item item-three">Human authority</span>
            <span className="ring-item item-four">Evidence set</span>
          </div>
          <div className="role-separation">
            <span><b>Validator</b> assesses</span>
            <span><b>Assurance Service</b> applies</span>
            <span><b>Governance</b> decides</span>
          </div>
        </div>
      </div>
    </figure>
  );
}

export function UndertakingVisual() {
  return (
    <figure className="product-visual undertaking-visual">
      <figcaption><span>Conceptual product visualization</span><strong>Undertaking Workbench</strong></figcaption>
      <div className="undertaking-toolbar">
        <div><span className="pv-badge badge-live">ACTIVE</span> Harbor Release · Undertaking #1042</div>
        <div className="toolbar-stats"><span>14 PWU Instances</span><span>37 evidence records</span><span>2 decisions pending</span></div>
      </div>
      <div className="undertaking-grid">
        <div className="undertaking-map">
          <span className="visual-label">CONCRETE PROFESSIONAL WORK GRAPH</span>
          <div className="work-lane lane-complete"><span>01</span><strong>Intent baseline</strong><b>COMPLETE</b><i /></div>
          <div className="work-lane lane-active"><span>02</span><strong>Behavior specification</strong><b>IN EXECUTION</b><i /></div>
          <div className="work-branch">
            <div className="work-lane lane-review"><span>02.1</span><strong>Journey evidence</strong><b>ASSURANCE</b></div>
            <div className="work-lane"><span>02.2</span><strong>Acceptance model</strong><b>READY</b></div>
          </div>
          <div className="work-lane lane-locked"><span>03</span><strong>Architecture baseline</strong><b>PROTECTED</b><i /></div>
        </div>
        <div className="undertaking-inspector">
          <span className="panel-title">PWU INSTANCE · 02.1</span>
          <h4>Journey evidence</h4>
          <div className="instance-status"><i />Assurance in progress</div>
          <div className="evidence-list">
            <span><i>✓</i> Interview synthesis <b>BOUND</b></span>
            <span><i>✓</i> Reasoning review <b>PASS</b></span>
            <span><i>↻</i> Contradiction scan <b>RUNNING</b></span>
          </div>
          <div className="decision-card"><small>DOWNSTREAM DECISION</small><strong>Promote behavior baseline</strong><span>Awaiting required evidence</span></div>
        </div>
      </div>
    </figure>
  );
}

export function CapabilityTimelineVisual() {
  const moments = [
    ["T₀", "Captured", "Tacit expertise becomes inspectable structure."],
    ["T₁", "Situated", "Capability is qualified for scenario and context."],
    ["T₂", "Executed", "Humans and agents produce evidence-bearing work."],
    ["T₃", "Reconciled", "New evidence reopens assumptions and decisions."],
    ["Tₙ", "Inherited", "Capability persists beyond a tool, team, or generation."],
  ];
  return (
    <figure className="timeline-visual">
      <figcaption>Capability is temporal—not a static library.</figcaption>
      <div className="timeline-line" />
      {moments.map(([time, title, body], index) => (
        <div className="timeline-moment" key={time} style={{ "--moment": index } as React.CSSProperties}>
          <span>{time}</span>
          <i />
          <strong>{title}</strong>
          <p>{body}</p>
        </div>
      ))}
    </figure>
  );
}

export function ScenarioReconciliationVisual() {
  return (
    <figure className="reconciliation-visual">
      <figcaption>Scenario reconciliation · conceptual strategic model</figcaption>
      <div className="recon-column">
        <span className="visual-label">ESTABLISHED BASELINE</span>
        <div className="recon-card"><i className="ok" />Assumption A <b>SUPPORTED</b></div>
        <div className="recon-card"><i className="ok" />Decision B <b>ACTIVE</b></div>
        <div className="recon-card"><i className="ok" />Work C <b>COMPLETE</b></div>
      </div>
      <div className="recon-event">
        <span>NEW EVIDENCE</span>
        <strong>Regulatory position changed</strong>
        <i />
      </div>
      <div className="recon-column recon-result">
        <span className="visual-label">GOVERNED RESPONSE</span>
        <div className="recon-card changed"><i />Assumption A <b>INVALIDATED</b></div>
        <div className="recon-card reopened"><i />Decision B <b>REOPENED</b></div>
        <div className="recon-card queued"><i />Work C <b>RECOMPOSED</b></div>
      </div>
    </figure>
  );
}

export function JanumiCodeVisual() {
  return (
    <figure className="code-visual">
      <figcaption><span>First domain realization</span><strong>JanumiCode</strong></figcaption>
      <div className="code-window">
        <div className="code-sidebar">
          <span>UNDERTAKING</span>
          <strong>Identity Service</strong>
          <div className="code-tree active">01 · Intent</div>
          <div className="code-tree">02 · Behavior</div>
          <div className="code-tree">03 · Architecture</div>
          <div className="code-tree">04 · Implementation</div>
        </div>
        <div className="code-editor">
          <div className="editor-tabs"><span className="active">acceptance-criteria.md</span><span>evidence.json</span></div>
          <pre><code><span className="code-comment"># Governed acceptance contract</span>{"\n"}<span className="code-key">scenario</span>: account recovery under elevated risk{"\n"}<span className="code-key">authority</span>: security-owner{"\n"}<span className="code-key">evidence</span>:{"\n"}  - threat-model: <span className="code-pass">verified</span>{"\n"}  - reasoning-review: <span className="code-pass">pass</span>{"\n"}<span className="code-key">transition</span>: protected</code></pre>
        </div>
        <div className="code-assurance">
          <span>ASSURANCE</span>
          <div className="assurance-score"><strong>3/3</strong><small>required controls</small></div>
          <div className="code-check"><i />Reasoning review</div>
          <div className="code-check"><i />Evidence grounding</div>
          <div className="code-check"><i />Security policy</div>
          <div className="governance-handoff"><small>GOVERNANCE HANDOFF</small><strong>Promotion requires an authorized Decision.</strong></div>
        </div>
      </div>
    </figure>
  );
}

export function CapabilityPortfolioVisual() {
  return (
    <figure className="portfolio-visual">
      <figcaption><span>Candidate strategic model · conceptual visualization</span><strong>Capability Portfolio</strong></figcaption>
      <div className="portfolio-toolbar">
        <span>ORGANIZATIONAL CAPABILITY POSTURE</span>
        <div><i className="portfolio-legend ready" />Qualified <i className="portfolio-legend watch" />Watch <i className="portfolio-legend risk" />At risk</div>
      </div>
      <div className="portfolio-layout">
        <div className="portfolio-list">
          <span className="visual-label">CAPABILITY INVENTORY</span>
          <div className="portfolio-item selected"><strong>Complex product realization</strong><span><i style={{ width: "88%" }} />88</span></div>
          <div className="portfolio-item"><strong>Secure platform operation</strong><span><i style={{ width: "72%" }} />72</span></div>
          <div className="portfolio-item watch-item"><strong>Brownfield modernization</strong><span><i style={{ width: "54%" }} />54</span></div>
          <div className="portfolio-item risk-item"><strong>Legacy controls recovery</strong><span><i style={{ width: "31%" }} />31</span></div>
        </div>
        <div className="portfolio-detail">
          <div className="portfolio-title"><span className="visual-label">SELECTED CAPABILITY · VERSION 4.2</span><h4>Complex product realization</h4><b>QUALIFIED · CURRENT</b></div>
          <div className="portfolio-facts">
            <div><small>QUALIFIED SCOPE</small><strong>Regulated, multi-team software products</strong></div>
            <div><small>AUTHORITY</small><strong>Engineering + product governance</strong></div>
            <div><small>CURRENT EVIDENCE</small><strong>12 reference Undertakings · 3 outcome cycles</strong></div>
            <div><small>CAPACITY</small><strong>2 concurrent Undertakings</strong></div>
          </div>
          <div className="portfolio-dependencies"><span className="visual-label">CRITICAL DEPENDENCIES</span><div><span>Architecture leadership</span><span>Assurance topology</span><span>Operational evidence</span><span>Model capability</span></div></div>
          <div className="portfolio-trajectory">
            <span className="visual-label">TEMPORAL POSTURE</span>
            <div className="trajectory-axis"><i className="point-past" /><i className="point-now" /><i className="point-future" /></div>
            <div className="trajectory-labels"><span>Qualified<br /><small>2025 Q4</small></span><span>Current posture<br /><small>2026 Q3</small></span><span>Renewal due<br /><small>2027 Q1</small></span></div>
            <p><b>WATCH:</b> key-person dependency increases without planned knowledge transfer.</p>
          </div>
        </div>
      </div>
    </figure>
  );
}

export function ShapeEngineeringVisual() {
  return (
    <div className="shape-visual" role="img" aria-label="Shape Engineering translation from ambiguous scenario to governed work architecture">
      <div className="shape-source">
        <span>AMBIGUOUS REALITY</span>
        <i className="shape-blob blob-one" />
        <i className="shape-blob blob-two" />
        <i className="shape-blob blob-three" />
        <strong>Intent · stakes · constraints · uncertainty</strong>
      </div>
      <div className="shape-process">
        <span>SHAPE ENGINEERING</span>
        <i />
        <i />
        <i />
      </div>
      <div className="shape-result">
        <span>GOVERNED SHAPE</span>
        <div className="shape-grid">
          <i /><i /><i /><i /><i /><i /><i /><i /><i />
        </div>
        <strong>Work · assurance · authority · evidence</strong>
      </div>
    </div>
  );
}
