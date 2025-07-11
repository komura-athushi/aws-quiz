import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { executeQuery } from '@/lib/database';
import { ApiError, QuestionForClient, ExamAttempt, QuizAttemptWithQuestions, QuestionChoice } from '@/types/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

    // attemptIdを使って問題を取得 (正解情報は除外)
    interface QuestionRow {
      id: number;
      body: string;
      choices: string | QuestionChoice[];
      exam_categories_id: number;
    }
    
    const questionRows = await executeQuery<QuestionRow>(
      `SELECT 
        q.id, 
        q.body, 
        q.choices, 
        q.exam_categories_id
      FROM questions q
      INNER JOIN question_responses qr ON q.id = qr.question_id
      WHERE qr.attempt_id = ?
      AND q.deleted_at IS NULL
      ORDER BY qr.id`,
      [attemptId]
    );

    if (questionRows.length === 0) {
      return NextResponse.json(
        { error: 'No questions found for this attempt' },
        { status: 404 }
      );
    }

    // 問題データを正しい形式に変換
    const questions: QuestionForClient[] = questionRows.map((row: QuestionRow) => ({
      id: row.id,
      body: row.body,
      choices: typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices,
      exam_categories_id: row.exam_categories_id
    }));

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
