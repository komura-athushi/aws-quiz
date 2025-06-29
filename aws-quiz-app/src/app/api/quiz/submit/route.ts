import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

interface SubmitRequest {
  attemptId: number;
  answers: Array<{
    questionId: number;
    answerIds: number[];
  }>;
}

interface Question {
  id: number;
  correct_key: string | number[];
}

export async function POST(request: NextRequest) {
  try {
    const { attemptId, answers }: SubmitRequest = await request.json();

    if (!attemptId || !answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: '無効なリクエストデータです' },
        { status: 400 }
      );
    }

    // 各問題の正解を取得
    const questionIds = answers.map(a => a.questionId);
    const placeholders = questionIds.map(() => '?').join(',');
    
    const questions = await executeQuery<Question>(`
      SELECT id, correct_key
      FROM questions 
      WHERE id IN (${placeholders}) AND deleted_at IS NULL
    `, questionIds);

    const correctAnswersMap = new Map<number, number[]>();
    questions.forEach(q => {
      let correctKey: number[];
      if (typeof q.correct_key === 'string') {
        correctKey = JSON.parse(q.correct_key);
      } else {
        correctKey = q.correct_key;
      }
      correctAnswersMap.set(q.id, correctKey);
    });

    // 各回答をquestion_responsesテーブルに保存
    let correctCount = 0;
    for (const answer of answers) {
      const correctAnswers = correctAnswersMap.get(answer.questionId) || [];
      
      // 正解判定: 配列が完全に一致するかチェック
      const isCorrect = 
        answer.answerIds.length === correctAnswers.length &&
        answer.answerIds.sort().every((id, index) => id === correctAnswers.sort()[index]);
      
      if (isCorrect) {
        correctCount++;
      }

      await executeQuery(`
        INSERT INTO question_responses (
          attempt_id, 
          question_id, 
          answer_ids, 
          is_correct,
          answered_at
        ) VALUES (?, ?, ?, ?, NOW())
      `, [
        attemptId,
        answer.questionId,
        JSON.stringify(answer.answerIds),
        isCorrect ? 1 : 0
      ]);
    }

    // exam_attemptsテーブルを更新
    await executeQuery(`
      UPDATE exam_attempts 
      SET 
        finished_at = NOW(),
        answer_count = ?,
        correct_count = ?
      WHERE id = ?
    `, [answers.length, correctCount, attemptId]);

    return NextResponse.json({ 
      success: true,
      totalQuestions: answers.length,
      correctCount
    });

  } catch (error) {
    console.error('Submit quiz error:', error);
    return NextResponse.json(
      { error: 'クイズの送信中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
