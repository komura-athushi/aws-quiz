import { RDSDataClient, ExecuteStatementCommand, SqlParameter } from '@aws-sdk/client-rds-data';

// Check if we're using Aurora Serverless v2 Data API or local MySQL
const isAurora = process.env.USE_AURORA === 'true';

// Validate required environment variables
function getRequiredEnvVar(varName: string): string {
  const value = process.env[varName];
  if (!value) {
    throw new Error(`Required environment variable ${varName} is not set`);
  }
  return value;
}

// Aurora Data API client configuration
let rdsDataClient: RDSDataClient | null = null;
let resourceArn: string | null = null;
let secretArn: string | null = null;
let database: string | null = null;

// Local MySQL configuration (fallback for development)
// TypeScript types for MySQL
interface MySQLModule {
  createPool: (config: MySQLPoolConfig) => MySQLPool;
}

interface MySQLPoolConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
}

interface MySQLPool {
  query: <T>(sql: string, values?: unknown[]) => Promise<[T[], unknown]>;
  getConnection: () => Promise<MySQLConnection>;
}

interface MySQLConnection {
  query: <T>(sql: string, values?: unknown[]) => Promise<[T[], unknown]>;
  execute: (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>;
  release: () => void;
  beginTransaction: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

interface MySQLResultSetHeader {
  insertId: number;
  affectedRows: number;
  changedRows?: number;
  warningCount?: number;
}

let mysql: MySQLModule | null = null;
let localPool: MySQLPool | null = null;

// Initialize database configuration
function initializeDatabase() {
  if (isAurora) {
    // Aurora Serverless v2 Data API configuration
    resourceArn = getRequiredEnvVar('AURORA_CLUSTER_ARN');
    secretArn = getRequiredEnvVar('AURORA_SECRET_ARN');
    database = getRequiredEnvVar('AURORA_DATABASE');
    
    // 接続タイムアウト設定（秒単位、デフォルト30秒）
    const connectionTimeoutSeconds = parseInt(process.env.AURORA_CONNECTION_TIMEOUT || '30');
    
    rdsDataClient = new RDSDataClient({
      region: process.env.APP_AWS_REGION || 'us-east-1',
      requestHandler: {
        requestTimeout: connectionTimeoutSeconds * 1000 * 1.5, // ミリ秒単位
        connectionTimeout: connectionTimeoutSeconds * 1000, // 接続タイムアウト
      },
      // ローカル開発時のAWS認証情報（オプション）
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN })
        }
      })
    });
  } else {
    // Local MySQL configuration with dynamic import
    (async () => {
      try {
        const mysqlModule = await import('mysql2/promise');
        mysql = mysqlModule.default || mysqlModule;
        
        const localConfig = {
          host: getRequiredEnvVar('DB_HOST'),
          port: parseInt(process.env.DB_PORT || '3306'),
          user: getRequiredEnvVar('DB_USER'),
          password: getRequiredEnvVar('DB_PASSWORD'),
          database: getRequiredEnvVar('DB_NAME'),
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
        };
        localPool = mysql.createPool(localConfig);
      } catch (err) {
        console.error('Failed to import mysql2/promise:', err);
      }
    })();
  }
}

// Initialize on module load
initializeDatabase();

// Test database connection
export async function testConnection(): Promise<{ success: boolean; message: string; environment: string }> {
  try {
    if (isAurora) {
      // Test Aurora Data API connection
      const testQuery = 'SELECT 1 as test_value';
      await executeQuery(testQuery);
      return {
        success: true,
        message: 'Aurora Data API connection successful',
        environment: 'Aurora Serverless v2 (Data API)'
      };
    } else {
      // Test local MySQL connection
      if (!localPool) {
        return {
          success: false,
          message: 'Local MySQL pool is not initialized',
          environment: 'Local MySQL'
        };
      }
      
      const connection = await localPool.getConnection();
      try {
        await connection.execute('SELECT 1 as test_value');
        return {
          success: true,
          message: 'Local MySQL connection successful',
          environment: 'Local MySQL'
        };
      } finally {
        connection.release();
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      environment: isAurora ? 'Aurora Serverless v2 (Data API)' : 'Local MySQL'
    };
  }
}

// Convert MySQL query parameters to Data API format
function convertParameters(params?: unknown[]): SqlParameter[] {
  if (!params) return [];
  
  return params.map((param, index) => {
    const paramName = `param${index + 1}`;
    
    if (param === null || param === undefined) {
      // Aurora Data APIでNULL値を処理
      return {
        name: paramName,
        value: { isNull: true }
      };
    }
    
    if (typeof param === 'number') {
      if (Number.isInteger(param)) {
        return {
          name: paramName,
          value: { longValue: param }
        };
      } else {
        return {
          name: paramName,
          value: { doubleValue: param }
        };
      }
    }
    
    if (typeof param === 'boolean') {
      return {
        name: paramName,
        value: { booleanValue: param }
      };
    }
    
    // Default to string representation
    return {
      name: paramName,
      value: { stringValue: param?.toString() || '' }
    };
  });
}

// Convert Data API query to MySQL format with numbered parameters
function convertQueryForDataAPI(query: string, params?: unknown[]): string {
  if (!params || params.length === 0) return query;
  
  let convertedQuery = query;
  params.forEach((_, index) => {
    convertedQuery = convertedQuery.replace('?', `:param${index + 1}`);
  });
  
  return convertedQuery;
}

// Get database connection (for local MySQL only)
export async function getConnection() {
  if (isAurora) {
    throw new Error('getConnection() is not available when using Aurora Data API');
  }
  
  if (!localPool) {
    throw new Error('MySQL pool is not initialized');
  }
  
  return await localPool.getConnection();
}

// Aurora Serverless retry utility for resuming databases
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = parseInt(process.env.AURORA_RETRY_COUNT || '3'),
  baseDelay: number = parseInt(process.env.AURORA_RETRY_DELAY || '2000')
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      const isResumingError = error instanceof Error && (
        error.name === 'DatabaseResumingException' || 
        error.message?.includes('resuming after being auto-paused') ||
        error.message?.includes('DatabaseResumingException')
      );
      
      if (isResumingError && attempt < maxRetries) {
        const delay = baseDelay * attempt; // 指数バックオフ: 2s, 4s, 6s
        console.log(`Aurora DB is resuming, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // リトライしない、または最大試行回数に達した場合はエラーを投げる
      throw error;
    }
  }
  throw new Error('Unexpected retry loop exit');
}

// Execute query with automatic connection handling
export async function executeQuery<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  if (isAurora) {
    // Use Aurora Data API with retry mechanism
    if (!rdsDataClient || !resourceArn || !secretArn || !database) {
      throw new Error('Aurora Data API not properly initialized');
    }

    return await executeWithRetry(async () => {
      const command = new ExecuteStatementCommand({
        resourceArn: resourceArn!,
        secretArn: secretArn!,
        database: database!,
        sql: convertQueryForDataAPI(query, params),
        parameters: convertParameters(params),
        includeResultMetadata: true
      });

      const response = await rdsDataClient!.send(command);
      
      if (!response.records || !response.columnMetadata) {
        return [];
      }

      // Convert Data API response to expected format
      const columnNames = response.columnMetadata.map((col, index: number) => {
        // Aurora Data APIではlabelプロパティを使用する必要がある場合がある
        return col.label || col.name || `column_${index}`;
      });
      
      const rows = response.records.map((record) => {
        const row: Record<string, string | number | boolean | null> = {};
        record.forEach((field, index: number) => {
          const columnName = columnNames[index];
          // Extract value from Data API field format
          if (field.stringValue !== undefined) {
            row[columnName] = field.stringValue;
          } else if (field.longValue !== undefined) {
            row[columnName] = field.longValue;
          } else if (field.doubleValue !== undefined) {
            row[columnName] = field.doubleValue;
          } else if (field.booleanValue !== undefined) {
            row[columnName] = field.booleanValue;
          } else if (field.isNull) {
            row[columnName] = null;
          } else {
            row[columnName] = null;
          }
        });
        return row;
      });

      return rows as T[];
    });
  } else {
    // Use local MySQL
    if (!localPool) {
      throw new Error('MySQL pool is not initialized');
    }
    
    const connection = await localPool.getConnection();
    try {
      const [rows] = await connection.execute(query, params);
      return rows as T[];
    } finally {
      connection.release();
    }
  }
}

// Execute query using regular query method (for compatibility issues)
export async function executeSimpleQuery<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  if (isAurora) {
    // For Aurora Data API, use the same method as executeQuery
    return executeQuery<T>(query, params);
  } else {
    // Use local MySQL
    if (!localPool) {
      throw new Error('MySQL pool is not initialized');
    }
    
    const connection = await localPool.getConnection();
    try {
      const [rows] = await connection.query(query, params);
      return rows as T[];
    } finally {
      connection.release();
    }
  }
}

// Execute INSERT query and return insert ID (Aurora Data API specific)
export async function executeInsert(
  query: string,
  params?: unknown[]
): Promise<{ insertId: number; affectedRows: number }> {
  if (isAurora) {
    // Use Aurora Data API with retry mechanism
    if (!rdsDataClient || !resourceArn || !secretArn || !database) {
      throw new Error('Aurora Data API not properly initialized');
    }

    return await executeWithRetry(async () => {
      const command = new ExecuteStatementCommand({
        resourceArn: resourceArn!,
        secretArn: secretArn!,
        database: database!,
        sql: convertQueryForDataAPI(query, params),
        parameters: convertParameters(params),
        includeResultMetadata: false
      });

      const response = await rdsDataClient!.send(command);
      
      // Aurora Data API では generatedFields に insertId が含まれる
      // BIGINT型の場合、longValueとして返される
      let insertId = 0;
      if (response.generatedFields && response.generatedFields.length > 0) {
        const generatedField = response.generatedFields[0];
        insertId = generatedField.longValue || generatedField.doubleValue || 0;
      }
      
      const affectedRows = response.numberOfRecordsUpdated || 0;
      
      // BIGINT型のAUTO_INCREMENTの場合、insertIdが0でも成功の場合がある
      // affectedRowsが1以上であれば成功とみなす
      if (affectedRows === 0) {
        throw new Error('INSERT failed: No rows affected');
      }
      
      return { insertId, affectedRows };
    });
  } else {
    // Use local MySQL
    if (!localPool) {
      throw new Error('MySQL pool is not initialized');
    }
    
    const connection = await localPool.getConnection();
    try {
      const [result] = await connection.execute(query, params);
      const mysqlResult = result as MySQLResultSetHeader;
      return {
        insertId: mysqlResult.insertId || 0,
        affectedRows: mysqlResult.affectedRows || 0
      };
    } finally {
      connection.release();
    }
  }
}

// User interface based on database schema
export interface User {
  id: number;
  provider: 'google';
  subject_id: string;
  name: string;
  role: 'user' | 'admin';
  deleted_at: Date | null;
  updated_at: Date | null;
  created_at: Date;
  last_login_at: Date | null;
}

// User service functions
export class UserService {
  static async findBySubjectId(subjectId: string): Promise<User | null> {
    const users = await executeQuery<User>(
      'SELECT * FROM users WHERE subject_id = ? AND deleted_at IS NULL',
      [subjectId]
    );
    return users.length > 0 ? users[0] : null;
  }

  static async createUser(data: {
    provider: 'google';
    subject_id: string;
    name: string;
    role?: 'user' | 'admin';
  }): Promise<User> {
    const { provider, subject_id, name, role = 'user' } = data;
    
    await executeQuery(
      `INSERT INTO users (provider, subject_id, name, role, created_at, last_login_at) 
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [provider, subject_id, name, role]
    );

    const newUser = await this.findBySubjectId(subject_id);
    if (!newUser) {
      throw new Error('Failed to create user');
    }
    
    return newUser;
  }

  static async updateLastLogin(subjectId: string): Promise<void> {
    await executeQuery(
      'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE subject_id = ? AND deleted_at IS NULL',
      [subjectId]
    );
  }

  static async upsertUser(data: {
    provider: 'google';
    subject_id: string;
    name: string;
    role?: 'user' | 'admin';
  }): Promise<User> {
    const existingUser = await this.findBySubjectId(data.subject_id);
    
    if (existingUser) {
      // Update last login time
      await this.updateLastLogin(data.subject_id);
      // Update name if it has changed
      if (existingUser.name !== data.name) {
        await executeQuery(
          'UPDATE users SET name = ?, updated_at = NOW() WHERE subject_id = ? AND deleted_at IS NULL',
          [data.name, data.subject_id]
        );
      }
      return await this.findBySubjectId(data.subject_id) || existingUser;
    } else {
      // Create new user
      return await this.createUser(data);
    }
  }
}

// Get current database configuration info
export function getDatabaseInfo(): { 
  environment: string; 
  config: Record<string, string | number | boolean | null | undefined> 
} {
  if (isAurora) {
    return {
      environment: 'Aurora Serverless v2 (Data API)',
      config: {
        resourceArn: resourceArn ? resourceArn.substring(0, 50) + '...' : 'Not set',
        secretArn: secretArn ? secretArn.substring(0, 50) + '...' : 'Not set',
        database: database || 'Not set',
        region: process.env.APP_AWS_REGION || 'us-east-1',
        connectionTimeout: process.env.AURORA_CONNECTION_TIMEOUT || '30',
        retryCount: process.env.AURORA_RETRY_COUNT || '3',
        retryDelay: process.env.AURORA_RETRY_DELAY || '4000',
        hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      }
    };
  } else {
    return {
      environment: 'Local MySQL',
      config: {
        host: process.env.DB_HOST || 'Not set',
        port: process.env.DB_PORT || '3306',
        user: process.env.DB_USER || 'Not set',
        database: process.env.DB_NAME || 'Not set'
      }
    };
  }
}

// Export RDS Data Client for advanced usage
export { rdsDataClient, resourceArn, secretArn, database };
