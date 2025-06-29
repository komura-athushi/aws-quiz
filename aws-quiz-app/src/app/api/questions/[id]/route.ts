import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

interface Question {
  id: number;
  body: string;
  choices: string | object; // JSON文字列またはオブジェクト
  correct_key: string | object; // JSON文字列またはオブジェクト
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const questionId = parseInt(id);
    
    if (isNaN(questionId)) {
      return NextResponse.json(
        { error: '無効な問題IDです' },
        { status: 400 }
      );
    }

    // 問題情報を取得
    const questions = await executeQuery<Question>(`
      SELECT 
        id,
        body,
        choices,
        correct_key
      FROM questions 
      WHERE id = ? AND deleted_at IS NULL
    `, [questionId]);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: '問題が見つかりません' },
        { status: 404 }
      );
    }

    const question = questions[0];
    
    console.log('Question choices type:', typeof question.choices);
    console.log('Question choices value:', question.choices);
    console.log('Question correct_key type:', typeof question.correct_key);
    console.log('Question correct_key value:', question.correct_key);
    
    // choicesが既にオブジェクトかどうかを確認
    let parsedChoices;
    if (typeof question.choices === 'string') {
      // 文字列の場合はJSONとして解析
      try {
        parsedChoices = JSON.parse(question.choices);
      } catch (error) {
        console.error('Failed to parse choices JSON:', error);
        return NextResponse.json(
          { error: '問題データに不整合があります' },
          { status: 500 }
        );
      }
    } else {
      // 既にオブジェクトの場合はそのまま使用
      parsedChoices = question.choices;
    }

    // correct_keyの解析
    let parsedCorrectKey;
    if (typeof question.correct_key === 'string') {
      try {
        parsedCorrectKey = JSON.parse(question.correct_key);
      } catch (error) {
        console.error('Failed to parse correct_key JSON:', error);
        return NextResponse.json(
          { error: '問題データに不整合があります' },
          { status: 500 }
        );
      }
    } else {
      parsedCorrectKey = question.correct_key;
    }

    return NextResponse.json({ 
      question: {
        id: question.id,
        body: question.body,
        choices: parsedChoices,
        correct_key: parsedCorrectKey
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'データベースエラーが発生しました' },
      { status: 500 }
    );
  }
}
