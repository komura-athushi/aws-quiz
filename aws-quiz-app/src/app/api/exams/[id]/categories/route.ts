import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

interface CategoryWithQuestionCount {
  id: number;
  category_name: string;
  description: string;
  question_count: number;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const examId = parseInt(id);
    
    if (isNaN(examId)) {
      return NextResponse.json(
        { error: '無効な試験IDです' },
        { status: 400 }
      );
    }

    // カテゴリー別問題数を取得
    const categories = await executeQuery<CategoryWithQuestionCount>(`
      SELECT 
        c.id,
        c.category_name,
        c.description,
        COUNT(q.id) as question_count
      FROM categories c
      INNER JOIN exam_categories ec ON c.id = ec.category_id
      LEFT JOIN questions q ON ec.id = q.exam_categories_id AND q.deleted_at IS NULL
      WHERE ec.exam_id = ?
      GROUP BY c.id, c.category_name, c.description
      ORDER BY c.category_name
    `, [examId]);

    // 総問題数を計算
    const totalQuestions = categories.reduce((sum, category) => sum + category.question_count, 0);

    return NextResponse.json({ 
      categories,
      totalQuestions
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'データベースエラーが発生しました' },
      { status: 500 }
    );
  }
}
