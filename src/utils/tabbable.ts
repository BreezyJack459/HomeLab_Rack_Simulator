const TABBABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]';

export function getTabbableElements(root: ParentNode | null): HTMLElement[] {
  if (!root) return [];

  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter((element) => {
    if (element.tabIndex < 0 || element.hasAttribute('disabled')) return false;
    if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;

    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}
