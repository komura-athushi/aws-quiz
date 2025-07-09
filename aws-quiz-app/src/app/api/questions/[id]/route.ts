import { NextResponse } from 'next/server';
import { getQuestionById } from '@/lib/quiz-service';
import { ApiError } from '@/types/database';
import { Logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const questionId = parseInt(id);
    
    if (isNaN(questionId) || questionId <= 0) {
      const errorResponse: ApiError = { 
        error: '無効な問題IDです',
        details: '問題IDは正の整数である必要があります'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const question = await getQuestionById(questionId);

    if (!question) {
      const errorResponse: ApiError = { 
        error: '問題が見つかりません',
        details: `ID ${questionId} の問題は存在しないか、削除されています`
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // クライアントには正解と解説を送信しない
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { correct_key, explanation, ...questionForClient } = question;

    // correct_keyの検証 (クライアントに送らないが、データの整合性チェックは実施)
    if (typeof question.correct_key === 'string') {
      try {
        JSON.parse(question.correct_key);
      } catch (error) {
        Logger.error('Failed to parse correct_key JSON:', error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
          { error: '問題データに不整合があります' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      question: questionForClient
    });
  } catch (error) {
    Logger.error('Question fetch error:', error instanceof Error ? error : new Error(String(error)));
    const errorResponse: ApiError = {
      error: 'データベースエラーが発生しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
