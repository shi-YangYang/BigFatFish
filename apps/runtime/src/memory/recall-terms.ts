// Keep whole phrases for exact matches and overlapping Han pairs for ordinary Chinese questions.
export function recallTerms(query: string): string[] {
  const chunks = query.normalize('NFKC').toLowerCase().match(/[\p{Script=Han}]+|[\p{L}\p{N}]+/gu) ?? [];
  const terms = new Set(chunks.slice(0, 10).map(chunk => chunk.slice(0, 120)));
  // In a naming question the noun can be shorter in the source: 小猫名字 ↔ 叫…的猫,
  // 狗狗叫什么 ↔ 养了一条狗. Keep this one-character expansion tied to its grammatical
  // role rather than admitting every individual character in the question.
  for (const match of query.matchAll(/(?:[小老大](\p{Script=Han})|(\p{Script=Han})\2|[只条匹盆棵辆艘](\p{Script=Han}))的?(?:名字|昵称|小名|叫什么|叫啥)/gu)) {
    terms.add((match[1] ?? match[2] ?? match[3])!);
    if (terms.size >= 28) break;
  }
  for (const chunk of chunks) {
    if (!/\p{Script=Han}/u.test(chunk)) continue;
    for (let i = 0; i + 1 < chunk.length && terms.size < 28; i++) terms.add(chunk.slice(i, i + 2));
    if (terms.size >= 28) break;
  }
  return [...terms];
}
