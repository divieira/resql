import initSqlJs, { Database } from 'sql.js';
import { addAutoGroupBy } from '../core/auto-groupby';
import { diffChars } from 'diff';
import { autocompleteQuery, hasApiKey, getApiKey, setApiKey } from '../core/llm-assistant';

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
  // Cancel any pending AI request — user is still typing
  cancelAi();

  transformTimeout = window.setTimeout(() => {
    transformSQL();
    updateSuggestion();

    // If no GROUP BY suggestion appeared, try AI autocomplete
    if (!currentSuggestion) {
      scheduleAiAutocomplete();
    }
  }, 300);
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
    cancelAi();

    // Update output to match
    transformSQL();
  }

  // Dismiss AI suggestion with Escape
  if (e.key === 'Escape') {
    clearAiSuggestion();
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

// ---- AI Inline Autocomplete ----

const aiKeyBtn = document.getElementById('ai-key-btn') as HTMLButtonElement;
const aiStatus = document.getElementById('ai-status') as HTMLSpanElement;
const apiKeyModal = document.getElementById('api-key-modal') as HTMLDivElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const apiKeySaveBtn = document.getElementById('api-key-save-btn') as HTMLButtonElement;
const apiKeyCancelBtn = document.getElementById('api-key-cancel-btn') as HTMLButtonElement;
const apiKeyClearBtn = document.getElementById('api-key-clear-btn') as HTMLButtonElement;

let aiTimeout: number | null = null;
const AI_DEBOUNCE_MS = 1000;

function refreshAiState() {
  const configured = hasApiKey();
  aiKeyBtn.classList.toggle('configured', configured);
  if (configured) {
    aiStatus.textContent = 'AI autocomplete active (Tab to accept)';
    aiStatus.className = 'ai-status';
  } else {
    aiStatus.textContent = 'Add an Anthropic API key to enable inline AI completions';
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
  clearAiSuggestion();
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    apiKeySaveBtn.click();
  } else if (e.key === 'Escape') {
    closeModal();
  }
});

// Cancel any in-flight AI request and pending timer
function cancelAi() {
  if (aiTimeout !== null) {
    clearTimeout(aiTimeout);
    aiTimeout = null;
  }
  if (aiAbortController) {
    aiAbortController.abort();
    aiAbortController = null;
  }
}

function clearAiSuggestion() {
  cancelAi();
  // Only clear if the current suggestion came from AI
  if (currentSuggestion && suggestionOverlay.querySelector('.ai')) {
    suggestionOverlay.innerHTML = '';
    currentSuggestion = '';
  }
}

// Show AI completion as inline ghost text (only if no GROUP BY suggestion is active)
function showAiCompletion(prefix: string, completion: string) {
  const prefixHtml = `<span class="suggestion-text">${escapeHtml(prefix)}</span>`;
  const completionHtml = `<span class="suggestion-addition ai">${escapeHtml(completion)}</span>`;
  suggestionOverlay.innerHTML = prefixHtml + completionHtml;
  currentSuggestion = prefix + completion;
}

// Schedule an AI autocomplete request after the user pauses typing
function scheduleAiAutocomplete() {
  cancelAi();

  // Don't run if no key or if a GROUP BY suggestion is already showing
  if (!hasApiKey()) return;
  if (currentSuggestion) return; // GROUP BY suggestion is active

  const sql = sqlInput.value;
  if (!sql.trim()) return;

  aiTimeout = window.setTimeout(async () => {
    // Re-check: user may have typed more or GROUP BY kicked in
    const currentText = sqlInput.value;
    if (currentText !== sql) return;
    if (currentSuggestion) return;

    aiAbortController = new AbortController();
    aiStatus.textContent = 'Thinking...';
    aiStatus.className = 'ai-status working';

    const result = await autocompleteQuery(sql, aiAbortController.signal);
    aiAbortController = null;

    // Stale check: input changed while we were waiting
    if (sqlInput.value !== sql) {
      refreshAiState();
      return;
    }

    if (result.success && result.completion) {
      showAiCompletion(sql, result.completion);
      aiStatus.textContent = 'Suggestion ready (Tab to accept)';
      aiStatus.className = 'ai-status';
    } else if (result.error && result.error !== 'Cancelled.') {
      aiStatus.textContent = result.error;
      aiStatus.className = 'ai-status error';
    } else {
      refreshAiState();
    }
  }, AI_DEBOUNCE_MS);
}

// Initialize AI state on load
refreshAiState();

// Initialize on page load
initDatabase();
