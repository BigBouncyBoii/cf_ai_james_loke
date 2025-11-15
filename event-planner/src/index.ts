/**
 * Event Planner Assistant with Slack Integration
 *
 * An AI-powered event planning application using Cloudflare Workers AI
 * with Slack integration for sharing approved event plans.
 *
 * 
 */
import { Env } from './types';
import { router } from './router';

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		return router(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
