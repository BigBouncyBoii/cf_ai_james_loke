/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
  /**
   * Binding for the Workers AI API.
   */
  AI: Ai;

  /**
   * Binding for static assets.
   */
  ASSETS: { fetch: (request: Request) => Promise<Response> };

  /**
   * Binding for Browser Rendering API.
   */
  BROWSER?: Fetcher;

  /**
   * Browserbase API key for web scraping
   */
  BROWSERBASE_API_KEY?: string;

  /**
   * Slack Bot Token for API calls
   */
  SLACK_BOT_TOKEN?: string;

  /**
   * Slack Signing Secret for webhook verification
   */
  SLACK_SIGNING_SECRET?: string;
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Event plan structure for the event planner
 */
export interface EventPlan {
  id: string;
  title: string;
  date: string;
  time?: string;
  guests: string[];
  timeline: string[];
  budget: number;
  venue?: string;
  description?: string;
  type?: string;
  status: "draft" | "approved" | "sent_to_slack";
  slackChannelId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Slack API message format
 */
export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
  thread_ts?: string;
}

/**
 * Slack Block Kit structure for rich messages
 */
export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text: string;
  }>;
  accessory?: any;
}

/**
 * Search result from browser operations
 */
export interface SearchResult {
  title: string;
  url: string;
  description: string;
  source: string;
}

/**
 * Browser search request structure
 */
export interface BrowserSearchRequest {
  query: string;
  resourceType?: 'venue' | 'tickets' | 'catering' | 'supplies' | 'general';
  maxResults?: number;
}
