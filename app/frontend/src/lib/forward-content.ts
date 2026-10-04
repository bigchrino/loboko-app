import { loadDmEphemeralDuration, computeExpiresAt } from '@/lib/ephemeral';
import { triggerPushNotification } from '@/lib/push-trigger';
import { supabase } from '@/lib/supabase';
import { decodePayload, encodePayload } from '@/lib/message-format';
import { uploadMediaEx, type UploadFolder } from '@/lib/storage-helpers';

/** Copy private attachments into the forwarder's own space before sharing. */
export async function prepareForwardContent(raw: string): Promise<string> {
  const payload = decodePayload(raw);
  if (payload.kind === 'signal' || payload.kind === 'call_event' || payload.kind === 'system') {
    throw new Error('Ce type de message ne peut pas être transféré');
  }
  if (payload.kind === 'text') return encodePayload(payload);
  if (payload.kind === 'shared_post') return raw;
  const expected: UploadFolder = payload.kind === 'audio' ? 'voice-notes'
    : payload.kind === 'file' ? 'message-documents' : 'message-media';
  const [bucket, objectPath, extra] = payload.object_key.split('::');
  if (bucket !== expected || !objectPath || extra !== undefined) {
    throw new Error('Pièce jointe indisponible pour le transfert');
  }
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) throw new Error('Impossible de lire la pièce jointe');
  const name = payload.kind === 'file' ? payload.file_name : objectPath.split('/').pop() || 'media.bin';
  const file = new File([data], name, { type: data.type });
  const result = await uploadMediaEx(file, expected, { skipImageCompression: true });
  if (!result.key) throw new Error(result.error || 'Impossible de copier la pièce jointe');
  return encodePayload({ ...payload, object_key: result.key });
}

/** Insert all selected recipients atomically, so retrying cannot duplicate partial sends. */
export async function forwardContentToContacts(raw: string, owner: string, recipients: string[]) {
  const ids = [...new Set(recipients)];
  if (!owner || ids.length === 0 || ids.length > 5 || ids.includes(owner)) {
    throw new Error('Choisissez de 1 à 5 contacts');
  }
  const content = await prepareForwardContent(raw);
  const rows = await Promise.all(ids.map(async receiver_id => {
    const duration = await loadDmEphemeralDuration(owner, receiver_id);
    const expires_at = computeExpiresAt(duration);
    return { user_id: owner, receiver_id, content, read: false,
      ...(expires_at ? { expires_at, is_ephemeral: true } : {}) };
  }));
  const { error } = await supabase.from('messages').insert(rows);
  if (error) throw new Error('Transfert non confirmé. Vérifiez la conversation avant de réessayer.');
  for (const recipientId of ids) {
    triggerPushNotification({ recipientId, kind: 'dm', title: 'Nouveau message', body: 'Message transféré', conversationId: owner });
  }
}
