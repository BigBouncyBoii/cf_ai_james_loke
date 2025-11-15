import { Env, SearchResult } from './types';

export class BrowserService {
	private env: Env;

	constructor(env: Env) {
		this.env = env;
	}

	async searchWeb(query: string, maxResults: number = 3): Promise<SearchResult[]> {
		try {
			console.log('Starting search for:', query);
			
			// Use DuckDuckGo HTML search for simpler parsing
			const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
			console.log('Search URL:', searchUrl);

			const response = await fetch(searchUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'en-US,en;q=0.5',
				},
			});

			if (!response.ok) {
				console.log('Search request failed:', response.status, response.statusText);
				return [];
			}

			const html = await response.text();
			console.log('HTML response length:', html.length);

			// Parse DuckDuckGo results
			const results = this.parseDuckDuckGoResults(html, maxResults);
			console.log(`Found ${results.length} search results`);
			
			return results;

		} catch (error) {
			console.error('Search error:', error);
			console.error('Error details:', {
				message: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : 'No stack trace'
			});
			return [];
		}
	}

	private parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
		const results: SearchResult[] = [];
		
		try {
			// DuckDuckGo HTML patterns
			const resultPattern = /<div class="result[^"]*">.*?<\/div>/gs;
			const titlePattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/;
			const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/;
			
			const resultMatches = html.match(resultPattern) || [];
			console.log(`Found ${resultMatches.length} result blocks`);
			
			for (let i = 0; i < Math.min(resultMatches.length, maxResults); i++) {
				const resultBlock = resultMatches[i];
				
				const titleMatch = resultBlock.match(titlePattern);
				const snippetMatch = resultBlock.match(snippetPattern);
				
				if (titleMatch && titleMatch[1] && titleMatch[2]) {
					let url = titleMatch[1];
					const title = titleMatch[2].trim();
					const description = snippetMatch ? snippetMatch[1].trim() : 'No description available';
					
					// Clean up URL (DuckDuckGo sometimes has redirect URLs)
					if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
						try {
							const urlParams = new URLSearchParams(url.split('?')[1]);
							url = urlParams.get('uddg') || url;
						} catch (e) {
							// Keep original URL if parsing fails
						}
					}
					
					// Skip invalid URLs
					if (url && !url.includes('duckduckgo.com') && title.length > 0) {
						results.push({
							title: title.slice(0, 100),
							url: url,
							description: description.slice(0, 200),
							source: 'duckduckgo_search'
						});
					}
				}
			}

			return results;

		} catch (error) {
			console.error('Error parsing search results:', error);
			return [];
		}
	}

	async extractPageContent(url: string): Promise<{ title: string; content: string; url: string } | null> {
		try {
			console.log('Extracting content from:', url);
			
			const response = await fetch(url, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				},
			});

			if (!response.ok) {
				console.log('Failed to fetch page:', response.status);
				return null;
			}

			const html = await response.text();
			
			// Simple title extraction
			const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
			const title = titleMatch ? titleMatch[1].trim() : 'No title';

			// Simple content extraction - get text between body tags
			const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/is);
			let content = '';
			
			if (bodyMatch) {
				// Remove HTML tags and clean up
				content = bodyMatch[1]
					.replace(/<script[^>]*>.*?<\/script>/gis, '')
					.replace(/<style[^>]*>.*?<\/style>/gis, '')
					.replace(/<[^>]+>/g, ' ')
					.replace(/\s+/g, ' ')
					.trim()
					.slice(0, 2000);
			}

			console.log('Successfully extracted content from:', url);
			return { title, content, url };

		} catch (error) {
			console.error('Content extraction failed for', url, ':', error);
			return null;
		}
	}

	async searchForEventResources(query: string, resourceType: 'venue' | 'tickets' | 'catering' | 'supplies' | 'general'): Promise<SearchResult[]> {
		// Enhance the search query based on resource type
		let enhancedQuery = query;
		
		switch (resourceType) {
			case 'venue':
				enhancedQuery += ' venue booking location hire';
				break;
			case 'tickets':
				enhancedQuery += ' tickets booking buy purchase';
				break;
			case 'catering':
				enhancedQuery += ' catering food service booking';
				break;
			case 'supplies':
				enhancedQuery += ' rental hire supplies equipment';
				break;
		}
		
		console.log(`Searching for ${resourceType} resources with query:`, enhancedQuery);
		return await this.searchWeb(enhancedQuery, 5);
	}
}