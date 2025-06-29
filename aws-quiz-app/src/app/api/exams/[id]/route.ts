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

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const examId = parseInt(params.id);
    
    if (isNaN(examId)) {
      return NextResponse.json(
        { error: '無効な試験IDです' },
        { status: 400 }
      );
    }

    // 試験情報を取得
    const exams = await executeQuery<Exam>(`
      SELECT 
        id,
        exam_name,
        exam_code,
        level,
        description,
        is_active
      FROM exams 
      WHERE id = ? AND is_active = 1
    `, [examId]);

    if (exams.length === 0) {
      return NextResponse.json(
        { error: '試験が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ exam: exams[0] });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'データベースエラーが発生しました' },
      { status: 500 }
    );
  }
}
