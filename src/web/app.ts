import initSqlJs, { Database } from 'sql.js';
import { addAutoGroupBy } from '../core/auto-groupby';

let db: Database | null = null;
let transformTimeout: number | null = null;

// DOM elements
const sqlInput = document.getElementById('sql-input') as HTMLTextAreaElement;
const executeBtn = document.getElementById('execute-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// Initialize SQL.js and load Chinook database
async function initDatabase() {
  try {
    showStatus('Loading database...', 'info');

    // Initialize SQL.js
    const SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`
    });

    // Fetch Chinook database
    const response = await fetch('https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_Sqlite.sqlite');
    const buffer = await response.arrayBuffer();

    db = new SQL.Database(new Uint8Array(buffer));

    showStatus('Database loaded! (Chinook music database)', 'success');
    setTimeout(() => hideStatus(), 3000);

    return true;
  } catch (error) {
    showStatus(`Error loading database: ${error}`, 'error');
    console.error('Database initialization error:', error);
    return false;
  }
}

// Transform SQL in real-time
function transformSQL() {
  const originalSQL = sqlInput.value.trim();

  if (!originalSQL) {
    sqlInput.classList.remove('transformed');
    return;
  }

  try {
    const transformedSQL = addAutoGroupBy(originalSQL);

    // Only update if transformation changed the SQL
    if (transformedSQL !== originalSQL) {
      // Save cursor position
      const cursorPos = sqlInput.selectionStart;

      sqlInput.value = transformedSQL;
      sqlInput.classList.add('transformed');

      // Restore cursor position (approximately)
      sqlInput.setSelectionRange(cursorPos, cursorPos);
    } else {
      sqlInput.classList.remove('transformed');
    }
  } catch (error) {
    console.error('Transform error:', error);
    sqlInput.classList.remove('transformed');
  }
}

// Debounced transform on input
sqlInput.addEventListener('input', () => {
  if (transformTimeout !== null) {
    clearTimeout(transformTimeout);
  }

  transformTimeout = window.setTimeout(() => {
    transformSQL();
  }, 300); // 300ms debounce
});

// Execute SQL query
async function executeQuery() {
  if (!db) {
    showStatus('Database not loaded yet. Please wait...', 'error');
    return;
  }

  const sql = sqlInput.value.trim();

  if (!sql) {
    showStatus('Please enter a SQL query', 'error');
    return;
  }

  try {
    showStatus('Executing query...', 'info');

    const results = db.exec(sql);

    if (results.length === 0) {
      showStatus('Query executed successfully (no results)', 'success');
      resultsDiv.innerHTML = '';
      return;
    }

    // Display results
    displayResults(results[0]);
    showStatus(`Query executed successfully (${results[0].values.length} rows)`, 'success');

  } catch (error) {
    showStatus(`SQL Error: ${error}`, 'error');
    resultsDiv.innerHTML = '';
  }
}

// Display query results as a table
function displayResults(result: { columns: string[], values: any[][] }) {
  const { columns, values } = result;

  let html = '<table>';

  // Header
  html += '<thead><tr>';
  for (const col of columns) {
    html += `<th>${escapeHtml(col)}</th>`;
  }
  html += '</tr></thead>';

  // Body
  html += '<tbody>';
  for (const row of values) {
    html += '<tr>';
    for (const cell of row) {
      const displayValue = cell === null ? '<i>NULL</i>' : escapeHtml(String(cell));
      html += `<td>${displayValue}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';

  html += '</table>';
  resultsDiv.innerHTML = html;
}

// Show status message
function showStatus(message: string, type: 'info' | 'success' | 'error') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
}

// Hide status message
function hideStatus() {
  statusDiv.style.display = 'none';
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Clear input
clearBtn.addEventListener('click', () => {
  sqlInput.value = '';
  sqlInput.classList.remove('transformed');
  resultsDiv.innerHTML = '';
  hideStatus();
  sqlInput.focus();
});

// Execute query
executeBtn.addEventListener('click', executeQuery);

// Execute on Ctrl/Cmd + Enter
sqlInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    executeQuery();
  }
});

// Load example queries
document.querySelectorAll('.example').forEach(el => {
  el.addEventListener('click', () => {
    const exampleSQL = el.getAttribute('data-sql');
    if (exampleSQL) {
      sqlInput.value = exampleSQL;
      sqlInput.classList.remove('transformed');
      resultsDiv.innerHTML = '';
      hideStatus();
      sqlInput.focus();

      // Trigger transformation after a short delay
      setTimeout(() => transformSQL(), 100);
    }
  });
});

// Initialize on page load
initDatabase();
