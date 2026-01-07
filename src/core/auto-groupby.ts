import pkg from 'node-sql-parser';
const { Parser } = pkg;

const parser = new Parser();

// Aggregate functions to detect
const AGGREGATE_FUNCTIONS = new Set([
  'SUM', 'COUNT', 'MIN', 'MAX', 'AVG',
  'STDDEV', 'VARIANCE', 'GROUP_CONCAT',
  'STRING_AGG', 'ARRAY_AGG'
]);

/**
 * Walk the AST to detect if an expression contains an aggregate function
 */
function hasAggregateFunction(node: any): boolean {
  if (!node || typeof node !== 'object') {
    return false;
  }

  // Check if this node is a function call
  if (node.type === 'aggr_func') {
    return true;
  }

  // Check if this is a function with a name that's an aggregate
  if (node.type === 'function') {
    const funcName = node.name?.toUpperCase();
    if (funcName && AGGREGATE_FUNCTIONS.has(funcName)) {
      return true;
    }
  }

  // Recursively check all properties
  for (const key in node) {
    const value = node[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (hasAggregateFunction(item)) {
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      if (hasAggregateFunction(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract column expressions that should be in GROUP BY
 */
function extractGroupByColumns(columns: any[]): any[] {
  const groupByExprs: any[] = [];

  for (const col of columns) {
    // Skip * columns
    if (col.expr.type === 'column_ref' && col.expr.column === '*') {
      continue;
    }

    // If column doesn't have an aggregate, add to GROUP BY
    if (!hasAggregateFunction(col.expr)) {
      groupByExprs.push(col.expr);
    }
  }

  return groupByExprs;
}

/**
 * SQL reserved keywords that should remain quoted
 */
const SQL_RESERVED_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'AND', 'OR', 'NOT',
  'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT', 'ALL', 'ANY', 'SOME', 'UNION',
  'INTERSECT', 'EXCEPT', 'VALUES', 'SET', 'DEFAULT', 'PRIMARY', 'FOREIGN',
  'KEY', 'REFERENCES', 'CHECK', 'UNIQUE', 'CONSTRAINT', 'CASCADE', 'RESTRICT'
]);

/**
 * Remove unnecessary quotes from SQL identifiers
 * Removes backticks, double quotes, or square brackets from simple identifiers
 * Keeps quotes for reserved keywords or identifiers with special characters
 */
function removeUnnecessaryQuotes(sql: string): string {
  // Pattern to match quoted identifiers: backticks, double quotes, or square brackets
  // Captures the content within the quotes
  return sql.replace(/([`"\[])([\w]+)([`"\]])/g, (match, openQuote, identifier, closeQuote) => {
    // Check if opening and closing quotes match
    if ((openQuote === '`' && closeQuote === '`') ||
        (openQuote === '"' && closeQuote === '"') ||
        (openQuote === '[' && closeQuote === ']')) {

      // Check if identifier needs quotes
      const needsQuotes =
        SQL_RESERVED_KEYWORDS.has(identifier.toUpperCase()) || // Reserved keyword
        /^\d/.test(identifier) || // Starts with a number
        /[^a-zA-Z0-9_]/.test(identifier); // Contains special characters

      // Return unquoted if safe, otherwise keep the quotes
      return needsQuotes ? match : identifier;
    }

    return match; // Keep as-is if quotes don't match
  });
}

/**
 * Add auto GROUP BY to a SQL query
 */
export function addAutoGroupBy(sql: string): string {
  try {
    // Parse the SQL - using MySQL dialect for cleaner output (backticks instead of double quotes)
    const ast = parser.astify(sql, { database: 'mysql' });

    // Handle both single statement and array of statements
    const statements = Array.isArray(ast) ? ast : [ast];

    for (const stmt of statements) {
      // Only process SELECT statements
      if (stmt.type !== 'select') {
        continue;
      }

      const columns = stmt.columns;
      if (!columns || columns.length === 0) {
        continue;
      }

      // Find columns with aggregates
      const hasAggregates = columns.some((col: any) => hasAggregateFunction(col.expr));

      if (hasAggregates) {
        // Extract non-aggregate columns for GROUP BY
        const groupByExprs = extractGroupByColumns(columns);

        // Add GROUP BY if we have non-aggregate columns, remove it if we don't
        if (groupByExprs.length > 0) {
          stmt.groupby = {
            columns: groupByExprs,
            modifiers: []
          };
        } else {
          // Only aggregates - remove GROUP BY if it exists
          (stmt as any).groupby = null;
        }
      }
    }

    // Convert AST back to SQL - MySQL dialect uses backticks
    const result = parser.sqlify(statements.length === 1 ? statements[0] : statements, { database: 'mysql' });

    // Remove unnecessary quotes from identifiers for cleaner output
    return removeUnnecessaryQuotes(result);
  } catch (error) {
    // If parsing fails, return original SQL
    console.error('Parse error:', error);
    return sql;
  }
}

/**
 * Check if a SQL string is valid
 */
export function isValidSQL(sql: string): boolean {
  if (!sql || sql.trim() === '') {
    return false;
  }

  try {
    const ast = parser.astify(sql, { database: 'mysql' });
    return ast !== null && ast !== undefined;
  } catch {
    return false;
  }
}
