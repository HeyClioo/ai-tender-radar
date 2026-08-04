export async function copyTitle(title, clipboard = globalThis.navigator?.clipboard) {
  const text = String(title ?? '').trim();
  if (!text) return false;
  if (!clipboard?.writeText) throw new Error('Clipboard API unavailable');
  await clipboard.writeText(text);
  return true;
}
