import { audio } from "../../engine/AudioManager.js";
import type { CardDefinition } from "../../game/cards/CardTypes.js";
import { getCardDef } from "../../data/cards.js";
import type { RelicDefinition } from "../../game/relics/RelicTypes.js";
import { makeCardInstance } from "../../game/cards/DeckManager.js";
import type { HeroRunState } from "../../game/state/RunState.js";
import { renderCard } from "../CardView.js";
import { el } from "../UIHelpers.js";
import type { GameApp } from "../GameApp.js";

/**
 * Shop scene — spend scrap on cards, a relic, or deck refinement.
 * Stock and prices are provided by GameApp (seeded per-node).
 */
export interface ShopStock {
  cards: { def: CardDefinition; price: number; bought: boolean }[];
  relic: { def: RelicDefinition; price: number; bought: boolean } | null;
  removalPrice: number;
  removalUsed: boolean;
  healPrice: number;
  healUsed: boolean;
}

export function renderShopScene(app: GameApp, stock: ShopStock, heroes: HeroRunState[], gold: number): HTMLElement {
  const scene = el("div", { class: "scene event-scene" });
  const panel = el("div", { class: "panel event-card", style: { maxWidth: "900px" } as Partial<CSSStyleDeclaration> }, [
    el("h2", { text: "Scrap Market" }),
    el("p", { class: "flavor", text: "A dim stall flickers online. The broker trades in forgotten signals." }),
    el("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "6px",
        marginBottom: "12px",
      } as Partial<CSSStyleDeclaration>,
    }, [
      el("div", { class: "dim", text: `Scrap: ${gold}` }),
      el("button", { class: "subtle", text: "Leave Shop", onClick: () => app.leaveShop() }),
    ]),
  ]);

  // Cards section
  const cardsLabel = el("div", {
    style: {
      marginTop: "10px",
      color: "var(--c-fg-dim)",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      fontSize: "12px",
    } as Partial<CSSStyleDeclaration>,
    text: "Cards",
  });
  panel.appendChild(cardsLabel);

  const cardRow = el("div", { style: { display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" } as Partial<CSSStyleDeclaration> });
  for (const [idx, entry] of stock.cards.entries()) {
    const wrap = el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" } as Partial<CSSStyleDeclaration> });
    const inst = makeCardInstance(entry.def.id);
    const canAfford = gold >= entry.price && !entry.bought;
    const node = renderCard(inst, {
      disabled: !canAfford,
      onClick: () => {
        if (!canAfford) return;
        audio.play("cardSelect");
        app.buyShopCard(idx);
      },
    });
    wrap.appendChild(node);
    wrap.appendChild(el("div", {
      class: entry.bought ? "dim" : "",
      style: { fontSize: "13px", fontFamily: "var(--font-mono)", color: entry.bought ? "var(--c-fg-muted)" : canAfford ? "var(--c-gold)" : "var(--c-danger)" } as Partial<CSSStyleDeclaration>,
      text: entry.bought ? "Sold" : `${entry.price} scrap`,
    }));
    cardRow.appendChild(wrap);
  }
  if (stock.cards.length === 0) {
    cardRow.appendChild(el("div", { class: "dim", text: "No cards in stock." }));
  }
  panel.appendChild(cardRow);

  // Relic section
  if (stock.relic) {
    panel.appendChild(el("div", {
      style: {
        marginTop: "18px",
        color: "var(--c-fg-dim)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontSize: "12px",
      } as Partial<CSSStyleDeclaration>,
      text: "Relic",
    }));
    const r = stock.relic;
    const canAfford = gold >= r.price && !r.bought;
    const row = el("div", {
      class: "panel",
      style: {
        padding: "12px 16px",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        marginTop: "6px",
      } as Partial<CSSStyleDeclaration>,
    }, [
      el("div", { style: { fontSize: "28px", color: "var(--c-gold)" } as Partial<CSSStyleDeclaration>, text: "◈" }),
      el("div", { style: { flex: "1" } as Partial<CSSStyleDeclaration> }, [
        el("h3", { text: r.def.name }),
        el("div", { class: "dim", text: r.def.description }),
      ]),
      el("div", { style: { fontFamily: "var(--font-mono)", color: r.bought ? "var(--c-fg-muted)" : canAfford ? "var(--c-gold)" : "var(--c-danger)" } as Partial<CSSStyleDeclaration>, text: r.bought ? "Sold" : `${r.price} scrap` }),
      el("button", {
        class: canAfford ? "primary" : "subtle",
        text: r.bought ? "Sold" : "Buy",
        onClick: () => {
          if (!canAfford) return;
          audio.play("reward");
          app.buyShopRelic();
        },
      }),
    ]);
    panel.appendChild(row);
  }

  // Services section
  panel.appendChild(el("div", {
    style: {
      marginTop: "18px",
      color: "var(--c-fg-dim)",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      fontSize: "12px",
    } as Partial<CSSStyleDeclaration>,
    text: "Services",
  }));
  const services = el("div", { style: { display: "flex", gap: "10px", marginTop: "6px", flexWrap: "wrap" } as Partial<CSSStyleDeclaration> });

  const canHeal = gold >= stock.healPrice && !stock.healUsed && heroes.some((h) => h.hp < h.maxHp);
  services.appendChild(el("button", {
    class: canHeal ? "primary" : "subtle",
    onClick: () => {
      if (!canHeal) return;
      audio.play("heal");
      app.buyShopHeal();
    },
  }, [
    el("div", { text: stock.healUsed ? "Repair bay (used)" : "Repair bay" }),
    el("div", { class: "dim", style: { fontSize: "11px", fontFamily: "var(--font-mono)" } as Partial<CSSStyleDeclaration>, text: `Heal each hero 30% — ${stock.healPrice} scrap` }),
  ]));

  const canRemove = gold >= stock.removalPrice && !stock.removalUsed && heroes.some((h) => h.deck.some((id) => getCardDef(id).rarity !== "starter"));
  services.appendChild(el("button", {
    class: canRemove ? "primary" : "subtle",
    onClick: () => {
      if (!canRemove) return;
      audio.play("cardSelect");
      app.openShopRemoval();
    },
  }, [
    el("div", { text: stock.removalUsed ? "Signal purge (used)" : "Signal purge" }),
    el("div", { class: "dim", style: { fontSize: "11px", fontFamily: "var(--font-mono)" } as Partial<CSSStyleDeclaration>, text: `Remove a card — ${stock.removalPrice} scrap` }),
  ]));

  panel.appendChild(services);

  scene.appendChild(panel);
  return scene;
}

/** Removal picker: shows the deck; clicking a removable card removes it. */
export function renderShopRemovalScene(app: GameApp, heroes: HeroRunState[]): HTMLElement {
  const scene = el("div", { class: "scene event-scene" });
  const panel = el("div", { class: "panel event-card", style: { maxWidth: "820px" } as Partial<CSSStyleDeclaration> }, [
    el("h2", { text: "Signal Purge" }),
    el("p", { class: "flavor", text: "Select a card to excise from the deck. Starter cards are protected." }),
  ]);
  const grid = el("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
      gap: "10px",
      marginTop: "10px",
    } as Partial<CSSStyleDeclaration>,
  });
  let any = false;
  for (const [hi, hero] of heroes.entries()) {
    for (const [i, defId] of hero.deck.entries()) {
      const def = getCardDef(defId);
      if (def.rarity === "starter") continue;
      any = true;
      const inst = makeCardInstance(defId, hero.upgraded.includes(defId));
      const node = renderCard(inst, {
        onClick: () => {
          audio.play("cardSelect");
          app.confirmShopRemoval(hi, i);
        },
      });
      grid.appendChild(node);
    }
  }
  if (!any) {
    grid.appendChild(el("div", { class: "dim", text: "Nothing available to remove." }));
  }
  panel.appendChild(grid);
  panel.appendChild(el("button", {
    class: "subtle",
    text: "Cancel",
    onClick: () => app.cancelShopRemoval(),
    style: { marginTop: "16px" } as Partial<CSSStyleDeclaration>,
  }));
  scene.appendChild(panel);
  return scene;
}
