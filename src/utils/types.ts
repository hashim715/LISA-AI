export interface Email {
  body?: string;
  subject?: string;
  timestamp?: Date;
  from: string;
  id?: string;
  messageId?: string;
  threadId?: string;
}

export interface JwtPayload {
  username: string;
}

export interface CalenderEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  attendees: Array<{ email: string; responseStatus: string }>;
}

export interface Slack {
  channel_name: string;
  type: string;
}

export interface NotionSummary {
  summary: string;
}

export interface PerplexityNews {
  news: string;
}
