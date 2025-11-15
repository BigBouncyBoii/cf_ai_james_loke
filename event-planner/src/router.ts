/**
 * Router Module
 * 
 * Handles URL routing and request delegation
 */
import { Env } from './types';
import { handleChatRequest } from './handlers/chat';
import { handleEventApproval } from './handlers/events';
import { handleSlackWebhook } from './handlers/slack';
import { handleBrowserSearch } from './handlers/browser';
import { handleSearchQueryGeneration } from './handlers/search-query';

/**
 * Main router function that delegates requests to appropriate handlers
 */
export async function router(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;

	// Handle static assets (frontend)
	if (path === '/' || (!path.startsWith('/api/') && !path.startsWith('/slack/'))) {
		return env.ASSETS.fetch(request);
	}

	// API Routes
	if (path === '/api/chat' && method === 'POST') {
		return handleChatRequest(request, env);
	}

	// Event approval and Slack integration
	if (path === '/api/approve-event' && method === 'POST') {
		return handleEventApproval(request, env);
	}

	// Browser search endpoint
	if (path === '/api/browser-search' && method === 'POST') {
		return handleBrowserSearch(request, env);
	}

	// Search query generation endpoint
	if (path === '/api/generate-search-query' && method === 'POST') {
		return handleSearchQueryGeneration(request, env);
	}

	// Slack webhook endpoint
	if (path === '/slack/events' && method === 'POST') {
		return handleSlackWebhook(request, env);
	}

	// Handle method not allowed
	if (path.startsWith('/api/') || path.startsWith('/slack/')) {
		return new Response('Method not allowed', { status: 405 });
	}

	// Handle 404 for unmatched routes
	return new Response('Not found', { status: 404 });
}