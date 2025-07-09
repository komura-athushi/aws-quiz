import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Logger } from '@/lib/logger';

interface Exam {
  id: number;
  exam_name: string;
  exam_code: string;
  level: string;
  description: string;
  is_active: number;
  totalQuestions: number;
  userCorrectAnswers: number;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    let userId = null;

    // ユーザーIDを取得（ログインしている場合）
    if (session?.user?.id) {
      const users = await executeQuery<{ id: number }>(`
        SELECT id FROM users WHERE subject_id = ?
      `, [session.user.id]);
      
      if (users.length > 0) {
        userId = users[0].id;
      }
    }

    // 全試験の基本情報を取得
    const exams = await executeQuery<Exam>(`
      SELECT 
        id,
        exam_name,
        exam_code,
        level,
        description,
        is_active
      FROM exams 
      WHERE is_active = 1
      ORDER BY level ASC
    `);

    // 各試験ごとに総問題数と正解数を計算
    const formattedExams = await Promise.all(
      exams.map(async (exam) => {
        // 総問題数を取得
        const totalQuestionsResult = await executeQuery<{ count: number }>(`
          SELECT COUNT(*) as count
          FROM questions q
          JOIN exam_categories ec ON q.exam_categories_id = ec.id
          WHERE ec.exam_id = ? AND q.deleted_at IS NULL
        `, [exam.id]);

        const totalQuestions = totalQuestionsResult[0]?.count || 0;

        let userCorrectAnswers = 0;

        // ユーザーがログインしている場合のみ正解数を計算
        if (userId) {
          // ユーザーの全アテンプトを取得
          const attempts = await executeQuery<{ id: number }>(`
            SELECT id 
            FROM exam_attempts 
            WHERE user_id = ? AND exam_id = ?
          `, [userId, exam.id]);

          if (attempts.length > 0) {
            // 各問題の最新回答が正解かどうかを効率的に取得
            const correctAnswersResult = await executeQuery<{ question_id: number; is_correct: number }>(`
              SELECT 
                qr.question_id,
                qr.is_correct
              FROM question_responses qr
              JOIN exam_attempts ea ON qr.attempt_id = ea.id
              JOIN questions q ON qr.question_id = q.id
              JOIN exam_categories ec ON q.exam_categories_id = ec.id
              WHERE ea.user_id = ? 
                AND ec.exam_id = ?
                AND q.deleted_at IS NULL
                AND qr.answered_at = (
                  SELECT MAX(qr2.answered_at)
                  FROM question_responses qr2
                  JOIN exam_attempts ea2 ON qr2.attempt_id = ea2.id
                  WHERE qr2.question_id = qr.question_id
                    AND ea2.user_id = ?
                    AND ea2.exam_id = ?
                )
            `, [userId, exam.id, userId, exam.id]);

            // 正解数をカウント
            userCorrectAnswers = correctAnswersResult.filter(r => r.is_correct === 1).length;
          }
        }

        return {
          ...exam,
          totalQuestions,
          userCorrectAnswers
        };
      })
    );

    return NextResponse.json({ exams: formattedExams });
  } catch (error) {
    Logger.error('Error fetching exams:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to fetch exams' },
      { status: 500 }
    );
  }
}
