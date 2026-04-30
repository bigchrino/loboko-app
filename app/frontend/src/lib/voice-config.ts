// Central config for voice note limits.
// Keep the UI, the recorder and any server-side validation in sync by
// importing from this single file.

export const MAX_VOICE_NOTE_SECONDS = 120;

// Allowed playback speeds surfaced in the VoiceMessage player.
export const VOICE_PLAYBACK_SPEEDS: number[] = [1, 1.5, 2];