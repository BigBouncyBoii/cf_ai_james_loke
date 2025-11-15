/**
 * Event Planner App Frontend
 *
 * Handles the chat UI interactions, event approval, Slack integration, and browser search.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Chat state
let chatHistory = [
	{
		role: "assistant",
		content:
			"Hi, I am your event planning assistant. How can I help you today? Just describe what you would like to do and I will create a comprehensive event plan for you!",
	},
];
let isProcessing = false;
let currentEventPlan = null;

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

// Send button click handler
sendButton.addEventListener("click", sendMessage);

/**
 * Sends a message to the chat API and processes the response
 */
async function sendMessage() {
	const message = userInput.value.trim();

	// Don't send empty messages
	if (message === "" || isProcessing) return;

	// Disable input while processing
	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	// Add user message to chat
	addMessageToChat("user", message);

	// Clear input
	userInput.value = "";
	userInput.style.height = "auto";

	// Show typing indicator
	typingIndicator.classList.add("visible");

	// Add message to history
	chatHistory.push({ role: "user", content: message });

	try {
		// Send request to API
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: chatHistory,
			}),
		});

		// Handle errors
		if (!response.ok) {
			throw new Error("Failed to get response");
		}

		const result = await response.json();

		// Check if we got an event plan that needs approval
		if (result.needsApproval && result.eventPlan) {
			currentEventPlan = result.eventPlan;
			
			// Add assistant response
			addMessageToChat("assistant", result.response);
			chatHistory.push({ role: "assistant", content: result.response });
			
			// Show event plan approval interface
			showEventApproval(result.eventPlan);
		} else {
			// Regular response
			addMessageToChat("assistant", result.response);
			chatHistory.push({ role: "assistant", content: result.response });
		}
	} catch (error) {
		console.error("Error:", error);
		addMessageToChat(
			"assistant",
			"Sorry, there was an error processing your request."
		);
	} finally {
		// Hide typing indicator
		typingIndicator.classList.remove("visible");

		// Re-enable input
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `msg ${role}`;  // Use 'msg' class to match HTML styles
	messageEl.innerHTML = `<p>${content}</p>`;
	
	// Add search buttons for assistant messages that mention finding resources
	if (role === 'assistant') {
		addSearchButtons(content, messageEl);
	}
	
	chatMessages.appendChild(messageEl);

	// Scroll to bottom
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Shows the event approval interface
 */
function showEventApproval(eventPlan) {
	const eventDate = new Date(eventPlan.date).toLocaleDateString();
	
	const approvalHTML = `
		<div class="event-approval" style="
			background: linear-gradient(135deg, rgba(246,130,31,0.1), rgba(255,154,60,0.1));
			border: 1px solid rgba(246,130,31,0.2);
			border-radius: 12px;
			padding: 20px;
			margin: 16px 0;
		">
			<h3 style="color: var(--accent); margin-top: 0;">📅 Event Plan Ready for Review</h3>
			
			<div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 16px; margin: 12px 0;">
				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
					<div><strong>📝 Title:</strong> ${eventPlan.title}</div>
					<div><strong>📅 Date:</strong> ${eventDate}</div>
					<div><strong>👥 Guests:</strong> ${eventPlan.guests?.length || 0}</div>
					<div><strong>💰 Budget:</strong> $${eventPlan.budget?.toLocaleString()}</div>
				</div>
				${eventPlan.venue ? `<div style="margin-top: 8px;"><strong>📍 Venue:</strong> ${eventPlan.venue}</div>` : ''}
				${eventPlan.timeline?.length > 0 ? `
					<div style="margin-top: 12px;">
						<strong>📋 Timeline:</strong>
						<ul style="margin: 4px 0 0 0; padding-left: 20px;">
							${eventPlan.timeline.map(item => `<li>${item}</li>`).join('')}
						</ul>
					</div>
				` : ''}
			</div>

			<div style="margin-bottom: 16px;">
				<label for="slack-channel" style="display: block; margin-bottom: 8px; font-weight: 600;">
					📱 Slack Channel ID (optional):
				</label>
				<input 
					type="text" 
					id="slack-channel" 
					placeholder="e.g., C1234567890 or #general"
					style="
						width: 100%;
						padding: 10px;
						border-radius: 8px;
						border: 1px solid rgba(255,255,255,0.1);
						background: rgba(255,255,255,0.05);
						color: var(--text);
						font-size: 14px;
					"
				/>
				<small style="color: var(--muted); font-size: 12px;">
					Leave empty to approve without sending to Slack
				</small>
			</div>

			<div style="display: flex; gap: 12px;">
				<button 
					onclick="approveEvent(true)"
					style="
						flex: 1;
						background: linear-gradient(135deg, var(--accent), var(--accent-2));
						color: #081019;
						border: none;
						padding: 12px 20px;
						border-radius: 8px;
						font-weight: 600;
						cursor: pointer;
					"
				>
					✅ Approve & Send to Slack
				</button>
				<button 
					onclick="approveEvent(false)"
					style="
						flex: 1;
						background: transparent;
						color: var(--muted);
						border: 1px solid rgba(255,255,255,0.1);
						padding: 12px 20px;
						border-radius: 8px;
						cursor: pointer;
					"
				>
					❌ Discard Plan
				</button>
			</div>
		</div>
	`;

	const messageEl = document.createElement("div");
	messageEl.className = "msg assistant";  // Use correct CSS classes
	messageEl.innerHTML = approvalHTML;
	chatMessages.appendChild(messageEl);

	// Scroll to bottom
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Handles event approval
 */
async function approveEvent(approved) {
	if (!currentEventPlan) return;

	const slackChannelInput = document.getElementById('slack-channel');
	const slackChannelId = slackChannelInput ? slackChannelInput.value.trim() : '';

	try {
		const response = await fetch('/api/approve-event', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				eventPlan: currentEventPlan,
				slackChannelId: slackChannelId,
				approved: approved
			})
		});

		const result = await response.json();

		if (result.success) {
			// Remove the approval interface
			const approvalElements = document.querySelectorAll('.event-approval');
			approvalElements.forEach(el => el.remove());
			
			// Add success message
			addMessageToChat("assistant", result.message);
			
			// Clear current event plan
			currentEventPlan = null;
		} else {
			addMessageToChat("assistant", `Error: ${result.error || 'Failed to process approval'}`);
		}
	} catch (error) {
		console.error('Error approving event:', error);
		addMessageToChat("assistant", "Sorry, there was an error processing your approval.");
	}
}

/**
 * Performs a browser search for event-related resources
 */
async function performBrowserSearch(query, resourceType = 'general') {
	try {
		addMessageToChat("assistant", `🔍 Searching the web for "${query}"...`);
		
		const response = await fetch('/api/browser-search', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: query,
				resourceType: resourceType,
				maxResults: 5
			}),
		});

		const data = await response.json();
		
		if (data.results && data.results.length > 0) {
			let resultsHTML = `<div style="
				background: rgba(255,255,255,0.05);
				border: 1px solid rgba(255,255,255,0.1);
				border-radius: 12px;
				padding: 20px;
				margin: 10px 0;
			">
				<h3 style="margin: 0 0 15px 0; color: var(--accent);">🔍 Search Results for "${query}"</h3>
			`;

			data.results.forEach((result, index) => {
				resultsHTML += `
					<div style="
						background: rgba(255,255,255,0.03);
						border-radius: 8px;
						padding: 15px;
						margin-bottom: 10px;
						border-left: 3px solid var(--accent);
					">
						<h4 style="margin: 0 0 8px 0;">
							<a href="${result.url}" target="_blank" style="color: var(--accent); text-decoration: none;">
								${result.title}
							</a>
						</h4>
						<p style="margin: 5px 0; color: var(--muted); font-size: 0.9em;">
							${result.description}
						</p>
						<small style="color: var(--muted); font-size: 0.8em;">
							${result.url}
						</small>
					</div>
				`;
			});

			resultsHTML += '</div>';
			
			const messageEl = document.createElement("div");
			messageEl.className = "msg assistant";
			messageEl.innerHTML = resultsHTML;
			chatMessages.appendChild(messageEl);
		} else {
			addMessageToChat("assistant", `Sorry, I couldn't find any results for "${query}". Please try a different search term.`);
		}
		
		// Scroll to bottom
		chatMessages.scrollTop = chatMessages.scrollHeight;
		
	} catch (error) {
		console.error('Browser search error:', error);
		addMessageToChat("assistant", "Sorry, there was an error performing the web search. Please try again later.");
	}
}

/**
 * Adds a search button to messages that mention finding resources
 */
async function addSearchButtons(messageText, messageElement) {
	// Check if the message might contain searchable content
	const searchKeywords = [
		'find', 'search', 'look', 'where', 'how', 'reviews', 'tickets', 
		'booking', 'venue', 'catering', 'museum', 'restaurant', 'hotel',
		'buy', 'get', 'book', 'visit'
	];

	const hasSearchableContent = searchKeywords.some(keyword => 
		messageText.toLowerCase().includes(keyword)
	);

	if (!hasSearchableContent) {
		return;
	}

	try {
		// Use AI to generate a clean search query
		const response = await fetch('/api/generate-search-query', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				message: messageText
			}),
		});

		const data = await response.json();
		
		if (data.query && data.query.trim() && data.query.length > 2) {
			const searchQuery = data.query.trim();
			
			// Determine resource type based on keywords
			let resourceType = 'general';
			if (searchQuery.includes('venue') || searchQuery.includes('location') || searchQuery.includes('hall')) {
				resourceType = 'venue';
			} else if (searchQuery.includes('ticket')) {
				resourceType = 'tickets';
			} else if (searchQuery.includes('catering') || searchQuery.includes('food') || searchQuery.includes('restaurant')) {
				resourceType = 'catering';
			} else if (searchQuery.includes('supplies') || searchQuery.includes('equipment')) {
				resourceType = 'supplies';
			}

			const buttonId = `search-btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			const searchButtonHTML = `
				<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
					<button 
						id="${buttonId}"
						data-query="${searchQuery}"
						data-type="${resourceType}"
						style="
							background: linear-gradient(135deg, var(--accent), var(--accent-2));
							color: white;
							border: none;
							padding: 10px 20px;
							border-radius: 8px;
							font-weight: 600;
							cursor: pointer;
							font-size: 0.9em;
						"
					>
						🔍 Search for "${searchQuery}"
					</button>
				</div>
			`;
			
			messageElement.innerHTML += searchButtonHTML;
			
			// Add event listener after the element is added to DOM
			setTimeout(() => {
				const button = document.getElementById(buttonId);
				if (button) {
					button.addEventListener('click', () => {
						const query = button.getAttribute('data-query');
						const type = button.getAttribute('data-type');
						performBrowserSearch(query, type);
					});
				}
			}, 10);
		}
	} catch (error) {
		console.log('Could not generate search query:', error);
		// Silently fail - no search button will be added
	}
}

// Make functions available globally
window.approveEvent = approveEvent;
window.performBrowserSearch = performBrowserSearch;
