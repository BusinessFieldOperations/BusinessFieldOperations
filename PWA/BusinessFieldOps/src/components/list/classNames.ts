/**
  allow conditional modifiers can be written as
 * `joinClasses('base', isActive && 'base--active')`.
 */
export function joinClasses(
  ...names: Array<string | false | null | undefined>
): string {
  return names.filter(Boolean).join(' ');
}
