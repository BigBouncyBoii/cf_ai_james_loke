/**
 * Slack Integration Service for Event Planner
 * Based on Cloudflare Slack Agent guide: https://developers.cloudflare.com/agents/guides/slack-agent/
 */

import { EventPlan, SlackMessage, SlackBlock } from "./types";

/**
 * Service class for Slack API integration
 */
export class SlackService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Posts a message to a Slack channel
   */
  async postMessage(
    message: SlackMessage
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      return result;
    } catch (error) {
      console.error("Failed to post Slack message:", error);
      return { ok: false, error: "Network error" };
    }
  }

  /**
   * Formats an EventPlan into a rich Slack message with Block Kit
   */
  formatEventMessage(event: EventPlan): SlackMessage {
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Create rich blocks for the event
    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${event.title}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Date:*\n${formattedDate}`,
          },
          {
            type: "mrkdwn",
            text: `*Expected Guests:*\n${event.guests.length > 0 ? event.guests.length : "TBD"}`,
          },
          {
            type: "mrkdwn",
            text: `*Budget:*\n$${event.budget.toLocaleString()}`,
          },
          {
            type: "mrkdwn",
            text: `*Venue:*\n${event.venue || "TBD"}`,
          },
        ],
      },
    ];

    // Add description if available
    if (event.description) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Description:*\n${event.description}`,
        },
      });
    }

    // Add timeline if available
    if (event.timeline && event.timeline.length > 0) {
      const timelineText = event.timeline
        .map((item, index) => `${index + 1}. ${item}`)
        .join("\n");
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Timeline:*\n${timelineText}`,
        },
      });
    }

    // Add guest list if available
    if (event.guests && event.guests.length > 0) {
      const guestText = event.guests.map((guest) => `• ${guest}`).join("\n");
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📧 Guest List:*\n${guestText}`,
        },
      });
    }

    // Add divider and footer
    blocks.push(
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Event created by AI Event Planner • ${new Date().toLocaleDateString()}`,
          },
        ],
      }
    );

    const message: SlackMessage = {
      channel: event.slackChannelId || "",
      text: `Event Plan: ${event.title}`, // Fallback text for notifications
      blocks,
    };

    return message;
  }

  /**
   * Posts an event plan to Slack with rich formatting
   */
  async postEventPlan(
    event: EventPlan
  ): Promise<{ ok: boolean; error?: string }> {
    if (!event.slackChannelId) {
      return { ok: false, error: "No Slack channel ID specified" };
    }

    const message = this.formatEventMessage(event);
    return await this.postMessage(message);
  }

  /**
   * Sends a follow-up message for event updates
   */
  async postEventUpdate(
    channelId: string,
    updateText: string,
    event: EventPlan
  ): Promise<{ ok: boolean; error?: string }> {
    const message: SlackMessage = {
      channel: channelId,
      text: `Event Update: ${event.title}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Update for "${event.title}":*\n${updateText}`,
          },
        },
        {
          type: "context",
          text: {
            type: "mrkdwn",
            text: `Updated by AI Event Planner • ${new Date().toLocaleString()}`,
          },
        },
      ],
    };

    return await this.postMessage(message);
  }
}

/**
 * Verifies Slack request signatures for webhook security
 * Based on Slack's HMAC SHA256 verification
 */
export async function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): Promise<boolean> {
  // Check if timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);

  if (Math.abs(currentTime - requestTime) > 300) {
    return false; // Request is too old
  }

  // Create base string
  const baseString = `v0:${timestamp}:${body}`;

  // Use Web Crypto API to compute HMAC
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(baseString)
  );
  const computedSignature =
    "v0=" +
    Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Compare signatures securely
  return computedSignature === signature;
}

/**
 * Simple Slack OAuth URL generator for app installation
 */
export function generateSlackOAuthURL(
  clientId: string,
  scopes: string[],
  redirectUri?: string
): string {
  const scopeString = scopes.join(",");
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopeString,
    redirect_uri: redirectUri || "/slack/oauth",
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}
