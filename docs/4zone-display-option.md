# 4-Zone Display Option — Design Note

## Problem
With the 4-zone spatial model (front / rear / side-left / side-right), the 2D editor
only shows 3 zones at once:
- Front view: front zone + both side strips
- Rear view: rear zone + both side strips

The opposite zone (rear when viewing front, front when viewing rear) is hidden unless
debug mode is enabled. This makes it hard to judge available U space across both faces.

## Options Considered

### Option A: Subtle ghost overlay in normal view (RECOMMENDED)
Show opposite-zone devices at ~18–20% opacity even in normal (non-debug) mode.
Debug mode adds the full overlay (zone boundaries, rail labels, cable node names).

**Pros:** Zero UI chrome; immediate spatial awareness; minimal code change  
**Cons:** Slightly busier view (mitigated by low opacity)

### Option B: Split 2D view mode
Toggle between single view and side-by-side front/rear halves.

**Pros:** Full clarity, no overlapping layers  
**Cons:** Cramped on small screens; complex new UI mode

### Option C: Keep as-is
Front/rear toggle is standard in rack design tools.

**Pros:** Cleanest view, no ambiguity  
**Cons:** Requires mental mapping; easy to plan overlapping U positions

## Decision
PENDING — awaiting user choice.
Default recommendation is **Option A**.
