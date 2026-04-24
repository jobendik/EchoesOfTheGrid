import { makeId } from "../../core/Id.js";
import type { GridPos } from "../../core/Types.js";
import { ENEMY_MAP } from "../../data/enemies.js";
import { HERO_MAP } from "../../data/heroes.js";
import type { Unit } from "./UnitTypes.js";

/** Factory helpers for spawning heroes and enemies at runtime. */

export function createHero(heroClass: "vanguard" | "riftblade" | "signalist", pos: GridPos): Unit {
  const bp = HERO_MAP.get(heroClass);
  if (!bp) throw new Error(`Unknown hero class: ${heroClass}`);
  return {
    id: makeId("hero"),
    side: "player",
    name: bp.name,
    heroClass,
    maxHp: bp.maxHp,
    hp: bp.maxHp,
    pos,
    statuses: {},
    dead: false,
    spriteKey: bp.spriteKey,
    moveRange: bp.moveRange,
    tags: ["hero"],
  };
}

export function createEnemy(enemyKind: string, pos: GridPos, hpOverride?: number): Unit {
  const bp = ENEMY_MAP.get(enemyKind);
  if (!bp) throw new Error(`Unknown enemy kind: ${enemyKind}`);
  return {
    id: makeId("enemy"),
    side: "enemy",
    name: bp.name,
    enemyKind,
    maxHp: hpOverride ?? bp.maxHp,
    hp: hpOverride ?? bp.maxHp,
    pos,
    statuses: {},
    dead: false,
    spriteKey: bp.spriteKey,
    moveRange: bp.moveRange,
    attackRange: bp.attackRange,
    attackDamage: bp.attackDamage,
    behaviorProfile: bp.behaviorProfile,
    tags: bp.tags.slice(),
  };
}
