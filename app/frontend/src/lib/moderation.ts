const bannedWords = [
  'porno',
  'sexe',
  'escort',
  'pute',
  'viol',
  'terroriste',
  'arnaque',
  'hack compte',
];

export function containsDangerousContent(text: string) {
  const lower = text.toLowerCase();

  return bannedWords.some((word) => lower.includes(word));
}
