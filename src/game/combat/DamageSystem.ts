import { Balance } from "../../data/balance.js";
import type { CombatState } from "../state/CombatState.js";
import type { Unit } from "../units/UnitTypes.js";

/** Damage modifiers derived from attacker & defender status. */
export function computeDamage(
  attacker: Unit | undefined,
  defender: Unit,
  base: number,
  state: CombatState,
): number {
  let dmg = base;
  if (attacker) {
    const strength = attacker.statuses["strength"] ?? 0;
    const weak = attacker.statuses["weak"] ?? 0;
    dmg += strength;
    if (weak > 0) dmg = Math.floor(dmg * Balance.statuses.weakMultiplier);
    // Overload Coil: first-attack-per-turn bonus (only for player-side attackers).
    if (attacker.side === "player" && state.player.attacksThisTurn === 0) {
      for (const r of state.player.relics) {
        if (r === "overload_coil") dmg += 2;
      }
    }
    if (attacker.side === "player") {
      for (const r of state.player.relics) {
        if (r === "marker_beacon" && (defender.statuses["marked"] ?? 0) > 0) dmg += 2;
      }
    }
  }
  const vuln = defender.statuses["vulnerable"] ?? 0;
  if (vuln > 0) dmg = Math.floor(dmg * Balance.statuses.vulnerableMultiplier);
  const marked = defender.statuses["marked"] ?? 0;
  if (marked > 0) dmg += Balance.statuses.markedFlatBonus;
  const fragile = defender.statuses["fragile"] ?? 0;
  dmg += fragile;
  // Poisoned enemies deal 1 less — applied at damage time when attacker is
  // the poisoned unit.
  if (attacker && attacker.side === "enemy") {
    const poison = attacker.statuses["poison"] ?? 0;
    if (poison > 0 && state.player.relics.includes("virulent_protocol")) {
      dmg = Math.max(0, dmg - 1);
    }
  }
  return Math.max(0, dmg);
}

/**
 * Apply raw damage to a unit, interacting with shield, retaliate, and lethal
 * prevention. Returns the actual damage dealt to HP (excluding shield).
 */
export interface DamageResult {
  hpDamage: number;
  shieldAbsorbed: number;
  killed: boolean;
  retaliate: number;
}

export function applyDamage(
  attacker: Unit | undefined,
  defender: Unit,
  base: number,
  state: CombatState,
): DamageResult {
  const total = computeDamage(attacker, defender, base, state);
  const shield = defender.statuses["shield"] ?? 0;
  const absorbed = Math.min(shield, total);
  const remaining = total - absorbed;
  if (absorbed > 0) defender.statuses["shield"] = shield - absorbed;
  let hpDamage = remaining;
  let killed = false;
  if (hpDamage > 0) {
    // Failsafe Core: prevent lethal once per combat.
    if (
      defender.side === "player" &&
      defender.hp - hpDamage <= 0 &&
      state.player.preventLethalCharges > 0
    ) {
      state.player.preventLethalCharges -= 1;
      defender.hp = 1;
      state.log.push({
        ts: Date.now(),
        kind: "relic",
        text: `${defender.name} survives lethal damage via Failsafe Core.`,
      });
      hpDamage = 0;
    } else {
      defender.hp -= hpDamage;
      if (defender.hp <= 0) {
        defender.hp = 0;
        defender.dead = true;
        killed = true;
      }
    }
  }
  const retaliate = defender.statuses["retaliate"] ?? 0;
  return { hpDamage, shieldAbsorbed: absorbed, killed, retaliate };
}

/** Heal a unit without exceeding maxHp. Returns amount healed. */
export function heal(unit: Unit, amount: number): number {
  if (unit.dead) return 0;
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + amount);
  return unit.hp - before;
}

/** Gain shield stacks on a unit. */
export function gainShield(unit: Unit, amount: number): void {
  unit.statuses["shield"] = (unit.statuses["shield"] ?? 0) + amount;
}
