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

/**
 * Shared singleton tooltip element. Using a single element prevents orphaned
 * tooltips when a hovered target is removed from the DOM (e.g. when the hand
 * is rebuilt while a card is under the cursor) — a situation where the
 * target's `mouseleave` never fires.
 */
let sharedTooltipEl: HTMLDivElement | null = null;
let sharedTooltipOwner: HTMLElement | null = null;

function getSharedTooltip(): HTMLDivElement {
  if (!sharedTooltipEl) {
    sharedTooltipEl = document.createElement("div");
    sharedTooltipEl.className = "tooltip";
    sharedTooltipEl.style.display = "none";
    document.body.appendChild(sharedTooltipEl);
  }
  return sharedTooltipEl;
}

function hideSharedTooltip(owner: HTMLElement | null): void {
  // Only hide if the requesting owner currently owns the tooltip; this avoids
  // flicker when pointer moves rapidly between adjacent targets.
  if (sharedTooltipEl && (owner === null || sharedTooltipOwner === owner)) {
    sharedTooltipEl.style.display = "none";
    sharedTooltipEl.innerHTML = "";
    sharedTooltipOwner = null;
  }
}

/** Simple tooltip attached to an element; follows the mouse. */
export function attachTooltip(target: HTMLElement, getContent: () => string | HTMLElement | null): () => void {
  const show = (ev: MouseEvent): void => {
    const content = getContent();
    if (!content) return;
    const tip = getSharedTooltip();
    tip.innerHTML = "";
    if (typeof content === "string") tip.innerHTML = content;
    else tip.appendChild(content);
    tip.style.display = "";
    sharedTooltipOwner = target;
    move(ev);
  };
  const move = (ev: MouseEvent): void => {
    if (!sharedTooltipEl || sharedTooltipOwner !== target) return;
    const x = ev.clientX + 16;
    const y = ev.clientY + 16;
    sharedTooltipEl.style.left = `${Math.min(x, window.innerWidth - 260)}px`;
    sharedTooltipEl.style.top = `${Math.min(y, window.innerHeight - 140)}px`;
  };
  const hide = (): void => {
    hideSharedTooltip(target);
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
