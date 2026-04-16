# Design System Specification

## 1. Overview & Creative North Star: "The Logical Architect"

This design system is built for the high-performance developer environment, moving beyond the utilitarian constraints of standard IDE extensions into a realm of **Logical Architecture**. The Creative North Star is a fusion of **Technical Brutalism** and **Liquid Refinement**. 

While VS Code is traditionally a flat, grid-based environment, this system introduces intentional depth through tonal layering and sophisticated typography. We treat the interface as a living blueprint—where data density is high, but the cognitive load is low due to clear spatial hierarchy and the surgical use of accent color.

**The Signature Feel:** 
- **Intentional Asymmetry:** Strategic use of whitespace and "hanging" labels to break the standard boxy feel.
- **Tonal Depth:** Replacing harsh borders with subtle shifts in dark-mode surfaces.
- **Micro-interactions:** Using light and motion (pulses, blurs) to indicate system vitality.

---

## 2. Color & Surface Philosophy

The palette is rooted in the deep charcoals of the official VS Code environment, but it is elevated through a sophisticated Material Design-inspired tiering system.

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for structural sectioning. We define boundaries through **Background Shifts**. 
- A card should not be "outlined"; it should sit as a `surface_container_low` (#1B1B1C) element upon a `surface` (#131313) background.
- Use `surface_container_highest` (#353535) for elements that require immediate user focus, such as active states or hovering tooltips.

### Surface Hierarchy & Glassmorphism
To achieve a premium, custom feel, floating elements (modals, dropdowns, or the Intent Composer) should utilize **Glassmorphism**:
- **Background:** Semi-transparent `surface_variant` (#353535) at 80% opacity.
- **Backdrop Blur:** 12px to 20px.
- **Signature Texture:** Use a subtle linear gradient on primary CTAs, transitioning from `primary` (#9FCAFF) to `primary_container` (#007ACC) at a 135-degree angle to provide a "metallic" technical polish.

---

## 3. Typography: The Editorial Contrast

This system relies on the tension between a high-end display face and a functional technical face.

| Role | Font Family | Token Reference | Usage |
| :--- | :--- | :--- | :--- |
| **Display** | Space Grotesk | `display-lg` to `headline-sm` | Large phase indicators, hero stats, and section headers. |
| **Interface** | Inter / Segoe UI | `title-md` to `label-sm` | Control labels, buttons, and metadata. |
| **Technical** | Consolas / Source Code Pro | *N/A* | All code snippets, log outputs, and chip content. |

**Editorial Note:** Use `display-sm` (Space Grotesk, 2.25rem) for numerical indicators or phase titles to create a "magazine-style" hierarchy within the sidebar, ensuring the technical data feels curated rather than just listed.

---

## 4. Elevation & Depth: Tonal Layering

We move away from the "drop shadow" of the early web. In this system, depth is a result of **Atmospheric Perspective**.

- **The Layering Principle:** 
    - Level 0 (Base): `surface` (#131313).
    - Level 1 (Embedded): `surface_container_low` (#1B1B1C).
    - Level 2 (Default Components): `surface_container` (#202020).
    - Level 3 (Raised/Interactive): `surface_container_high` (#2A2A2A).
- **Ambient Shadows:** For "Whiteboard Nodes" or "Floating Modals," use a shadow color of `on_secondary_fixed_variant` (#474747) at 10% opacity with a 30px blur. This mimics a natural glow rather than a muddy shadow.
- **Ghost Borders:** For accessibility on low-contrast screens, a "Ghost Border" may be used: `outline_variant` (#404751) at 15% opacity.

---

## 5. Component Library

### Governed Stream Cards
High-density containers that prioritize status over structure.
- **Structure:** No border. Use `surface_container_low` background.
- **Header:** Use `title-sm` (Inter) in `on_surface` (#E5E2E1).
- **Status Indicator:** Instead of an icon, use a 3px wide vertical "Status Bar" on the far-left edge of the card. Colors: `tertiary` (#61DAC1) for healthy, `error` (#FFB4AB) for blocked.
- **Collapsibility:** Use a chevron that rotates 90 degrees; when collapsed, the background shifts to `surface_container_lowest` (#0E0E0E).

### Intent Composer (Multi-line Input)
A sophisticated input area designed for "Natural Language to Code" workflows.
- **Surface:** `surface_container_highest` (#353535).
- **Mentions & Chips:** Chips use `primary_container` (#007ACC) with `on_primary_container` (#FFFFFF) text. Use `sm` (0.125rem) roundedness for a sharper, technical look.
- **Placeholder:** `on_surface_variant` (#C0C7D3) in `body-md` Inter.

### Phase Indicator (Mini-Timeline)
A compact, vertical or horizontal thread of dots.
- **Completed:** Solid `tertiary` (#61DAC1) dot.
- **Current:** Solid `primary` (#9FCAFF) dot with a 4px outer "pulse" ring at 30% opacity.
- **Future:** Hollow 1.5px ring using `outline` (#8A919D).
- **Connector Lines:** 1px `outline_variant` (#404751).

### Architecture Canvas Nodes
Whiteboard-style elements for visual mapping.
- **Body:** `surface_container_high` (#2A2A2A).
- **Phase-Specific Borders:** While we avoid borders elsewhere, nodes use a 2px top-border (accent only) to indicate their phase:
    - Discovery: `primary` (#9FCAFF).
    - Development: `tertiary` (#61DAC1).
    - Review: `secondary` (#C8C6C6).
- **Type:** All content inside nodes should use Monospaced font at `label-md` size.

---

## 6. Do's and Don'ts

### Do
- **Do** use `surface_bright` (#393939) for hover states on list items.
- **Do** allow content to breathe. Use the `lg` (0.5rem) or `xl` (0.75rem) spacing tokens between high-density cards.
- **Do** use `tertiary` (#61DAC1) for "Success" or "System Ready" states to distinguish from the standard VS Code blue.

### Don't
- **Don't** use 100% white (#FFFFFF) for text. Always use `on_surface` (#E5E2E1) to reduce eye strain in dark mode.
- **Don't** use rounded corners larger than `md` (0.375rem) for primary UI containers. We want the system to feel "Architectural," not "Bubbly."
- **Don't** use dividers/horizontal rules (`<hr>`). Use a 12px vertical gap or a background color step-down instead.
- **Don't** use "Drop Shadows" on flat buttons. Use tonal contrast (e.g., `primary` on `surface_container`).