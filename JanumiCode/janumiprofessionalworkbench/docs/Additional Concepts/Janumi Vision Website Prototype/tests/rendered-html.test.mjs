import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Janumi vision homepage with production metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Infrastructure for humanity/);
  assert.match(html, /Janumi Professional Workbench/);
  assert.match(html, /Reasoning Review/);
  assert.match(html, /Future expression · not currently available/i);
  assert.match(html, /data-explorer="historical-capability"/i);
  assert.match(html, /TIME BEFORE PRESENT · LOGARITHMIC/i);
  assert.match(html, /Auto-cycling from system view to reality/i);
  assert.match(html, /data-playback="playing"/i);
  assert.match(html, /Pause timeline/i);
  assert.match(html, /role="tablist"[^>]*aria-label="Professional capability across history"/i);
  assert.match(html, /aria-label="Reveal photographic reality"/i);
  assert.match(html, /Great Pyramid of Giza/i);
  assert.match(html, /Roman Colosseum/i);
  assert.match(html, /Cologne Cathedral/i);
  assert.match(html, /Boeing 747/i);
  assert.match(html, /Large Hadron Collider/i);
  assert.match(html, /ASML EUV Lithography/i);
  assert.match(html, /SpaceX Starship/i);
  assert.match(html, /Teleoperated Humanoid Surgery/i);
  assert.match(html, /teleoperated—not autonomous—and preclinical/i);
  assert.match(html, /The artifact is visible/i);
  assert.match(html, /data-explorer="artifact-outcome"/i);
  assert.match(html, /aria-controls="manifestation-detail"/i);
  assert.match(html, /property="og:image" content="https:\/\/janumi\.example\/og\.png"/i);
  assert.match(html, /href="\/connect#waitlist"/i);
  assert.match(html, /href="#professional-workbench"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("server-renders keyboard and touch accessible conceptual explorers", async () => {
  const response = await render("/vision");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /data-explorer="regenerative-cycle"/i);
  assert.match(html, /Interactive regenerative professional capability cycle/i);
  assert.match(html, /aria-controls="cycle-detail"/i);
  assert.match(html, /Receives[\s\S]*Transforms[\s\S]*Passes forward/i);
  assert.match(html, /Shape Engineering/i);
  assert.match(html, /Candidate concepts guide the vision but do not alter current product contracts/i);
  assert.match(html, /data-explorer="capability-hierarchy"/i);
});

test("server-renders every public route", async () => {
  const routes = [
    "/vision",
    "/platform",
    "/janumicode",
    "/assurance",
    "/enterprise",
    "/open-source",
    "/research",
    "/company",
    "/connect",
  ];

  for (const route of routes) {
    const response = await render(route);
    assert.equal(response.status, 200, `${route} should render`);
    const html = await response.text();
    assert.match(html, /<main id="main-content">/i, `${route} should contain the main landmark`);
    assert.match(html, /aria-label="Primary navigation"/i, `${route} should contain the primary navigation`);
  }
});

test("preserves canonical work and assurance boundaries in the rendered experience", async () => {
  const [platformResponse, assuranceResponse] = await Promise.all([
    render("/platform"),
    render("/assurance"),
  ]);
  const [platform, assurance] = await Promise.all([
    platformResponse.text(),
    assuranceResponse.text(),
  ]);

  assert.match(platform, /REUSABLE DEFINITION LANE/);
  assert.match(platform, /PWA version[\s\S]*owns[\s\S]*PWU Types/);
  assert.match(platform, /An Undertaking binds one PWA\/profile\/version/);
  assert.match(platform, /Undertaking[\s\S]*owns[\s\S]*PWU Instances/);
  assert.match(platform, /each instantiates a PWU Type/);

  assert.match(assurance, /Reasoning Review/);
  assert.match(assurance, /Validator[\s\S]*Assurance Service[\s\S]*Governance/);
  assert.match(assurance, /Evaluation is not authority/);
  assert.match(assurance, /protected downstream transition/);
  assert.doesNotMatch(assurance, /Assurance Service[\s\S]{0,120}authorizes baseline promotion/i);

  const interactions = await readFile(new URL("../app/interactions.tsx", import.meta.url), "utf8");
  assert.match(interactions, /Assurance Services invoke required validators/);
  assert.match(interactions, /governance makes reserved decisions such as waiver, risk acceptance, and promotion/i);
  assert.doesNotMatch(interactions, /governance authorizes protected transitions/i);
});

test("packages the historical imagery locally with inspectable provenance", async () => {
  const assets = [
    "giza.webp",
    "colosseum.webp",
    "cologne-cathedral.webp",
    "boeing-747.webp",
    "lhc.webp",
    "asml-euv.webp",
    "starship.webp",
    "humanoid-surgery-hero.webp",
  ];

  await Promise.all(
    assets.map((asset) =>
      access(new URL(`../public/images/capability-timeline/${asset}`, import.meta.url)),
    ),
  );

  const provenance = await readFile(
    new URL("../public/images/capability-timeline/ATTRIBUTION.md", import.meta.url),
    "utf8",
  );
  assert.match(provenance, /Unsplash License[^\n]*not a public-domain dedication/i);
  assert.match(provenance, /ASML[^]*local, non-published prototype/i);
  assert.match(provenance, /CC BY 4\.0/i);
  assert.match(provenance, /teleoperated, not autonomous/i);
});

test("uses locally packaged professional photographs in the enterprise problem explorer", async () => {
  const assets = ["software.webp", "law.webp", "healthcare.webp", "construction.webp"];
  const [interactions, styles, provenance] = await Promise.all([
    readFile(new URL("../app/interactions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(
      new URL("../public/images/professional-manifestations/ATTRIBUTION.md", import.meta.url),
      "utf8",
    ),
    ...assets.map((asset) =>
      access(new URL(`../public/images/professional-manifestations/${asset}`, import.meta.url)),
    ),
  ]);

  for (const asset of assets) {
    assert.ok(interactions.includes(`professional-manifestations/${asset}`));
  }
  assert.match(interactions, /manifestation-photo-credit/);
  assert.match(styles, /\.manifestation-material img[^]*object-fit:\s*cover/);
  assert.match(styles, /\.manifestation-card:hover \.manifestation-material img/);
  assert.match(provenance, /Unsplash License[^\n]*not a public-domain dedication/i);
  assert.match(provenance, /DVIDS[^]*public domain/i);
});

test("continuously cycles milestones while automatically revealing reality", async () => {
  const [hero, styles] = await Promise.all([
    readFile(new URL("../app/hero-timeline.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(hero, /const SYSTEM_VIEW_HOLD = \d+;/);
  assert.match(hero, /const REVEAL_DURATION = \d+;/);
  assert.match(hero, /const MILESTONE_DURATION = \d+;/);
  assert.match(hero, /setActiveIndex\(\(index\) => \(index \+ 1\) % milestones\.length\)/);
  assert.match(hero, /milestones\[\(activeIndex \+ 1\) % milestones\.length\]/);
  assert.match(hero, /requestAnimationFrame\(animateReveal\)/);
  assert.match(hero, /setReveal\(eased \* 100\)/);
  assert.match(hero, /useState<"playing" \| "paused">\("playing"\)/);
  assert.match(hero, /data-playback=\{playback\}/);
  assert.match(hero, /document\.hidden/);
  assert.match(hero, /Pause timeline/);
  assert.match(hero, /aria-pressed=\{playback !== "playing"\}/);
  assert.match(hero, /prefers-reduced-motion: reduce/);
  assert.match(hero, /className="history-media-slot"/);
  assert.match(hero, /activeIndex % 2 === 0/);
  assert.doesNotMatch(hero, /<div key=\{active\.id\} className=\{`history-media/);
  assert.doesNotMatch(hero, /IntersectionObserver|canAutoplay|isInView/);
  assert.doesNotMatch(hero, /setPlayback\("complete"\)/);
  assert.match(styles, /\.history-media-slot\s*\{[^]*aspect-ratio:\s*16\s*\/\s*9[^]*overflow:\s*hidden/);
  assert.match(styles, /\.history-media\s*\{[^]*position:\s*absolute[^]*inset:\s*0/);
  assert.match(styles, /data-playback="playing"[^]*history-reality-sweep 5\.5s/);
  assert.match(styles, /history-reality-sweep-alt/);
  assert.match(styles, /history-divider-sweep-alt/);
  assert.match(styles, /@keyframes history-reality-sweep[^]*clip-path: inset\(0 100% 0 0\)[^]*clip-path: inset\(0 0 0 0\)/);
  assert.match(styles, /@keyframes history-divider-sweep[^]*left: 0%[^]*left: 100%/);
});

test("removes all disposable starter-preview dependencies", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|site-creator-vinext-starter/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
