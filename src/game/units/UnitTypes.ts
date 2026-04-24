import type {
  AssetKey,
  ClassId,
  EnemyId,
  GridPos,
  HeroClassId,
  Side,
  UnitId,
} from "../../core/Types.js";
import type { StatusMap } from "../combat/StatusSystem.js";

/**
 * Runtime combat unit. Both heroes and enemies share this shape; they are
 * distinguished by `side` and whether they have a `heroClass` or
 * `enemyKind`. Keeping a single record type simplifies targeting and AI
 * code that treats all units uniformly.
 */
export interface Unit {
  id: UnitId;
  side: Side;
  name: string;
  /** Hero class id if side === 'player'. */
  heroClass?: HeroClassId;
  /** Enemy kind id if side === 'enemy'. */
  enemyKind?: EnemyId;
  maxHp: number;
  hp: number;
  pos: GridPos;
  statuses: StatusMap;
  /** True when the unit died this combat (kept for animations). */
  dead: boolean;
  /** Sprite / color key for rendering. */
  spriteKey: AssetKey;
  /** Basic movement the unit can make on its own turn. For heroes, most
   *  movement is card-driven; this is used by enemy AI. */
  moveRange: number;
  /** Attack range for enemy baseline attacks. Not used for heroes. */
  attackRange?: number;
  /** Enemy baseline damage for unplanned fallback attacks. */
  attackDamage?: number;
  /** Enemy behavior profile id (see BehaviorProfiles). */
  behaviorProfile?: string;
  /** Additional per-unit tags (boss, elite, etc.) for content gating. */
  tags: string[];
}

export interface HeroBlueprint {
  heroClass: HeroClassId;
  classId: ClassId;
  name: string;
  maxHp: number;
  moveRange: number;
  spriteKey: AssetKey;
  /** Ordered list of card ids the hero starts with. */
  startingDeck: readonly string[];
  shortDescription: string;
  /** Role tagline used in menus. */
  role: string;
}

export interface EnemyBlueprint {
  enemyKind: EnemyId;
  name: string;
  maxHp: number;
  moveRange: number;
  attackRange: number;
  attackDamage: number;
  behaviorProfile: string;
  spriteKey: AssetKey;
  tags: string[];
  /** One-line description for tooltips / debug. */
  description: string;
}
