import { BrowserService } from '../browser';
import { BrowserSearchRequest, Env, SearchResult } from '../types';

export async function handleBrowserSearch(request: Request, env: Env): Promise<Response> {
	try {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const browserService = new BrowserService(env);
		const searchRequest: BrowserSearchRequest = await request.json();

		if (!searchRequest.query) {
			return new Response('Query is required', { status: 400 });
		}

		console.log('Browser search request:', searchRequest);

		let results: SearchResult[];

		if (searchRequest.resourceType && searchRequest.resourceType !== 'general') {
			results = await browserService.searchForEventResources(
				searchRequest.query,
				searchRequest.resourceType
			);
		} else {
			results = await browserService.searchWeb(
				searchRequest.query,
				searchRequest.maxResults || 5
			);
		}

		return new Response(JSON.stringify({ results }), {
			headers: { 'Content-Type': 'application/json' },
		});

	} catch (error) {
		console.error('Browser search error:', error);
		return new Response(
			JSON.stringify({ 
				error: 'Browser search failed', 
				details: error instanceof Error ? error.message : 'Unknown error' 
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}