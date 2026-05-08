export function getRequiredElement<T extends HTMLElement>(
  id: string,
  type: new () => T,
): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Element with id '${id}' not found.`);
  }
  if (!(el instanceof type)) {
    throw new Error(
      `Element with id '${id}' is not of type ${type.name}, but of type ${el.constructor.name}.`,
    );
  }
  return el;
}
