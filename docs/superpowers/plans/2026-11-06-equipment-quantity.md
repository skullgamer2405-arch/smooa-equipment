# Equipment quantity implementation plan

> Execute inline with superpowers:executing-plans; one independent whole-branch review before publishing.

**Goal:** Add total and borrowed quantities, safe approval/return accounting, and accessible + / − controls.
**Architecture:** Shared stock helpers; server-managed equipment writes and transactional booking stock; existing React/Firestore subscriptions for public inventory.
**Tech Stack:** Node 24, Express, Firestore, React, TypeScript, existing shadcn components.
**Spec:** ../specs/2026-11-06-equipment-quantity-design.md

## Constraints and review focus

No dependencies or production-data testing. Keep old rows working as quantity 1. Preserve notification consent/dedup, partial returns with idempotent receipts and original working tree. Check concurrent approval/return/edit, invalid quantities, stale browser data, legacy bookings without quantity, and paginated inventory updates.

## Tasks

1. [x] Server stock integrity: failing tests in tests/quantity.test.mjs and tests/firestore-api.test.mjs; shared/inventory.js exposes totalQuantity, borrowedQuantity, availableQuantity, bookingQuantity. server/inventory.mjs reads approved rows in a transaction and validates saves/deletes. Both booking entrypoints validate quantity; approval and return write totals atomically. API routes and Firestore rules prevent counter bypass. Verify unit/API and emulator tests, including concurrent last-stock approval and repeated return.
2. [x] User and admin UI: write browser test for 5 total → request 3 → approve → remaining 2 → return → 5. Add shared quantity input, types, draft/receipt/import support, inventory CRUD API adapter, stock display and sold-out filtering. Quantity appears in admin, user history, calendar projection and notifications. Verify TypeScript, unit tests and browser workflow/mobile/keyboard checks.
3. [ ] Delivery: update usage/change guide, run full offline API/unit/build/rules/browser suite; independent review; commit exact tested files, PR and Preview. Preserve existing dirty root and report rules publication requirement before official rollout. Finish outstanding manual PDF link verification separately.

## Ledger

- Base d5c939a. Native implementation chosen to keep one coding worker as existing project workflow requires.
- Defaults chosen: deduct at approval; restore at admin receipt; legacy quantity 1; total max 10,000. Owner confirmed partial returns: keep approved until remainingQuantity is zero; persist returnedQuantity and deduplicate receipt UUIDs.
- Shared interfaces: equipment.quantity and bookings.quantity are totals; borrowedQuantity is server-owned. UI, booking validation, notifications and inventory writes use the same integer bounds and legacy defaults.

- API/unit checks: 59 passed; frontend unit checks: 23 passed; TypeScript passed. Firestore emulator: 5 passed including real concurrent approval and partial-return retry transactions. Browser quantity workflow and mobile bounds passed; final status locator adjusted for the existing decorative status dot.

- Independent review found two important cases. Fixes: disallow booking-less bulk returns (inventory button selects borrower request instead), and allow returning at the 100-active limit while rejecting approval 101. Regression tests observed failing before changes. Minor deferred: unavailable/maintenance public filters now yield empty lists because only lendable items are shown.

- Final verification: TypeScript + production build; 23 frontend units, 62 API/server units, 5 emulator tests, 45 browser tests, 1 production browser security test, all passed (136 total). Source hashes match all three final offline evidence snapshots. Return dialog axe check: 0 violations; mobile and desktop screenshots inspected.
- Review fixes verified: booking-specific returns prevent accidentally closing a new borrower’s loan; 100 active loans remain returnable and approval 101 is rejected. Both regression tests observed RED before changes and GREEN in full suite.
- Ruling: full-request legacy returns remain accepted only with bookingId; quantity-based returns require UUID receipt. The inventory shortcut now opens approved borrower requests instead of returning all loans. Old cached clients must reload.
