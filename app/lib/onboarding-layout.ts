export function positionTourBubble(
  el: HTMLDialogElement,
  anchor: HTMLElement | null,
) {
  const rect = anchor?.getBoundingClientRect(),
    bounds = el.getBoundingClientRect();
  const left =
    innerWidth < 640
      ? (innerWidth - bounds.width) / 2
      : Math.max(
          16,
          Math.min((rect?.left ?? 40) + 20, innerWidth - bounds.width - 16),
        );
  const desiredTop =
    innerWidth < 640
      ? innerHeight - bounds.height - 84
      : (rect?.bottom ?? 80) + 12;
  el.style.left = `${left}px`;
  el.style.top = `${Math.max(16, Math.min(desiredTop, innerHeight - bounds.height - 20))}px`;
}
