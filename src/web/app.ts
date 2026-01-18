import initSqlJs, { Database } from 'sql.js';
import { addAutoGroupBy } from '../core/auto-groupby';
import { diffChars } from 'diff';

let db: Database | null = null;
let transformTimeout: number | null = null;
let currentSuggestion = '';

// DOM elements - Tab 1 (Separate Boxes)
const sqlInput = document.getElementById('sql-input') as HTMLTextAreaElement;
const sqlOutput = document.getElementById('sql-output') as HTMLTextAreaElement;
const executeBtn = document.getElementById('execute-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const copyToInputBtn = document.getElementById('copy-to-input-btn') as HTMLButtonElement;

// DOM elements - Tab 2 (Autocomplete)
const sqlInputAutocomplete = document.getElementById('sql-input-autocomplete') as HTMLTextAreaElement;
const suggestionOverlayAutocomplete = document.getElementById('sql-suggestion-autocomplete') as HTMLDivElement;
const executeBtnAutocomplete = document.getElementById('execute-btn-autocomplete') as HTMLButtonElement;
const clearBtnAutocomplete = document.getElementById('clear-btn-autocomplete') as HTMLButtonElement;

// Shared elements
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

// Tab 1: Transform SQL in real-time (updates output textarea)
function transformSQL() {
  const originalSQL = sqlInput.value.trim();

  if (!originalSQL) {
    sqlOutput.value = '';
    sqlOutput.classList.remove('transformed');
    return;
  }

  try {
    const transformedSQL = addAutoGroupBy(originalSQL);

    // Update OUTPUT textarea, not INPUT (prevents typing disruption)
    sqlOutput.value = transformedSQL;

    if (transformedSQL !== originalSQL) {
      sqlOutput.classList.add('transformed');
    } else {
      sqlOutput.classList.remove('transformed');
    }
  } catch (error) {
    console.error('Transform error:', error);
    sqlOutput.value = originalSQL;
    sqlOutput.classList.remove('transformed');
  }
}

// Tab 2: Update inline suggestion overlay (autocomplete style)
function updateSuggestionAutocomplete() {
  const originalSQL = sqlInputAutocomplete.value;

  if (!originalSQL.trim()) {
    suggestionOverlayAutocomplete.innerHTML = '';
    currentSuggestion = '';
    return;
  }

  try {
    const transformedSQL = addAutoGroupBy(originalSQL);

    if (transformedSQL === originalSQL) {
      suggestionOverlayAutocomplete.innerHTML = '';
      currentSuggestion = '';
      return;
    }

    // Calculate diff to show inline additions
    const diff = diffChars(originalSQL, transformedSQL);

    // Check if transformation is append-only (only additions at the end)
    let isAppendOnly = true;
    let hasRemovals = false;

    for (const part of diff) {
      if (part.removed) {
        hasRemovals = true;
        isAppendOnly = false;
        break;
      }
    }

    // Only show inline suggestion for append-only changes
    if (isAppendOnly && !hasRemovals) {
      let html = '';
      for (const part of diff) {
        if (part.added) {
          // Show additions as greyed-out
          html += `<span class="suggestion-addition">${escapeHtml(part.value)}</span>`;
        } else {
          // Show unchanged parts (will be covered by textarea)
          html += `<span class="suggestion-text">${escapeHtml(part.value)}</span>`;
        }
      }

      suggestionOverlayAutocomplete.innerHTML = html;
      currentSuggestion = transformedSQL;
    } else {
      // For complex transformations, don't show inline suggestion
      suggestionOverlayAutocomplete.innerHTML = '';
      currentSuggestion = '';
    }

  } catch (error) {
    console.error('Suggestion error:', error);
    suggestionOverlayAutocomplete.innerHTML = '';
    currentSuggestion = '';
  }
}

// Tab 1: Debounced transform on input (separate boxes)
sqlInput.addEventListener('input', () => {
  if (transformTimeout !== null) {
    clearTimeout(transformTimeout);
  }

  transformTimeout = window.setTimeout(() => {
    transformSQL();
  }, 300);
});

// Tab 2: Debounced suggestion update on input (autocomplete)
let autocompleteTimeout: number | null = null;
sqlInputAutocomplete.addEventListener('input', () => {
  if (autocompleteTimeout !== null) {
    clearTimeout(autocompleteTimeout);
  }

  autocompleteTimeout = window.setTimeout(() => {
    updateSuggestionAutocomplete();
  }, 300);
});

// Tab 1: Execute SQL query (from separate boxes)
async function executeQuery() {
  if (!db) {
    showStatus('Database not loaded yet. Please wait...', 'error');
    return;
  }

  // Use transformed SQL if available, otherwise use input
  const sql = sqlOutput.value.trim() || sqlInput.value.trim();

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

// Tab 2: Execute SQL query (from autocomplete)
async function executeQueryAutocomplete() {
  if (!db) {
    showStatus('Database not loaded yet. Please wait...', 'error');
    return;
  }

  // Apply transformation if suggestion exists, otherwise use current input
  const sql = currentSuggestion || addAutoGroupBy(sqlInputAutocomplete.value.trim());

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

// Tab 1: Copy transformed SQL to input
copyToInputBtn.addEventListener('click', () => {
  sqlInput.value = sqlOutput.value;
  sqlInput.focus();
  transformSQL();
});

// Tab 1: Clear input
clearBtn.addEventListener('click', () => {
  sqlInput.value = '';
  sqlOutput.value = '';
  sqlOutput.classList.remove('transformed');
  resultsDiv.innerHTML = '';
  hideStatus();
  sqlInput.focus();
});

// Tab 1: Execute query button
executeBtn.addEventListener('click', executeQuery);

// Tab 1: Execute on Ctrl/Cmd + Enter
sqlInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    executeQuery();
  }
});

// Tab 2: Clear input (autocomplete)
clearBtnAutocomplete.addEventListener('click', () => {
  sqlInputAutocomplete.value = '';
  suggestionOverlayAutocomplete.innerHTML = '';
  currentSuggestion = '';
  resultsDiv.innerHTML = '';
  hideStatus();
  sqlInputAutocomplete.focus();
});

// Tab 2: Execute query button (autocomplete)
executeBtnAutocomplete.addEventListener('click', executeQueryAutocomplete);

// Tab 2: Execute on Ctrl/Cmd + Enter and accept suggestion with Tab
sqlInputAutocomplete.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    executeQueryAutocomplete();
  }

  // Accept inline suggestion with Tab key
  if (e.key === 'Tab' && currentSuggestion) {
    e.preventDefault();
    sqlInputAutocomplete.value = currentSuggestion;
    suggestionOverlayAutocomplete.innerHTML = '';
    currentSuggestion = '';
  }
});

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.getAttribute('data-tab');

    // Update active tab button
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`)?.classList.add('active');

    // Clear results when switching tabs
    resultsDiv.innerHTML = '';
    hideStatus();

    // Focus appropriate input
    if (tabName === 'separate') {
      sqlInput.focus();
    } else if (tabName === 'autocomplete') {
      sqlInputAutocomplete.focus();
      // Trigger initial suggestion
      setTimeout(() => updateSuggestionAutocomplete(), 100);
    }
  });
});

// Load example queries (works with active tab)
document.querySelectorAll('.example').forEach(el => {
  el.addEventListener('click', () => {
    const exampleSQL = el.getAttribute('data-sql');
    if (!exampleSQL) return;

    // Check which tab is active
    const activeTab = document.querySelector('.tab-content.active')?.id;

    if (activeTab === 'tab-separate') {
      // Tab 1: Separate boxes
      sqlInput.value = exampleSQL;
      sqlOutput.value = '';
      sqlOutput.classList.remove('transformed');
      resultsDiv.innerHTML = '';
      hideStatus();
      sqlInput.focus();
      setTimeout(() => transformSQL(), 100);
    } else if (activeTab === 'tab-autocomplete') {
      // Tab 2: Autocomplete
      sqlInputAutocomplete.value = exampleSQL;
      suggestionOverlayAutocomplete.innerHTML = '';
      currentSuggestion = '';
      resultsDiv.innerHTML = '';
      hideStatus();
      sqlInputAutocomplete.focus();
      setTimeout(() => updateSuggestionAutocomplete(), 100);
    }
  });
});

// Initialize on page load
initDatabase();
