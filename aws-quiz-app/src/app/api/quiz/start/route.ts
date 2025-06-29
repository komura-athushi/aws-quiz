import { NextResponse } from 'next/server';
import { executeQuery, executeSimpleQuery } from '@/lib/database';
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

    console.log('Received request body:', { examId, categoryIds, questionCount });

    if (!examId || !categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0 || !questionCount) {
      console.log('Validation failed:', { examId, categoryIds, questionCount });
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
    
    console.log('Test query result:', testQuery);
    
    // 選択されたカテゴリーからランダムに問題を取得
    // シンプルなクエリ構築でMySQL2の制約を回避
    const escapedExamId = Number(examId);
    const escapedCategoryId = Number(categoryIds[0]); // とりあえず最初の1つを使用
    const escapedQuestionCount = Number(questionCount);
    
    console.log('Using values:', { escapedExamId, escapedCategoryId, escapedQuestionCount });
    
    // パラメータなしの直接的なクエリで試す
    const directQuery = `
      SELECT q.id
      FROM questions q
      INNER JOIN exam_categories ec ON q.exam_categories_id = ec.id
      WHERE ec.exam_id = ${escapedExamId}
        AND ec.category_id = ${escapedCategoryId}
        AND q.deleted_at IS NULL
      ORDER BY RAND()
      LIMIT ${escapedQuestionCount}
    `;
    
    console.log('Direct query:', directQuery);
    
    const questions = await executeSimpleQuery<Question>(directQuery);

    if (questions.length < questionCount) {
      return NextResponse.json(
        { error: '選択された条件で十分な問題が見つかりません' },
        { status: 400 }
      );
    }

    const questionIds = questions.map(q => q.id);

    console.log('Session user:', session.user);
    console.log('User ID (Google subject):', session.user.id);
    console.log('Database User ID:', session.user.dbUserId);

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
