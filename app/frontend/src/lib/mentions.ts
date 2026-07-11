// Shared helpers for the @mentions system (posts, comments, group messages).
// - extractMentionQuery: detect an in-progress @query at the caret.
// - searchMentionables: search users by username / display_name.
// - applyMention: replace the current @query with a @username token.
// - parseMentions: extract @usernames from final text.
// - renderWithMentions: split text into plain/mention chunks for rendering.

import { supabase } from '@/lib/supabase';

export interface MentionSuggestion {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_key: string | null;
}

/**
 * Detect if the caret is currently within an @mention being typed.
 * Returns the query (without the leading "@") and the range [start, end]
 * of the @token (including the @). Returns null when not in a mention.
 */
export function extractMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number; end: number } | null {
  if (caret < 0 || caret > text.length) return null;
  // Walk backwards from caret to find the nearest "@" that starts a token.
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '@') break;
    // Stop if we hit a whitespace/newline before finding "@".
    if (/\s/.test(ch)) return null;
    i--;
  }
  if (i < 0 || text[i] !== '@') return null;
  // The char before "@" must be start-of-string or whitespace.
  if (i > 0 && !/\s/.test(text[i - 1])) return null;
  const query = text.slice(i + 1, caret);
  // Usernames are alphanumeric/underscore/dot only — reject queries with spaces etc.
  if (query.length > 32 || /[^\w.]/.test(query)) return null;
  return { query, start: i, end: caret };
}

/**
 * Search profiles matching the given query (by username or display_name).
 * Returns up to `limit` suggestions ordered by username.
 */
export async function searchMentionables(
  query: string,
  limit = 6,
): Promise<MentionSuggestion[]> {
  const q = query.trim();
  try {
    let req = supabase
      .from('profiles')
      .select('user_id, username, display_name, avatar_key')
      .limit(limit);
    if (q.length > 0) {
      // Supabase .or() expects a single string with comma-separated filters.
      const like = `%${q}%`;
      req = req.or(`username.ilike.${like},display_name.ilike.${like}`);
    } else {
      req = req.order('username', { ascending: true });
    }
    const { data, error } = await req;
    if (error) throw error;
    return (data || []) as MentionSuggestion[];
  } catch (e) {
    console.error('[mentions] search failed', e);
    return [];
  }
}

/**
 * Replace the current @query with "@username " in the given text.
 * Returns the new text and the new caret position.
 */
export function applyMention(
  text: string,
  range: { start: number; end: number },
  username: string,
): { text: string; caret: number } {
  const before = text.slice(0, range.start);
  const after = text.slice(range.end);
  const token = `@${username} `;
  const newText = before + token + after;
  return { text: newText, caret: (before + token).length };
}

/**
 * Extract @usernames referenced in the text. Usernames start with "@" and
 * contain word chars / dot. The returned list is deduplicated, order preserved.
 */
export function parseMentions(text: string): string[] {
  if (!text) return [];
  const re = /(^|\s)@([\w.]{1,32})/g;
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const uname = m[2];
    if (!seen.has(uname)) {
      seen.add(uname);
      out.push(uname);
    }
  }
  return out;
}

/**
 * Resolve @usernames in `text` to user ids via the profiles table.
 * Returns a map of username -> user_id for found users.
 */
export async function resolveMentionedUserIds(
  text: string,
): Promise<Record<string, string>> {
  const names = parseMentions(text);
  if (names.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, username')
      .in('username', names);
    if (error) throw error;
    const out: Record<string, string> = {};
    (data || []).forEach((r: { user_id: string; username: string | null }) => {
      if (r.username) out[r.username] = r.user_id;
    });
    return out;
  } catch (e) {
    console.error('[mentions] resolve failed', e);
    return {};
  }
}

export type MentionChunk =
  | { type: 'text'; value: string }
  | { type: 'mention'; username: string }
  | { type: 'link'; url: string; display: string };

/**
 * Resolve a single @username to a user_id via the profiles table.
 * Returns null when the user does not exist (or query fails).
 */
export async function resolveUsernameToId(
  username: string,
): Promise<string | null> {
  const clean = (username || '').trim().replace(/^@+/, '');
  if (!clean) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', clean)
      .maybeSingle();
    if (error) throw error;
    return data?.user_id ?? null;
  } catch (e) {
    console.error('[mentions] resolveUsernameToId failed', e);
    return null;
  }
}

/**
 * Split text into plain/mention chunks for safe rendering. Consumers can
 * map each chunk to a <span> or a clickable profile link.
 */
// Détecte http(s)://... et www.xxx — volontairement limité à ces deux formes
// (plutôt que tout ce qui ressemble à un nom de domaine) pour éviter les faux
// positifs sur du texte normal ("Mr. Dupont", "3.5kg"...). Ça couvre le cas
// courant : un lien copié-collé depuis un navigateur inclut toujours l'un
// des deux.
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

// Ponctuation de fin de phrase qu'on ne veut pas inclure dans le lien
// lui-même (ex: "Regarde ça: https://exemple.com." → le point final n'est
// pas censé faire partie de l'URL).
const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}'"”’]+$/;

function splitLinkChunks(text: string): MentionChunk[] {
  if (!text) return [];
  const out: MentionChunk[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    let raw = m[0];
    let end = m.index + raw.length;
    const trailingMatch = raw.match(TRAILING_PUNCTUATION_RE);
    if (trailingMatch) {
      raw = raw.slice(0, raw.length - trailingMatch[0].length);
      end -= trailingMatch[0].length;
    }
    if (!raw) continue;
    if (m.index > lastIndex) {
      out.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    const url = raw.toLowerCase().startsWith('http') ? raw : `https://${raw}`;
    out.push({ type: 'link', url, display: raw });
    lastIndex = end;
  }
  if (lastIndex < text.length) {
    out.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return out;
}

export function splitMentionChunks(text: string): MentionChunk[] {
  if (!text) return [];
  const re = /(^|\s)@([\w.]{1,32})/g;
  const out: MentionChunk[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const leading = m[1] ?? '';
    const uname = m[2];
    const matchStart = m.index + leading.length;
    const matchEnd = matchStart + uname.length + 1; // "@" + uname
    if (matchStart > lastIndex) {
      out.push(...splitLinkChunks(text.slice(lastIndex, matchStart)));
    }
    out.push({ type: 'mention', username: uname });
    lastIndex = matchEnd;
  }
  if (lastIndex < text.length) {
    out.push(...splitLinkChunks(text.slice(lastIndex)));
  }
  return out;
}
