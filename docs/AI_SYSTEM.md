# AI System

## Goals

The enemy AI has two non-negotiable design goals:

1. **Readability.** A player should *always* be able to predict what an enemy will do next, from glancing at the intent icon alone, and understand *why* it chose that action by hovering for a moment. No hidden state, no surprise combos.
2. **Authorability.** A content designer adding a new enemy should not write a behavior tree or state machine. They pick a **behavior profile** (e.g. "bruiser", "sniper", "bomber", "warden") and override a few weights.

## Approach: utility-based intent planning

Each enemy, on the turn boundary, emits a single **Intent** for its *next* turn. An intent is:

```ts
interface Intent {
  enemyId: UnitId;
  kind: "attack" | "rangedAttack" | "aoe" | "move" | "buff" | "debuff" | "summon" | "wait";
  targetUnitId?: UnitId;
  targetTile?: GridPos;
  predictedDamage?: number;
  affectedTiles: GridPos[];
  icon: string;         // shown on the grid & enemy list
  reason: string;       // tooltip: human-readable explanation
}
```

On its turn, the enemy **executes** exactly the intent it previously committed to — so the player's plan cannot be invalidated by a last-second change. After execution, the enemy plans its next intent based on the new board state.

## Planner

`IntentPlanner.planIntent(enemy, state)` scores a small number of **candidate actions** derived from the enemy's behavior profile and the current board, then picks the highest-utility option.

```
for each behavior-specific action template (attack, approach, flank, heal_ally, charge_aoe, retreat, ...):
    score = base_score
          + profile_weights[action]
          + situational_modifiers(board, enemy, target)
          - cooldown_penalty
    if score > best.score:  best = {action, score, reason}
return best
```

Situational modifiers include:

- Distance to target (preferred band for ranged/melee).
- Whether the target is in cover, vulnerable, low-HP, isolated.
- Whether the AoE would hit multiple heroes.
- Whether the enemy is at low HP and has a retreat/heal option.
- Telegraphed mega-attacks that must be charged this turn.

Each scoring branch writes a short human-readable string to `reason`. Examples:

- *"Target is adjacent and vulnerable — committing to a bite."*
- *"Two heroes clustered on the east flank — charging a plasma volley."*
- *"Low HP and a healer ally is in range — retreating and pinging for support."*

These strings surface in the enemy hover tooltip and in the debug overlay (`` ` ``/F1).

## Behavior profiles

Profiles live next to enemy definitions in `src/data/enemies.ts`. Each profile picks an action set and a small weight vector:

- `drone` — weak ranged harassment, keeps distance.
- `brute` — charges melee; ignores cover.
- `sniper` — prefers maximum range and LoS; stuns on crit.
- `bomber` — self-destructs adjacent to multiple heroes.
- `leaper` — jumps to flank isolated heroes.
- `warden` — defensive caster; buffs allies and lays traps.
- `parasite` — attaches to heroes, deals poison ticks.
- `sentinel` — retaliation-focused tank.
- `shield_bearer` — grants shield to nearby allies.
- `boss` — multi-phase with telegraphed wind-ups (telegraphs render as dashed orange tiles on the grid).

## Telegraphs

Some actions — especially boss attacks and bomber fuses — resolve on a later turn via the `Telegraph` system. A telegraph is a scheduled effect with a preview pattern on the grid. Players see the affected tiles the turn *before* the hit, so the threat is always tradeable:

- Move out of the zone, or
- Take the hit to preserve board control, or
- Kill the caster before it resolves.

## Why not a behavior tree?

Behavior trees are powerful but hard to tune across many enemy types — small changes to a shared subtree ripple unpredictably. Utility scoring is:

- **Compositional** — add a new modifier once, all actions benefit.
- **Inspectable** — the winning action's `reason` string is a free debug log.
- **Cheap** — we evaluate a handful of candidates per enemy per turn (the grid is small).

For a 6–12 enemy-type prototype, the trade-off is decisively in favour of utility scoring.

## Extending

1. Add a new profile id to `BehaviorProfile`.
2. Teach the planner about its candidate actions and weight overrides.
3. Point an enemy in `src/data/enemies.ts` at the new profile.
4. Write a sentence or two of `reason` strings for its action branches — this is the *design contract* with the player.
