import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { executeQuery } from '@/lib/database';
import { 
  createUnauthorizedError,
  createDatabaseError,
  logApiRequest,
  logApiError
} from '@/lib/api-utils';
import { Exam } from '@/types/database';

interface ExamWithStats extends Exam {
  totalQuestions: number;
  userCorrectAnswers: number;
  userTotalAnswers: number;
  userAccuracyRate: number;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    logApiRequest('GET', '/api/exams/stats');
    
    if (!session?.user?.id || !session.user.dbUserId) {
      return createUnauthorizedError(
        'ログインが必要です',
        'セッション情報が不完全です'
      );
    }

    const userId = session.user.dbUserId;

    // アクティブな試験の基本情報を取得
    const exams = await executeQuery<Exam>(`
      SELECT 
        id,
        exam_name,
        exam_code,
        level,
        description,
        is_active,
        created_at,
        updated_at
      FROM exams 
      WHERE is_active = 1
      ORDER BY exam_name ASC
    `);

    // 各試験ごとに統計情報を計算
    const examsWithStats: ExamWithStats[] = await Promise.all(
      exams.map(async (exam) => {
        // 総問題数を取得
        const [totalQuestionsResult] = await executeQuery<{ total: number }>(`
          SELECT COUNT(q.id) as total
          FROM questions q
          INNER JOIN exam_categories ec ON q.exam_categories_id = ec.id
          WHERE ec.exam_id = ? AND q.deleted_at IS NULL
        `, [exam.id]);

        const totalQuestions = totalQuestionsResult?.total || 0;

        // ユーザーの統計を取得
        const [userStatsResult] = await executeQuery<{
          correct_answers: number;
          total_answers: number;
        }>(`
          SELECT 
            COALESCE(SUM(CASE WHEN qr.is_correct = 1 THEN 1 ELSE 0 END), 0) as correct_answers,
            COALESCE(COUNT(qr.id), 0) as total_answers
          FROM question_responses qr
          INNER JOIN exam_attempts ea ON qr.attempt_id = ea.id
          INNER JOIN questions q ON qr.question_id = q.id
          INNER JOIN exam_categories ec ON q.exam_categories_id = ec.id
          WHERE ea.user_id = ? 
            AND ec.exam_id = ? 
            AND ea.finished_at IS NOT NULL
        `, [userId, exam.id]);

        const userCorrectAnswers = userStatsResult?.correct_answers || 0;
        const userTotalAnswers = userStatsResult?.total_answers || 0;
        const userAccuracyRate = userTotalAnswers > 0 
          ? Math.round((userCorrectAnswers / userTotalAnswers) * 100) 
          : 0;

        return {
          ...exam,
          totalQuestions,
          userCorrectAnswers,
          userTotalAnswers,
          userAccuracyRate
        };
      })
    );

    return NextResponse.json({ 
      exams: examsWithStats,
      totalExams: examsWithStats.length
    });

  } catch (error) {
    logApiError('GET', '/api/exams/stats', error);
    return createDatabaseError(error);
  }
}
