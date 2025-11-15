/**
 * Event Approval Handler
 * 
 * Handles event approval and Slack integration
 */
import { Env, EventPlan } from '../types';
import { SlackService } from '../slack';

/**
 * Handles event approval and Slack posting
 */
export async function handleEventApproval(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const { eventPlan, slackChannelId, approved } = (await request.json()) as {
			eventPlan: EventPlan;
			slackChannelId?: string;
			approved: boolean;
		};

		if (!approved) {
			return new Response(JSON.stringify({ 
				success: true, 
				message: 'Event plan discarded' 
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Update event status
		eventPlan.status = 'approved';
		eventPlan.updatedAt = new Date().toISOString();
		
		// If Slack channel provided, post to Slack
		if (slackChannelId && env.SLACK_BOT_TOKEN) {
			eventPlan.slackChannelId = slackChannelId;
			
			const slackService = new SlackService(env.SLACK_BOT_TOKEN);
			const result = await slackService.postEventPlan(eventPlan);
			
			if (result.ok) {
				eventPlan.status = 'sent_to_slack';
				eventPlan.updatedAt = new Date().toISOString();
				
				return new Response(JSON.stringify({ 
					success: true, 
					message: 'Event plan approved and sent to Slack!',
					eventPlan: eventPlan
				}), {
					headers: { 'Content-Type': 'application/json' },
				});
			} else {
				return new Response(JSON.stringify({ 
					success: false, 
					error: `Failed to post to Slack: ${result.error}`,
					eventPlan: eventPlan
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		return new Response(JSON.stringify({ 
			success: true, 
			message: 'Event plan approved!',
			eventPlan: eventPlan
		}), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error handling event approval:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to process event approval' }),
			{
				status: 500,
				headers: { 'content-type': 'application/json' },
			},
		);
	}
}