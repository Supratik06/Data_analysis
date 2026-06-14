# AI_USAGE.md - AI Collaboration Log

This document lists the AI tools used, the key prompts, and three concrete cases where the AI produced something incorrect, how it was caught, and how it was resolved.

---

## 1. AI Tools Used & Key Prompts

*   **Primary AI Collaborator**: Gemini 3.5 Flash (Medium) via Antigravity Agent.
*   **Key Prompts Used**:
    *   *Search & Locate*: Command-line searches to find the legacy spreadsheet file.
    *   *Architecture Guidance*: Structuring a Decoupled Express API + React Client layout.
    *   *CSV Parser Code Gen*: Drafting regex rules and validation checks for 25 CSV anomalies.
    *   *SQL Join Balances*: Querying and calculating individual totals in SQL.

---

## 2. Concrete Cases of AI Inaccuracies & Fixes

### Case 1: Silent Failure in Locate File
*   **What the AI did wrong**: The AI ran standard recursive searches targeting `expenses_export.csv` (all lowercase with underscores). It returned empty results, leading the AI to briefly assume the CSV file was missing from the disk.
*   **How it was caught**: We noticed the active directory path mentioned by the user was `@New_Project`. We ran a folder listing (`list_dir`) on `d:\program\html_css\New_Project` and discovered the file was actually named `Expenses Export.csv` (with uppercase letters and spaces instead of underscores).
*   **What we changed**: We updated the search commands, validation test scripts, and the API upload handler to correctly reference `Expenses Export.csv`.

### Case 2: Rounding / Precision Discrepancy on Percentage Split Normalization
*   **What the AI did wrong**: For percentage splits that summed to 110% (Rows 15 & 32), the AI proposed a division that resulted in floating-point amounts. Summing the calculated shares resulted in fractional paisa mismatches (e.g., total sum equaled ₹1,439.99 instead of ₹1,440.00).
*   **How it was caught**: We reviewed the math for Aisha's rent and Pizza Friday splits. Summing individual shares did not exactly match the parent transaction's `amount_in_inr`.
*   **What we changed**: We adjusted the splitting logic in `/api/import/commit`. After splitting according to normalized percentages, we round each split to 2 decimal places. To prevent penny leaks, we calculate the last participant's split as `total_amount - sum(all_other_splits)`. This ensures that the splits always add up to exactly the transaction amount.

### Case 3: In-Memory Balance Calculations
*   **What the AI did wrong**: During initial drafting of the backend API routes, the AI computed the group balances in Javascript memory using arrays parsed directly from the uploaded CSV, skipping the SQL query execution entirely.
*   **How it was caught**: We reviewed the code against the requirement: *"Use relational DBs only"*. Using JS memory arrays would bypass SQLite database updates.
*   **What we changed**: We refactored the balance calculations in `server.js` (`/api/groups/:id/balances`) to run SQL queries (`SUM` and `GROUP BY`) on the SQLite `expenses` and `expense_splits` tables. Now, balances are strictly computed from relational DB state.
