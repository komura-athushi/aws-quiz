import { NextRequest, NextResponse } from 'next/server';
import { logError, logWarn } from '@/lib/api-utils';
import { executeQuery } from '@/lib/database';
import { ApiError, QuestionForClient, ExamAttempt, QuizAttemptWithQuestions, QuestionChoice } from '@/types/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type QuizAttemptQuestionsResponse = QuizAttemptWithQuestions | ApiError;

/**
 * クイズアテンプトの問題を取得するエンドポイント
 * 
 * 指定された試験アテンプトIDに基づいて問題を取得する
 * 
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

    // 試験アテンプト情報を取得
    // ログインユーザーのものしか取得できないようにする
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

    // question_idsを取得・パース
    let questionIds: number[];
    try {
      // データベースから取得したquestion_idsが文字列の場合はパースする
      if (typeof attempt.question_ids === 'string') {
        questionIds = JSON.parse(attempt.question_ids);
      } else {
        questionIds = attempt.question_ids;
      }
      
      // 配列でない場合はエラー
      if (!Array.isArray(questionIds)) {
        throw new Error('question_ids is not an array');
      }
    } catch (parseError) {
      await logError(`Failed to parse question_ids: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      return NextResponse.json(
        { error: 'Invalid question data format' },
        { status: 500 }
      );
    }
    
    if (questionIds.length === 0) {
      return NextResponse.json(
        { error: 'No questions found for this attempt' },
        { status: 404 }
      );
    }

    // 問題情報を取得 (正解情報は除外)
    const placeholders = questionIds.map(() => '?').join(',');
    
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
      WHERE q.id IN (${placeholders}) 
      AND q.deleted_at IS NULL
      ORDER BY FIELD(q.id, ${placeholders})`,
      [...questionIds, ...questionIds]
    );

    // 問題データを正しい形式に変換
    const questions: QuestionForClient[] = questionRows.map((row: QuestionRow) => ({
      id: row.id,
      body: row.body,
      choices: typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices,
      exam_categories_id: row.exam_categories_id
    }));

    // 取得した問題数が期待する数と一致しているかチェック
    if (questions.length !== questionIds.length) {
      await logWarn(`Expected ${questionIds.length} questions but got ${questions.length} for attempt ${attemptId}`);
    }

    const responseData: QuizAttemptWithQuestions = {
      attempt,
      questions
    };

    return NextResponse.json(responseData);

  } catch (error) {
    await logError('Error fetching quiz attempt questions:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
