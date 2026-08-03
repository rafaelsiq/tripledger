# Plan: WhatsApp expense summary export

## Goal
Let trip members share a clear Portuguese summary of expenses to a WhatsApp group: what was spent, who paid, who still owes, and how much.

## Surfaces
1. **Finanças → Lançamentos** (`finance/index`): one button exports a summary of **all** expenses.
2. **Expense detail** (`finance/expense/[expenseId]`): the same button exports a summary for **that expense only**.

## Message contents
### Trip-wide
- Trip name
- Totals: overall amount, already paid, still open
- Per expense: title, category, who fronted (`paidByUid`), amount, paid vs open
- Per person on each expense: owed, already paid, remaining

### Single expense
- Expense title + trip name
- Total, paid, open
- Who paid for the group
- Per person: owed / paid / remaining

Income lançamentos are omitted from payment-status summaries (same as CSV/totals).

## Implementation
1. `src/lib/financeShare.ts` — pure helpers to build WhatsApp-friendly text + `shareFinanceSummary()` using React Native `Share` (same pattern as invite share), with clipboard fallback.
2. Reuse `formatCurrency` / `memberLabel` / `paymentProgress`.
3. UI: header action “WhatsApp” next to CSV on list; matching action on expense detail (near edit / after timeline).
4. No new native dependency; no WhatsApp deep-link required (system share sheet lets the user pick WhatsApp).

## Out of scope
- Changing Firestore models or payment flows
- CSV format changes
- Auto-posting into a specific WhatsApp group without the share sheet
