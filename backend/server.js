import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import multer from 'multer';
import { getDb } from './db.js';
import { parseCSV } from './parser.js';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-123456';

// Middleware for JWT Verification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- AUTH ENDPOINTS ---

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Please provide all fields' });
  }

  try {
    const db = await getDb();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username.trim(), email.trim(), passwordHash]
    );

    // Also add them to the default Flatmates group (id=1)
    await db.run(
      'INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)',
      [1, result.lastID, new Date().toISOString().split('T')[0]]
    );

    res.status(201).json({ message: 'User registered successfully', userId: result.lastID });
  } catch (err) {
    console.error(err);
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username or Email already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please provide username and password' });
  }

  try {
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username.trim()]);

    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get('SELECT id, username, email FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// --- GROUPS & MEMBERSHIPS ENDPOINTS ---

app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const groups = await db.all('SELECT * FROM groups');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/groups/:id/members', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const members = await db.all(
      `SELECT u.id, u.username, u.email, gm.joined_at, gm.left_at 
       FROM group_memberships gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ?`,
      [req.params.id]
    );
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/groups/:id/members', authenticateToken, async (req, res) => {
  const { username, joined_at, left_at } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  
  try {
    const db = await getDb();
    const user = await db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [username.trim()]);
    if (!user) return res.status(404).json({ error: 'User not found. Register them first.' });

    await db.run(
      `INSERT OR REPLACE INTO group_memberships (group_id, user_id, joined_at, left_at) 
       VALUES (?, ?, ?, ?)`,
      [req.params.id, user.id, joined_at || new Date().toISOString().split('T')[0], left_at || null]
    );
    res.json({ message: 'Group membership updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- EXPENSES & SETTLEMENTS ---

app.post('/api/expenses', authenticateToken, async (req, res) => {
  const { group_id, description, paid_by_id, amount, currency, date, split_type, splits, is_settlement, notes } = req.body;
  if (!group_id || !description || !paid_by_id || amount === undefined || !date || !split_type || !splits) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const db = await getDb();
    await db.run('BEGIN TRANSACTION');

    const inrAmount = currency.toUpperCase() === 'USD' ? amount * 83.0 : amount;

    const expenseResult = await db.run(
      `INSERT INTO expenses (group_id, description, paid_by_id, amount, currency, date, split_type, notes, exchange_rate, amount_in_inr, is_settlement)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [group_id, description, paid_by_id, amount, currency, date, split_type, notes || '', currency.toUpperCase() === 'USD' ? 83.0 : 1.0, inrAmount, is_settlement ? 1 : 0]
    );
    const expenseId = expenseResult.lastID;

    for (const split of splits) {
      await db.run(
        `INSERT INTO expense_splits (expense_id, user_id, amount, share_value) VALUES (?, ?, ?, ?)`,
        [expenseId, split.user_id, split.amount, split.share_value || null]
      );
    }

    await db.run('COMMIT');
    res.status(201).json({ message: 'Expense added successfully', expenseId });
  } catch (err) {
    const db = await getDb();
    await db.run('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Database transaction failed' });
  }
});

app.get('/api/expenses', authenticateToken, async (req, res) => {
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });

  try {
    const db = await getDb();
    const expenses = await db.all(
      `SELECT e.*, u.username as paid_by_name
       FROM expenses e
       LEFT JOIN users u ON e.paid_by_id = u.id
       WHERE e.group_id = ?
       ORDER BY e.date DESC, e.id DESC`,
      [group_id]
    );

    // Fetch splits for each expense
    for (const expense of expenses) {
      expense.splits = await db.all(
        `SELECT es.*, u.username 
         FROM expense_splits es
         JOIN users u ON es.user_id = u.id
         WHERE es.expense_id = ?`,
        [expense.id]
      );
    }

    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// --- BALANCES & SETTLEMENT ENGINE ---

app.get('/api/groups/:id/balances', authenticateToken, async (req, res) => {
  const groupId = req.params.id;
  try {
    const db = await getDb();

    // Get all members of the group
    const members = await db.all(
      `SELECT u.id, u.username 
       FROM group_memberships gm 
       JOIN users u ON gm.user_id = u.id 
       WHERE gm.group_id = ?`,
      [groupId]
    );

    // Compute net balance per member
    const balances = {};
    for (const m of members) {
      balances[m.id] = {
        userId: m.id,
        username: m.username,
        totalPaid: 0,
        totalOwed: 0,
        netBalance: 0
      };
    }

    // Sum paid amounts
    const paidSums = await db.all(
      `SELECT paid_by_id, SUM(amount_in_inr) as total_paid 
       FROM expenses 
       WHERE group_id = ? 
       GROUP BY paid_by_id`,
      [groupId]
    );
    paidSums.forEach(p => {
      if (balances[p.paid_by_id]) {
        balances[p.paid_by_id].totalPaid = p.total_paid;
      }
    });

    // Sum owed amounts
    const owedSums = await db.all(
      `SELECT es.user_id, SUM(es.amount) as total_owed 
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       WHERE e.group_id = ?
       GROUP BY es.user_id`,
      [groupId]
    );
    owedSums.forEach(o => {
      if (balances[o.user_id]) {
        balances[o.user_id].totalOwed = o.total_owed;
      }
    });

    // Calculate net balances
    const balanceList = Object.values(balances).map(b => {
      b.netBalance = parseFloat((b.totalPaid - b.totalOwed).toFixed(2));
      return b;
    });

    // Simplify debts: Aisha's request (Who pays whom, how much, done)
    const debtors = [];
    const creditors = [];

    balanceList.forEach(b => {
      if (b.netBalance < -0.01) {
        debtors.push({ userId: b.userId, username: b.username, amount: -b.netBalance });
      } else if (b.netBalance > 0.01) {
        creditors.push({ userId: b.userId, username: b.username, amount: b.netBalance });
      }
    });

    // Greedy settlement simplifier
    const settlements = [];
    let dIdx = 0;
    let cIdx = 0;

    // Deep copy to prevent mutating the original
    const debtorsCopy = debtors.map(d => ({ ...d }));
    const creditorsCopy = creditors.map(c => ({ ...c }));

    while (dIdx < debtorsCopy.length && cIdx < creditorsCopy.length) {
      const debtor = debtorsCopy[dIdx];
      const creditor = creditorsCopy[cIdx];

      if (debtor.amount < 0.01) {
        dIdx++;
        continue;
      }
      if (creditor.amount < 0.01) {
        cIdx++;
        continue;
      }

      const payAmount = parseFloat(Math.min(debtor.amount, creditor.amount).toFixed(2));
      settlements.push({
        fromUserId: debtor.userId,
        fromUsername: debtor.username,
        toUserId: creditor.userId,
        toUsername: creditor.username,
        amount: payAmount
      });

      debtor.amount -= payAmount;
      creditor.amount -= payAmount;
    }

    res.json({
      balances: balanceList,
      settlements: settlements
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- IMPORT EXPORT CSV ENDPOINTS ---

app.post('/api/import/analyze', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const csvContent = req.file.buffer.toString('utf8');
    const { rows, anomalies } = parseCSV(csvContent);
    res.json({ rows, anomalies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to analyze CSV' });
  }
});

app.post('/api/import/commit', authenticateToken, async (req, res) => {
  const { rows, resolutions, exchangeRate } = req.body;
  if (!rows || !resolutions) {
    return res.status(400).json({ error: 'Missing rows or resolutions' });
  }

  const db = await getDb();
  
  // Clean lists
  const report = {
    totalRowsIngested: 0,
    anomaliesResolved: 0,
    actionsTaken: []
  };

  try {
    await db.run('BEGIN TRANSACTION');

    const group_id = 1; // Default Flatmates Group
    const userMap = {};
    const users = await db.all('SELECT id, username FROM users');
    users.forEach(u => {
      userMap[u.username.toLowerCase()] = u.id;
    });

    const getOrAddUser = async (name) => {
      const key = name.trim().toLowerCase();
      if (userMap[key]) return userMap[key];
      
      // Seed temporary user if they don't exist
      const salt = await db.get('SELECT password_hash FROM users LIMIT 1'); // reuse any hash
      const defaultHash = salt ? salt.password_hash : 'dummy';
      const result = await db.run(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [name, `${name.toLowerCase()}@temp.com`, defaultHash]
      );
      
      // Link to default group
      await db.run(
        'INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)',
        [group_id, result.lastID, '2026-02-01']
      );

      userMap[key] = result.lastID;
      report.actionsTaken.push(`Created temporary user profile for "${name}".`);
      return result.lastID;
    };

    // Keep track of deleted or ignored rows from resolutions
    const skippedRowIndices = new Set();
    const duplicateMap = {};
    const conflictResolutions = {};

    // First pass: Resolve skips and conflicts
    resolutions.forEach(r => {
      if (r.type === 'DUPLICATE_ENTRY' && r.action === 'delete') {
        skippedRowIndices.add(r.rowIndex);
        report.anomaliesResolved++;
        report.actionsTaken.push(`Row ${r.rowIndex}: Deleted duplicate entry of "${r.description}".`);
      }
      if (r.type === 'CONFLICTING_ENTRY') {
        if (r.action === 'keep_a') {
          skippedRowIndices.add(r.rowB);
          report.actionsTaken.push(`Row ${r.rowB}: Ignored in favor of Row ${r.rowA} (Thalassa Dinner).`);
        } else if (r.action === 'keep_b') {
          skippedRowIndices.add(r.rowA);
          report.actionsTaken.push(`Row ${r.rowA}: Ignored in favor of Row ${r.rowB} (Thalassa Dinner).`);
        }
        report.anomaliesResolved++;
      }
      if (r.type === 'ZERO_AMOUNT' && r.action === 'delete') {
        skippedRowIndices.add(r.rowIndex);
        report.anomaliesResolved++;
        report.actionsTaken.push(`Row ${r.rowIndex}: Deleted zero-amount entry "${r.description}".`);
      }
    });

    // Helper to format date
    const formatDate = (dateStr) => {
      if (dateStr.toLowerCase() === 'mar-14') return '2026-03-14';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        // Assume DD-MM-YYYY
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
      return dateStr;
    };

    // Second pass: Process rows and write to DB
    for (const row of rows) {
      if (skippedRowIndices.has(row.rowIndex)) {
        continue;
      }

      // Check for resolution overrides
      let finalPaidBy = row.paid_by;
      let finalAmount = parseFloat((row.amount || '').replace(/,/g, ''));
      let finalCurrency = row.currency || 'INR';
      let finalDate = formatDate(row.date);
      let finalSplitType = row.split_type || 'equal';
      let finalSplitWith = row.split_with;
      let finalSplitDetails = row.split_details;
      let isSettlement = 0;
      let notes = row.notes || '';

      const rowResolutions = resolutions.filter(r => r.rowIndex === row.rowIndex);

      for (const res of rowResolutions) {
        if (res.type === 'MISSING_PAID_BY' && res.action === 'assign') {
          finalPaidBy = res.value;
          report.anomaliesResolved++;
          report.actionsTaken.push(`Row ${row.rowIndex}: Assigned missing payer to "${res.value}".`);
        }
        if (res.type === 'NAME_INCONSISTENCY') {
          finalPaidBy = res.value;
          report.anomaliesResolved++;
          report.actionsTaken.push(`Row ${row.rowIndex}: Mapped payer "${row.paid_by}" to "${res.value}".`);
        }
        if (res.type === 'MISSING_CURRENCY') {
          finalCurrency = res.value;
          report.anomaliesResolved++;
          report.actionsTaken.push(`Row ${row.rowIndex}: Assigned missing currency to "${res.value}".`);
        }
        if (res.type === 'FLOAT_PRECISION') {
          finalAmount = parseFloat(res.value);
          report.anomaliesResolved++;
          report.actionsTaken.push(`Row ${row.rowIndex}: Rounded float amount to ${res.value}.`);
        }
        if (res.type === 'AMBIGUOUS_DATE') {
          finalDate = formatDate(res.value);
          report.anomaliesResolved++;
          report.actionsTaken.push(`Row ${row.rowIndex}: Resolved ambiguous date to ${res.value}.`);
        }
        if (res.type === 'NON_STANDARD_DATE') {
          finalDate = formatDate(res.value);
          report.anomaliesResolved++;
          report.actionsTaken.push(`Row ${row.rowIndex}: Converted non-standard date to ${finalDate}.`);
        }
        if (res.type === 'SETTLEMENT_LOGGED_AS_EXPENSE') {
          finalSplitType = 'settlement';
          isSettlement = 1;
          report.anomaliesResolved++;
          report.actionsTaken.push(`Row ${row.rowIndex}: Converted settlement expense to direct transfer.`);
        }
        if (res.type === 'TIMELINE_VIOLATION_MEERA' && res.action === 'remove') {
          // Remove Meera from split_with
          const list = finalSplitWith.split(';').map(m => m.trim());
          finalSplitWith = list.filter(m => m.toLowerCase() !== 'meera').join(';');
          report.anomaliesResolved++;
          report.actionsTaken.push(`Row ${row.rowIndex}: Removed Meera from split list (occurred post-departure).`);
        }
        if (res.type === 'TIMELINE_VIOLATION_SAM' && res.action === 'remove') {
          // Remove Sam from split_with
          const list = finalSplitWith.split(';').map(m => m.trim());
          finalSplitWith = list.filter(m => m.toLowerCase() !== 'sam').join(';');
          report.anomaliesResolved++;
          report.actionsTaken.push(`Row ${row.rowIndex}: Removed Sam from split list (occurred pre-arrival).`);
        }
      }

      // Special case: check for Kabir in split list
      const splitList = finalSplitWith.split(';').map(m => m.trim()).filter(m => m !== '');
      let cleanSplitList = [];
      let kabirAction = null;

      // Find if Kabir resolution is defined
      const kabirRes = resolutions.find(r => r.rowIndex === row.rowIndex && r.type === 'NON_GROUP_MEMBERS');
      if (kabirRes) {
        kabirAction = kabirRes.action; // 'absorb_by_dev', 'add_temporary', 'redistribute'
        report.anomaliesResolved++;
      }

      for (const member of splitList) {
        const norm = member.toLowerCase();
        if (norm === 'kabir' || norm === "dev's friend kabir") {
          if (kabirAction === 'add_temporary') {
            cleanSplitList.push('Kabir');
            report.actionsTaken.push(`Row ${row.rowIndex}: Split with Kabir registered as temporary member.`);
          } else if (kabirAction === 'absorb_by_dev') {
            // Dev absorbs Kabir's share. Dev's count will be weighted as 2 shares later
            cleanSplitList.push('Dev');
            cleanSplitList.push('Dev'); // double share for Dev
            report.actionsTaken.push(`Row ${row.rowIndex}: Dev absorbed Kabir's split share.`);
          } else {
            // Redistribute: just drop Kabir, meaning split among other members
            report.actionsTaken.push(`Row ${row.rowIndex}: Kabir's share redistributed among flatmates.`);
          }
        } else {
          // Normalize normal flatmate names
          if (norm === 'priya s') cleanSplitList.push('Priya');
          else if (norm === 'priya') cleanSplitList.push('Priya');
          else if (norm === 'rohan') cleanSplitList.push('Rohan');
          else if (norm === 'aisha') cleanSplitList.push('Aisha');
          else if (norm === 'meera') cleanSplitList.push('Meera');
          else if (norm === 'sam') cleanSplitList.push('Sam');
          else if (norm === 'dev') cleanSplitList.push('Dev');
          else {
            // Unrecognized name, standard fallback
            cleanSplitList.push(member);
          }
        }
      }

      // Direct settlements (Rohan pays Aisha back, Sam's deposit share)
      // Deposit share in Row 38: Sam pays Aisha 15000 deposit share
      if (row.description.toLowerCase().includes('deposit') && row.paid_by.toLowerCase() === 'sam') {
        finalSplitType = 'settlement';
        isSettlement = 1;
        cleanSplitList = ['Aisha']; // Sam paid Aisha directly
        report.actionsTaken.push(`Row ${row.rowIndex}: Sam deposit share imported as direct settlement payment to Aisha.`);
      }

      const rate = finalCurrency.toUpperCase() === 'USD' ? parseFloat(exchangeRate || 83.0) : 1.0;
      const inrAmount = parseFloat((finalAmount * rate).toFixed(2));

      // Resolve payer ID
      const paidById = await getOrAddUser(finalPaidBy);

      // Insert expense record
      const expenseInsert = await db.run(
        `INSERT INTO expenses (group_id, description, paid_by_id, amount, currency, date, split_type, notes, exchange_rate, amount_in_inr, is_settlement)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [group_id, row.description, paidById, finalAmount, finalCurrency, finalDate, finalSplitType, notes, rate, inrAmount, isSettlement]
      );
      const expenseId = expenseInsert.lastID;

      // Compute individual splits
      const numParticipants = cleanSplitList.length;
      if (numParticipants > 0) {
        if (finalSplitType === 'settlement') {
          // Direct settlement: 100% of amount goes to the recipient user (receiver)
          const recipientId = await getOrAddUser(cleanSplitList[0]);
          await db.run(
            `INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)`,
            [expenseId, recipientId, inrAmount]
          );
        } else if (finalSplitType === 'percentage') {
          // Parse percentages
          const detailsStr = finalSplitDetails || '';
          const detailsParts = detailsStr.split(';').map(p => p.trim()).filter(p => p !== '');
          const pctMap = {};
          let totalPct = 0;

          detailsParts.forEach(part => {
            const match = part.match(/(.+)\s+(\d+)%/);
            if (match) {
              const name = match[1].trim();
              const pct = parseFloat(match[2]);
              pctMap[name.toLowerCase()] = pct;
              totalPct += pct;
            }
          });

          // Normalize if sum is not 100
          const normalizeFactor = totalPct > 0 ? (100 / totalPct) : 1.0;

          for (const rawName of cleanSplitList) {
            const userId = await getOrAddUser(rawName);
            const userPct = pctMap[rawName.toLowerCase()] || (100 / numParticipants);
            const resolvedPct = userPct * normalizeFactor;
            const splitAmount = parseFloat((inrAmount * (resolvedPct / 100)).toFixed(2));
            
            await db.run(
              `INSERT OR REPLACE INTO expense_splits (expense_id, user_id, amount, share_value) VALUES (?, ?, ?, ?)`,
              [expenseId, userId, splitAmount, resolvedPct]
            );
          }
        } else if (finalSplitType === 'share') {
          // Parse shares
          const detailsStr = finalSplitDetails || '';
          const detailsParts = detailsStr.split(';').map(p => p.trim()).filter(p => p !== '');
          const shareMap = {};
          let totalShares = 0;

          detailsParts.forEach(part => {
            const match = part.match(/(.+)\s+(\d+)/);
            if (match) {
              const name = match[1].trim();
              const val = parseFloat(match[2]);
              shareMap[name.toLowerCase()] = val;
              totalShares += val;
            }
          });

          // If empty details, treat all active split list as 1 share
          if (totalShares === 0) {
            cleanSplitList.forEach(name => {
              shareMap[name.toLowerCase()] = 1;
              totalShares += 1;
            });
          }

          for (const rawName of cleanSplitList) {
            const userId = await getOrAddUser(rawName);
            const userShares = shareMap[rawName.toLowerCase()] || 1;
            const splitAmount = parseFloat((inrAmount * (userShares / totalShares)).toFixed(2));

            await db.run(
              `INSERT OR REPLACE INTO expense_splits (expense_id, user_id, amount, share_value) VALUES (?, ?, ?, ?)`,
              [expenseId, userId, splitAmount, userShares]
            );
          }
        } else {
          // EQUAL splits: split amount equally
          // In cleanSplitList, duplicates are handled (like Dev having 2 shares if Dev absorbed Kabir)
          // To compute equal shares, we count occurrences in cleanSplitList
          const counts = {};
          cleanSplitList.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
          const totalCounts = cleanSplitList.length;

          for (const [rawName, count] of Object.entries(counts)) {
            const userId = await getOrAddUser(rawName);
            const splitAmount = parseFloat((inrAmount * (count / totalCounts)).toFixed(2));

            await db.run(
              `INSERT OR REPLACE INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)`,
              [expenseId, userId, splitAmount]
            );
          }
        }
      }

      report.totalRowsIngested++;
    }

    // Log the successful import
    await db.run(
      `INSERT INTO import_logs (filename, status, summary) VALUES (?, ?, ?)`,
      ['Expenses Export.csv', 'success', JSON.stringify(report)]
    );

    await db.run('COMMIT');
    res.json({ message: 'CSV imported successfully', report });

  } catch (err) {
    console.error(err);
    await db.run('ROLLBACK');
    res.status(500).json({ error: 'Import transaction failed' });
  }
});

// Launch server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
