import { supabase } from '@/lib/supabase';

export type NotificationType = 'like' | 'comment' | 'message' | 'follow';

interface CreateNotificationParams {
  recipientId: string;
  fromUserId: string;
  type: NotificationType;
  postId?: string | number;
  message?: string;
}

/**
 * Create a notification row for `recipientId`.
 * Silently no-ops if the actor is the recipient (no self-notifications)
 * or if essential fields are missing. Errors are logged but not thrown,
 * so UI flows are never blocked by notification write failures.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { recipientId, fromUserId, type, postId, message } = params;
  if (!recipientId || !fromUserId) return;
  if (recipientId === fromUserId) return;

  try {
    const payload: Record<string, unknown> = {
      user_id: recipientId,
      from_user_id: fromUserId,
      type,
      read: false,
    };
    if (message) payload.message = message;
    if (postId !== undefined && postId !== null && postId !== '') {
      payload.post_id = postId;
    }
    const { error } = await supabase.from('notifications').insert(payload);
    if (error) throw error;
  } catch (e) {
    console.error('[notifications] create failed', e);
  }
}

/**
 * Return the count of unread notifications for the given user.
 * Returns 0 on any error so the UI stays stable.
 */
export async function countUnreadNotifications(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
    return typeof count === 'number' ? count : 0;
  } catch (e) {
    console.error('[notifications] count unread failed', e);
    return 0;
  }
}

/**
 * Mark all notifications of the given user as read.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
  } catch (e) {
    console.error('[notifications] mark read failed', e);
  }
}