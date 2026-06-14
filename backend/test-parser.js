import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSV } from './parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve(__dirname, '../Expenses Export.csv');

try {
  const content = fs.readFileSync(csvPath, 'utf8');
  console.log('Successfully read CSV file.');
  const { rows, anomalies } = parseCSV(content);

  console.log(`\nParsed ${rows.length} rows.`);
  console.log(`Detected ${anomalies.length} anomalies:\n`);

  anomalies.forEach((a, index) => {
    console.log(`[Anomaly ${index + 1}] Type: ${a.type}`);
    console.log(`  Description: ${a.description}`);
    if (a.data) {
      console.log(`  Data: ${JSON.stringify(a.data)}`);
    }
    console.log('-------------------------------------------');
  });

} catch (err) {
  console.error('Error reading/parsing CSV:', err);
}
