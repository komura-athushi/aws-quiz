import { NextResponse } from 'next/server';
import { getQuestionById } from '@/lib/quiz-service';
import { ApiError } from '@/types/database';

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

    // クライアントには正解を送信しない
    const { correct_key, explanation, ...questionForClient } = question;

    return NextResponse.json({ 
      question: questionForClient
    });
  } catch (error) {
    console.error('Question fetch error:', error);
    const errorResponse: ApiError = {
      error: 'データベースエラーが発生しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
