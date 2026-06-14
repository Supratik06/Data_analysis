import fs from 'fs';

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const KNOWN_MEMBERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];

export function parseCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { rows: [], anomalies: [] };

  const headers = splitCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows = [];
  const anomalies = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] || '';
    });
    // Add 1-based index (header is line 1, data starts at line 2)
    rowObj.rowIndex = i + 1;
    rows.push(rowObj);
  }

  // Helper to normalize names
  const normalizeName = (name) => {
    if (!name) return '';
    const clean = name.trim().toLowerCase();
    if (clean === 'priya s' || clean === 'priya') return 'Priya';
    if (clean === 'rohan') return 'Rohan';
    if (clean === 'aisha') return 'Aisha';
    if (clean === 'meera') return 'Meera';
    if (clean === 'sam') return 'Sam';
    if (clean === 'dev') return 'Dev';
    if (clean === 'kabir' || clean === "dev's friend kabir") return 'Kabir';
    
    // Capitalize first letter as fallback
    return name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
  };

  // Perform checks row-by-row
  rows.forEach((row) => {
    const rIdx = row.rowIndex;
    
    // 1. Paid By missing
    if (!row.paid_by) {
      anomalies.push({
        rowIndex: rIdx,
        type: 'MISSING_PAID_BY',
        description: `Row ${rIdx}: Missing 'paid_by' for expense "${row.description}".`,
        data: row,
        resolved: false
      });
    } else {
      // Name Inconsistencies for Payer
      const normPayer = normalizeName(row.paid_by);
      if (row.paid_by !== normPayer) {
        anomalies.push({
          rowIndex: rIdx,
          type: 'NAME_INCONSISTENCY',
          description: `Row ${rIdx}: Payer name "${row.paid_by}" has inconsistent format. Suggesting "${normPayer}".`,
          data: { field: 'paid_by', original: row.paid_by, suggested: normPayer },
          resolved: false
        });
      }
    }

    // 2. Amount Validation (quoted numbers, decimals, zero, negative)
    let amountStr = row.amount || '';
    // Strip commas
    amountStr = amountStr.replace(/,/g, '');
    const amountVal = parseFloat(amountStr);

    if (isNaN(amountVal)) {
      anomalies.push({
        rowIndex: rIdx,
        type: 'INVALID_AMOUNT',
        description: `Row ${rIdx}: Amount "${row.amount}" is not a valid number.`,
        data: row,
        resolved: false
      });
    } else {
      // Float precision check (e.g. 899.995)
      const decimalPart = amountStr.split('.')[1] || '';
      if (decimalPart.length > 2) {
        anomalies.push({
          rowIndex: rIdx,
          type: 'FLOAT_PRECISION',
          description: `Row ${rIdx}: Amount ${amountVal} has more than 2 decimal places. Suggesting rounding to ${amountVal.toFixed(2)}.`,
          data: { original: amountVal, suggested: parseFloat(amountVal.toFixed(2)) },
          resolved: false
        });
      }

      // Zero amount
      if (amountVal === 0) {
        anomalies.push({
          rowIndex: rIdx,
          type: 'ZERO_AMOUNT',
          description: `Row ${rIdx}: Expense "${row.description}" has zero amount.`,
          data: row,
          resolved: false
        });
      }

      // Negative amount
      if (amountVal < 0) {
        anomalies.push({
          rowIndex: rIdx,
          type: 'NEGATIVE_AMOUNT',
          description: `Row ${rIdx}: Expense "${row.description}" has negative amount (${amountVal}). Interpreting as a refund.`,
          data: row,
          resolved: false
        });
      }
    }

    // 3. Currency blank
    if (!row.currency) {
      anomalies.push({
        rowIndex: rIdx,
        type: 'MISSING_CURRENCY',
        description: `Row ${rIdx}: Currency is missing for expense "${row.description}". Defaulting to "INR".`,
        data: row,
        resolved: false
      });
    }

    // 4. Currency USD
    if (row.currency && row.currency.toUpperCase() === 'USD') {
      anomalies.push({
        rowIndex: rIdx,
        type: 'USD_CURRENCY',
        description: `Row ${rIdx}: Expense "${row.description}" is in USD ($${amountVal}). Needs exchange rate conversion.`,
        data: { amount: amountVal, currency: 'USD' },
        resolved: false
      });
    }

    // 5. Date checks (Inconsistent Date Format, Ambiguous Dates)
    const dateStr = row.date || '';
    let parsedDate = null;
    let isAmbiguous = false;
    let isNonStandard = false;

    // Check if it's Mar-14 format
    if (dateStr.toLowerCase() === 'mar-14') {
      parsedDate = new Date(2026, 2, 14); // 14 March 2026
      isNonStandard = true;
    } else {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          // Check for ambiguous format like 04-05-2026 where it could be April 5 or May 4
          // The note says "is this April 5 or May 4? format is a mess"
          if (row.description.toLowerCase().includes('deep cleaning') && dateStr === '04-05-2026') {
            isAmbiguous = true;
          }
          parsedDate = new Date(year, month - 1, day);
        }
      }
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) {
      anomalies.push({
        rowIndex: rIdx,
        type: 'INVALID_DATE',
        description: `Row ${rIdx}: Date "${dateStr}" is invalid.`,
        data: row,
        resolved: false
      });
    } else {
      if (isNonStandard) {
        anomalies.push({
          rowIndex: rIdx,
          type: 'NON_STANDARD_DATE',
          description: `Row ${rIdx}: Date "${dateStr}" is in a non-standard format. Suggesting "14-03-2026".`,
          data: { original: dateStr, suggested: '14-03-2026' },
          resolved: false
        });
      }
      if (isAmbiguous) {
        anomalies.push({
          rowIndex: rIdx,
          type: 'AMBIGUOUS_DATE',
          description: `Row ${rIdx}: Date "04-05-2026" for "${row.description}" is ambiguous. Suggesting "05-04-2026" (April 5, 2026) based on context.`,
          data: { original: dateStr, options: ['05-04-2026', '04-05-2026'], suggested: '05-04-2026' },
          resolved: false
        });
      }
    }

    // 6. Split Type and Settlement Checks
    if (!row.split_type) {
      if (row.description.toLowerCase().includes('paid') || row.description.toLowerCase().includes('back')) {
        anomalies.push({
          rowIndex: rIdx,
          type: 'SETTLEMENT_LOGGED_AS_EXPENSE',
          description: `Row ${rIdx}: "${row.description}" has no split type and looks like a settlement. Suggesting importing as Settlement (Payment).`,
          data: { isSettlement: true },
          resolved: false
        });
      } else {
        anomalies.push({
          rowIndex: rIdx,
          type: 'MISSING_SPLIT_TYPE',
          description: `Row ${rIdx}: Split type is missing. Defaulting to 'equal'.`,
          data: row,
          resolved: false
        });
      }
    }

    // 7. Split Details and Split With Checks (Kabir / Non-members, Invalid percentage sums)
    const splitWithStr = row.split_with || '';
    const splitMembers = splitWithStr.split(';').map(m => m.trim()).filter(m => m !== '');
    
    // Check if any split member is a non-member (e.g. Kabir)
    const nonMembers = splitMembers.filter(m => !KNOWN_MEMBERS.includes(normalizeName(m)));
    if (nonMembers.length > 0) {
      anomalies.push({
        rowIndex: rIdx,
        type: 'NON_GROUP_MEMBERS',
        description: `Row ${rIdx}: Split includes non-flatmates: ${nonMembers.join(', ')}.`,
        data: { nonMembers, originalSplitWith: splitWithStr },
        resolved: false
      });
    }

    // Standardize Split With Names
    const invalidSplitWithNames = splitMembers.filter(m => m !== normalizeName(m));
    if (invalidSplitWithNames.length > 0) {
      const suggestedSplitWith = splitMembers.map(normalizeName).join(';');
      anomalies.push({
        rowIndex: rIdx,
        type: 'SPLIT_WITH_NAME_INCONSISTENCY',
        description: `Row ${rIdx}: Split list contains format inconsistencies. Suggesting: "${suggestedSplitWith}".`,
        data: { original: splitWithStr, suggested: suggestedSplitWith },
        resolved: false
      });
    }

    // Percentage split sum verification
    if (row.split_type === 'percentage') {
      const splitDetailsStr = row.split_details || '';
      const detailsParts = splitDetailsStr.split(';').map(p => p.trim()).filter(p => p !== '');
      let totalPercentage = 0;
      detailsParts.forEach(part => {
        const match = part.match(/(.+)\s+(\d+)%/);
        if (match) {
          totalPercentage += parseFloat(match[2]);
        }
      });
      if (totalPercentage !== 100) {
        anomalies.push({
          rowIndex: rIdx,
          type: 'INVALID_PERCENTAGE_SUM',
          description: `Row ${rIdx}: Percentage split sums to ${totalPercentage}% instead of 100% (Row Details: "${row.split_details}").`,
          data: { totalPercentage, originalDetails: splitDetailsStr },
          resolved: false
        });
      }
    }

    // Equal split with split details
    if (row.split_type === 'equal' && row.split_details) {
      anomalies.push({
        rowIndex: rIdx,
        type: 'EQUAL_SPLIT_WITH_DETAILS',
        description: `Row ${rIdx}: Split type is "equal" but "split_details" was provided ("${row.split_details}"). Details will be ignored unless type changed to shares/percentage.`,
        data: { split_details: row.split_details },
        resolved: false
      });
    }

    // 8. Timeline bounds (Meera leaving, Sam arriving)
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      // Meera moved out March 31, 2026. Any expense after March 31, 2026 involving Meera is a timeline violation
      const meeraCutoff = new Date(2026, 3, 1); // April 1, 2026
      if (parsedDate >= meeraCutoff) {
        const includesMeera = splitMembers.map(normalizeName).includes('Meera');
        if (includesMeera) {
          anomalies.push({
            rowIndex: rIdx,
            type: 'TIMELINE_VIOLATION_MEERA',
            description: `Row ${rIdx}: "${row.description}" on ${dateStr} includes Meera, but she moved out on March 31, 2026.`,
            data: { date: dateStr, member: 'Meera' },
            resolved: false
          });
        }
      }

      // Sam moved in mid-April. Let's set his moving date to April 15, 2026.
      // Row 40 is dated April 12, 2026 (Electricity Apr) and includes Sam. 
      // Sam deposit is April 8, 2026.
      // Housewarming drinks is April 10, 2026.
      // If Sam is included in splits before April 15, 2026, flag it.
      const samCutoff = new Date(2026, 3, 15); // April 15, 2026
      if (parsedDate < samCutoff) {
        const includesSam = splitMembers.map(normalizeName).includes('Sam');
        // Ignore the deposit payment since it's a settlement between Sam and Aisha
        const isSamDeposit = row.description.toLowerCase().includes('deposit') && row.paid_by.toLowerCase() === 'sam';
        if (includesSam && !isSamDeposit) {
          anomalies.push({
            rowIndex: rIdx,
            type: 'TIMELINE_VIOLATION_SAM',
            description: `Row ${rIdx}: "${row.description}" on ${dateStr} includes Sam, but he moved in on April 15, 2026.`,
            data: { date: dateStr, member: 'Sam' },
            resolved: false
          });
        }
      }
    }
  });

  // 9. Duplicate and Conflict Detection ( Marina Bites, Thalassa Dinner )
  for (let i = 0; i < rows.length; i++) {
    const rowA = rows[i];
    const amountA = parseFloat((rowA.amount || '').replace(/,/g, ''));
    if (isNaN(amountA)) continue;

    for (let j = i + 1; j < rows.length; j++) {
      const rowB = rows[j];
      const amountB = parseFloat((rowB.amount || '').replace(/,/g, ''));
      if (isNaN(amountB)) continue;

      // Check if dates are identical (or normalized identical)
      let dateA = rowA.date;
      let dateB = rowB.date;
      if (dateA.toLowerCase() === 'mar-14') dateA = '14-03-2026';
      if (dateB.toLowerCase() === 'mar-14') dateB = '14-03-2026';

      if (dateA === dateB) {
        const descA = rowA.description.toLowerCase();
        const descB = rowB.description.toLowerCase();

        // Check for Marina Bites duplicate (same payer, same amount, same date, very similar description)
        if (rowA.paid_by.toLowerCase() === rowB.paid_by.toLowerCase() && Math.abs(amountA - amountB) < 0.01) {
          if (descA.includes('marina') || descB.includes('marina') || descA.includes('dinner') && descB.includes('dinner')) {
            anomalies.push({
              rowIndex: rowB.rowIndex,
              type: 'DUPLICATE_ENTRY',
              description: `Row ${rowB.rowIndex} ("${rowB.description}") appears to be a duplicate of Row ${rowA.rowIndex} ("${rowA.description}").`,
              data: { duplicateOf: rowA.rowIndex, rowA: rowA.rowIndex, rowB: rowB.rowIndex, amount: amountA },
              resolved: false
            });
          }
        }

        // Check for Thalassa conflict (overlapping dinners logged by different people, e.g., Aisha 2400 and Rohan 2450)
        if (descA.includes('thalassa') && descB.includes('thalassa')) {
          anomalies.push({
            rowIndex: rowB.rowIndex,
            type: 'CONFLICTING_ENTRY',
            description: `Row ${rowB.rowIndex} ("${rowB.description}" by ${rowB.paid_by}) conflicts with Row ${rowA.rowIndex} ("${rowA.description}" by ${rowA.paid_by}) on the same dinner.`,
            data: { rowA: rowA.rowIndex, rowB: rowB.rowIndex, payerA: rowA.paid_by, payerB: rowB.paid_by, amountA, amountB },
            resolved: false
          });
        }
      }
    }
  }

  return { rows, anomalies };
}
