// Types and helpers of the staff chat API (clinic-api/src/chat).

export type ChatPerson = { id: string; name: string; role: string };

/** GET /chat/conversations — the signed-in person's, pinned first, latest activity next. */
export type Conversation = {
	id: string;
	kind: "direct" | "group" | "cabinet";
	/** Groups only. */
	name: string | null;
	createdAt: string;
	activityAt: string;
	pinned: boolean;
	muted: boolean;
	archived: boolean;
	unread: number;
	lastMessage: { body: string; senderId: string; senderName: string; createdAt: string } | null;
	/** Everyone in it but the signed-in person. */
	members: (ChatPerson & { active: boolean })[];
};

export type ChatMessage = { id: string; body: string; senderId: string; senderName: string; createdAt: string };

/** GET /chat/conversations/:id/messages — oldest first. */
export type MessagePage = { messages: ChatMessage[]; hasMore: boolean };

export const CHAT_KEY = ["chat"];
export const CONVERSATIONS_KEY = ["chat", "conversations"];
export const UNREAD_KEY = ["chat", "unread"];
export const messagesKey = (id: string) => ["chat", "messages", id];

/** How often a list or an open conversation looks for new messages. */
export const LIST_POLL_MS = 10_000;
export const THREAD_POLL_MS = 4_000;
export const BADGE_POLL_MS = 30_000;
