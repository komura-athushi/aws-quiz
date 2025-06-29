import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface ExamStats {
  examId: number;
  totalQuestions: number;
  userAttempts: number;
  userCorrectAnswers: number;
  bestScore: number;
  lastAttemptDate: string | null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザー情報を取得
    const users = await executeQuery<{ id: number }>(`
      SELECT id FROM users WHERE subject_id = ?
    `, [session.user.email]);

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    const userId = users[0].id;

    // 各試験の統計情報を取得
    const examStats = await executeQuery<any>(`
      SELECT 
        e.id as examId,
        COALESCE(q_count.total_questions, 0) as totalQuestions,
        COALESCE(attempts.user_attempts, 0) as userAttempts,
        COALESCE(attempts.total_correct, 0) as userCorrectAnswers,
        COALESCE(attempts.best_score, 0) as bestScore,
        attempts.last_attempt_date as lastAttemptDate
      FROM exams e
      LEFT JOIN (
        SELECT 
          ec.exam_id,
          COUNT(DISTINCT q.id) as total_questions
        FROM exam_categories ec
        JOIN questions q ON ec.id = q.exam_categories_id 
        WHERE q.deleted_at IS NULL
        GROUP BY ec.exam_id
      ) q_count ON e.id = q_count.exam_id
      LEFT JOIN (
        SELECT 
          ea.exam_id,
          COUNT(ea.id) as user_attempts,
          SUM(COALESCE(ea.correct_count, 0)) as total_correct,
          MAX(COALESCE(ea.correct_count, 0)) as best_score,
          MAX(ea.finished_at) as last_attempt_date
        FROM exam_attempts ea
        WHERE ea.user_id = ? AND ea.finished_at IS NOT NULL
        GROUP BY ea.exam_id
      ) attempts ON e.id = attempts.exam_id
      WHERE e.is_active = 1
      ORDER BY e.id
    `, [userId]);

    // データを整形
    const stats: Record<number, ExamStats> = {};
    examStats.forEach(row => {
      stats[row.examId] = {
        examId: row.examId,
        totalQuestions: row.totalQuestions || 0,
        userAttempts: row.userAttempts || 0,
        userCorrectAnswers: row.userCorrectAnswers || 0,
        bestScore: row.bestScore || 0,
        lastAttemptDate: row.lastAttemptDate
      };
    });

    return NextResponse.json({ stats });

  } catch (error) {
    console.error('Get exam stats error:', error);
    return NextResponse.json(
      { error: '統計情報の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
