// Server load — hosts the RPH engine on the SvelteKit NODE server (better-sqlite3 lives here, never the browser).
// It stands up an in-memory engine over the injected Product Realization PWA ontology, DRIVES the Reference
// Undertaking live (real commands → events → state), and hands the resulting Professional Work Graph (a pure,
// serializable DemoGraph) to the page. The browser renders only this read-model; the engine never renders.
import {
	createEngine,
	driveReferenceUndertaking,
	professionalWorkGraph,
	REFERENCE_OPEN_RESIDUALS
} from '@janumipwb/rph-engine';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const engine = createEngine({ ontology });
	try {
		driveReferenceUndertaking(engine);
		const graph = professionalWorkGraph(engine, { openResiduals: REFERENCE_OPEN_RESIDUALS });
		return { graph };
	} finally {
		engine.close();
	}
};
