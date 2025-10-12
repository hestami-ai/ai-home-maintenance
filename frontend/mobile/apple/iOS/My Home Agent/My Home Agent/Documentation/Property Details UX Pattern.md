# Property Details View - UX Pattern

## Problem
The edit property form contains extensive detailed information (50+ fields), but the view-only property details screen only showed a small subset (8 fields). This created an information gap where users couldn't see all property data without entering edit mode.

## Solution: Expandable Sections (Accordion Pattern)

### Design Pattern
**Progressive Disclosure** - Show essential information by default, hide detailed information behind expandable sections.

### Implementation

#### Always Visible (Hero Section)
- Property image/gallery
- Title and address
- Status indicator
- Property type
- **Key stats grid**: Square footage, bedrooms, bathrooms, year built

#### Expandable Sections (Tap to Expand)
1. **🏗️ Structure & Features**
   - Stories, lot size
   - Basement (with type)
   - Garage (with type and spaces)
   - Attic (with access type)
   - Crawl space

2. **🌡️ HVAC & Climate**
   - Heating system and fuel
   - Cooling system
   - Air conditioning
   - HVAC age, brand
   - Thermostat type

3. **🏠 Exterior & Roofing**
   - Roof type and age
   - Exterior material
   - Foundation type
   - Fence (with type)

4. **⚡ Utilities & Systems**
   - Water source
   - Sewer system
   - Gas service
   - Electrical panel and amps

5. **☀️ Outdoor Features** (conditional)
   - Pool (with type)
   - Patio
   - Deck

### UX Benefits

✅ **Scannable** - Key info visible at a glance  
✅ **Comprehensive** - All data accessible without editing  
✅ **Mobile-optimized** - Doesn't overwhelm small screens  
✅ **Progressive disclosure** - User controls detail level  
✅ **Familiar pattern** - Accordion/expandable sections are standard on mobile  
✅ **Visual hierarchy** - Icons and grouping make sections easy to identify  

### Components Created

#### `ExpandableDetailSection`
Reusable accordion component with:
- Icon and title header
- Chevron indicator (up/down)
- Smooth animation
- Themed styling

```swift
ExpandableDetailSection(
    title: "HVAC & Climate",
    icon: "thermometer.medium"
) {
    // Content goes here
}
```

#### `DetailRow`
Consistent label-value row with:
- Left-aligned label
- Right-aligned value
- Optional indentation for sub-items
- Proper spacing

```swift
DetailRow(label: "Heating System", value: "Forced Air")
DetailRow(label: "Heating Fuel", value: "Natural Gas", indented: true)
```

### Mobile Best Practices Applied

1. **Tap targets** - Expandable headers are full-width, easy to tap
2. **Visual feedback** - Chevron rotates, smooth animation
3. **Grouping** - Related fields grouped logically
4. **Hierarchy** - Parent/child relationships (e.g., Garage → Garage Type)
5. **Conditional display** - Empty sections don't appear
6. **Consistent spacing** - 12pt between sections, 4pt between rows

### Alternative Patterns Considered

| Pattern | Pros | Cons | Decision |
|---------|------|------|----------|
| **Tabs** | Clear separation | Requires horizontal nav, fragmented | ❌ Rejected |
| **"See All" button** | Very simple | Two-step process, modal needed | ❌ Rejected |
| **Long scroll** | No interaction needed | Overwhelming, hard to scan | ❌ Rejected |
| **Accordion** ✅ | Scannable, user control, familiar | Requires tapping | ✅ **Selected** |

### Future Enhancements

If needed, you could add:
- **Remember expanded state** - Persist which sections user opened
- **"Expand All" button** - For power users who want to see everything
- **Search/filter** - For properties with extensive data
- **Copy to clipboard** - Tap a value to copy it
- **Deep linking** - Open specific section from notifications

## Usage

The pattern is automatically applied to all property detail views. No configuration needed. Sections only appear if they have data to display.
