import initSqlJs, { Database } from 'sql.js';
import { addAutoGroupBy } from '../core/auto-groupby';
import { diffChars } from 'diff';
import { improveQuery, hasApiKey, getApiKey, setApiKey } from '../core/llm-assistant';

let db: Database | null = null;
let transformTimeout: number | null = null;
let currentSuggestion = '';
let aiAbortController: AbortController | null = null;

// DOM elements
const sqlInput = document.getElementById('sql-input') as HTMLTextAreaElement;
const sqlOutput = document.getElementById('sql-output') as HTMLTextAreaElement;
const suggestionOverlay = document.getElementById('sql-suggestion') as HTMLDivElement;
const executeBtn = document.getElementById('execute-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const copyToInputBtn = document.getElementById('copy-to-input-btn') as HTMLButtonElement;
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

// Transform SQL in real-time (updates output textarea)
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

// Update inline suggestion overlay (autocomplete style)
function updateSuggestion() {
  const originalSQL = sqlInput.value;

  if (!originalSQL.trim()) {
    suggestionOverlay.innerHTML = '';
    currentSuggestion = '';
    return;
  }

  try {
    const transformedSQL = addAutoGroupBy(originalSQL);

    if (transformedSQL === originalSQL) {
      suggestionOverlay.innerHTML = '';
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

      suggestionOverlay.innerHTML = html;
      currentSuggestion = transformedSQL;
    } else {
      // For complex transformations, don't show inline suggestion
      suggestionOverlay.innerHTML = '';
      currentSuggestion = '';
    }

  } catch (error) {
    console.error('Suggestion error:', error);
    suggestionOverlay.innerHTML = '';
    currentSuggestion = '';
  }
}

// Debounced transform on input
sqlInput.addEventListener('input', () => {
  if (transformTimeout !== null) {
    clearTimeout(transformTimeout);
  }

  transformTimeout = window.setTimeout(() => {
    transformSQL(); // Update output textarea
    updateSuggestion(); // Update inline suggestion overlay
  }, 300); // 300ms debounce
});

// Execute SQL query
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

// Copy transformed SQL to input
copyToInputBtn.addEventListener('click', () => {
  sqlInput.value = sqlOutput.value;
  sqlInput.focus();
  suggestionOverlay.innerHTML = '';
  currentSuggestion = '';
  transformSQL(); // Re-transform to update output
});

// Clear input
clearBtn.addEventListener('click', () => {
  sqlInput.value = '';
  sqlOutput.value = '';
  sqlOutput.classList.remove('transformed');
  suggestionOverlay.innerHTML = '';
  currentSuggestion = '';
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

  // Accept inline suggestion with Tab key
  if (e.key === 'Tab' && currentSuggestion) {
    e.preventDefault();
    sqlInput.value = currentSuggestion;
    suggestionOverlay.innerHTML = '';
    currentSuggestion = '';

    // Update output to match
    transformSQL();
  }
});

// Load example queries
document.querySelectorAll('.example').forEach(el => {
  el.addEventListener('click', () => {
    const exampleSQL = el.getAttribute('data-sql');
    if (exampleSQL) {
      sqlInput.value = exampleSQL;
      sqlOutput.value = '';
      sqlOutput.classList.remove('transformed');
      suggestionOverlay.innerHTML = '';
      currentSuggestion = '';
      resultsDiv.innerHTML = '';
      hideStatus();
      sqlInput.focus();

      // Trigger transformation after a short delay
      setTimeout(() => {
        transformSQL();
        updateSuggestion();
      }, 100);
    }
  });
});

// ---- AI Assistant ----

const aiImproveBtn = document.getElementById('ai-improve-btn') as HTMLButtonElement;
const aiKeyBtn = document.getElementById('ai-key-btn') as HTMLButtonElement;
const aiStatus = document.getElementById('ai-status') as HTMLSpanElement;
const aiSuggestionPanel = document.getElementById('ai-suggestion-panel') as HTMLDivElement;
const aiSuggestionSql = document.getElementById('ai-suggestion-sql') as HTMLTextAreaElement;
const aiAcceptBtn = document.getElementById('ai-accept-btn') as HTMLButtonElement;
const aiDismissBtn = document.getElementById('ai-dismiss-btn') as HTMLButtonElement;

// Modal elements
const apiKeyModal = document.getElementById('api-key-modal') as HTMLDivElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const apiKeySaveBtn = document.getElementById('api-key-save-btn') as HTMLButtonElement;
const apiKeyCancelBtn = document.getElementById('api-key-cancel-btn') as HTMLButtonElement;
const apiKeyClearBtn = document.getElementById('api-key-clear-btn') as HTMLButtonElement;

function refreshAiState() {
  const configured = hasApiKey();
  aiImproveBtn.disabled = !configured;
  aiKeyBtn.classList.toggle('configured', configured);
  if (configured) {
    aiStatus.textContent = 'Ready';
    aiStatus.className = 'ai-status';
  } else {
    aiStatus.textContent = 'Enter an OpenAI API key to enable';
    aiStatus.className = 'ai-status';
  }
}

// Modal open/close
aiKeyBtn.addEventListener('click', () => {
  apiKeyInput.value = getApiKey() || '';
  apiKeyModal.classList.add('open');
  apiKeyInput.focus();
});

function closeModal() {
  apiKeyModal.classList.remove('open');
  apiKeyInput.value = '';
}

apiKeyCancelBtn.addEventListener('click', closeModal);
apiKeyModal.addEventListener('click', (e) => {
  if (e.target === apiKeyModal) closeModal();
});

apiKeySaveBtn.addEventListener('click', () => {
  setApiKey(apiKeyInput.value);
  closeModal();
  refreshAiState();
});

apiKeyClearBtn.addEventListener('click', () => {
  setApiKey('');
  closeModal();
  refreshAiState();
  dismissAiSuggestion();
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    apiKeySaveBtn.click();
  } else if (e.key === 'Escape') {
    closeModal();
  }
});

// Improve query with AI
aiImproveBtn.addEventListener('click', async () => {
  const sql = sqlInput.value.trim();
  if (!sql) {
    aiStatus.textContent = 'Type a query first';
    aiStatus.className = 'ai-status error';
    return;
  }

  // Cancel any in-flight request
  if (aiAbortController) {
    aiAbortController.abort();
  }
  aiAbortController = new AbortController();

  aiImproveBtn.disabled = true;
  aiStatus.textContent = 'Thinking...';
  aiStatus.className = 'ai-status working';
  dismissAiSuggestion();

  const result = await improveQuery(sql, aiAbortController.signal);
  aiAbortController = null;

  if (result.success && result.query) {
    aiSuggestionSql.value = result.query;
    aiSuggestionPanel.classList.add('visible');
    aiStatus.textContent = 'Suggestion ready';
    aiStatus.className = 'ai-status';
  } else {
    aiStatus.textContent = result.error || 'Failed';
    aiStatus.className = 'ai-status error';
  }

  aiImproveBtn.disabled = !hasApiKey();
});

// Accept AI suggestion
aiAcceptBtn.addEventListener('click', () => {
  const suggested = aiSuggestionSql.value;
  if (suggested) {
    sqlInput.value = suggested;
    dismissAiSuggestion();
    transformSQL();
    updateSuggestion();
    sqlInput.focus();
  }
});

// Dismiss AI suggestion
function dismissAiSuggestion() {
  aiSuggestionPanel.classList.remove('visible');
  aiSuggestionSql.value = '';
}

aiDismissBtn.addEventListener('click', dismissAiSuggestion);

// Initialize AI state on load
refreshAiState();

// Initialize on page load
initDatabase();
