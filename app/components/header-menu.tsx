import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/** Native disclosures with the dismissal behavior of a small header popover. */
export function HeaderMenu({
  className,
  children,
  menuRef,
}: {
  className: string;
  children: ReactNode;
  menuRef?: RefObject<HTMLDetailsElement | null>;
}) {
  const localRef = useRef<HTMLDetailsElement>(null),
    ref = menuRef ?? localRef;
  useEffect(() => {
    const menu = ref.current!;
    const closeOthers = () => {
      document
        .querySelectorAll<HTMLDetailsElement>("[data-header-menu][open]")
        .forEach((other) => {
          if (other !== menu) other.open = false;
        });
    };
    const outside = (event: Event) => {
      if (menu.open && !event.composedPath().includes(menu)) menu.open = false;
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.open) {
        event.preventDefault();
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    const toggle = () => {
      if (menu.open) closeOthers();
    };
    // Close peers immediately when opening the root summary, including in browsers
    // without support for the native details[name] grouping behavior.
    const click = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest("summary") === menu.firstElementChild && !menu.open)
        closeOthers();
    };
    menu.addEventListener("toggle", toggle);
    menu.addEventListener("click", click);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", keydown);
    return () => {
      menu.removeEventListener("toggle", toggle);
      menu.removeEventListener("click", click);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", keydown);
    };
  }, [ref]);
  return (
    <details
      ref={ref}
      className={className}
      name="workspace-header"
      data-header-menu
    >
      {children}
    </details>
  );
}
