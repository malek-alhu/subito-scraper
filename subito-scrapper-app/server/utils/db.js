import pkg from 'pg';
const { Pool } = pkg;
import { useRuntimeConfig } from '#imports';

let pool = null;

function getPool() {
  if (!pool) {
    const config = useRuntimeConfig();
    const databaseUrl = config.databaseUrl;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });

    console.log('PostgreSQL connection pool initialized');
  }

  return pool;
}

// Query helper function
export async function query(text, params) {
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Transaction helper
export async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Database adapter to mimic Supabase API
export const db = {
  from(table) {
    return {
      // SELECT queries
      select(columns = '*') {
        let selectQuery = `SELECT ${columns} FROM ${table}`;
        let whereConditions = [];
        let params = [];
        let paramCount = 0;
        let orderByClause = '';
        let limitClause = '';
        let singleResult = false;

        const builder = {
          eq(column, value) {
            paramCount++;
            whereConditions.push(`${column} = $${paramCount}`);
            params.push(value);
            return builder;
          },

          neq(column, value) {
            paramCount++;
            whereConditions.push(`${column} != $${paramCount}`);
            params.push(value);
            return builder;
          },

          lt(column, value) {
            paramCount++;
            whereConditions.push(`${column} < $${paramCount}`);
            params.push(value);
            return builder;
          },

          lte(column, value) {
            paramCount++;
            whereConditions.push(`${column} <= $${paramCount}`);
            params.push(value);
            return builder;
          },

          gt(column, value) {
            paramCount++;
            whereConditions.push(`${column} > $${paramCount}`);
            params.push(value);
            return builder;
          },

          gte(column, value) {
            paramCount++;
            whereConditions.push(`${column} >= $${paramCount}`);
            params.push(value);
            return builder;
          },

          in(column, values) {
            if (!values || values.length === 0) {
              // If no values, return empty result
              whereConditions.push('1=0');
              return builder;
            }
            const placeholders = values.map((_, i) => `$${paramCount + i + 1}`).join(', ');
            paramCount += values.length;
            whereConditions.push(`${column} IN (${placeholders})`);
            params.push(...values);
            return builder;
          },

          order(column, options = {}) {
            const direction = options.ascending === false ? 'DESC' : 'ASC';
            orderByClause = ` ORDER BY ${column} ${direction}`;
            return builder;
          },

          limit(count) {
            limitClause = ` LIMIT ${count}`;
            return builder;
          },

          single() {
            singleResult = true;
            limitClause = ' LIMIT 1';
            return builder;
          },

          async then(resolve, reject) {
            try {
              let finalQuery = selectQuery;
              if (whereConditions.length > 0) {
                finalQuery += ' WHERE ' + whereConditions.join(' AND ');
              }
              finalQuery += orderByClause + limitClause;

              const result = await query(finalQuery, params);

              if (singleResult) {
                if (result.rows.length === 0) {
                  resolve({ data: null, error: new Error('No rows found') });
                } else {
                  resolve({ data: result.rows[0], error: null });
                }
              } else {
                resolve({ data: result.rows, error: null });
              }
            } catch (error) {
              resolve({ data: null, error });
            }
          }
        };

        return builder;
      },

      // INSERT queries
      async insert(data) {
        const isArray = Array.isArray(data);
        const records = isArray ? data : [data];

        if (records.length === 0) {
          return { data: null, error: new Error('No data to insert') };
        }

        const columns = Object.keys(records[0]);
        const values = records.map((record, recordIndex) => {
          return `(${columns.map((_, colIndex) => `$${recordIndex * columns.length + colIndex + 1}`).join(', ')})`;
        }).join(', ');

        const allParams = records.flatMap(record => columns.map(col => record[col]));

        const insertQuery = `
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES ${values}
          RETURNING *
        `;

        let singleResult = false;

        const builder = {
          select(columns = '*') {
            // This would modify the RETURNING clause
            return builder;
          },

          single() {
            singleResult = true;
            return builder;
          },

          async then(resolve, reject) {
            try {
              const result = await query(insertQuery, allParams);

              if (singleResult) {
                resolve({ data: result.rows[0], error: null });
              } else {
                resolve({ data: result.rows, error: null });
              }
            } catch (error) {
              resolve({ data: null, error });
            }
          }
        };

        return builder;
      },

      // UPSERT queries
      async upsert(data, options = {}) {
        const isArray = Array.isArray(data);
        const records = isArray ? data : [data];

        if (records.length === 0) {
          return { data: null, error: new Error('No data to upsert') };
        }

        const columns = Object.keys(records[0]);
        const values = records.map((record, recordIndex) => {
          return `(${columns.map((_, colIndex) => `$${recordIndex * columns.length + colIndex + 1}`).join(', ')})`;
        }).join(', ');

        const allParams = records.flatMap(record => columns.map(col => record[col]));

        // Handle conflict columns
        let conflictColumns = options.onConflict;
        if (typeof conflictColumns === 'string') {
          conflictColumns = [conflictColumns];
        } else if (!conflictColumns || conflictColumns.length === 0) {
          // Default to primary key
          conflictColumns = ['id'];
        }

        const updateSet = columns
          .filter(col => !conflictColumns.includes(col))
          .map(col => `${col} = EXCLUDED.${col}`)
          .join(', ');

        const upsertQuery = `
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES ${values}
          ON CONFLICT (${conflictColumns.join(', ')})
          DO UPDATE SET ${updateSet}
          RETURNING *
        `;

        try {
          const result = await query(upsertQuery, allParams);
          return { data: result.rows, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },

      // UPDATE queries
      update(data) {
        const columns = Object.keys(data);
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        let params = columns.map(col => data[col]);
        let paramCount = columns.length;

        let whereConditions = [];

        const builder = {
          eq(column, value) {
            paramCount++;
            whereConditions.push(`${column} = $${paramCount}`);
            params.push(value);
            return builder;
          },

          in(column, values) {
            if (!values || values.length === 0) {
              whereConditions.push('1=0');
              return builder;
            }
            const placeholders = values.map((_, i) => `$${paramCount + i + 1}`).join(', ');
            paramCount += values.length;
            whereConditions.push(`${column} IN (${placeholders})`);
            params.push(...values);
            return builder;
          },

          async then(resolve, reject) {
            try {
              let updateQuery = `UPDATE ${table} SET ${setClause}`;
              if (whereConditions.length > 0) {
                updateQuery += ' WHERE ' + whereConditions.join(' AND ');
              }
              updateQuery += ' RETURNING *';

              const result = await query(updateQuery, params);
              resolve({ data: result.rows, error: null });
            } catch (error) {
              resolve({ data: null, error });
            }
          }
        };

        return builder;
      },

      // DELETE queries
      delete() {
        let whereConditions = [];
        let params = [];
        let paramCount = 0;

        const builder = {
          eq(column, value) {
            paramCount++;
            whereConditions.push(`${column} = $${paramCount}`);
            params.push(value);
            return builder;
          },

          async then(resolve, reject) {
            try {
              let deleteQuery = `DELETE FROM ${table}`;
              if (whereConditions.length > 0) {
                deleteQuery += ' WHERE ' + whereConditions.join(' AND ');
              }

              const result = await query(deleteQuery, params);
              resolve({ data: result.rows, error: null });
            } catch (error) {
              resolve({ data: null, error });
            }
          }
        };

        return builder;
      }
    };
  }
};

export default db;
