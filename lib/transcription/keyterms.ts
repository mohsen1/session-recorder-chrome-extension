/** Small, provider-safe vocabulary. Never persist page context or credentials here. */
export function normalizeKeyterms(value: unknown, maxLength = 50): string[] {
  if (!Array.isArray(value)) return [];
  const terms: string[] = [];
  let characters = 0;
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const term = item.replace(/\s+/g, ' ').trim();
    if (!term || term.length > maxLength || term.split(' ').length > 5 || /[@:/\\\d]{2}|https?[:/]|[\r\n<>]/i.test(term)) continue;
    if (terms.some(t => t.toLocaleLowerCase() === term.toLocaleLowerCase())) continue;
    if (characters + term.length > 400 || terms.length >= 40) break;
    terms.push(term); characters += term.length;
  }
  return terms;
}
export function addDeepgramKeyterms(params: URLSearchParams, model: string, terms?: string[]): void {
  if (!model.startsWith('nova-3')) return;
  for (const term of normalizeKeyterms(terms)) params.append('keyterm', term);
}
