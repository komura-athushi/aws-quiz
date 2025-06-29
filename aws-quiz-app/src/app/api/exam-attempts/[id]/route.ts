import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// データベース接続設定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'aws_quiz',
  port: parseInt(process.env.DB_PORT || '3306'),
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const attemptId = parseInt(params.id);
    
    if (isNaN(attemptId)) {
      return NextResponse.json({ error: '無効なattemptIdです' }, { status: 400 });
    }

    const connection = await mysql.createConnection(dbConfig);
    
    try {
      // exam_attemptsテーブルから問題IDsを取得
      const [rows] = await connection.execute(
        'SELECT question_ids FROM exam_attempts WHERE id = ?',
        [attemptId]
      );
      
      const attempts = rows as any[];
      
      if (attempts.length === 0) {
        return NextResponse.json({ error: 'クイズセッションが見つかりません' }, { status: 404 });
      }
      
      const questionIds = attempts[0].question_ids;
      
      return NextResponse.json({
        attemptId,
        questionIds
      });
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'データベースエラーが発生しました' }, { status: 500 });
  }
}
