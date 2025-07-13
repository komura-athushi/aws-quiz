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


/**
 * クイズ結果取得エンドポイント
 * 
 * 指定されたattemptIdに基づいてクイズ結果を取得する
 * 
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  let attemptIdString = '';
  try {
    const { attemptId } = await params;
    attemptIdString = attemptId;
    
    logApiRequest('GET', `/api/quiz/results/${attemptId}`);
    
    const attemptIdNumber = validatePositiveInteger(attemptId);
    if (!attemptIdNumber) {
      return createValidationError(
        '無効なattemptIDです'
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.dbUserId) {
      return createUnauthorizedError(
        'ログインが必要です',
        'セッション情報が不完全です'
      );
    }
    const dtUserId = session.user.dbUserId;

    const result = await getQuizResults(attemptIdNumber, dtUserId);
    
    if (!result) {
      return createNotFoundError(
        'クイズ結果が見つかりません',
        `ID ${attemptIdNumber} の完了済み試験記録は存在しません`
      );
    }

    const { attempt, exam, responses } = result;

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
