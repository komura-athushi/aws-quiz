import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Logger } from '@/lib/logger';
import { 
  getRandomQuestions, 
  getCategoryQuestionCounts, 
  createExamAttempt,
  getExamAttempt
} from '@/lib/quiz-service';
import { 
  StartQuizRequest, 
  StartQuizResponse, 
  ApiError 
} from '@/types/database';

/**
 * リクエストパラメータの検証
 */
function validateStartQuizRequest(body: unknown): body is StartQuizRequest {
  return (
    typeof body === 'object' && 
    body !== null && 
    'examId' in body && 
    typeof (body as Record<string, unknown>).examId === 'number' &&
    'categoryIds' in body &&
    Array.isArray((body as Record<string, unknown>).categoryIds) &&
    ((body as Record<string, unknown>).categoryIds as unknown[]).length > 0 &&
    ((body as Record<string, unknown>).categoryIds as unknown[]).every((id: unknown) => typeof id === 'number') &&
    'questionCount' in body &&
    typeof (body as Record<string, unknown>).questionCount === 'number' &&
    ((body as Record<string, unknown>).questionCount as number) > 0
  );
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session.user.dbUserId) {
      const errorResponse: ApiError = {
        error: 'ログインが必要です',
        details: 'セッション情報が不完全です'
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const dtUserId = session.user.dbUserId;

    const body = await request.json();

    if (!validateStartQuizRequest(body)) {
      const errorResponse: ApiError = {
        error: '必要なパラメータが不足しているか、形式が正しくありません',
        details: 'examId, categoryIds, questionCount が正しく設定されている必要があります'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { examId, categoryIds, questionCount } = body;

    // カテゴリー別の問題数を確認
    const categoryQuestionCounts = await getCategoryQuestionCounts(examId, categoryIds);
    const totalAvailableQuestions = categoryQuestionCounts.reduce(
      (sum, cat) => sum + cat.question_count, 
      0
    );

    if (totalAvailableQuestions < questionCount) {
      const errorResponse: ApiError = {
        error: `選択された条件で十分な問題が見つかりません`,
        details: `必要: ${questionCount}問、利用可能: ${totalAvailableQuestions}問`
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 問題をランダムに取得
    const questions = await getRandomQuestions(examId, categoryIds, questionCount);
    
    if (questions.length < questionCount) {
      const errorResponse: ApiError = {
        error: 'データベースエラー：期待される問題数を取得できませんでした',
        details: `取得できた問題数: ${questions.length}問`
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const questionIds = questions.map(q => q.id).filter(id => id && !isNaN(id) && id > 0);
    
    // 有効な問題IDがあることを確認
    if (questionIds.length === 0) {
      const errorResponse: ApiError = {
        error: 'データベースエラー：有効な問題データが見つかりませんでした',
        details: '問題データに不整合があります'
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }
    
    if (questionIds.length < questionCount) {
      const errorResponse: ApiError = {
        error: 'データベースエラー：有効な問題数が不足しています',
        details: `有効な問題数: ${questionIds.length}問`
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // exam_attemptsテーブルに記録
    await Logger.info('Creating exam attempt', {
      userId: dtUserId,
      examId,
      questionCount: questionIds.length
    });
    
    const attemptId = await createExamAttempt(
      dtUserId,
      examId,
      questionIds
    );
    
    await Logger.info('Exam attempt created', { attemptId });
    
    // 作成したばかりの試行を確認
    const verifyAttempt = await getExamAttempt(attemptId, dtUserId);
    
    if (!verifyAttempt) {
      await Logger.error('Failed to verify newly created attempt', undefined, { attemptId });
      const errorResponse: ApiError = {
        error: '試験記録の作成に失敗しました',
        details: '試験記録の確認中にエラーが発生しました'
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }
    
    await Logger.info('Verified attempt exists', {
      attemptId: verifyAttempt.id,
      questionIdsCount: verifyAttempt.question_ids.length
    });

    const response: StartQuizResponse = {
      success: true,
      attemptId,
      questionIds
    };

    await Logger.info('Sending response', { response });
    return NextResponse.json(response);

  } catch (error) {
    await Logger.error('Quiz start error', error as Error);
    const errorResponse: ApiError = {
      error: 'クイズの開始に失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
