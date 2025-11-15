/**
 * Slack Webhook Handler
 * 
 * Handles incoming Slack webhook events and advanced message processing
 */
import { Env } from '../types';
import { verifySlackSignature, SlackService } from '../slack';

// Re-use the same system prompt as chat handler
const SYSTEM_PROMPT = `You are an expert AI event planning assistant. Your role is to help users plan events by:

1. Extracting key details from user requests (event type, date, guest count, budget, venue preferences)
2. Creating detailed event plans with timelines and suggestions
3. Providing practical advice for event organization
4. When you have enough information to create a comprehensive event plan, respond with a JSON structure

When creating an event plan, respond with this EXACT JSON format:
{
  "action": "create_event",
  "event": {
    "title": "Event Title",
    "date": "YYYY-MM-DD",
    "time": "HH:MM AM/PM (if mentioned)",
    "type": "Event type (birthday, wedding, corporate, etc.)",
    "guests": ["guest1", "guest2"] or [],
    "timeline": ["task 1: description", "task 2: description"],
    "budget": 1000,
    "venue": "Venue suggestion or description",
    "description": "Brief description of the event"
  },
  "response": "Your helpful response explaining the plan to the user"
}

For regular conversation without enough details for a complete plan, respond normally with helpful event planning advice and ask for missing information.

Be friendly, practical, and focus on creating realistic, well-organized event plans.`;

const MODEL_ID = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Handles Slack webhook events
 */
export async function handleSlackWebhook(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body = await request.text();
		console.log('Slack webhook received raw body:', body);

		// Verify Slack signature if signing secret is available
		if (env.SLACK_SIGNING_SECRET) {
			const timestamp = request.headers.get('X-Slack-Request-Timestamp') || '';
			const signature = request.headers.get('X-Slack-Signature') || '';
			
			const isValid = await verifySlackSignature(
				env.SLACK_SIGNING_SECRET,
				timestamp,
				body,
				signature
			);
			
			if (!isValid) {
				return new Response('Invalid signature', { status: 401 });
			}
		}
		
		// URL verification challenge
		try {
			const payload = JSON.parse(body);
			console.log('Parsed Slack payload:', JSON.stringify(payload, null, 2));

			if (payload.type === 'url_verification') {
				console.log('URL verification challenge');
				return new Response(payload.challenge);
			}

			// Handle message events
			if (payload.type === 'event_callback' && payload.event) {
				const event = payload.event;
				console.log('Event received type:', event.type);
				console.log('Full event data:', JSON.stringify(event, null, 2));

				// Log ALL message events (including bot messages)
				if (event.type === 'message') {
					console.log('MESSAGE RECEIVED:');
					console.log('   - Channel:', event.channel);
					console.log('   - User:', event.user);
					console.log('   - Text:', event.text);
					console.log('   - Timestamp:', event.ts);
					console.log('   - Is Bot:', !!event.bot_id);
					console.log('   - Subtype:', event.subtype);
				}

				// Handle user messages (ignore bot's own messages)
				if (event.type === 'message' && !event.bot_id && event.text) {
					console.log('💬 Processing USER message from:', event.user);
					await handleSlackMessage(event, env);
				}

				// Handle app mentions
				if (event.type === 'app_mention' && event.text) {
					console.log('Bot mentioned:', event.text);
					await handleSlackMention(event, env);
				}
			}
			
		} catch (e) {
			console.log('Failed to parse Slack payload:', e);
		}
		
		return new Response('OK');
	} catch (error) {
		console.error('Error handling Slack webhook:', error);
		return new Response('Error', { status: 500 });
	}
}

/**
 * Handle regular messages in channels where bot is present
 */
async function handleSlackMessage(event: any, env: Env) {
	const { text, channel, user } = event;

	// Simple keyword detection for event planning
	const eventKeywords = ['plan', 'event', 'party', 'meeting', 'celebration'];
	const hasEventKeyword = eventKeywords.some((keyword) =>
		text.toLowerCase().includes(keyword)
	);

	if (hasEventKeyword) {
		console.log('Event planning keywords detected');

		// Process with AI
		const messages = [
			{ role: 'system', content: SYSTEM_PROMPT },
			{ role: 'user', content: text },
		];

		try {
			const response = await env.AI.run(MODEL_ID, {
				messages,
				max_tokens: 512,
			});
			const aiResponse = (response as { response: string }).response;

			// Send AI response back to Slack
			const slackService = new SlackService(env.SLACK_BOT_TOKEN!);
			await slackService.postMessage({
				channel: channel,
				text: aiResponse,
			});

			console.log('AI response sent to Slack');
		} catch (error) {
			console.error('Error processing message:', error);
		}
	}
}

/**
 * Handle direct mentions of the bot (@botname)
 */
async function handleSlackMention(event: any, env: Env) {
	const { text, channel, user, ts } = event;

	// Remove the bot mention from the text
	const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();

	console.log('Processing mention:', cleanText);

	// Check if this is a request to modify a recent event plan
	const isEventModification =
		cleanText.toLowerCase().includes('swap') ||
		cleanText.toLowerCase().includes('change') ||
		cleanText.toLowerCase().includes('modify') ||
		cleanText.toLowerCase().includes('update') ||
		cleanText.toLowerCase().includes('move') ||
		cleanText.toLowerCase().includes('history');

	let messages: any[] = [];

	if (isEventModification && env.SLACK_BOT_TOKEN) {
		// Try to get recent channel context to understand what event they're referring to
		console.log('Attempting to get channel context for modification request');
		try {
			const channelHistory = await getRecentChannelMessages(
				channel,
				env.SLACK_BOT_TOKEN
			);
			console.log('Channel history retrieved:', channelHistory.length, 'messages');

			const recentEventPlan = findRecentEventPlan(channelHistory);
			console.log('Recent event plan found:', recentEventPlan ? 'YES' : 'NO');

			if (recentEventPlan) {
				// Create a focused context for modification
				const timelineText =
					recentEventPlan.timeline
						?.slice(0, 7)
						.map((item: string, idx: number) => `${idx + 1}. ${item.replace(/^\d+\.\s*/, '')}`)
						.join('\n') || 'No timeline available';

				const focusedContext = `You are helping modify this event plan:

Title: ${recentEventPlan.title}
Current Timeline:
${timelineText}

The user wants to modify it. Be helpful and specific.`;

				messages = [
					{ role: 'system', content: focusedContext },
					{ role: 'user', content: cleanText },
				];
			} else {
				console.log('No recent event plan found in channel history');
				messages = [
					{ role: 'system', content: SYSTEM_PROMPT },
					{
						role: 'user',
						content: `${cleanText} (Note: I don't see a recent event plan in this channel. Could you provide more context about what event you're referring to?)`,
					},
				];
			}
		} catch (error) {
			console.log('Error getting channel context:', error);
			messages = [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: cleanText },
			];
		}
	} else {
		// Regular event planning request
		messages = [
			{ role: 'system', content: SYSTEM_PROMPT },
			{ role: 'user', content: cleanText },
		];
	}

	try {
		console.log('Sending to AI with messages:', JSON.stringify(messages, null, 2));

		// Add timeout wrapper for AI call
		const aiCall = env.AI.run(MODEL_ID, { messages, max_tokens: 1000 });
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('AI request timeout')), 15000)
		);

		console.log('Starting AI request with timeout...');
		const response = await Promise.race([aiCall, timeoutPromise]);
		console.log('AI request completed successfully');

		let aiResponse = (response as { response: string }).response;
		console.log('AI Raw Response received:', aiResponse);

		// Check if it's an event plan
		let parsedResponse;
		try {
			if (typeof aiResponse === 'object') {
				parsedResponse = aiResponse;
			} else {
				parsedResponse = JSON.parse(aiResponse);
			}

			if (parsedResponse.action === 'create_event' && parsedResponse.event) {
				console.log('AI returned event plan - sending to Slack as rich message');

				// Create event plan and send rich message
				const eventPlan = {
					id: crypto.randomUUID(),
					...parsedResponse.event,
					status: 'draft' as const,
					slackChannelId: channel,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};

				const slackService = new SlackService(env.SLACK_BOT_TOKEN!);
				const result = await slackService.postEventPlan(eventPlan);
				console.log('Event plan sent to Slack, result:', result);
				return;
			}
		} catch (e) {
			console.log('Not a JSON event plan - sending as regular message');
		}

		// Send regular AI response
		console.log('Sending regular AI response to Slack:', aiResponse);
		const slackService = new SlackService(env.SLACK_BOT_TOKEN!);
		const result = await slackService.postMessage({
			channel: channel,
			text: aiResponse,
		});

		console.log('AI response sent to Slack, result:', result);
	} catch (error) {
		console.error('Error processing mention:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		// Send error message to user
		let fallbackMessage = `Sorry, I encountered an error processing your request: ${errorMessage}. Please try again!`;

		if (errorMessage.includes('timeout')) {
			fallbackMessage =
				"I'm experiencing some technical difficulties right now. Please try your request again in a moment.";
		}

		try {
			const slackService = new SlackService(env.SLACK_BOT_TOKEN!);
			await slackService.postMessage({
				channel: channel,
				text: fallbackMessage,
			});
			console.log('Error message sent to user');
		} catch (slackError) {
			console.error('Failed to send error message to Slack:', slackError);
		}
	}
}

/**
 * Get recent messages from a Slack channel to provide context
 */
async function getRecentChannelMessages(channel: string, token: string) {
	try {
		console.log('Fetching channel history for channel:', channel);
		const url = `https://slack.com/api/conversations.history?channel=${channel}&limit=5`;

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
		});

		console.log('Response status:', response.status);
		const data = (await response.json()) as {
			ok?: boolean;
			messages?: any[];
			error?: string;
		};

		if (!data.ok) {
			console.log('Slack API error:', data.error);
			return [];
		}

		console.log('Retrieved', data.messages?.length || 0, 'messages');
		return data.messages || [];
	} catch (error) {
		console.log('Error fetching channel history:', error);
		return [];
	}
}

/**
 * Find the most recent event plan in channel messages
 */
function findRecentEventPlan(messages: any[]) {
	console.log('Searching for event plans in', messages.length, 'messages');

	for (const message of messages) {
		// Check for event plan indicators in blocks or text
		if (message.blocks) {
			const hasEventHeader = message.blocks.some((block: any) => {
				if (block.type === 'header') {
					return (
						block.text?.text?.includes('🎉') ||
						block.text?.text?.includes('Party') ||
						block.text?.text?.includes('Event')
					);
				}
				return false;
			});

			if (hasEventHeader) {
				console.log('Found event plan message! Extracting details...');
				return extractEventFromBlocks(message.blocks);
			}
		}

		// Fallback: check text content
		if (
			message.text &&
			(message.text.includes('Event Plan:') ||
				message.text.includes('🎉') ||
				message.text.includes('Timeline:'))
		) {
			console.log('Found potential event plan in text!');
			return extractEventFromText(message.text);
		}
	}

	console.log('No event plans found in messages');
	return null;
}

/**
 * Extract event plan data from Slack blocks
 */
function extractEventFromBlocks(blocks: any[]) {
	try {
		const eventPlan: any = {};

		// Extract title from header
		const headerBlock = blocks.find((block) => block.type === 'header');
		if (headerBlock?.text?.text) {
			eventPlan.title = headerBlock.text.text.replace(/🎉\s*/, '').trim();
		}

		// Extract details from section fields
		const sectionBlocks = blocks.filter((block) => block.type === 'section');

		for (const section of sectionBlocks) {
			if (section.fields) {
				for (const field of section.fields) {
					const text = field.text || '';

					if (text.includes('Date:')) {
						const lines = text.split('\n');
						eventPlan.date = lines[1]?.trim();
					} else if (text.includes('Budget:')) {
						const lines = text.split('\n');
						const budgetText = lines[1]?.trim();
						eventPlan.budget = budgetText?.replace(/[$,]/g, '');
					} else if (text.includes('Venue:')) {
						const lines = text.split('\n');
						eventPlan.venue = lines[1]?.trim();
					}
				}
			} else if (section.text?.text) {
				const text = section.text.text;

				if (text.includes('Timeline:')) {
					const timelineText = text.replace(/\*Timeline:\*\s*\n/, '');
					eventPlan.timeline = timelineText
						.split('\n')
						.map((line: string) => line.trim())
						.filter((line: string) => line.length > 0);
				}
			}
		}

		return Object.keys(eventPlan).length > 0 ? eventPlan : null;
	} catch (error) {
		console.log('Error extracting event from blocks:', error);
		return null;
	}
}

/**
 * Extract event plan data from message text
 */
function extractEventFromText(text: string) {
	try {
		const eventPlan: any = {};

		// Extract title
		const titleMatch = text.match(/🎉\s*([^\n]+)/);
		if (titleMatch) {
			eventPlan.title = titleMatch[1].trim();
		}

		// Extract timeline
		const timelineMatch = text.match(/Timeline:\*?\s*\n([\s\S]+?)(?=\n\*|$)/);
		if (timelineMatch) {
			const timelineText = timelineMatch[1];
			eventPlan.timeline = timelineText
				.split(/\n/)
				.map((line: string) => line.trim())
				.filter((line: string) => line.length > 0 && /^\d+\./.test(line));
		}

		return Object.keys(eventPlan).length > 0 ? eventPlan : null;
	} catch (error) {
		console.log('Error extracting event from text:', error);
		return null;
	}
}