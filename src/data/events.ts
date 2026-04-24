import type { EventDefinition } from "../game/encounters/EncounterTypes.js";

/**
 * Text-based narrative events. Each offers meaningful choices that modify
 * the run state (HP, deck, relics).
 */
export const EVENTS: readonly EventDefinition[] = [
  {
    id: "ev_fractured_console",
    title: "Fractured Console",
    flavor:
      "A half-melted console pulses weakly. Its cache might hold something useful — or fry your systems.",
    choices: [
      {
        label: "Extract data (lose 3 HP)",
        description: "Gain a random uncommon card.",
        outcomes: [
          { kind: "loseHp", amount: 3 },
          { kind: "addRandomCard", rarity: "uncommon" },
        ],
      },
      {
        label: "Scavenge carefully",
        description: "Gain 15 scrap.",
        outcomes: [{ kind: "addGold", amount: 15 }],
      },
      {
        label: "Ignore it",
        description: "Move on safely.",
        outcomes: [{ kind: "nothing" }],
      },
    ],
  },
  {
    id: "ev_ghost_operator",
    title: "Ghost Operator",
    flavor:
      "A ghosted signal offers to \"tune\" one of your cards — for a price paid in memory.",
    choices: [
      {
        label: "Let it tune a card",
        description: "Upgrade a random card. Lose 5 HP.",
        outcomes: [
          { kind: "upgradeCard" },
          { kind: "loseHp", amount: 5 },
        ],
      },
      {
        label: "Refuse",
        description: "Nothing happens.",
        outcomes: [{ kind: "nothing" }],
      },
    ],
  },
  {
    id: "ev_archive_vault",
    title: "Archive Vault",
    flavor:
      "An old archive slides open, leaking fragmented code. Some of it looks usable. Some… less so.",
    choices: [
      {
        label: "Grab the prototype",
        description: "Gain a random rare card. Add a curse.",
        outcomes: [
          { kind: "addRandomCard", rarity: "rare" },
          { kind: "addCurse" },
        ],
      },
      {
        label: "Trim the archive",
        description: "Remove a card from your deck.",
        outcomes: [{ kind: "removeCard" }],
      },
      {
        label: "Leave it sealed",
        description: "Move on.",
        outcomes: [{ kind: "nothing" }],
      },
    ],
  },
  {
    id: "ev_medpack_drop",
    title: "Emergency Med-Pack",
    flavor: "A medpack beacon blinks nearby — but an aggressive ping suggests it's trapped.",
    choices: [
      {
        label: "Use the medpack",
        description: "Heal 8 HP on each hero. Risky: lose 2 HP if it's a trap.",
        outcomes: [
          { kind: "heal", amount: 8 },
          { kind: "loseHp", amount: 2 },
        ],
      },
      {
        label: "Salvage components",
        description: "Gain 10 scrap.",
        outcomes: [{ kind: "addGold", amount: 10 }],
      },
    ],
  },
  {
    id: "ev_rogue_ai",
    title: "Rogue AI Request",
    flavor:
      "A rogue AI sidesteps the firewall and whispers an offer: \"Shield me, and I'll give you something sharp.\"",
    choices: [
      {
        label: "Accept the deal",
        description: "Gain an uncommon relic. Add a curse.",
        outcomes: [
          { kind: "addRelic", rarity: "uncommon" },
          { kind: "addCurse" },
        ],
      },
      {
        label: "Decline",
        description: "The AI dissipates.",
        outcomes: [{ kind: "nothing" }],
      },
    ],
  },
  {
    id: "ev_unstable_power",
    title: "Unstable Power Core",
    flavor:
      "A dormant core hums with volatile energy. The readings flicker between asset and liability.",
    choices: [
      {
        label: "Overclock (gain 20 scrap, lose 4 HP)",
        description: "Risky: take damage but gain scrap.",
        outcomes: [
          { kind: "addGold", amount: 20 },
          { kind: "loseHp", amount: 4 },
        ],
      },
      {
        label: "Stabilize",
        description: "Upgrade a card.",
        outcomes: [{ kind: "upgradeCard" }],
      },
    ],
  },
];

export const EVENT_MAP = new Map(EVENTS.map((e) => [e.id, e]));
