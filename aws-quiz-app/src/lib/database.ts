import mysql from 'mysql2/promise';

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aws_quiz',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Get database connection
export async function getConnection() {
  return await pool.getConnection();
}

// Execute query with automatic connection handling
export async function executeQuery<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(query, params);
    return rows as T[];
  } finally {
    connection.release();
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

export default pool;
