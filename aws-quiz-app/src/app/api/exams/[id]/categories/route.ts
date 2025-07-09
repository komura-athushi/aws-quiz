import { NextResponse } from 'next/server';
import { getExamCategories } from '@/lib/quiz-service';
import { ApiError } from '@/types/database';
import { Logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const examId = parseInt(id);
    
    if (isNaN(examId) || examId <= 0) {
      const errorResponse: ApiError = { 
        error: '無効な試験IDです',
        details: '試験IDは正の整数である必要があります'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { categories, totalQuestions } = await getExamCategories(examId);

    return NextResponse.json({ 
      categories,
      totalQuestions
    });
  } catch (error) {
    Logger.error('Categories fetch error:', error instanceof Error ? error : new Error(String(error)));
    const errorResponse: ApiError = {
      error: 'データベースエラーが発生しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
