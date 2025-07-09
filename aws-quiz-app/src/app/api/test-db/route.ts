import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import { Logger } from '@/lib/logger';

export async function GET() {
  try {
    // データベース接続をテスト
    const result = await executeQuery('SELECT 1 as test');
    
    // usersテーブルの件数を取得
    const userCount = await executeQuery('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL');
    
    return NextResponse.json({
      success: true,
      message: 'データベース接続成功',
      test_result: result,
      user_count: userCount[0],
    });
  } catch (error) {
    Logger.error('Database connection error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        success: false,
        message: 'データベース接続エラー',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
