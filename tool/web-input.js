import { gameDoc } from './realm.js';

const PRIMARY = 'button.authored-node[data-node="Primary"]';

const findPrimary = () => [...gameDoc().querySelectorAll(PRIMARY)].find(b => !b.disabled && !b.closest('[hidden]') && b.getClientRects().length > 0) ?? null;
export const primaryReady = () => !!findPrimary();

export function clickPrimary() {
  const primary = findPrimary();
  if (!primary) return false;
  primary.click();
  return true;
}
