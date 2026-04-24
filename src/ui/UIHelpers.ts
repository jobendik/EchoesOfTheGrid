/**
 * Lightweight DOM helpers used across scenes. Keeping this tiny avoids a
 * framework dependency while still giving us composable UI primitives.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<keyof HTMLElementTagNameMap[K], unknown>> & {
    class?: string;
    dataset?: Record<string, string>;
    style?: Partial<CSSStyleDeclaration>;
    html?: string;
    text?: string;
    onClick?: (ev: MouseEvent) => void;
    onMouseEnter?: (ev: MouseEvent) => void;
    onMouseLeave?: (ev: MouseEvent) => void;
    onMouseMove?: (ev: MouseEvent) => void;
    onKeyDown?: (ev: KeyboardEvent) => void;
  } = {},
  children: (Node | string | null | undefined | false)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k === "class") node.className = String(v);
    else if (k === "dataset" && typeof v === "object")
      Object.assign(node.dataset, v);
    else if (k === "style" && typeof v === "object")
      Object.assign(node.style, v as Partial<CSSStyleDeclaration>);
    else if (k === "html") node.innerHTML = String(v);
    else if (k === "text") node.textContent = String(v);
    else if (k === "onClick") node.addEventListener("click", v as EventListener);
    else if (k === "onMouseEnter") node.addEventListener("mouseenter", v as EventListener);
    else if (k === "onMouseLeave") node.addEventListener("mouseleave", v as EventListener);
    else if (k === "onMouseMove") node.addEventListener("mousemove", v as EventListener);
    else if (k === "onKeyDown") node.addEventListener("keydown", v as EventListener);
    else (node as unknown as Record<string, unknown>)[k] = v;
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

export function clear(root: HTMLElement): void {
  while (root.firstChild) root.removeChild(root.firstChild);
}

/** Simple tooltip attached to an element; follows the mouse. */
export function attachTooltip(target: HTMLElement, getContent: () => string | HTMLElement | null): () => void {
  let tip: HTMLDivElement | null = null;
  const show = (ev: MouseEvent): void => {
    const content = getContent();
    if (!content) return;
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "tooltip";
      document.body.appendChild(tip);
    }
    tip.innerHTML = "";
    if (typeof content === "string") tip.innerHTML = content;
    else tip.appendChild(content);
    move(ev);
  };
  const move = (ev: MouseEvent): void => {
    if (!tip) return;
    const x = ev.clientX + 16;
    const y = ev.clientY + 16;
    tip.style.left = `${Math.min(x, window.innerWidth - 260)}px`;
    tip.style.top = `${Math.min(y, window.innerHeight - 140)}px`;
  };
  const hide = (): void => {
    if (tip && tip.parentElement) tip.parentElement.removeChild(tip);
    tip = null;
  };
  target.addEventListener("mouseenter", show);
  target.addEventListener("mousemove", move);
  target.addEventListener("mouseleave", hide);
  return () => {
    target.removeEventListener("mouseenter", show);
    target.removeEventListener("mousemove", move);
    target.removeEventListener("mouseleave", hide);
    hide();
  };
}
