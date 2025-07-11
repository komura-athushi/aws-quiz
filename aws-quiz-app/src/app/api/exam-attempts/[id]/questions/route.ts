import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { executeQuery } from '@/lib/database';
import { ApiError, QuestionForClient, ExamAttempt } from '@/types/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface QuizAttemptWithQuestions {
  attempt: ExamAttempt;
  questions: QuestionForClient[];
}

type QuizAttemptQuestionsResponse = QuizAttemptWithQuestions | ApiError;

/**
 * Quiz attempt questions retrieval API
 * 
 * @param params - Route parameters containing attempt ID
 * @returns Quiz attempt data with all questions (excluding correct answers)
 * 
 * @example
 * GET /api/exam-attempts/123/questions
 * Returns: { attempt: ExamAttempt, questions: QuestionForClient[] }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<QuizAttemptQuestionsResponse>> {
  try {
    const { id } = await params;
    const attemptId = parseInt(id);

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session.user.dbUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const dbUserId = session.user.dbUserId;
    
    // バリデーション
    if (!attemptId || isNaN(attemptId)) {
      return NextResponse.json(
        { error: 'Invalid attempt ID' },
        { status: 400 }
      );
    }

    // 試験アテンプト情報を取得（ユーザー認証付き）
    const attemptRows = await executeQuery<ExamAttempt>(
      'SELECT * FROM exam_attempts WHERE id = ? AND user_id = ?',
      [attemptId, dbUserId]
    );

    if (attemptRows.length === 0) {
      return NextResponse.json(
        { error: 'Attempt not found' },
        { status: 404 }
      );
    }

    const attempt = attemptRows[0];

    // 問題IDsを取得
    const questionIds = attempt.question_ids;
    
    if (!questionIds || questionIds.length === 0) {
      return NextResponse.json(
        { error: 'No questions found for this attempt' },
        { status: 404 }
      );
    }

    // 問題情報を一括取得 (正解情報は除外)
    const placeholders = questionIds.map(() => '?').join(',');
    const questionRows = await executeQuery<any>(
      `SELECT 
        q.id, 
        q.body, 
        q.choices, 
        q.exam_categories_id
      FROM questions q
      WHERE q.id IN (${placeholders}) 
      AND q.deleted_at IS NULL
      ORDER BY FIELD(q.id, ${placeholders})`,
      [...questionIds, ...questionIds]
    );

    // 問題データを正しい形式に変換
    const questions: QuestionForClient[] = questionRows.map((row: any) => ({
      id: row.id,
      body: row.body,
      choices: typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices,
      exam_categories_id: row.exam_categories_id
    }));

    // 取得した問題数が期待する数と一致しているかチェック
    if (questions.length !== questionIds.length) {
      Logger.warn(`Expected ${questionIds.length} questions but got ${questions.length}`);
    }

    const responseData: QuizAttemptWithQuestions = {
      attempt,
      questions
    };

    return NextResponse.json(responseData);

  } catch (error) {
    Logger.error('Error fetching quiz attempt questions:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
