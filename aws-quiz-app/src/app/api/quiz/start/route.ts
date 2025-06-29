import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface Question {
  id: number;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    const { examId, categoryIds, questionCount } = await request.json();


    if (!examId || !categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0 || !questionCount) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    // まずシンプルなクエリで動作確認
    const testQuery = await executeQuery<Question>(`
      SELECT q.id
      FROM questions q
      INNER JOIN exam_categories ec ON q.exam_categories_id = ec.id
      WHERE ec.exam_id = ?
      AND q.deleted_at IS NULL
      LIMIT 5
    `, [examId]);
    
    
    // 選択されたカテゴリーから問題を取得
    const escapedExamId = Number(examId);
    const escapedQuestionCount = Number(questionCount);
    
    // 複数カテゴリーのためのIN句を構築
    const categoryPlaceholders = categoryIds.map(() => '?').join(',');
    
    
    // より安全なアプローチ：パラメータを分けて処理
    const categoryIdNumbers = categoryIds.map(id => Number(id));
    const questionCountNumber = Number(questionCount);
    
    
    // カテゴリー別の問題数を確認
    const categoryQuestionCounts = await executeQuery(`
      SELECT ec.category_id, COUNT(q.id) as question_count
      FROM questions q
      INNER JOIN exam_categories ec ON q.exam_categories_id = ec.id
      WHERE ec.exam_id = ?
        AND ec.category_id IN (${categoryPlaceholders})
        AND q.deleted_at IS NULL
      GROUP BY ec.category_id
    `, [escapedExamId, ...categoryIdNumbers]);
    
    // 複数カテゴリーに対応したクエリ（LIMIT問題を回避）
    const questions = await executeQuery<Question>(`
      SELECT q.id
      FROM questions q
      INNER JOIN exam_categories ec ON q.exam_categories_id = ec.id
      WHERE ec.exam_id = ?
        AND ec.category_id IN (${categoryPlaceholders})
        AND q.deleted_at IS NULL
      ORDER BY RAND()
    `, [escapedExamId, ...categoryIdNumbers]);

    
    // クライアントサイドで制限を適用
    const limitedQuestions = questions.slice(0, questionCountNumber);

    if (limitedQuestions.length < questionCount) {
      return NextResponse.json(
        { error: `選択された条件で十分な問題が見つかりません（必要: ${questionCount}問、見つかった: ${limitedQuestions.length}問）` },
        { status: 400 }
      );
    }

    const questionIds = limitedQuestions.map(q => q.id);


    // データベースのユーザーIDを使用
    if (!session.user.dbUserId) {
      return NextResponse.json(
        { error: 'ユーザー情報が不完全です' },
        { status: 400 }
      );
    }

    // exam_attemptsテーブルにINSERT
    const result = await executeQuery(`
      INSERT INTO exam_attempts (user_id, exam_id, question_ids)
      VALUES (?, ?, ?)
    `, [session.user.dbUserId, examId, JSON.stringify(questionIds)]);

    const attemptId = (result as any).insertId;

    return NextResponse.json({
      success: true,
      attemptId,
      questionIds
    });

  } catch (error) {
    console.error('Quiz start error:', error);
    return NextResponse.json(
      { error: 'クイズの開始に失敗しました' },
      { status: 500 }
    );
  }
}
