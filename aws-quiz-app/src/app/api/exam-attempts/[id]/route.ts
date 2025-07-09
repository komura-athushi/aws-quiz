import { NextRequest, NextResponse } from 'next/server';
// セッション情報取得用
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getExamAttempt } from '@/lib/quiz-service';
import { ApiError } from '@/types/database';
import { Logger } from '@/lib/logger';
import { createUnauthorizedError } from '@/lib/api-utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attemptId = parseInt(id);
    

    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.dbUserId) {
      return createUnauthorizedError(
        'ログインが必要です',
        'セッション情報が不完全です'
      );
    }

    const dtUserId = session.user.dbUserId;
    
    if (isNaN(attemptId) || attemptId <= 0) {
      const errorResponse: ApiError = { 
        error: '無効なattemptIDです',
        details: 'attemptIDは正の整数である必要があります'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const attempt = await getExamAttempt(attemptId, dtUserId);
    
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
