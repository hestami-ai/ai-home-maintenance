# Janumi Vision Website Prototype

An aspirational, multi-page company website prototype for Janumi. It leads with the grand vision, grounds that vision in Janumi Professional Workbench, and presents JanumiCode as the first domain realization.

## Experience map

- `/` — interactive historical capability timeline, company thesis, platform progression, Assurance Engineering, JanumiCode, access tiers, future professions, and time
- `/vision` — non-normative grand vision and candidate strategic concepts
- `/platform` — PWA Designer, Undertaking Workbench, canonical work model, and platform capabilities
- `/assurance` — micro- and macro-level Assurance Engineering, Reasoning Review, and protected transitions
- `/janumicode` — first software-engineering domain realization
- `/enterprise` — trust boundaries, identity, delegated authority, isolation, and deployment direction
- `/open-source` — Community edition and public-repository direction
- `/research` — challengeable hypotheses, candidate concepts, limits, and evidence program
- `/company` — company thesis, principles, and horizon
- `/connect` — non-transmitting waitlist and demonstration form prototypes

## Prototype integrity

- CSS-rendered product interfaces are explicitly labelled as conceptual visualizations.
- Professional Scenario, Professional Capability, Capability Portfolio, Civilizational Capability, and related long-term concepts are labelled candidate or exploratory—not canonical product objects.
- JanumiLegal, JanumiHealth, and JanumiConstruction are labelled future expressions and not currently available.
- The wordmark, official logo, public repository, and production contact destinations remain placeholders pending confirmed assets and links.
- The forms store and transmit no data.
- Historical hero imagery has an inspectable [asset provenance record](public/images/capability-timeline/ATTRIBUTION.md). The official ASML image is restricted to this local prototype and must be licensed or replaced before publication.
- The professional manifestation photographs in “The Real Enterprise Problem” have a separate [Unsplash and public-domain provenance record](public/images/professional-manifestations/ATTRIBUTION.md).

## Local development

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

The default local URL is `http://localhost:3000/`.

After `npm run build`, `npm run preview` provides a lightweight local preview of the built worker when the normal Vinext development process is unavailable.

## Validation

```bash
npm run lint
npm test
```

`npm test` builds the production bundle and verifies server rendering across all public routes.
