// Reciprocal rank fusion gives exact matches and paraphrases a place in a
// bounded result, and favours documents returned by both retrievers.
export function fuseRanks(lexical: string[], semantic: string[]): string[] {
  if (!semantic.length) return lexical;
  const scores = new Map<string,number>();
  for (const ranked of [lexical,semantic]) {
    ranked.forEach((id,i)=>scores.set(id,(scores.get(id) ?? 0) + 1/(20+i)));
  }
  return [...scores.keys()].sort((a,b)=>scores.get(b)!-scores.get(a)!);
}
