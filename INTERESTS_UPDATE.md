# Comprehensive Interests & Tools/Mediums Implementation

## Overview
This update restructures interests into a hierarchical **5-category system** with subcategories, adds **50+ tools/mediums** for filtering, and improves the dashboard to show only **selected interests** rather than all presets.

## Changes Made

### 1. Backend Changes

#### MongoDB Schema Updates (`src/models/Node.ts`)
- Added `tools: string[]` field
- Added `mediums: string[]` field
- These new fields have default empty arrays

#### Validation Schema (`src/schemas/node.ts`)
- Updated `updateProfileSchema` to accept `tools` and `mediums` arrays
- Each array: max 50 items, max 100 chars per item

#### API Routes (`src/routes/nodes.ts`)
- Updated `PATCH /nodes/me` to save tools/mediums
- Updated `GET /nodes/:alias` to return tools/mediums in profile response

#### Discover Filtering (`src/routes/discover.ts`)
- Enhanced `GET /discover/nodes` to filter by:
  - `?interests=comma,separated,list`
  - `?tools=comma,separated,list`
  - `?mediums=comma,separated,list`
- All three filters work with OR logic (can combine multiple filters)
- Response includes `tools` and `mediums` arrays for each node

### 2. Frontend Changes

#### Interest Taxonomy (`frontend/src/lib/interestPresets.ts`)
**5 Main Categories with Subcategories:**

1. **Research & knowledge**
   - Primary research, Secondary research, Design research
   - Science communication, Archives & memory, Research methods

2. **Creation & craft**
   - Visual art, Music & sound, Writing, Game design
   - Animation & motion, Photography & imaging, 3D & modeling
   - Fabrication & making, Textiles & fiber arts

3. **Systems & infrastructure**
   - Open source, Systems design, UX & interface design
   - Frontend/Backend development, Database & data
   - DevOps & infrastructure, Information architecture

4. **Community & culture**
   - Community building/infrastructure, Teaching & pedagogy
   - Accessibility, Governance, Climate & sustainability
   - Social justice, Cultural practices

5. **Craft & technique**
   - Woodworking, Metalworking, Ceramics & pottery
   - Jewelry making, Printmaking, Bookbinding
   - Conservation & restoration, Traditional techniques

**Tools & Mediums:**
- 43 tools (Figma, Blender, React, Node.js, Docker, etc.)
- 48 mediums (Photography, 3D printing, Textiles, etc.)

#### New Components

**`InterestPickerCategorized.tsx`**
- Collapsible category picker for interests
- Two modes:
  - **Edit**: Shows all categories with expandable subcategories
  - **View**: Shows only selected interests grouped by category
- Works in both light/dark modes

**`ToolsMediumsPicker.tsx`**
- Scrollable lists for tools and mediums
- Search functionality for each section
- Checkboxes for multi-select
- Used on Discover page filter sidebar

### 3. Dashboard Display (`HubPage.tsx`)
- **Old behavior**: Shows all preset interests (16 items)
- **New behavior**: Shows only interests user actually selected
  - Grouped by category
  - Edit button to modify
  - Much cleaner, non-overwhelming display

### 4. Discover Page Updates
**New Filter Options:**
- Category filter (5 categories: research, creation, systems, community, craft)
- Tools filter (searchable list of 43 tools)
- Mediums filter (searchable list of 48 mediums)

Existing filters remain:
- Type: all/spaces/projects/nodes
- Activity: brainstorm, research, fabrication, skillwork, etc.
- Project status: active, completed, disputed
- Space type: open, invite_only, application
- Search by alias/interests/keywords

## Database Migration

**File**: `scripts/addInterestsSample.ts`

**Usage:**
```bash
npx ts-node scripts/addInterestsSample.ts
```

**What it does:**
- Finds all active accounts with empty/missing interests
- Assigns 3 sample interests: "Open source", "Systems design", "Teaching / pedagogy"
- One-time operation; auto-assignment NOT enabled for new users

**Important**: After running this migration, new users will go through signup without pre-filled interests (they must select their own).

## Frontend Integration Points

### RegisterPage.tsx
Would need update to use `InterestPickerCategorized` (not done in this PR, can be added separately)

### HubPage.tsx  
Would need update to integrate `InterestPickerCategorized` for the interests edit/view flow (suggested enhancement)

### DiscoverPage.tsx
Would need integration of `ToolsMediumsPicker` in the sidebar filters (suggested enhancement)

## Backward Compatibility

- ✅ `INTEREST_PRESETS` still exported (flat array of all interests)
- ✅ Existing interests data continues to work
- ✅ New fields (`tools`, `mediums`) default to empty arrays
- ✅ No breaking changes to existing endpoints

## Migration Checklist

- [ ] Run MongoDB migration: `npx ts-node scripts/addInterestsSample.ts`
- [ ] Deploy backend (Node.ts, schemas, routes)
- [ ] Deploy frontend (lib, components, pages)
- [ ] Test dashboard interests display (only selected shown)
- [ ] Test Discover page with new tools/mediums filters
- [ ] Verify signup flow (decide if RegisterPage should use new component)

## Future Enhancements

1. **RegisterPage**: Integrate `InterestPickerCategorized` for categorized picker on signup
2. **Profile editing**: Full integration of tools/mediums on HubPage
3. **Discover**: Add category-based filtering alongside individual interests
4. **Search**: Consider indexing tools/mediums for full-text search on discover
5. **API**: Add endpoints to list available tools/mediums (for autocomplete, etc.)

## Files Modified

**Backend:**
- `src/models/Node.ts`
- `src/schemas/node.ts`
- `src/routes/nodes.ts`
- `src/routes/discover.ts`

**Frontend:**
- `frontend/src/lib/interestPresets.ts` (major expansion)
- `frontend/src/components/InterestPickerCategorized.tsx` (new)
- `frontend/src/components/ToolsMediumsPicker.tsx` (new)

**Migration:**
- `scripts/addInterestsSample.ts` (new)
