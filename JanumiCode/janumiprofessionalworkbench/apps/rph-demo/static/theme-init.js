(function initializeJanumiTheme() {
	var theme = 'dark';
	try {
		var saved = globalThis.localStorage.getItem('jpwb-color-theme');
		if (saved === 'light' || saved === 'dark') theme = saved;
	} catch {
		// Storage can be unavailable; dark is the resilient compatibility default.
	}

	var root = globalThis.document.documentElement;
	root.dataset.theme = theme;
	root.style.colorScheme = theme;
	var meta = globalThis.document.querySelector('meta[data-jpwb-theme-color]');
	if (meta) meta.setAttribute('content', theme === 'light' ? '#f0ecdf' : '#131313');
})();
