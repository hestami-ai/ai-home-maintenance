// The PWU Type authoring help + copy-on-use catalog now live in the shared @janumipwb/rph-authoring package (the
// LLM-agnostic capability layer), so the SAME source backs the node-graph inspector form, the server actions, and
// the Pi agent's tool schemas. Imported from the browser-safe "/catalog" subpath (pure data — no engine). This
// thin re-export keeps the existing form/spec imports (`$lib/authoring/pwuType`) stable.
export {
	PWU_TYPE_HELP,
	PWU_TYPE_CATALOG,
	catalogTemplate,
	type PwuTypeTemplate
} from '@janumipwb/rph-authoring/catalog';
