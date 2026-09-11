/**
 * What an element is called — one answer, used everywhere.
 *
 * The scanner and the healer each grew their own version of this ladder, and they
 * disagreed: the scanner read `placeholder` and not `title`, the healer read
 * `title` and not `placeholder`, and **neither read `alt`**. That last one is not
 * a detail. Per the accessible-name spec an image's `alt` names the link or button
 * that contains it, so `<a href="/report"><img alt="Download report"></a>` is
 * called "Download report" by every browser, by Playwright's `getByRole`, and by
 * every screen reader — and was called nothing at all by us. Logos, icon buttons,
 * product tiles and social links are all this shape, so a whole category of
 * perfectly addressable controls was being reported as unaddressable.
 *
 * The two files disagreeing was the second problem. A fingerprint captured by one
 * and matched by the other would compare a name against nothing, and the accessible
 * name is the single strongest signal the matcher has.
 *
 * Deliberately a pure function over parts harvested in the page, rather than
 * something that reads the DOM. Nothing inside `page.evaluate` can call an
 * imported function — tsx rewrites it to a helper the page does not have — so the
 * only way to share this at all is to harvest the raw parts in the browser and
 * decide here.
 */

/** The raw sources of a name, as harvested from the page. */
export interface NameParts {
  ariaLabel: string | null;
  /** Text of the element `aria-labelledby` points at. */
  labelledByText: string | null;
  /** Text of the `<label for>` that owns this control. */
  labelText: string | null;
  /** The element's own visible text. */
  text: string | null;
  /** Alt text of images inside it — what names an icon button or a logo link. */
  imageAlt: string | null;
  /** `value`, which is what labels `input[type=submit]` and `input[type=button]`. */
  value: string | null;
  placeholder: string | null;
  title: string | null;
}

/** An empty part is the same as an absent one; whitespace-only names name nothing. */
function clean(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The accessible name, or null when the element has none.
 *
 * Ordered as the spec orders it: `aria-labelledby` outranks `aria-label`, both
 * outrank a native label, and content comes before the fallbacks. `title` is last
 * because it is the spec's last resort too, and `placeholder` sits just above it
 * because a placeholder is a hint rather than a label — a control named only by
 * its placeholder is a real testability finding, and treating it as well-named
 * would hide that.
 */
export function accessibleNameFrom(parts: NameParts): string | null {
  return (
    clean(parts.labelledByText) ??
    clean(parts.ariaLabel) ??
    clean(parts.labelText) ??
    clean(parts.text)?.slice(0, 80) ??
    clean(parts.imageAlt)?.slice(0, 80) ??
    clean(parts.value) ??
    clean(parts.placeholder) ??
    clean(parts.title)
  );
}
