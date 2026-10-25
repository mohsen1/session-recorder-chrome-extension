/** Capture only visible interface labels, never inputs, editable text, or hidden nodes. */
export function pageVocabularyContext(root: Document = document): string {
  const labels: string[] = [];
  for (const element of root.querySelectorAll('h1,h2,h3,button,nav a,[role="tab"],label,code')) {
    if (element.closest('input,textarea,[contenteditable],[data-private],[data-sensitive],[hidden],[aria-hidden="true"]')) continue;
    if (element.querySelector('input,textarea,[contenteditable]')) continue;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (!box.width || !box.height || box.bottom < 0 || box.top > innerHeight || box.right < 0 || box.left > innerWidth || style.visibility !== 'visible' || style.display === 'none') continue;
    const text: string[] = [];
    const walker = root.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest('input,textarea,[contenteditable],[data-private],[data-sensitive],[hidden],[aria-hidden="true"]')) continue;
      if (!parent.getClientRects().length || getComputedStyle(parent).visibility !== 'visible') continue;
      text.push(node.textContent ?? '');
    }
    const label = text.join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.join('\n').length >= 6000) break;
  }
  return labels.join('\n').slice(0, 6000);
}
