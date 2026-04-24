import { getCardDef } from "../data/cards.js";
import { KEYWORD_MAP } from "../data/keywords.js";
import type { CardInstance } from "../game/cards/CardTypes.js";
import { el } from "./UIHelpers.js";

/**
 * Renders a card instance as a DOM element. The card view is purely visual
 * — interaction (select/play) is handled by the parent via callbacks.
 */
export function renderCard(
  card: CardInstance,
  opts: {
    selected?: boolean;
    disabled?: boolean;
    cost?: number;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  } = {},
): HTMLElement {
  const def = getCardDef(card.defId);
  const isUpgraded = card.upgraded;
  const cost = opts.cost ?? (isUpgraded && def.upgradedCost !== undefined ? def.upgradedCost : def.cost);
  const name = isUpgraded ? `${def.name}+` : def.name;
  const desc = isUpgraded && def.upgradedDescription ? def.upgradedDescription : def.description;
  const cls = [
    "card",
    `rarity-${def.rarity}`,
    isUpgraded ? "upgraded" : "",
    opts.selected ? "selected" : "",
    opts.disabled ? "disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const keywordText = def.keywords.length > 0 ? def.keywords.join(" · ") : "";
  const typeLabel = def.type.toUpperCase();

  return el("div", {
    class: cls,
    onClick: opts.onClick,
    onMouseEnter: opts.onMouseEnter,
    onMouseLeave: opts.onMouseLeave,
    dataset: { cardId: def.id, instanceId: card.instanceId },
  }, [
    el("div", { class: "cost", text: String(cost) }),
    el("div", { class: "name", text: name }),
    el("div", { class: "type", text: typeLabel }),
    el("div", { class: "art" }, [makeCardArt(def.id, def.type)]),
    el("div", { class: "desc", html: formatKeywords(desc) }),
    keywordText ? el("div", { class: "keywords", text: keywordText }) : null,
  ].filter(Boolean) as (Node | null)[]);
}

function makeCardArt(cardId: string, type: string): HTMLElement {
  // Tiny inline SVG glyph derived from card id hash — purely placeholder art.
  const hue = Math.abs(stringHash(cardId)) % 360;
  const glyph = typeGlyph(type);
  const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
    <defs>
      <radialGradient id="g-${cardId}" cx="50%" cy="40%">
        <stop offset="0%" stop-color="hsl(${hue}, 80%, 60%)" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="hsl(${hue + 40}, 60%, 12%)" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="100" height="100" fill="url(#g-${cardId})"/>
    <g fill="rgba(255,255,255,0.85)" font-family="serif" font-size="52" text-anchor="middle" dominant-baseline="middle">
      <text x="50" y="58">${glyph}</text>
    </g>
  </svg>`;
  const wrap = document.createElement("div");
  wrap.innerHTML = svg;
  return wrap;
}

function typeGlyph(type: string): string {
  switch (type) {
    case "attack": return "⚔";
    case "skill": return "✦";
    case "movement": return "↯";
    case "power": return "◈";
    case "tactic": return "◎";
    default: return "◆";
  }
}

function stringHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

/** Turn keyword names in a description into highlighted spans. */
export function formatKeywords(desc: string): string {
  let out = desc;
  for (const key of KEYWORD_MAP.keys()) {
    const name = KEYWORD_MAP.get(key)!.name;
    const re = new RegExp(`\\b${name}\\b`, "g");
    out = out.replace(re, `<span class="keyword">${name}</span>`);
  }
  return out;
}

/** Build a hover tooltip for a card, showing full description + keywords. */
export function cardTooltip(card: CardInstance): HTMLElement {
  const def = getCardDef(card.defId);
  const name = card.upgraded ? `${def.name}+` : def.name;
  const desc = card.upgraded && def.upgradedDescription ? def.upgradedDescription : def.description;
  const container = el("div", {}, [
    el("div", { class: "name", text: name }),
    el("div", { class: "dim", text: `${def.type.toUpperCase()} · ${def.rarity}` }),
    el("div", { style: { marginTop: "6px" } as Partial<CSSStyleDeclaration>, html: formatKeywords(desc) }),
  ]);
  for (const kw of def.keywords) {
    const k = KEYWORD_MAP.get(kw);
    if (!k) continue;
    container.appendChild(
      el("div", { class: "keyword", style: { marginTop: "6px" } as Partial<CSSStyleDeclaration> }, [
        el("span", { html: `<strong>${k.name}:</strong> ${k.description}` }),
      ]),
    );
  }
  return container;
}
