import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQuizResults } from '@/lib/quiz-service';
import { 
  createValidationError,
  createUnauthorizedError,
  createNotFoundError,
  createDatabaseError,
  validatePositiveInteger,
  logApiRequest,
  logApiError
} from '@/lib/api-utils';
import { QuizResultResponse } from '@/types/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let attemptIdString = '';
  try {
    const { id } = await params;
    attemptIdString = id;
    
    logApiRequest('GET', `/api/quiz/results/${id}`);
    
    const attemptId = validatePositiveInteger(id);
    if (!attemptId) {
      return createValidationError(
        '無効なattemptIDです',
        'attemptIDは正の整数である必要があります'
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.dbUserId) {
      return createUnauthorizedError(
        'ログインが必要です',
        'セッション情報が不完全です'
      );
    }

    const result = await getQuizResults(attemptId);
    
    if (!result) {
      return createNotFoundError(
        'クイズ結果が見つかりません',
        `ID ${attemptId} の完了済み試験記録は存在しません`
      );
    }

    const { attempt, exam, responses } = result;

    // アクセス権限をチェック
    if (attempt.user_id !== session.user.dbUserId) {
      return createUnauthorizedError(
        'このクイズ結果にアクセスする権限がありません',
        '異なるユーザーの試験結果です'
      );
    }

    // レスポンスデータを構築
    const totalQuestions = responses.length;
    const correctCount = responses.filter(r => r.is_correct).length;
    const incorrectCount = totalQuestions - correctCount;
    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const responseData: QuizResultResponse = {
      attempt,
      exam,
      totalQuestions,
      correctCount,
      incorrectCount,
      scorePercentage,
      responses
    };

    return NextResponse.json(responseData);

  } catch (error) {
    logApiError('GET', `/api/quiz/results/${attemptIdString}`, error);
    return createDatabaseError(error);
  }
}
