export function positionTourBubble(
  el: HTMLDialogElement,
  anchor: HTMLElement | null,
) {
  const viewport = window.visualViewport,
    width = viewport?.width ?? innerWidth,
    height = viewport?.height ?? innerHeight,
    offsetTop = viewport?.offsetTop ?? 0,
    offsetLeft = viewport?.offsetLeft ?? 0;
  const rect = anchor?.getBoundingClientRect(),
    bounds = el.getBoundingClientRect();
  const left =
    width < 640
      ? (width - bounds.width) / 2
      : Math.max(
          16,
          Math.min((rect?.left ?? 40) + 20, width - bounds.width - 16),
        );
  const desiredTop =
    width < 640 ? height - bounds.height - 16 : (rect?.bottom ?? 80) + 12;
  el.style.left = `${offsetLeft + left}px`;
  el.style.top = `${offsetTop + Math.max(16, Math.min(desiredTop, height - bounds.height - 16))}px`;
}
