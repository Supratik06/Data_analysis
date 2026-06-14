# DECISIONS.md - Decision Log

This log documents the key product design and technical architecture decisions made during the development of EquiSplit, comparing alternative options and explaining why we chose the selected implementation.

---

## 1. Architecture: Single-Page React App with Express + SQLite Backend

*   **Options Considered:**
    1.  **Frontend-only application**: Run SQLite in the browser (using `sql.js` or `wa-sqlite`) and persist data in `IndexedDB`.
    2.  **Decoupled Client-Server (React + Express + SQLite)**: Build a Node/Express API server that interacts with a local SQLite database file, and run a React frontend.
    3.  **Full-stack Next.js Application**: Use Next.js App Router with SQLite via server actions.
*   **Decision & Rationale:**
    *   We selected **Option 2 (Decoupled Client-Server)**. 
    *   *Frontend-only (Option 1)* would make it difficult to satisfy the requirement "Use relational DBs only" since IndexedDB is non-relational and in-browser SQLite is technically a client-side wrapper.
    *   *Next.js (Option 3)* introduces significant build complexity on Windows systems when compiling native SQLite bindings inside Server Actions, sometimes causing build crashes.
    *   *Express + SQLite (Option 2)* is highly modular, lightweight, and isolated. It has zero native compile dependencies for the frontend, making development fast and satisfying the relational database requirement cleanly.

---

## 2. Ingestion Strategy: Interactive Wizard vs. Silent Auto-Correction

*   **Options Considered:**
    1.  **Silent Guess/Heuristics**: Automatically correct casing, delete duplicate rows, normalize percentages, convert USD, and run import without asking the user.
    2.  **Interactive Anomaly Resolution Wizard**: Parse the CSV, return a list of all 25 anomalies, and present a step-by-step UI to the user to choose the correction strategy before executing the database transactions.
*   **Decision & Rationale:**
    *   We chose **Option 2 (Interactive Wizard)**.
    *   A silent guess fails candidates ("A silent guess is a failing answer"). Furthermore, Meera explicitly requested: *"Clean up the duplicates — but I want to approve anything the app deletes or changes."*
    *   The interactive wizard allows Meera and the other flatmates to review every duplicate candidate side-by-side (Marina Bites, Thalassa Dinner), select a resolution, and review date formatting or timeline bounds before confirming the ingestion.

---

## 3. Database Modeling of Settlements/Payments

*   **Options Considered:**
    1.  **Separate `settlements` table**: Create a table containing fields `id, sender_id, receiver_id, amount, date` separate from the `expenses` table.
    2.  **Unified Transactions Model**: Treat settlements as a special type of expense (`split_type = 'settlement'`, `is_settlement = 1`) where the sender is the payer, and the split recipient is the receiver.
*   **Decision & Rationale:**
    *   We selected **Option 2 (Unified Transactions Model)**.
    *   Under a unified model, the balance query is mathematically elegant and simple:
        `Net Balance = Sum(Amounts Paid as Payer) - Sum(Amounts Owed as Split Member)`
    *   If Rohan pays Aisha back ₹5,000, Rohan is logged as the payer (paid = +₹5,000) and Aisha is logged as the sole split recipient (owes = +₹5,000). 
    *   This naturally increases Rohan's net balance by ₹5,000 (reducing his debt) and decreases Aisha's net balance by ₹5,000 (reducing what she is owed), utilizing the exact same relational table joins. This prevents double-accounting bugs and keeps database integrity high.

---

## 4. Timeline Constraints: Strict vs. Soft Violations

*   **Options Considered:**
    1.  **Strict Database Block**: Use SQL constraints that block inserting any split for Meera post-March 31 or Sam pre-April 15.
    2.  **Warn-and-Resolve Flow (Soft Validation)**: Flag the dates during validation but allow overrides or easy one-click exclusions in the UI.
*   **Decision & Rationale:**
    *   We chose **Option 2 (Warn-and-Resolve)**.
    *   Some timeline bounds are soft. For instance, Sam moved in mid-April (April 15), but he participated in the "Housewarming drinks" on April 10. A strict DB check would prevent logging Sam's share of the drinks, even though it is socially correct to split it with him.
    *   The wizard warns the user: "Sam was included on April 10, before his official start date". The user can choose to keep him in the split (for the party) but remove him from the April 12 electricity bill.

---

## 5. Debt Simplification Engine (Aisha's Request)

*   **Options Considered:**
    1.  **Pairwise Debts**: Leave debt pairwise (if Aisha owes Rohan ₹2,000 and Rohan owes Aisha ₹5,000, keep them separate).
    2.  **Greedy Net-Balance Settlement**: Simplify balances so that the number of transaction hops is minimized, ignoring who bought what originally, to present a list of "who pays whom, how much, done."
*   **Decision & Rationale:**
    *   We selected **Option 2 (Greedy Settlement)**.
    *   Aisha requested: *"I just want one number per person. Who pays whom, how much, done."*
    *   The backend calculates the net balance of each user (credits - debits). It divides users into Debtors (net < 0) and Creditors (net > 0), sorts them by size, and greedily matches the largest debtor with the largest creditor. This minimizes payment transactions and is standard split-app logic (e.g. Splitwise).
