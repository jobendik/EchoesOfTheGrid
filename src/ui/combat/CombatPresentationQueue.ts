import type { GridPos, UnitId } from "../../core/Types.js";
import type { CombatController } from "../../game/combat/CombatController.js";

export type CombatEvent =
  | { kind: "card_played"; casterId: UnitId; target?: GridPos }
  | { kind: "unit_moved"; unitId: UnitId; from: GridPos; to: GridPos }
  | { kind: "damage_dealt"; defenderId: UnitId; amount: number; heavy: boolean }
  | { kind: "shield_gained"; unitId: UnitId; amount: number }
  | { kind: "status_applied"; unitId: UnitId; status: string; stacks: number }
  | { kind: "enemy_intent_resolved"; enemyId: UnitId; intentKind: string }
  | { kind: "unit_died"; unitId: UnitId }
  | { kind: "reward_gained"; reward: string };

export interface PresentationState {
  moveTweens: Map<UnitId, { from: GridPos; to: GridPos; start: number; duration: number }>;
  hitFlashes: Map<UnitId, number>;
  shieldPulses: Map<UnitId, number>;
  dissolves: Map<UnitId, number>;
  projectiles: { id: string; from: GridPos; to: GridPos; start: number; duration: number }[];
  hitStopUntil: number;
}

export class CombatPresentationQueue {
  private queue: CombatEvent[] = [];
  readonly state: PresentationState = {
    moveTweens: new Map(),
    hitFlashes: new Map(),
    shieldPulses: new Map(),
    dissolves: new Map(),
    projectiles: [],
    hitStopUntil: 0,
  };

  bind(controller: CombatController): void {
    controller.events.on("cardPlayed", (p) => this.push({ kind: "card_played", casterId: p.casterId, target: p.target }));
    controller.events.on("unitMoved", (p) => this.push({ kind: "unit_moved", unitId: p.unitId, from: p.from, to: p.to }));
    controller.events.on("damageDealt", (p) => this.push({ kind: "damage_dealt", defenderId: p.defenderId, amount: p.amount, heavy: p.amount >= 10 }));
    controller.events.on("shieldGained", (p) => this.push({ kind: "shield_gained", unitId: p.unitId, amount: p.amount }));
    controller.events.on("statusApplied", (p) => this.push({ kind: "status_applied", unitId: p.unitId, status: p.status, stacks: p.stacks }));
    controller.events.on("enemyIntentResolved", (p) => this.push({ kind: "enemy_intent_resolved", enemyId: p.enemyId, intentKind: p.intentKind }));
    controller.events.on("unitDied", (p) => this.push({ kind: "unit_died", unitId: p.unitId }));
  }

  push(event: CombatEvent): void {
    this.queue.push(event);
  }

  update(now: number, shakeStrength: number): void {
    const e = this.queue.shift();
    if (e) this.apply(e, now, shakeStrength);
    for (const [id, until] of this.state.hitFlashes) if (now > until) this.state.hitFlashes.delete(id);
    for (const [id, until] of this.state.shieldPulses) if (now > until) this.state.shieldPulses.delete(id);
    for (const [id, until] of this.state.dissolves) if (now > until) this.state.dissolves.delete(id);
    this.state.projectiles = this.state.projectiles.filter((p) => now <= p.start + p.duration);
    for (const [id, tween] of this.state.moveTweens) if (now > tween.start + tween.duration) this.state.moveTweens.delete(id);
  }

  private apply(event: CombatEvent, now: number, shakeStrength: number): void {
    switch (event.kind) {
      case "unit_moved":
        this.state.moveTweens.set(event.unitId, { from: event.from, to: event.to, start: now, duration: 160 });
        break;
      case "damage_dealt":
        this.state.hitFlashes.set(event.defenderId, now + 140);
        if (event.heavy) this.state.hitStopUntil = now + 60;
        break;
      case "shield_gained":
        this.state.shieldPulses.set(event.unitId, now + 220);
        break;
      case "status_applied":
        this.state.shieldPulses.set(event.unitId, now + 150);
        break;
      case "unit_died":
        this.state.dissolves.set(event.unitId, now + 500);
        break;
      case "enemy_intent_resolved":
      case "card_played":
      case "reward_gained":
        if (shakeStrength > 0.01) this.state.hitStopUntil = Math.max(this.state.hitStopUntil, now);
        break;
    }
  }
}
