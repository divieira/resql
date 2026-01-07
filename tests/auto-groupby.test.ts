import { describe, it, expect } from 'vitest';
import { addAutoGroupBy, isValidSQL } from '../src/core/auto-groupby';

describe('Auto GROUP BY', () => {
  describe('Basic aggregate detection', () => {
    it('should add GROUP BY for COUNT with non-aggregate column', () => {
      const input = 'SELECT name, COUNT(*) FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('name');
    });

    it('should add GROUP BY for SUM with non-aggregate column', () => {
      const input = 'SELECT category, SUM(price) FROM products';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
    });

    it('should add GROUP BY for AVG with non-aggregate column', () => {
      const input = 'SELECT department, AVG(salary) FROM employees';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('department');
    });

    it('should add GROUP BY for MIN with non-aggregate column', () => {
      const input = 'SELECT type, MIN(price) FROM items';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('type');
    });

    it('should add GROUP BY for MAX with non-aggregate column', () => {
      const input = 'SELECT category, MAX(views) FROM posts';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
    });
  });

  describe('Multiple columns', () => {
    it('should handle multiple non-aggregate columns', () => {
      const input = 'SELECT city, country, COUNT(*) FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('city');
      expect(result.toLowerCase()).toContain('country');
    });

    it('should handle multiple aggregate functions', () => {
      const input = 'SELECT category, SUM(price), AVG(price), COUNT(*) FROM products';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
    });
  });

  describe('No transformation needed', () => {
    it('should not modify query with only aggregates', () => {
      const input = 'SELECT COUNT(*), SUM(price) FROM products';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).not.toContain('group by');
    });

    it('should not modify query without aggregates', () => {
      const input = 'SELECT name, email FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).not.toContain('group by');
    });

    it('should not modify query that already has GROUP BY', () => {
      const input = 'SELECT name, COUNT(*) FROM users GROUP BY name';
      const result = addAutoGroupBy(input);
      // Should still have GROUP BY but not duplicate it
      const groupByCount = (result.toLowerCase().match(/group by/g) || []).length;
      expect(groupByCount).toBe(1);
    });

    it('should not add GROUP BY to SELECT *', () => {
      const input = 'SELECT * FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).not.toContain('group by');
    });
  });

  describe('Complex queries', () => {
    it('should handle queries with WHERE clause', () => {
      const input = 'SELECT category, COUNT(*) FROM products WHERE price > 100';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
      expect(result.toLowerCase()).toContain('where');
    });

    it('should handle queries with table aliases', () => {
      const input = 'SELECT u.name, COUNT(*) FROM users u';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
    });

    it('should handle nested function calls', () => {
      const input = 'SELECT category, COUNT(DISTINCT user_id) FROM orders';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
      expect(result.toLowerCase()).toContain('category');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const input = '';
      const result = addAutoGroupBy(input);
      expect(result).toBe('');
    });

    it('should not crash on edge case SQL', () => {
      const input = 'SELECT this is not valid SQL';
      const result = addAutoGroupBy(input);
      // Should not crash, returns some result
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle queries with column aliases', () => {
      const input = 'SELECT name AS user_name, COUNT(*) AS total FROM users';
      const result = addAutoGroupBy(input);
      expect(result.toLowerCase()).toContain('group by');
    });
  });

  describe('SQL validation', () => {
    it('should validate correct SQL', () => {
      expect(isValidSQL('SELECT * FROM users')).toBe(true);
      expect(isValidSQL('SELECT name, COUNT(*) FROM users GROUP BY name')).toBe(true);
    });

    it('should reject clearly invalid SQL', () => {
      expect(isValidSQL('not sql at all')).toBe(false);
      expect(isValidSQL('')).toBe(false);
      expect(isValidSQL('completely invalid nonsense')).toBe(false);
    });
  });
});
