import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

interface Exam {
  id: number;
  exam_name: string;
  exam_code: string;
  level: string;
  description: string;
  is_active: number;
}

export async function GET() {
  try {
    // アクティブな試験一覧を取得
    const exams = await executeQuery<Exam>(`
      SELECT 
        id,
        exam_name,
        exam_code,
        level,
        description,
        is_active
      FROM exams 
      WHERE is_active = 1
      ORDER BY created_at ASC
    `);

    return NextResponse.json({ exams });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'データベースエラーが発生しました' },
      { status: 500 }
    );
  }
}
