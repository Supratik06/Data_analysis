# EquiSplit - Premium Shared Expense Splitting App

EquiSplit is a modern, responsive web application built for Aisha, Rohan, Priya, Meera, Sam, and Dev to manage their shared household expenses. It reads their messy legacy `Expenses Export.csv` spreadsheet, flags 25 different data anomalies interactively, standardizes name and date formats, handles USD-to-INR conversions, and computes balances and debt settlements.

---

## 🚀 Key Features

1.  **Glassmorphism Dashboard**: A dark theme featuring glowing UI cards, responsive layouts, and hover indicators.
2.  **Simplified Debt Settlement (Aisha's Request)**: A greedy simplification algorithm showing the minimum number of transactions needed to settle everyone up ("who pays whom, how much, done").
3.  **Detailed Expense Breakdown (Rohan's Request)**: Click on any flatmate's card on the dashboard to filter and display the exact ledger entries they paid for or participated in, explaining their balance down to the paisa.
4.  **USD Conversion (Priya's Request)**: Custom input during import to convert USD trip transactions to INR (using a user-defined exchange rate, e.g. 83.0).
5.  **Interactive Anomaly resolution wizard (Meera's Request)**: Detects duplicates, overlapping entries, invalid percentage sums, negative refunds, and timeline violations. Requires manual approval before changes are saved to the database.
6.  **Timeline-Bound Splits (Sam's Request)**: Restricts splits according to group membership dates. March expenses exclude Sam (who moved in April 15), and April expenses exclude Meera (who left March 31).

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite), Vanilla CSS, Lucide Icons
*   **Backend**: Node.js, Express, JWT, Multer
*   **Database**: Relational SQLite3 database (stored in `backend/database.sqlite`)

---

## ⚙️ Setup Instructions

### Public Deployment (Vercel)
The application has been split and deployed securely on Vercel:
*   **Frontend Application**: [https://data-analysis-wl99.vercel.app](https://data-analysis-wl99.vercel.app)
*   **Backend API Base**: [https://data-analysis-omek.vercel.app](https://data-analysis-omek.vercel.app)

### Local Development Setup
Make sure you have Node.js (version 18+) installed.

#### 1. Ingest Dependencies
From the root project directory (`New_Project`), run the utility command to install packages for both client and server:
```bash
npm run install-all
```

#### 2. Start Dev Servers
Start both the Express backend API and the Vite React frontend concurrently:
```bash
npm run dev
```

*   **Vite Frontend** runs at: `http://localhost:5173/`
*   **Express Backend** runs at: `http://localhost:5000/`

#### 3. Demo Credentials
To login as any of the flatmates, enter their name (case-insensitive) with the default password:
*   **Username**: `Aisha`, `Rohan`, `Priya`, `Meera`, `Sam`, or `Dev`
*   **Password**: `password123`

---

## 🤖 AI Used

This project was developed in collaboration with an AI assistant acting as a pair-programming partner.
*   **Primary Tool Used**: Gemini AI (via Antigravity Agent).
*   **Role**: The AI assisted in scaffolding the Vite/Express architecture, generating regex scripts to parse the messy CSV file, formulating the relational SQL database schema, and debugging the Vercel serverless deployment routing logic.
*   **Accountability**: As the engineer of record, all AI output was reviewed, modified, and validated against the assignment parameters (e.g., enforcing strict relational database rules and standardizing floating-point math rounding). 

> **Note**: A full detailed log of the exact AI prompts, tools used, and three concrete instances where the AI generated incorrect logic (and how I corrected them) is available in [AI_USAGE.md](AI_USAGE.md).

---

## 📂 Project Structure

```text
New_Project/
├── backend/
│   ├── db.js             # SQLite connector and seed script
│   ├── parser.js         # CSV ingestion and anomaly parser
│   ├── schema.sql        # SQLite relational table schemas
│   ├── server.js         # Express API routes
│   └── vercel.json       # Vercel Serverless routing config
├── frontend/
│   ├── index.html        # Main HTML structure with SEO meta
│   └── src/
│       ├── App.jsx       # Single Page React App
│       ├── index.css     # Glassmorphic vanilla CSS styles
│       └── main.jsx      # React client entry point
├── Expenses Export.csv   # Messy raw spreadsheet export
├── SCOPE.md              # ER schema & 25 anomaly logs
├── DECISIONS.md          # Log of design & technical choices
├── AI_USAGE.md           # Detailed AI collaboration logs
└── README.md             # Setup instructions & AI usage (this file)
```
