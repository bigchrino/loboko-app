import type { PostItem } from '@/components/PostCard';
import { supabase } from '@/lib/supabase';

export interface PostAuthor {
  username: string;
  display_name?: string;
  metier?: string;
  avatar_key?: string;
  role?: string;
  is_admin?: boolean;
}
export interface PostView {
  post: PostItem;
  author: PostAuthor | null;
  avatarUrl: string | null;
  mediaUrls: { url: string; type: 'image' | 'video' }[];
  mediaRatios: Record<string, number>;
  liked: boolean;
  likeId: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
}

// Tab memory only, scoped to the viewer, bounded and cleared at sign-out.
// The server is still consulted on every visit; this only seeds the UI.
const views = new Map<string, { value: PostView; savedAt: number }>();
const keyFor = (id: string, viewer?: string) => `${viewer || 'guest'}:${id}`;
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') views.clear();
});
export function readPostView(id: string, viewer?: string): PostView | undefined {
  const key = keyFor(id, viewer);
  const entry = views.get(key);
  if (!entry) return;
  if (Date.now() - entry.savedAt > 10 * 60_000) {
    views.delete(key);
    return;
  }
  return entry.value;
}
export function savePostView(value: PostView, viewer?: string) {
  const key = keyFor(value.post.id, viewer);
  views.delete(key);
  views.set(key, { value, savedAt: Date.now() });
  if (views.size > 100) views.delete(views.keys().next().value!);
}
export function forgetPostView(id: string, viewer?: string) {
  views.delete(keyFor(id, viewer));
}
