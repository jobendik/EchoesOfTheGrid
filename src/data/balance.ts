/**
 * Central balance knobs. Changing any of these should immediately tune the
 * whole game without touching simulation code.
 */
export const Balance = {
  player: {
    startingEnergy: 3,
    handSize: 5,
    /** Max cards a player can hold in hand. Excess drawn cards are discarded. */
    handLimit: 10,
    /** Basic move range granted to the party per turn via movement cards.
     *  Heroes do not move on their own; movement is card-driven. */
  },
  combat: {
    defaultGridWidth: 8,
    defaultGridHeight: 6,
  },
  statuses: {
    burnPerTurnDamage: 2,
    weakMultiplier: 0.75,
    vulnerableMultiplier: 1.5,
    markedFlatBonus: 2,
  },
  difficulty: {
    // HP scalar applied to enemies on elite / boss encounters.
    eliteHpMultiplier: 1.5,
    bossHpMultiplier: 3.0,
    // Damage scalar for tier-3 encounters.
    tier3DamageBonus: 1,
  },
  run: {
    mapLayers: 6,
    nodesPerLayer: 3,
    startingGold: 0,
  },
} as const;
