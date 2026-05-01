/**
 * Triggers a Web Push notification via the `send-push` Supabase edge function.
 *
 * This helper is *fire-and-forget*: callers should never await it on the UI
 * critical path. A failure is logged but never propagated — sending a message
 * must never fail because push could not be delivered.
 */

import { supabase } from '@/lib/supabase';
import { isConversationActive } from '@/lib/active-conversation';

type PushKind = 'dm' | 'group' | 'mention';

/**
 * Fan-out a group push notification to every member of the group except
 * the sender. Fire-and-forget: all errors are swallowed.
 */
export function triggerGroupPushFanout(args: {
  groupId: string;
  senderId: string;
  memberIds: string[];
  mentionedUserIds?: string[];
  title: string;
  body: string;
}): void {
  const {
    groupId,
    senderId,
    memberIds,
    mentionedUserIds,
    title,
    body,
  } = args;
  if (!groupId || !title) return;
  const mentioned = new Set(mentionedUserIds ?? []);
  for (const uid of memberIds) {
    if (!uid || uid === senderId) continue;
    triggerPushNotification({
      recipientId: uid,
      kind: mentioned.has(uid) ? 'mention' : 'group',
      title,
      body,
      conversationId: groupId,
    });
  }
}

type TriggerArgs = {
  recipientId: string;
  kind: PushKind;
  title: string;
  body: string;
  conversationId: string;
};

/**
 * Shortens a message body for display in a notification. Keeps emojis,
 * trims whitespace, caps at ~120 chars.
 */
export function notificationPreview(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = String(raw).replace(/\s+/g, ' ').trim();
  if (!trimmed) return fallback;
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}…`;
}

/**
 * Fire-and-forget push trigger. Never throws.
 *
 * Guards:
 * - If the recipient is the current user, skip (self-notify).
 * - If the conversation is currently focused by the sender, still send — the
 *   server-side check is for the *recipient*, and we don't know the recipient
 *   state here. (Recipient-side suppression happens in the service worker.)
 */
export function triggerPushNotification(args: TriggerArgs): void {
  const { recipientId, kind, title, body, conversationId } = args;
  if (!recipientId || !title) return;

  void (async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user?.id;
      if (me && me === recipientId) return;

      // Tiny safety: if THIS device is the recipient and we are on the conv,
      // skip (rare edge case: multi-tab same user).
      if (
        (kind === 'dm' || kind === 'group') &&
        isConversationActive(kind, conversationId) &&
        me === recipientId
      ) {
        return;
      }

      const { error } = await supabase.functions.invoke('send-push', {
        body: {
          recipient_user_id: recipientId,
          kind,
          title,
          body,
          data: {
            type: kind === 'mention' ? 'group' : kind,
            conversation_id: conversationId,
          },
        },
      });
      if (error) {
        // We log but never throw. The feature is best-effort.
        console.warn('[push-trigger] send-push invoke failed', error.message ?? error);
      }
    } catch (e) {
      console.warn('[push-trigger] unexpected error', e);
    }
  })();
}

/**
 * Fire-and-forget push for an @mention inside a post or a comment.
 *
 * Contrary to `triggerPushNotification` (which is tied to a conversation),
 * a mention push carries a `post_id` (and optionally `comment_id`) so the
 * service worker / app can deep-link to the publication when tapped.
 *
 * Never throws. Skips self-mentions.
 */
export function triggerMentionPush(args: {
  recipientId: string;
  actorName: string;
  mentionType: 'post' | 'comment' | 'message';
  postId?: string | number | null;
  commentId?: string | number | null;
  messageId?: string | number | null;
  body?: string;
}): void {
  const {
    recipientId,
    actorName,
    mentionType,
    postId,
    commentId,
    messageId,
    body,
  } = args;
  if (!recipientId) return;

  const title = 'Vous avez été mentionné';
  const displayBody = (() => {
    const who = actorName?.trim() || 'Quelqu’un';
    const suffix =
      mentionType === 'post'
        ? 'vous a mentionné dans une publication'
        : mentionType === 'comment'
          ? 'vous a mentionné dans un commentaire'
          : 'vous a mentionné dans un message';
    if (body && body.trim()) {
      return `${who} ${suffix}: ${notificationPreview(body, '')}`.trim();
    }
    return `${who} ${suffix}`;
  })();

  void (async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user?.id;
      if (me && me === recipientId) return;

      const data: Record<string, unknown> = { type: mentionType };
      if (postId !== undefined && postId !== null && postId !== '') {
        data.post_id = postId;
      }
      if (commentId !== undefined && commentId !== null && commentId !== '') {
        data.comment_id = commentId;
      }
      if (messageId !== undefined && messageId !== null && messageId !== '') {
        data.message_id = messageId;
      }

      const { error } = await supabase.functions.invoke('send-push', {
        body: {
          recipient_user_id: recipientId,
          kind: 'mention',
          title,
          body: displayBody,
          data,
        },
      });
      if (error) {
        console.warn('[push-trigger] mention push invoke failed', error.message ?? error);
      }
    } catch (e) {
      console.warn('[push-trigger] mention push unexpected error', e);
    }
  })();
}