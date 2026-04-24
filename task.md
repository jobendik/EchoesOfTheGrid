You are an expert senior game developer, technical director, TypeScript engineer, gameplay systems architect, UI/UX designer, and portfolio-focused software engineer.

Your task is to create a professional, polished, impressive tactical roguelike deckbuilder game prototype.

This is not a toy demo.

This project is intended to become a serious GitHub portfolio piece for a developer presenting themselves as a Gameplay Developer with strengths in gameplay systems, AI, multiplayer/real-time systems, technical architecture, and browser-based games.

The final result must impress both:
1. players who open the live demo, and
2. developers/employers who inspect the repository, code architecture, README, and extensibility.

The game should feel like a real small indie prototype, not a basic tutorial project.

The game should be built professionally with TypeScript and a clean modular file/folder structure.

You may choose the most appropriate web game technology stack, but the project must be:
- TypeScript-based
- browser-playable
- easy to run locally
- easy to deploy to GitHub Pages
- structured like a professional game project
- easy to expand with real assets later
- understandable to other developers
- portfolio-quality

Preferred stack:
- TypeScript
- Vite
- HTML/CSS
- Canvas or PixiJS or Phaser or a custom rendering layer
- No heavy backend
- No unnecessary framework complexity unless justified
- LocalStorage or IndexedDB for save/load
- Web Audio API or audio library if needed

The game must be playable in the browser.

The project must include:
- Complete source code
- Professional folder structure
- README.md
- ASSETS.md
- architecture documentation
- asset placeholder system
- data-driven cards/enemies/encounters
- clean build scripts
- GitHub Pages deployment readiness

The project should be called:

“Echoes of the Grid”

You may choose a better name if you have a stronger idea, but keep the tone:
- tactical
- mysterious
- stylish
- readable
- system-driven
- portfolio-friendly

============================================================
HIGH-LEVEL GAME CONCEPT
============================================================

Create a tactical roguelike deckbuilder where the player commands a small squad on a grid-based battlefield using cards.

The game should combine ideas from:
- Slay the Spire: deckbuilding, energy, card rewards, relics, run progression
- Into the Breach: grid-based tactics, readable enemy intent, positioning
- Darkest Dungeon: party pressure, status effects, danger escalation
- Monster Train / Across the Obelisk: party-based card combat
- Balatro: clarity, polish, juicy UI feedback, satisfying interaction loops

Do not clone any one game directly.

The game should have its own identity.

Core fantasy:
The player controls a small squad of “Echo Runners” entering unstable tactical simulations called “Grids.” Each encounter is a compact tactical battle. Cards represent commands, abilities, maneuvers, reactions, and special tech. Enemies telegraph their intentions, allowing the player to outmaneuver them through clever positioning, timing, and card play.

The player should feel smart when they:
- push enemies into hazards
- dodge predicted attacks
- chain cards together
- protect low-health allies
- manipulate enemy intent
- use terrain strategically
- upgrade the deck between battles
- build synergies over a run

============================================================
PORTFOLIO GOALS
============================================================

This project must demonstrate strong professional skills:

1. Gameplay systems
- deterministic turn structure
- clean card effect resolution
- grid combat
- targeting rules
- status effects
- action queues
- enemy intent
- encounter flow
- combat previews
- run progression

2. AI
- enemy intent generation
- tactical target selection
- pathfinding on grid
- utility-based decisions
- readable decision reasons
- optional AI debug overlay

3. Architecture
- modular TypeScript systems
- data-driven definitions
- clear separation of rendering, simulation, input, UI, and data
- testable pure gameplay logic where reasonable
- avoid huge monolithic files
- avoid spaghetti state mutation

4. UI/UX
- polished card hand
- readable grid
- enemy intent indicators
- hover tooltips
- damage previews
- targeting previews
- combat log
- reward screens
- map/progression screen
- save/load menu
- settings menu

5. Extensibility
- easy to add cards
- easy to add enemies
- easy to add relics
- easy to add encounters
- easy to replace placeholder assets with real PNG/SVG/audio assets

6. Professional repository quality
- good README
- clean folder structure
- ASSETS.md describing required production assets
- comments where useful
- consistent naming
- meaningful types/interfaces
- no unexplained magic numbers
- no broken references
- no missing assets
- no console spam
- no TypeScript errors

============================================================
IMPORTANT GAMEPLAY REQUIREMENTS
============================================================

The game must be a complete playable prototype.

It does not need to be huge, but it must feel coherent, polished, and replayable.

Minimum playable scope:

- Main menu
- New Run
- Continue Run
- Tutorial/help overlay
- Combat scene
- Reward screen
- Run map / encounter selection
- Card upgrade or deck modification screen
- Victory/defeat screen
- Save/load support
- Settings screen

The player should be able to complete a short run of approximately 5–8 encounters.

The game should include enough content to demonstrate depth:

Player squad:
- 3 playable heroes
- Each hero has unique role, stats, and starting cards
- Heroes occupy grid cells
- Heroes can be damaged, shielded, moved, buffed, debuffed
- If all heroes die, the run is lost

Suggested heroes:
1. Vanguard
   - durable frontliner
   - shield, push, guard, taunt
2. Riftblade
   - mobile striker
   - dash, backstab, combo attacks
3. Arcanist / Signalist
   - support/control
   - mark enemies, apply shock, manipulate cards, heal/shield

Cards:
- At least 35–50 cards total
- Cards must be data-driven
- Cards should include common, uncommon, rare, and starter cards
- Cards should include attacks, movement, defense, support, control, area effects, reactions, and utility
- Cards should support upgrades
- Cards should have clear metadata:
  - id
  - name
  - cost
  - rarity
  - type
  - owner/class
  - description
  - targeting mode
  - range
  - effect list
  - upgrade changes
  - tags
  - placeholder art key

Deck system:
- Draw pile
- Hand
- Discard pile
- Exhaust pile
- Energy per turn
- Card draw per turn
- End turn discard
- Shuffle discard into draw pile
- Temporary cards
- Exhausting cards
- Upgraded card variants

Combat:
- Turn-based
- Player turn and enemy turn
- Grid-based battlefield
- 8x8 or 10x8 grid
- Movement and positioning matter
- Attack previews
- Range previews
- Area-of-effect previews
- Enemy intent visible before player commits actions
- Hazards and terrain matter
- Combat ends when enemies are defeated or squad dies

Grid/terrain:
- Walkable tiles
- Blocked tiles
- Hazard tiles
- Cover tiles
- Objective tiles if useful
- Optional destructible objects
- Optional height/elevation if simple and readable

Enemy system:
- At least 10 enemy types
- Each enemy has:
  - stats
  - movement
  - attack range
  - behavior profile
  - intent generation
  - visual intent indicator
  - tooltip explaining what it will do
- Enemy examples:
  - Drone: weak ranged attacker
  - Brute: slow melee heavy hitter
  - Sniper: long-range telegraphed attack
  - Shieldbearer: protects allies
  - Leaper: jumps toward backline
  - Bomber: targets area with delayed explosion
  - Warden: buffs allies
  - Parasite: applies debuffs
  - Sentinel: overwatch attack if player moves in range
  - Boss / Elite: multi-intent enemy with phases

Enemy AI:
- Must not be random-only
- Use clear tactical logic
- Each enemy should evaluate:
  - nearest valid target
  - weakest target
  - best attack position
  - whether to move, attack, guard, buff, or prepare special ability
- AI intent should be computed before the player acts
- Enemy decisions should include a human-readable reason string for debug/tooltip
- Include optional debug overlay:
  - show chosen target
  - show path
  - show intent reason
  - show threat tiles

Status effects:
Include a robust status effect system with at least:
- Shield / Block
- Vulnerable
- Weak
- Poison/Bleed/Burn
- Marked
- Stunned
- Rooted
- Strength / Power
- Fragile
- Retaliate / Thorns
- Regeneration

Status effects should be extensible and not hardcoded everywhere.

Relics / passive modifiers:
- At least 15 relics/passives
- Rewarded after elite/boss encounters or special events
- Modify gameplay in interesting ways
- Examples:
  - First attack each turn deals +2 damage
  - Start combat with +1 energy
  - Draw 1 extra card when an enemy is pushed
  - Gain shield when playing movement cards
  - Poison also reduces enemy damage
  - Once per combat, prevent lethal damage
  - Cards with cost 0 deal +1 damage
  - At end of turn, deal 1 damage to all marked enemies

Run progression:
- Short branching map
- Player chooses next encounter
- Encounter types:
  - Normal combat
  - Elite combat
  - Rest/repair
  - Upgrade station
  - Event
  - Boss
- Runs should be replayable with a seed
- The game should track current node, deck, relics, hero HP, and progress

Events:
- Include at least 5 simple text-based events
- Events should offer meaningful choices:
  - gain card but lose HP
  - upgrade a card
  - remove a card
  - gain relic but add curse
  - heal or receive gold/resource
- Events should be data-driven if reasonable

Economy:
Optional, but if included:
- Credits/scrap as currency
- Shops or upgrade stations
- Buy cards/relics/remove cards

Save/load:
- Save current run to localStorage
- Continue from main menu
- Save data should include:
  - run seed
  - deck
  - upgraded cards
  - relics
  - hero HP
  - current map node
  - completed encounters
  - settings
- Include “Reset Save” option
- Use versioned save data to support future changes

============================================================
PRESENTATION AND POLISH REQUIREMENTS
============================================================

The game should look impressive even with placeholder assets.

Style direction:
- dark tactical sci-fi fantasy
- clean high-contrast UI
- glowing grid highlights
- readable silhouettes
- card-focused presentation
- polished but not overcomplicated
- strong feedback on every action

Visual quality should rely on:
- strong layout
- typography
- colors
- motion
- particles
- UI animations
- hover states
- hit effects
- screen shake used lightly
- floating damage numbers
- clean icons
- readable cards
- polished transitions

Do not rely on expensive art.

Placeholder assets should be simple but elegant:
- generated SVGs
- simple geometric icons
- CSS gradients
- Canvas-drawn shapes
- color-coded units
- symbolic card art
- procedural background
- placeholder sound effects if possible

The placeholder system must be asset-ready:
- All assets referenced through a centralized asset manifest
- No hardcoded scattered paths
- Placeholder art should be easily replaceable by PNG/SVG files
- Cards must have `artKey`
- Units must have `spriteKey`
- Effects must have `vfxKey` where appropriate
- Audio events must have `sfxKey`
- UI icons must have `iconKey`

The code should be prepared for real assets such as:
- card art PNGs
- unit sprites
- tile sprites
- effect sprites
- UI icons
- music loops
- sound effects

============================================================
USER EXPERIENCE REQUIREMENTS
============================================================

The player should always understand:
- whose turn it is
- how much energy they have
- what each card does
- which unit is selected
- where a card can be played
- what will happen if they play it
- what enemies intend to do
- how much damage is expected
- why they won or lost
- what reward they are choosing

Required UI elements:
- Top combat status bar
- Turn indicator
- Energy display
- Draw pile / discard pile counters
- End Turn button
- Player hand
- Card hover zoom/tooltip
- Hero panels with HP/status
- Enemy HP bars
- Enemy intent icons
- Combat log
- Targeting preview
- Tile hover info
- Damage/healing/shield numbers
- Reward selection screen
- Map screen
- Settings menu
- Save/continue controls

Card UI:
Each card should show:
- name
- cost
- type
- rarity color/frame
- owner/class indicator
- rules text
- tags
- placeholder art
- upgraded state
- clear hover details

Combat log:
Should display important actions:
- card played
- damage dealt
- status applied
- enemy intent
- enemy action
- deaths
- relic triggers

Tooltips:
Tooltips should explain:
- status effects
- keywords
- intents
- terrain
- relics
- card tags

============================================================
TECHNICAL ARCHITECTURE REQUIREMENTS
============================================================

Use professional TypeScript architecture.

Avoid a single giant file.

Suggested folder structure:

/src
  /app
    main.ts
    GameApp.ts
    config.ts

  /core
    EventBus.ts
    RNG.ts
    Id.ts
    Types.ts
    Logger.ts
    Time.ts
    SaveVersion.ts

  /engine
    GameLoop.ts
    InputManager.ts
    AssetManager.ts
    SceneManager.ts
    Camera2D.ts
    AudioManager.ts

  /game
    /state
      GameState.ts
      RunState.ts
      CombatState.ts
      SaveState.ts

    /combat
      CombatController.ts
      TurnManager.ts
      ActionQueue.ts
      TargetingSystem.ts
      DamageSystem.ts
      MovementSystem.ts
      StatusSystem.ts
      IntentSystem.ts
      CombatResolver.ts
      ThreatMap.ts

    /grid
      Grid.ts
      Tile.ts
      GridPosition.ts
      Pathfinding.ts
      LineOfSight.ts
      AreaPatterns.ts

    /cards
      CardTypes.ts
      CardInstance.ts
      CardDatabase.ts
      CardEffects.ts
      CardEvaluator.ts
      DeckManager.ts
      CardUpgradeSystem.ts

    /units
      UnitTypes.ts
      Unit.ts
      HeroDatabase.ts
      EnemyDatabase.ts
      UnitFactory.ts

    /ai
      EnemyAI.ts
      UtilityAI.ts
      IntentPlanner.ts
      BehaviorProfiles.ts
      AIDebugInfo.ts

    /relics
      RelicTypes.ts
      RelicDatabase.ts
      RelicSystem.ts

    /encounters
      EncounterTypes.ts
      EncounterDatabase.ts
      EncounterGenerator.ts
      MapGenerator.ts
      EventDatabase.ts

    /progression
      RewardSystem.ts
      RunMapSystem.ts
      EconomySystem.ts
      DifficultyScaler.ts

  /data
    cards.ts
    enemies.ts
    heroes.ts
    relics.ts
    encounters.ts
    events.ts
    keywords.ts
    assets.ts
    balance.ts

  /render
    Renderer.ts
    RenderLayers.ts
    GridRenderer.ts
    UnitRenderer.ts
    CardRenderer.ts
    VFXRenderer.ts
    ParticleSystem.ts
    AnimationSystem.ts

  /ui
    UIManager.ts
    MainMenu.ts
    CombatHUD.ts
    CardHandView.ts
    CardTooltip.ts
    UnitPanel.ts
    CombatLogView.ts
    RewardScreen.ts
    RunMapScreen.ts
    SettingsScreen.ts
    DebugOverlay.ts

  /styles
    base.css
    layout.css
    combat.css
    cards.css
    menus.css
    tooltips.css
    debug.css

  /assets
    /placeholders
      placeholder-card.svg
      placeholder-hero.svg
      placeholder-enemy.svg
    asset-manifest.ts

  /tests
    cardEffects.test.ts
    pathfinding.test.ts
    statusSystem.test.ts
    saveLoad.test.ts

/public
  /assets
    /cards
    /units
    /tiles
    /ui
    /audio
    /music

/docs
  ARCHITECTURE.md
  ASSETS.md
  GAMEPLAY.md
  CARD_SYSTEM.md
  AI_SYSTEM.md

Root files:
- package.json
- vite.config.ts
- tsconfig.json
- index.html
- README.md
- ASSETS.md
- LICENSE
- .gitignore

You may adjust the structure if there is a better professional reason, but the final structure must be clean, modular, and understandable.

============================================================
CODE QUALITY REQUIREMENTS
============================================================

The code must:
- compile with TypeScript
- avoid `any` unless absolutely necessary
- define clear interfaces and types
- separate data from logic
- separate simulation from rendering where possible
- use deterministic RNG for runs
- use clean naming
- avoid deeply nested spaghetti logic
- avoid huge files
- keep UI readable and maintainable
- handle errors gracefully
- avoid broken asset references
- avoid missing imports
- avoid circular dependencies where possible
- use comments for important systems, not for obvious syntax
- include enough documentation that another developer can extend it

Implement important gameplay logic as mostly pure functions where feasible:
- card effect resolution
- pathfinding
- target validation
- status ticking
- damage calculation
- intent evaluation
- reward generation

The game should not break if:
- player clicks invalid target
- player ends turn with cards in hand
- enemy has no valid target
- card has no valid target
- save data is missing or old
- asset path fails
- screen is resized

============================================================
DATA-DRIVEN CARD SYSTEM
============================================================

The card system is one of the most important parts.

Cards should be defined in data, not hardcoded one by one in UI logic.

Example card definition shape:

interface CardDefinition {
  id: CardId;
  name: string;
  classId: HeroClassId | "neutral";
  rarity: "starter" | "common" | "uncommon" | "rare" | "curse";
  type: "attack" | "skill" | "power" | "movement" | "tactic";
  cost: number;
  upgradedCost?: number;
  targeting: TargetingDefinition;
  effects: CardEffectDefinition[];
  upgradedEffects?: CardEffectDefinition[];
  tags: CardTag[];
  keywords: KeywordId[];
  description: string;
  upgradedDescription?: string;
  artKey: AssetKey;
}

Targeting examples:
- self
- ally
- enemy
- tile
- emptyTile
- unitOrTile
- line
- cone
- radius
- allEnemies
- allAllies

Effect examples:
- dealDamage
- gainShield
- applyStatus
- moveUnit
- push
- pull
- drawCards
- gainEnergy
- exhaust
- createCard
- modifyCardCost
- heal
- mark
- stun
- addRetain
- summonHazard
- triggerRelicEvent

The effect resolver should be generic enough that adding a new card mostly means adding data.

Include a clear card database with at least 35–50 cards.

Create cards with synergy:
- movement cards trigger bonuses
- marked enemies take extra damage
- push cards interact with hazards
- shield cards interact with retaliation
- poison/burn builds
- low-cost combo cards
- expensive powerful rare cards
- hero-specific cards
- neutral cards

============================================================
EXAMPLE CARD IDEAS
============================================================

Include cards like these or better:

Starter:
- Strike: Deal 6 damage.
- Guard: Gain 5 Shield.
- Step: Move 2 tiles.
- Quick Shot: Deal 4 damage at range.
- Patch Wound: Heal an ally for 4.

Vanguard:
- Shield Bash: Deal damage equal to half Shield. Push 1.
- Hold the Line: Gain Shield. Adjacent allies gain Shield.
- Taunting Signal: Apply Taunted/Marked to enemies in radius.
- Iron Wall: Until next turn, reduce incoming damage.
- Counterstance: Gain Retaliate.

Riftblade:
- Blink Strike: Move up to 3 tiles, then deal 8 damage.
- Backline Cut: Deal bonus damage if attacking from behind or flank.
- Momentum: Draw a card if you moved this turn.
- Phase Step: Move through enemies.
- Finisher: Deal high damage if target is below 50% HP.

Signalist:
- Mark Target: Apply Marked.
- Chain Spark: Deal damage and jump to nearby enemy.
- Reboot: Draw 2 cards. Exhaust.
- Barrier Field: Shield all allies in radius.
- Overclock: Gain energy but apply Fragile.

Neutral:
- Grenade: Deal AoE damage.
- Suppressing Fire: Apply Weak in a cone.
- Emergency Battery: Gain 2 energy. Exhaust.
- Field Kit: Heal and remove one debuff.
- Tactical Swap: Swap positions of two allies.
- Static Mine: Place hazard.
- Scan: Reveal enemy intent and draw 1.

Rare:
- Singularity: Pull all enemies toward target tile, then damage.
- Time Fracture: Take an extra player action phase with reduced draw.
- Orbital Lance: Huge delayed line attack.
- Perfect Formation: All allies gain Shield and Strength.
- System Crash: Stun all damaged enemies.

Curses:
- Glitch: Unplayable. When drawn, lose 1 energy.
- Static Noise: Clutters hand.
- Fractured Signal: Randomly increases card cost this turn.

============================================================
ENEMY INTENT SYSTEM
============================================================

Enemy intent is critical.

Each enemy should plan its next action at the start of the player turn or after major changes if needed.

Intents must be visible.

Intent examples:
- Attack hero X for N damage
- Move toward hero X
- Attack area
- Buff ally
- Shield self
- Summon hazard
- Charge heavy attack
- Explode next turn
- Overwatch
- Retreat

Intent display:
- icon above enemy
- tooltip on hover
- highlighted targeted tiles
- targeted hero indicator
- combat log entry if useful

Each intent should include:
- type
- target unit or tile
- predicted damage
- area pattern if any
- confidence/priority if useful
- reason string

Example reason strings:
- “Nearest vulnerable hero in range”
- “Highest damage line attack hits 2 heroes”
- “Low health: retreating toward cover”
- “Protecting elite ally”
- “Preparing area attack on clustered heroes”

This is excellent for employer-facing demonstration of AI clarity.

============================================================
AI DEBUG OVERLAY
============================================================

Include a toggleable debug overlay.

This should impress developers.

The debug overlay should show:
- enemy planned target
- pathfinding route
- threat map
- attack ranges
- AI decision score/reason
- blocked tiles
- valid move tiles
- line of sight if implemented
- current seed
- current turn number

Keep it visually clean and optional.

Hotkey:
- F1 or backtick toggles debug overlay

============================================================
TACTICAL GRID REQUIREMENTS
============================================================

Grid should support:
- cell coordinates
- occupied cells
- blocked cells
- hazard cells
- cover cells
- pathfinding
- range queries
- area patterns
- line/cone/radius effects
- target validation
- hover preview

Pathfinding:
- Implement A* or BFS depending on terrain complexity
- Movement should avoid blocked and occupied cells
- Enemies should be able to path toward reachable cells
- If no path exists, AI should choose fallback behavior

Area patterns:
- single target
- radius
- cross
- line
- cone if feasible
- adjacent tiles
- all units in row/column if useful

============================================================
COMBAT RESOLUTION REQUIREMENTS
============================================================

Combat flow:

1. Start combat
2. Generate battlefield
3. Spawn heroes
4. Spawn enemies
5. Shuffle deck
6. Draw starting hand
7. Generate enemy intents
8. Player turn:
   - draw cards
   - gain energy
   - play cards
   - move/attack/support
   - preview effects before committing
   - end turn
9. Enemy turn:
   - resolve enemy intents
   - move enemies
   - attack
   - apply statuses
   - generate new intents
10. Check win/loss
11. Reward screen
12. Return to run map

The player should not be forced to move heroes manually unless through cards, unless you design a separate limited move action. Prefer card-driven tactics.

Damage system:
- Base damage
- Modifiers from Strength/Weak/Vulnerable/Marked
- Shield absorbs damage
- HP loss
- Floating numbers
- death handling
- relic/status triggers

Status ticking:
- start of turn
- end of turn
- on hit
- on move
- on card played
- on damage taken
- on kill

Action queue:
- Use an action queue for readable sequential resolution
- Cards and enemy actions should animate/resolve step by step
- Keep it fast but understandable

============================================================
REWARD AND PROGRESSION REQUIREMENTS
============================================================

After combat:
- Present 3 card rewards
- Option to skip card
- Occasionally offer relic
- Occasionally offer upgrade/remove/heal
- Show clear comparison/tooltip
- Add selected card to deck

Card upgrades:
- Upgrade modifies card numbers, cost, effects, or keywords
- Upgraded card should visually show improved state
- Avoid creating hardcoded duplicate mess if possible

Run map:
- Generate small branching graph
- Nodes have encounter type
- Player selects connected next node
- Show future node types
- Boss at end
- Save after node completion

Difficulty:
- Later encounters should be harder
- Elites should be noticeably dangerous
- Boss should have unique mechanics

============================================================
CONTENT REQUIREMENTS
============================================================

Minimum content:

Heroes:
- 3 heroes

Cards:
- 35–50 cards

Enemies:
- 10 enemies

Relics:
- 15 relics

Encounters:
- 12+ possible encounter definitions
- At least 1 boss
- At least 3 elite encounters

Events:
- 5+ event definitions

Terrain:
- 5+ terrain/tile types:
  - normal
  - blocked
  - hazard
  - cover
  - unstable/energy tile
  - optional healing tile or objective tile

Keywords:
- Create a keyword dictionary for tooltips:
  - Shield
  - Marked
  - Weak
  - Vulnerable
  - Burn
  - Poison
  - Stun
  - Retain
  - Exhaust
  - Push
  - Pull
  - Overwatch
  - Retaliate

============================================================
VISUAL DESIGN DIRECTION
============================================================

The game should have a consistent aesthetic.

Suggested theme:
- dark sci-fi tactical simulation
- neon accents
- holographic grid
- stylized cards
- elegant UI
- clear silhouettes
- glowing intents
- subtle particle effects
- atmospheric background

Color roles:
- Player heroes: blue/cyan/teal
- Enemies: red/orange/purple
- Hazard: orange/red
- Shield: blue
- Poison: green
- Burn: orange
- Marked: yellow
- Rare cards: purple/gold
- UI panels: dark navy/charcoal
- Grid highlights: cyan/white
- Invalid target: red

Use CSS variables for theme colors.

The game should look good in screenshots.

Do not make the UI noisy.

Readability is more important than flashy effects.

============================================================
AUDIO REQUIREMENTS
============================================================

Include an audio system even if placeholder sounds are simple.

Audio events should be centralized:
- card hover
- card select
- card play
- invalid action
- damage hit
- shield gain
- heal
- enemy attack
- enemy death
- reward select
- map node select
- victory
- defeat

If real audio files are not available, implement simple generated placeholder tones using Web Audio API.

The system must be ready to replace placeholder sounds with actual audio files later.

Music:
- Optional generated ambient loop
- Or placeholder silent system with documented asset slots

Do not include broken external audio references.

============================================================
ASSET SYSTEM REQUIREMENTS
============================================================

Create a centralized asset manifest.

Example:

export const AssetManifest = {
  cards: {
    strike: {
      placeholder: "generated",
      productionPath: "/assets/cards/strike.png"
    }
  },
  units: {
    vanguard: {
      placeholder: "generated",
      productionPath: "/assets/units/heroes/vanguard.png"
    }
  },
  audio: {
    cardPlay: {
      placeholder: "generated-tone",
      productionPath: "/assets/audio/sfx/card-play.wav"
    }
  }
};

All visual/audio references should go through this or an equivalent system.

Placeholder assets should:
- not crash if production files are missing
- look acceptable
- be visually consistent
- be easy to replace

============================================================
ASSETS.md REQUIREMENTS
============================================================

You must create a detailed ASSETS.md file.

This file is very important.

It should describe exactly what real assets should be created or purchased to make the game look and sound professional.

ASSETS.md must include:

1. Asset philosophy
- What style the game needs
- How assets should support readability
- Why consistent silhouettes matter
- Why card art must not reduce legibility

2. Folder structure
Recommended final production asset paths:
- /public/assets/cards/
- /public/assets/units/heroes/
- /public/assets/units/enemies/
- /public/assets/tiles/
- /public/assets/vfx/
- /public/assets/ui/
- /public/assets/audio/sfx/
- /public/assets/audio/music/
- /public/assets/fonts/

3. Card art requirements
Describe:
- resolution
- aspect ratio
- transparent or full-frame
- file format
- naming convention
- style guide
- rarity frame considerations
- how to create artKey mappings

Recommended:
- 512x768 PNG or WebP for card illustrations
- 1024x1536 for source art if possible
- consistent lighting and palette
- no tiny unreadable details
- strong silhouettes

4. Unit sprite requirements
Describe:
- heroes
- enemies
- idle poses
- hit frames
- death frames if needed
- directional requirements if any
- recommended resolution
- format
- naming

For this prototype:
- static or lightly animated sprites are enough
- 256x256 or 512x512 PNG/WebP per unit
- transparent background
- optional sprite sheets later

5. Tile and battlefield assets
Describe:
- tile types
- normal tile
- blocked tile
- hazard tile
- cover tile
- objective tile
- grid overlays
- recommended sizes
- seamless or non-seamless requirements

6. UI assets
Describe:
- icons
- intent icons
- status icons
- card frames
- buttons
- panels
- map node icons
- energy icon
- health/shield icons
- keyword icons

7. VFX assets
Describe:
- impact flashes
- slash
- projectile
- explosion
- shield pulse
- heal pulse
- poison cloud
- burn effect
- teleport/blink
- card play burst

8. Audio assets
Describe:
- UI sounds
- card sounds
- combat sounds
- movement sounds
- enemy sounds
- victory/defeat
- ambience
- music loops

Include recommended formats:
- WAV for source/high quality
- OGG/MP3 for web deployment
- normalized volume
- short UI sounds under 1 second
- loopable music 1–3 minutes

9. Music direction
Describe:
- ambient tactical sci-fi
- low intensity combat loop
- boss loop
- victory sting
- defeat sting
- map/menu ambience

10. Asset replacement guide
Explain:
- how to replace placeholder assets
- how to update asset manifest
- how card art keys map to card definitions
- how unit sprite keys map to unit definitions
- what to do if an asset is missing

11. Asset checklist
Include a production checklist:
- 50 card illustrations
- 3 hero portraits/sprites
- 10 enemy sprites
- 15 relic icons
- 20 status/keyword icons
- 10 intent icons
- 6 tile types
- 20 VFX sprites/animations
- 30 SFX
- 3–5 music loops/stingers

12. Licensing note
Explain:
- use only licensed, owned, or CC0 assets
- track source and license
- include attribution file if necessary
- avoid copyrighted game art from commercial games

============================================================
README.md REQUIREMENTS
============================================================

Create a professional README.md.

It should include:

- Project title
- Hero image/screenshot placeholder
- Live demo link placeholder
- Short pitch
- Why this project exists
- Gameplay summary
- Key features
- Technical highlights
- Architecture overview
- Systems demonstrated
- How to run locally
- How to build
- How to deploy to GitHub Pages
- Controls
- Screenshots/GIF placeholders
- Folder structure overview
- Future roadmap
- Portfolio note

The README should make the project look serious.

Include wording that emphasizes:
- data-driven card architecture
- tactical grid combat
- enemy intent AI
- utility-based decision-making
- modular TypeScript systems
- save/load
- extensible asset pipeline
- debug overlays
- professional UI/UX

============================================================
DOCUMENTATION REQUIREMENTS
============================================================

Create docs:

1. /docs/ARCHITECTURE.md
Explain:
- high-level architecture
- scene flow
- data flow
- state management
- simulation/rendering separation
- event bus
- save/load
- extension points

2. /docs/CARD_SYSTEM.md
Explain:
- card definitions
- card instances
- effect resolution
- targeting
- upgrades
- keywords
- examples of adding a new card

3. /docs/AI_SYSTEM.md
Explain:
- enemy behavior profiles
- intent planning
- utility scores
- pathfinding
- debug overlay
- how to add a new enemy behavior

4. /docs/GAMEPLAY.md
Explain:
- rules
- turn structure
- combat
- run progression
- encounters
- relics
- statuses

These docs should be concise but professional.

============================================================
TESTING REQUIREMENTS
============================================================

Include basic tests if practical.

At minimum, create testable pure functions and include example tests for:
- pathfinding
- card effect resolution
- damage calculation
- status ticking
- save/load serialization

Use Vitest if appropriate.

Do not overcomplicate, but having tests is a strong portfolio signal.

============================================================
BUILD AND DEPLOYMENT REQUIREMENTS
============================================================

Use Vite.

package.json should include:
- dev
- build
- preview
- test if tests are included
- typecheck

Example:
- npm install
- npm run dev
- npm run build
- npm run preview
- npm run typecheck
- npm run test

Include a GitHub Pages deployment workflow if reasonable:

.github/workflows/deploy.yml

The project must build to /dist.

Make sure asset paths work on GitHub Pages.

Use Vite base configuration carefully.

Consider:
- base: "./" for simple GitHub Pages compatibility
or document how to set base to repo name.

============================================================
CONTROLS
============================================================

Basic controls:
- Mouse hover: inspect cards, units, tiles
- Left click: select card, target tile/unit
- Right click or Escape: cancel selection
- End Turn button
- Space: end turn shortcut
- F1 or `: debug overlay
- M: mute
- S: save manually if needed
- Esc: menu/settings

Controls must be displayed in help/tutorial overlay.

============================================================
TUTORIAL REQUIREMENTS
============================================================

Include a simple tutorial overlay or guided first encounter.

Explain:
- play cards from hand
- energy
- targeting
- enemy intent
- shield
- movement
- end turn
- rewards

This can be a non-intrusive modal/help screen.

============================================================
PERFORMANCE REQUIREMENTS
============================================================

The game should run smoothly in browser.

Avoid:
- excessive DOM updates every frame
- unnecessary re-rendering
- huge particle counts
- memory leaks
- giant textures
- slow pathfinding every frame

Use event-driven UI updates where practical.

The game does not need to support thousands of units.

Target:
- desktop browser
- 60 FPS if possible
- responsive layout down to laptop screens

============================================================
RESPONSIVE DESIGN
============================================================

The game should work well at:
- 1920x1080
- 1600x900
- 1366x768

Mobile support is optional, but the layout should not completely break.

Prioritize desktop.

============================================================
POLISH DETAILS
============================================================

Add small polish touches:
- card hover lift
- card play animation
- selected card glow
- valid target highlight
- invalid target feedback
- enemy intent pulse
- smooth damage numbers
- shield shimmer
- hit flash
- subtle camera shake on heavy hits
- victory animation
- reward card reveal
- map node hover
- animated background particles
- sound feedback

Do not overdo animations to the point of hurting readability.

============================================================
PLACEHOLDER VISUAL IMPLEMENTATION
============================================================

Even without production art, make the game look good.

Use:
- CSS gradients
- SVG icons
- Canvas shapes
- generated card art
- procedural backgrounds
- clean typography
- glow effects
- rarity frames
- unit silhouettes
- grid lighting

Cards should not look like plain rectangles.

Units should not look like random circles if you can do better.

Create distinct placeholder visuals:
- Vanguard: shield-like silhouette
- Riftblade: angular blade silhouette
- Signalist: orb/signal silhouette
- Drone: small triangle/eye
- Brute: large blocky silhouette
- Sniper: long narrow silhouette
- Shieldbearer: shield icon
- Boss: larger animated symbol

============================================================
GAME FEEL REQUIREMENTS
============================================================

The game should feel satisfying.

Important:
- Every card play should produce immediate feedback
- Damage should be readable
- Enemy attacks should be telegraphed
- Big attacks should feel big
- Shielding should feel protective
- Movement should feel crisp
- Winning should feel rewarding
- Losing should feel fair

Use strong visual hierarchy:
- primary action area: grid
- secondary: hand/cards
- supporting: logs/panels
- never bury important information

============================================================
ERROR HANDLING REQUIREMENTS
============================================================

The game should handle:
- invalid card target
- insufficient energy
- no cards in draw pile
- no enemies alive
- no heroes alive
- enemy unable to move
- corrupted save
- old save version
- missing asset
- browser localStorage unavailable

Show user-friendly messages where needed.

============================================================
IMPLEMENTATION ORDER
============================================================

Build the project in this order:

1. Create Vite + TypeScript project structure.
2. Create core types and data models.
3. Implement grid, units, cards, statuses, and combat state.
4. Implement deterministic RNG.
5. Implement card database and deck manager.
6. Implement combat controller and turn manager.
7. Implement targeting and card effect resolver.
8. Implement enemy intent system and simple AI.
9. Implement rendering/UI for combat.
10. Implement card hand UI.
11. Implement tooltips and previews.
12. Implement reward system.
13. Implement run map.
14. Implement save/load.
15. Implement relic system.
16. Implement events.
17. Add polish: animations, particles, audio.
18. Add debug overlay.
19. Add documentation.
20. Add tests/typecheck.
21. Final cleanup and README.

Do not skip architecture.

Do not produce a single-file prototype.

This must be a professional multi-file TypeScript project.

============================================================
EXPECTED FINAL DELIVERABLE
============================================================

At the end, provide:

1. Full repository structure
2. All source files
3. package.json
4. vite.config.ts
5. tsconfig.json
6. index.html
7. README.md
8. ASSETS.md
9. docs files
10. optional tests
11. instructions for running the project
12. notes on how to replace placeholder assets
13. notes on how to deploy to GitHub Pages

The project should run with:

npm install
npm run dev

And build with:

npm run build

No missing imports.
No TypeScript compile errors.
No broken asset paths.
No placeholder TODOs for core gameplay.
No fake claims in README.
No incomplete “left as exercise” systems.

============================================================
QUALITY BAR
============================================================

This should be good enough that a developer reviewing the repository thinks:

“This person understands gameplay architecture.”

“This is more than a visual demo.”

“The card system is extensible.”

“The AI intent system is clear and readable.”

“The UI is polished enough for a prototype.”

“The codebase is organized professionally.”

“This could realistically become a real indie game.”

“This person can build systems, not just small isolated mechanics.”

============================================================
FINAL DESIGN TARGET
============================================================

The player should be able to:

- Start a new run
- Choose a path on the map
- Enter tactical combat
- Understand enemy intentions
- Use cards to move, attack, shield, push, pull, heal, and control
- Win fights through smart positioning
- Choose rewards
- Upgrade the deck
- Gain relics
- Continue the run
- Fight an elite or boss
- Save and continue later
- Inspect the debug overlay and understand the AI/system design

The repository should demonstrate:

- professional TypeScript
- clean modular architecture
- data-driven design
- tactical gameplay
- enemy AI
- UI/UX polish
- save/load
- asset pipeline readiness
- strong documentation
- portfolio-quality thinking

Build the complete project now.
