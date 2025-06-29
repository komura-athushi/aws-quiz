import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

interface QuestionResult {
  questionId: number;
  questionBody: string;
  userAnswers: number[];
  correctAnswers: number[];
  isCorrect: boolean;
  choices: Array<{
    choice_id: number;
    choice_text: string;
  }>;
  explanation: string;
}

interface AttemptResult {
  id: number;
  totalQuestions: number;
  correctCount: number;
  finishedAt: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attemptId = parseInt(id);
    
    if (isNaN(attemptId)) {
      return NextResponse.json(
        { error: '無効なattemptIdです' },
        { status: 400 }
      );
    }

    // 試験結果の基本情報を取得
    const attempts = await executeQuery<AttemptResult>(`
      SELECT 
        id,
        answer_count as totalQuestions,
        correct_count as correctCount,
        finished_at as finishedAt
      FROM exam_attempts 
      WHERE id = ? AND finished_at IS NOT NULL
    `, [attemptId]);

    if (attempts.length === 0) {
      return NextResponse.json(
        { error: 'クイズ結果が見つかりません' },
        { status: 404 }
      );
    }

    const attempt = attempts[0];

    // 各問題の回答結果を取得
    const questionResults = await executeQuery<any>(`
      SELECT 
        qr.question_id as questionId,
        qr.answer_ids as userAnswers,
        qr.is_correct as isCorrect,
        q.body as questionBody,
        q.choices,
        q.correct_key as correctAnswers,
        q.explanation
      FROM question_responses qr
      JOIN questions q ON qr.question_id = q.id
      WHERE qr.attempt_id = ?
      ORDER BY qr.answered_at
    `, [attemptId]);

    // データを整形
    const results: QuestionResult[] = questionResults.map(row => {
      let userAnswers: number[];
      let correctAnswers: number[];
      let choices;

      try {
        userAnswers = typeof row.userAnswers === 'string' 
          ? JSON.parse(row.userAnswers) 
          : row.userAnswers;
      } catch {
        userAnswers = [];
      }

      try {
        correctAnswers = typeof row.correctAnswers === 'string' 
          ? JSON.parse(row.correctAnswers) 
          : row.correctAnswers;
      } catch {
        correctAnswers = [];
      }

      try {
        choices = typeof row.choices === 'string' 
          ? JSON.parse(row.choices) 
          : row.choices;
      } catch {
        choices = [];
      }

      return {
        questionId: row.questionId,
        questionBody: row.questionBody,
        userAnswers,
        correctAnswers,
        isCorrect: Boolean(row.isCorrect),
        choices,
        explanation: row.explanation
      };
    });

    return NextResponse.json({
      attempt,
      results
    });

  } catch (error) {
    console.error('Get quiz results error:', error);
    return NextResponse.json(
      { error: 'クイズ結果の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
