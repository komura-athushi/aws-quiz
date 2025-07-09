import { NextRequest, NextResponse } from 'next/server';
import { getExamAttempt } from '@/lib/quiz-service';
import { ApiError } from '@/types/database';
import { Logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attemptId = parseInt(id);
    
    if (isNaN(attemptId) || attemptId <= 0) {
      const errorResponse: ApiError = { 
        error: '無効なattemptIDです',
        details: 'attemptIDは正の整数である必要があります'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const attempt = await getExamAttempt(attemptId);
    
    if (!attempt) {
      const errorResponse: ApiError = { 
        error: 'クイズセッションが見つかりません',
        details: `ID ${attemptId} の試験開始記録は存在しません`
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    Logger.info('Responding with attempt data:', {
      attemptId: attempt.id,
      questionIds: attempt.question_ids,
      examId: attempt.exam_id
    });
    
    return NextResponse.json({
      attemptId: attempt.id,
      questionIds: attempt.question_ids,
      examId: attempt.exam_id,
      startedAt: attempt.started_at,
      finishedAt: attempt.finished_at
    });
    
  } catch (error) {
    Logger.error('Exam attempt fetch error:', error instanceof Error ? error : new Error(String(error)));
    const errorResponse: ApiError = {
      error: 'データベースエラーが発生しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
