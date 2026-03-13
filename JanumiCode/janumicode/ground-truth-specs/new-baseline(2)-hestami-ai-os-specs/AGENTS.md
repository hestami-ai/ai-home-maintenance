# Hestami AI OS - Agent Implementation Map

## 1. The Prime Directive
You are building the **Hestami AI Operating System**, a comprehensive platform for property management, resident services, and gig-economy coordination.

**Current Status:** Implementation Phase
**Source of Truth:** The `docs/` directory in this folder supersedes all previous "Phase X" source documents.

## 2. The System of Record
Do not rely on training data or assumptions. Rely on these structured documents:

*   **`docs/architecture/system-overview.md`**: The high-level topology, the "Three Pillars" strategy, and the unified data flow. **Start here.**
*   **`docs/product-specs/`**: Detailed functional requirements and user narratives.
    *   `01-concierge.md`: Resident experience, onboarding, front desk operations.
    *   `02-service-provider.md`: Vendor marketplace and work dispatch.
    *   `03-cam.md`: Community management and accounting.
*   **`docs/design-docs/`**: Technical decisions and architectural constraints (e.g., "Why we use Event Sourcing").

## 3. Implementation Protocol (The MAKER Way)
When implementing features from these specs:

1.  **Decompose:** Do not attempt to build a whole Pillar at once. Break `01-concierge.md` into atomic `task_units` (e.g., "Define Resident Entity", "Build Onboarding API").
2.  **Verify:** Every requirement in the prose must have a corresponding test or observable validation.
3.  **Trace:** Link your code comments back to the specific section in `docs/product-specs/`.

## 4. The Three Pillars (Priority Order)
1.  **Concierge:** (Immediate Focus) - The "Face" of the system.
2.  **Service Provider:** (Secondary) - The "Hands" of the system.
3.  **CAM:** (Tertiary) - The "Brain/Ledger" of the system.

---
*This file is the root node. Follow the links in Section 2 to traverse the system.*