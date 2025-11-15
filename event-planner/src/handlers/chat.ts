/**
 * Chat API Handler
 * 
 * Handles chat requests, event plan generation, and AI interactions
 */
import { Env, ChatMessage, EventPlan } from '../types';

// Model ID for Workers AI model
const MODEL_ID = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// Enhanced system prompt for event planning
const SYSTEM_PROMPT = `You are an expert AI event planning assistant with access to web search capabilities. Your role is to help users plan events by:

1. Extracting key details from user requests (event type, date, guest count, budget, venue preferences)
2. Creating detailed event plans with timelines and suggestions
3. Providing practical advice for event organization
4. When users ask about finding specific resources (like "museum tickets", "venues", "catering"), you can suggest web searches
5. When you have enough information to create a comprehensive event plan, respond with a JSON structure

When users ask questions about finding resources like:
- "How can I find museum tickets?"
- "Where can I book a venue?"
- "How do I find catering services?"
- "Where to buy party supplies?"

You can suggest that they can search for these resources and provide helpful search terms. For example:
"I can help you search for museum tickets! You could search for '[museum name] tickets booking' or 'buy [museum name] tickets online'."

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

Be friendly, practical, and focus on creating realistic, well-organized event plans. When appropriate, suggest web searches for finding specific resources.`;

/**
 * Handles chat API requests
 */
export async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === 'system')) {
			messages.unshift({ role: 'system', content: SYSTEM_PROMPT });
		}

		const response = await env.AI.run(
			MODEL_ID,
			{
				messages,
				max_tokens: 1024,
			},
			{
				returnRawResponse: false,
			},
		) as { response: string };

		// Check if the response contains an event plan
		try {
			const responseText = response.response;
			console.log('AI Raw Response:', responseText);
			
			let jsonText = responseText;
			let parsedResponse;

			// Try to extract JSON from markdown code blocks if present
			const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
			if (codeBlockMatch) {
				jsonText = codeBlockMatch[1];
				console.log('Extracted JSON from code block:', jsonText);
			}

			// Try parsing the extracted or original text
			try {
				parsedResponse = JSON.parse(jsonText);
			} catch (parseError) {
				console.log('JSON parsing failed:', parseError);
				throw parseError;
			}
			
			if (parsedResponse.action === 'create_event' && parsedResponse.event) {
				console.log('Event plan detected! Creating approval response');
				
				// Create a draft event plan
				const eventPlan: EventPlan = {
					id: crypto.randomUUID(),
					...parsedResponse.event,
					status: 'draft',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};

				console.log('Final event plan:', eventPlan);

				return new Response(JSON.stringify({
					response: parsedResponse.response,
					eventPlan: eventPlan,
					needsApproval: true
				}), {
					headers: { 'Content-Type': 'application/json' },
				});
			}
		} catch (e) {
			console.log('JSON parsing failed or no event plan found:', e);
			// Not JSON or doesn't contain event plan - treat as regular response
		}

		// Return regular response
		return new Response(JSON.stringify({ 
			response: response.response
		}), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error processing chat request:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to process request' }),
			{
				status: 500,
				headers: { 'content-type': 'application/json' },
			},
		);
	}
}