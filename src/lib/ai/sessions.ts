"use client";

import { useSyncExternalStore } from "react";

/**
 * AI chat sessions persisted in the visitor's browser via localStorage.
 *
 *   - Each session has its own random 10-byte (20 hex chars) id and a
 *     trimmed list of UI messages so the user can flip back to old chats.
 *   - The active session id lives in its own key so reloading the page
 *     restores the conversation that was on screen.
 *   - Storage subscribers use {@link useSyncExternalStore}, which is
 *     SSR-safe and complies with React 19's `set-state-in-effect` rule.
 *
 * Privacy: this is purely client-side. The server-side audit log lives in
 * the `ai_chat_logs` table (migration 006) and is keyed by the same
 * session id so an admin can correlate without ever needing the visitor's
 * localStorage.
 */

export const SESSIONS_KEY = "mada.ai.sessions";
export const ACTIVE_SESSION_KEY = "mada.ai.activeSession";
const SESSIONS_EVENT = "mada-ai-sessions-change";
const MAX_SESSIONS = 30;
const MAX_MESSAGES_PER_SESSION = 100;
const MAX_TITLE_LENGTH = 60;

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function generateSessionId(): string {
  // 10 bytes of randomness rendered as 20 lowercase hex chars (~80 bits of
  // entropy). Falls back to Math.random if Web Crypto is unavailable
  // (very old browsers); still good enough as a session label.
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2).padStart(20, "0").slice(0, 20);
}

export function deriveTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser?.text) return "New chat";
  const cleaned = firstUser.text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + "…";
}

function readSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isChatSession);
  } catch {
    return [];
  }
}

function isChatSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ChatSession>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.createdAt === "number" &&
    typeof v.updatedAt === "number" &&
    Array.isArray(v.messages)
  );
}

function writeSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  // Cap total sessions; oldest first by updatedAt.
  const trimmed = [...sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
  // localStorage doesn't fire `storage` events on the same tab, so we
  // broadcast our own.
  window.dispatchEvent(new Event(SESSIONS_EVENT));
}

function readActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_SESSION_KEY);
}

function writeActiveSessionId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_SESSION_KEY, id);
  else window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  window.dispatchEvent(new Event(SESSIONS_EVENT));
}

// ---------------------------------------------------------------------------
// Subscriber wiring
// ---------------------------------------------------------------------------

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(SESSIONS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SESSIONS_EVENT, callback);
  };
}

const EMPTY_SESSIONS: ChatSession[] = [];

// Cache snapshots so useSyncExternalStore can do reference-equality checks.
let lastSnapshot: ChatSession[] = EMPTY_SESSIONS;
let lastSnapshotJson = "[]";

function getSessionsSnapshot(): ChatSession[] {
  const sessions = readSessions();
  const json = JSON.stringify(sessions);
  if (json === lastSnapshotJson) return lastSnapshot;
  lastSnapshot = sessions;
  lastSnapshotJson = json;
  return sessions;
}

function getServerSessionsSnapshot(): ChatSession[] {
  return EMPTY_SESSIONS;
}

let lastActiveSnapshot: string | null = null;
function getActiveSnapshot(): string | null {
  const v = readActiveSessionId();
  if (v === lastActiveSnapshot) return lastActiveSnapshot;
  lastActiveSnapshot = v;
  return v;
}

function getServerActiveSnapshot(): string | null {
  return null;
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

export function useChatSessions(): ChatSession[] {
  return useSyncExternalStore(
    subscribe,
    getSessionsSnapshot,
    getServerSessionsSnapshot
  );
}

export function useActiveSessionId(): string | null {
  return useSyncExternalStore(
    subscribe,
    getActiveSnapshot,
    getServerActiveSnapshot
  );
}

// ---------------------------------------------------------------------------
// Module-level mutators (no React state, no refs needed)
//
// These run only in the browser. SSR-safe because each function bails out
// when `window` is undefined.
// ---------------------------------------------------------------------------

export function upsertSession(
  incoming: Partial<ChatSession> & { id: string }
): void {
  const sessions = readSessions();
  const idx = sessions.findIndex((s) => s.id === incoming.id);
  const now = Date.now();
  if (idx === -1) {
    sessions.push({
      id: incoming.id,
      title: incoming.title ?? "New chat",
      createdAt: incoming.createdAt ?? now,
      updatedAt: incoming.updatedAt ?? now,
      messages: incoming.messages ?? [],
    });
  } else {
    sessions[idx] = {
      ...sessions[idx],
      ...incoming,
      updatedAt: incoming.updatedAt ?? now,
    };
  }
  writeSessions(sessions);
}

export function saveMessages(
  sessionId: string,
  messages: StoredMessage[]
): void {
  const trimmed = messages.slice(-MAX_MESSAGES_PER_SESSION);
  const sessions = readSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  const now = Date.now();
  const title = deriveTitle(trimmed);
  if (idx === -1) {
    sessions.push({
      id: sessionId,
      title,
      createdAt: now,
      updatedAt: now,
      messages: trimmed,
    });
  } else {
    sessions[idx] = {
      ...sessions[idx],
      title:
        sessions[idx].title === "New chat" || sessions[idx].title === ""
          ? title
          : sessions[idx].title,
      updatedAt: now,
      messages: trimmed,
    };
  }
  writeSessions(sessions);
}

export function deleteSession(sessionId: string): void {
  const sessions = readSessions().filter((s) => s.id !== sessionId);
  writeSessions(sessions);
  if (readActiveSessionId() === sessionId) {
    writeActiveSessionId(sessions[0]?.id ?? null);
  }
}

export function clearAllSessions(): void {
  writeSessions([]);
  writeActiveSessionId(null);
}

export function setActiveSession(sessionId: string | null): void {
  writeActiveSessionId(sessionId);
}

export function startNewSession(): string {
  const id = generateSessionId();
  const now = Date.now();
  const sessions = readSessions();
  sessions.push({
    id,
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [],
  });
  writeSessions(sessions);
  writeActiveSessionId(id);
  return id;
}
