import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { WorkspaceDialog } from './WorkspaceDialog';
const originalMethods = new Map(['showModal', 'close'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]));
beforeEach(() => {
  for (const name of originalMethods.keys()) Object.defineProperty(HTMLDialogElement.prototype, name, { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup(); document.querySelectorAll('[data-focus-fixture]').forEach(element => element.remove()); vi.restoreAllMocks();
  for (const [name, descriptor] of originalMethods) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
function fileTrigger() {
  const details = document.createElement('details'); details.dataset.testid = 'more-dropdown'; details.dataset.focusFixture = 'yes';
  const summary = document.createElement('summary'); summary.textContent = 'File'; details.append(summary); document.body.append(details); return summary;
}
function dialog() {
  return render(<WorkspaceDialog title="Load sample" onClose={() => {}}>Samples</WorkspaceDialog>);
}
it('restores File when lazy opening captured BODY instead of an actionable trigger', () => {
  const trigger = fileTrigger(); document.body.focus(); expect(document.activeElement).toBe(document.body);
  const view = dialog(); view.unmount(); expect(document.activeElement).toBe(trigger);
});
it('restores the original visible trigger when it remains available', () => {
  fileTrigger(); const trigger = document.createElement('button'); trigger.dataset.focusFixture = 'yes'; document.body.append(trigger);
  vi.spyOn(trigger, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList); trigger.focus();
  const view = dialog(); view.unmount(); expect(document.activeElement).toBe(trigger);
});
