import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getRandomQuestions, 
  getCategoryQuestionCounts, 
  createExamAttempt 
} from '@/lib/quiz-service';
import { 
  StartQuizRequest, 
  StartQuizResponse, 
  ApiError 
} from '@/types/database';

/**
 * リクエストパラメータの検証
 */
function validateStartQuizRequest(body: any): body is StartQuizRequest {
  return (
    typeof body.examId === 'number' &&
    Array.isArray(body.categoryIds) &&
    body.categoryIds.length > 0 &&
    body.categoryIds.every((id: any) => typeof id === 'number') &&
    typeof body.questionCount === 'number' &&
    body.questionCount > 0
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
    const attemptId = await createExamAttempt(
      session.user.dbUserId,
      examId,
      questionIds
    );

    const response: StartQuizResponse = {
      success: true,
      attemptId,
      questionIds
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Quiz start error:', error);
    const errorResponse: ApiError = {
      error: 'クイズの開始に失敗しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
