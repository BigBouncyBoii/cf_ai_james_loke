/**
 * Search Query Generation Handler
 * 
 * Uses AI to generate compact search queries from user messages or AI responses
 */
import { Env } from '../types';

const MODEL_ID = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const SEARCH_QUERY_PROMPT = `You are a search query optimization assistant. Your job is to extract the best search terms from user messages.

Given a message, extract 1-3 concise search terms that would be most useful for web search. Focus on:
- Key nouns and topics
- Specific places, attractions, or services
- Remove unnecessary words like "you could search for", "try searching", etc.

Examples:
Input: "reviews about Big Ben! You could search for 'Big Ben reviews'"
Output: Big Ben reviews

Input: "I need to find museum tickets for the Natural History Museum"  
Output: Natural History Museum tickets

Input: "Where can I book a wedding venue in London?"
Output: London wedding venue booking

Input: "How do I find catering services for a corporate event?"
Output: corporate catering services

Respond with ONLY the search query, nothing else. Keep it under 5 words when possible.`;

export async function handleSearchQueryGeneration(request: Request, env: Env): Promise<Response> {
	try {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const { message } = await request.json() as { message: string };

		if (!message) {
			return new Response('Message is required', { status: 400 });
		}

		console.log('Generating search query for:', message);

		const response = await env.AI.run(
			MODEL_ID,
			{
				messages: [
					{ role: 'system', content: SEARCH_QUERY_PROMPT },
					{ role: 'user', content: message }
				],
				max_tokens: 50,
			},
			{ returnRawResponse: false }
		) as { response: string };

		const searchQuery = response.response.trim().replace(/['"]/g, '');

		console.log('Generated search query:', searchQuery);

		return new Response(JSON.stringify({ 
			query: searchQuery,
			original: message 
		}), {
			headers: { 'Content-Type': 'application/json' },
		});

	} catch (error) {
		console.error('Search query generation error:', error);
		return new Response(
			JSON.stringify({ 
				error: 'Failed to generate search query',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}