# Design

The visual and product design language for the app. Read this when building any screen or component so the app stays coherent across phases. `CLAUDE.md` holds the rules; this holds the feel.

> The principles and anti-patterns are the parts worth keeping stable. The palette and type choices below are locked in — change them only deliberately.

## Product feel — the north star
The product is *spontaneous coordination*, not engagement. Every design choice should serve "help two people make a plan happen," not "keep someone in the app." Five principles:

1. **Coordination over engagement.** Success is a user closing the app to go do the thing. Never optimize for time-in-app, streaks, or scroll depth.
2. **Calm, not addictive.** No vanity metrics, no infinite dopamine loops, no fake urgency. The feed can run out — that's fine, an honest empty state beats manufactured content.
3. **The plan is the hero.** The activity is the unit of value; the UI centers the plan (what, when, roughly where), not profiles or social clout.
4. **Safety is visible, not bolted on.** Block/report are always reachable, location is clearly approximate, and the design never pressures someone into sharing more than they chose to.
5. **Low commitment, low pressure.** Joining is light, leaving is easy, and nothing about the UI shames a no-show or a small turnout.

## Tone & voice
Casual, direct, human. Short sentences. Talk like a friend suggesting something, not like a platform. Avoid corporate cheer, avoid hype, avoid exclamation overload.
- Buttons say what happens: "Join", "Post it", "I'm in", not "Submit" / "Confirm".
- Empty and error states are plain and kind: "Nothing nearby right now — try a wider radius or check back later," not "Oops! Something went wrong 😬".
- Never use urgency or guilt ("3 spots left, hurry!" / "Don't leave them hanging"). The product is low-pressure; the copy is too.

## Avoiding the generic look (read before touching palette/type)
"Doesn't look AI-generated" is a craft requirement, not a vibe. How to hit it:

**Ground every choice in the subject.** Distinctiveness comes from *this* product's world — spontaneous real-world plans, the small electric "yes, let's go" moment, places, activities, evenings out. Derive palette, type, and the signature moment from that, never from what looks good in the abstract.

**Pick one signature element and spend your boldness there.** The single thing the app is remembered by — almost certainly the swipe card and the moment a plan matches. Make that exceptional and keep everything around it quiet and disciplined. Don't scatter bold moves across every screen.

**Type carries the personality.** System-font-everywhere *is* the generic choice. Pair a characterful display face (used with restraint) with a clean body face so the type treatment is itself memorable — see Typography.

**Know the AI-default looks and don't drift into them.** Current AI-generated design clusters into three; avoid landing on any by accident:
1. Warm cream background + high-contrast serif + terracotta accent. *(An earlier draft of this doc proposed exactly this — cream `#F7F5F1` + coral `#F2613F`. It's been replaced for that reason.)*
2. Near-black background + a single acid-green or vermilion accent.
3. Broadsheet layout — hairline rules, zero border-radius, dense newspaper columns.
Each is fine *if deliberately chosen for a reason*; none should be a default you fall into.

**Work in passes: plan → critique → build → critique.** Before building a screen, sketch the token system, then ask "would I produce something near-identical for any other app?" If yes, it's a default — change it and note why. Critique again against the built screen. Match execution to the vision: minimal needs precision in spacing and type; maximal needs elaborate follow-through.

**Then remove one thing.** Once a screen reads as done, cut the least necessary element. Restraint is what separates intentional from busy.

## Color
Define everything as tokens (never hardcode hex in screens). The app is light mode only.

**Direction: sunset ocean.** Warm-led — the coral/orange of a horizon sunset is primary; deep ocean teal is the cool contrast accent. Airbnb-clean layout with a faint warm tint on the background instead of flat white. Chosen because it's grounded in the product's world (golden hour, going outside, the ocean/outdoors), avoids the three AI-default clusters, and the warm/cool tension gives it visual life without being loud.

Brand:
| Token | Hex | Use |
|---|---|---|
| `action` | `#F4845F` | Primary CTAs, swipe-right, "I'm in" — sunset coral |
| `accent` | `#2AAFA8` | Trust/safety cues, info, links — ocean teal |
| `bg` | `#FFFAF8` | App background — faint warm tint, not cream |

Functional:
| Token | Hex | Use |
|---|---|---|
| `ink` | `#1A100D` | Primary text |
| `muted` | `#7A6560` | Secondary text, captions |
| `surface` | `#FFFFFF` | Cards, sheets |
| `line` | `#EDE5E1` | Borders, dividers |
| `success` | `#1E9E8E` | Accepted, confirmations — ocean-tinted |
| `warning` | `#E09020` | Waitlist, soft cautions |
| `danger` | `#D13E2A` | Remove, block, destructive — warm red, distinct from coral |

Don't use `danger` for anything routine — reserve it for destructive/safety actions so it keeps its weight. Don't let `action` coral drift toward terracotta — it should read warm-orange, not brick.

## Typography
- **Display — Plus Jakarta Sans** (slightly editorial, confident, not corporate). Used *with restraint* for screen titles and the activity title on detail. This is the type moment that makes the app feel distinctive; don't use it for body copy.
- **Body — system font** (SF Pro on iOS, Roboto on Android). Fast, legible, invisible — right for descriptions, chat, and forms where legibility beats personality.
- **Caption/data** — shares the body face.

Load Plus Jakarta Sans via `expo-google-fonts` (deferred until the font pass — placeholder system font until then). Confine it to display moments to keep bundle impact minimal.

Three weights only: 400 / 500 / 600. Sentence case everywhere; no all-caps labels.

| Style | Size / weight | Use |
|---|---|---|
| Display | 28 / 600 | Screen titles, the activity title on detail |
| Title | 20 / 600 | Card titles, section headers |
| Body | 16 / 400 | Default text |
| Label | 14 / 500 | Buttons, chips, metadata |
| Caption | 13 / 400 | Timestamps, helper text, distance |

## Spacing, shape, motion
- **Spacing:** 4-point scale — 4, 8, 12, 16, 24, 32. 16 is the default gutter.
- **Radius:** cards 16, buttons/inputs 12, chips/tags full pill, avatars circle.
- **Elevation:** flat with soft shadows; the swipe card gets the most lift, everything else stays grounded.
- **Touch targets:** 44×44pt minimum.
- **Motion:** quick and physical (swipe, card spring, sheet slide). Animate to clarify, not to delay. Respect reduced-motion.

## Core components
- **Swipe card (the hero).** Image (or a tasteful tag-colored placeholder when none), title, time, rough distance ("~2 mi"), 1–3 tag chips, spots-left as a quiet number. Right = interested, left = pass. Big, legible, one card at a time. This component gets the most design care.
- **Activity detail.** Title, description, time (with a "flexible" marker when set), attendee avatars, tag chips, join button reflecting the accept mode. **No map, no address** — meeting spot is in chat after matching. A short line states this so it's not a surprise.
- **Activity card (list).** Compact version of the swipe card for "my activities" and matched lists.
- **Buttons.** Primary (`action` fill), secondary (outline), destructive (`danger` text/outline). Verb labels.
- **Tag chips.** Pill, from the fixed list only. Selectable state for filters/picker; static for display.
- **Bottom tab nav.** Three tabs max — Discover, My plans, Profile. Keep it shallow.
- **Avatars.** Circle, initial fallback. Never expose anything beyond the public profile fields.

## Key screens & states
- **Discovery (swipe stack).** The home. Optional filter affordance, never required. **Design the empty state as a first-class screen** — in a liquidity-starved app it's common early, so make it honest and helpful (widen radius, post your own plan), never a dead end.
- **Host a plan.** Short, single-flow form. Sensible defaults (auto-accept, reasonable capacity). Tag picker from the fixed list. Make posting feel light, not like filing paperwork.
- **Matched / chat.** Group chat is where coordination (including where to meet) happens. Clear, simple, with block/report always one tap away.
- **Profile.** Public: photos, age, gender, name, bio, interest tags. Private to the owner: their own activities-done count. No ratings, no badges, no public history.
- **Loading / error / empty:** every list and feed needs all three designed. Skeletons over spinners; plain kind copy on errors.

## Accessibility
- Contrast: body text and essential UI meet WCAG AA against their background.
- Support Dynamic Type / font scaling — don't pin font sizes.
- Every icon-only control has an accessible label. Don't encode meaning in color alone (pair the swipe-right color with a clear icon/label).
- Honor system reduced motion.

## Anti-patterns — do NOT design these
- Ratings, stars, scores, tiers, streaks, or any public reputation surface (the product has none by design).
- Vanity metrics or leaderboards.
- Fake scarcity/urgency ("hurry, spots going fast").
- Aggressive or guilt-based notifications.
- Anything that displays or implies exact location before/after matching — distance only, coordinated meeting spot lives in chat.
- Dark patterns around leaving an activity, blocking, or deleting an account — these stay easy.