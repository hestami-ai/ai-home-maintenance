// FetchMetrics tests

const assert = require('assert');

// Helper for synchronous test execution
const test = (name, fn) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
    throw e;
  }
};

const it = (name, fn) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
    throw e;
  }
};

const describe = (title, fn) => {
  console.log(`\n=== ${title} ===`);
  fn();
};

const describeSub = (title, fn) => {
  console.log(`--- ${title} ---`);
  fn();
};

// Load implementation
const { fetchMetrics } = require('../index.js');

describe('FetchMetrics - Read Latest Metric Values from Postgres', () => {
  describeSub('Empty metrics handling', () => {
    test('returns empty object for empty rows', async () => {
      const dbConnection = {
        query: async () => ({ rows: [] })
      };

      const result = await fetchMetrics(dbConnection);
      assert.strictEqual(Object.keys(result).length, 0);
      assert.deepStrictEqual(result, {});
    });
  });

  describeSub('Single metric', () => {
    test('handles single metric correctly', async () => {
      const dbConnection = {
        query: async () => ({
          rows: [{ metric_name: 'temperature', value: 85.5 }]
        })
      };

      const result = await fetchMetrics(dbConnection);
      assert.strictEqual(Object.keys(result).length, 1);
      assert.strictEqual(result['temperature'], 85.5);
    });
  });

  describeSub('Multiple metrics map format', () => {
    test('returns map with metric names as keys', async () => {
      const dbConnection = {
        query: async () => ({
          rows: [
            { metric_name: 'cpu_usage', value: 45.2 },
            { metric_name: 'memory_usage', value: 62.8 },
            { metric_name: 'disk_io', value: 150.5 }
          ]
        })
      };

      const result = await fetchMetrics(dbConnection);
      const isObject = Object.prototype.isPrototypeOf.call(Object.prototype, result);
      assert.ok(isObject);
      assert.strictEqual(Object.keys(result).length, 3);
      assert.strictEqual(result['cpu_usage'], 45.2);
      assert.strictEqual(result['memory_usage'], 62.8);
      assert.strictEqual(result['disk_io'], 150.5);
      assert.deepStrictEqual(Object.keys(result), ['cpu_usage', 'memory_usage', 'disk_io']);
    });
  });

  describeSub('Numeric value type', () => {
    test('preserves numeric type for metric values', async () => {
      const dbConnection = {
        query: async () => ({
          rows: [{ metric_name: 'count', value: 100 }]
        })
      };

      const result = await fetchMetrics(dbConnection);
      assert.strictEqual(typeof result['count'], 'number');
      assert.strictEqual(result['count'], 100);
    });
  });

  describeSub('Optional metric name parameter', () => {
    test('returns specified metric when name is provided', async () => {
      const dbConnection = {
        query: async () => ({
          rows: [{ metric_name: 'cpu_usage', value: 72.3 }]
        })
      };

      const result = await fetchMetrics(dbConnection, 'cpu_usage');
      assert.strictEqual(result['cpu_usage'], 72.3);
    });
  });

  describeSub('Error handling', () => {
    test('propagates database errors', async () => {
      const dbConnection = {
        query: async () => {
          throw new Error('Connection refused');
        }
      };

      await assert.rejects(
        fetchMetrics(dbConnection),
        (err) => err.message.includes('Connection refused')
      );
    });

    test('propagates SQL syntax errors', async () => {
      const dbConnection = {
        query: async () => {
          throw new SyntaxError('Invalid SQL syntax');
        }
      };

      await assert.rejects(
        fetchMetrics(dbConnection),
        (err) => err instanceof Error
      );
    });
  });
});
