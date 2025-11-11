/**
 * Service for advanced provider search using PostGIS and pgvector
 */

export interface SearchFilters {
	// Geospatial
	latitude?: number;
	longitude?: number;
	radius_miles?: number;

	// Rating
	min_rating?: number;
	min_reviews?: number;

	// Service area
	county?: string;
	state?: string;

	// License
	has_license?: boolean;

	// Availability
	available_only?: boolean;

	// Semantic search
	semantic_query?: string;
	limit?: number;
}

export interface Provider {
	id: string;
	business_name: string;
	description: string;
	phone?: string;
	website?: string;
	business_license?: string;
	service_area?: any;
	is_available: boolean;
	rating: number;
	total_reviews: number;
	address?: string;
	plus_code?: string;
	business_location?: {
		type: string;
		coordinates: [number, number]; // [longitude, latitude]
	};
	merged_data?: any;
	created_at: string;
	updated_at: string;
	// Computed fields from search
	distance?: number;
	similarity?: number;
}

export interface SearchResponse {
	count: number;
	results: Provider[];
}

/**
 * Advanced provider search with flexible filters
 */
export async function searchProviders(filters: SearchFilters): Promise<SearchResponse> {
	const response = await fetch('/api/providers/search', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(filters)
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Search failed' }));
		throw new Error(error.error || error.message || 'Search failed');
	}

	return response.json();
}

/**
 * Find nearby providers (preset)
 */
export async function findNearbyProviders(
	latitude: number,
	longitude: number,
	options: {
		radius_miles?: number;
		min_rating?: number;
		min_reviews?: number;
	}
): Promise<SearchResponse> {
	const params = new URLSearchParams({
		latitude: latitude.toString(),
		longitude: longitude.toString(),
		radius_miles: (options.radius_miles || 25).toString(),
		min_rating: (options.min_rating || 4.0).toString(),
		min_reviews: (options.min_reviews || 5).toString()
	});

	const response = await fetch(`/api/providers/nearby?${params}`);

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Search failed' }));
		throw new Error(error.error || error.message || 'Search failed');
	}

	return response.json();
}

/**
 * Semantic search
 */
export async function semanticSearch(
	query: string,
	options: {
		latitude?: number;
		longitude?: number;
		radius_miles?: number;
		limit?: number;
	}
): Promise<SearchResponse> {
	const body: any = { query, limit: options.limit || 10 };

	if (options.latitude && options.longitude) {
		body.latitude = options.latitude;
		body.longitude = options.longitude;
		body.radius_miles = options.radius_miles || 50;
	}

	const response = await fetch('/api/providers/semantic', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Search failed' }));
		throw new Error(error.error || error.message || 'Search failed');
	}

	return response.json();
}

/**
 * Find experienced providers
 */
export async function findExperiencedProviders(options: {
	min_years?: number;
	min_rating?: number;
	county?: string;
	state?: string;
}): Promise<SearchResponse> {
	const params = new URLSearchParams({
		min_years: (options.min_years || 10).toString(),
		min_rating: (options.min_rating || 4.0).toString()
	});

	if (options.county) params.append('county', options.county);
	if (options.state) params.append('state', options.state);

	const response = await fetch(`/api/providers/experienced?${params}`);

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Search failed' }));
		throw new Error(error.error || error.message || 'Search failed');
	}

	return response.json();
}
