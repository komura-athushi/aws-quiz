import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getQuestionById, 
  saveQuestionResponse, 
  finishExamAttempt,
  getExamAttempt 
} from '@/lib/quiz-service';
import { Logger } from '@/lib/logger';
import { 
  createValidationError,
  createUnauthorizedError,
  createNotFoundError,
  createDatabaseError,
  logApiRequest,
  logApiError
} from '@/lib/api-utils';

interface QuizAnswer {
  questionId: number;
  answerIds: number[];
}

interface SubmitQuizRequest {
  attemptId: number;
  answers: QuizAnswer[];
}

interface SubmitQuizResponse {
  success: boolean;
  totalQuestions: number;
  correctCount: number;
  attemptId: number;
}

/**
 * 回答が正解かどうかを判定する
 */
function isAnswerCorrect(selectedAnswers: number[], correctAnswers: number[]): boolean {
  if (selectedAnswers.length !== correctAnswers.length) {
    return false;
  }
  
  const sortedSelected = [...selectedAnswers].sort((a, b) => a - b);
  const sortedCorrect = [...correctAnswers].sort((a, b) => a - b);
  
  return sortedSelected.every((answer, index) => answer === sortedCorrect[index]);
}

/**
 * リクエストデータの検証
 */
function validateSubmitRequest(body: unknown): body is SubmitQuizRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const typedBody = body as Record<string, unknown>;
  
  // attemptId のチェック
  if (!('attemptId' in typedBody) || typeof typedBody.attemptId !== 'number') {
    return false;
  }
  
  // answers 配列のチェック
  if (!('answers' in typedBody) || !Array.isArray(typedBody.answers)) {
    return false;
  }
  
  // 各回答のチェック
  return typedBody.answers.every((answer: unknown) => {
    if (typeof answer !== 'object' || answer === null) {
      return false;
    }
    
    const typedAnswer = answer as Record<string, unknown>;
    
    return (
      'questionId' in typedAnswer && 
      typeof typedAnswer.questionId === 'number' &&
      'answerIds' in typedAnswer &&
      Array.isArray(typedAnswer.answerIds) &&
      typedAnswer.answerIds.every((id: unknown) => typeof id === 'number')
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session.user.dbUserId) {
      return createUnauthorizedError(
        'ログインが必要です',
        'セッション情報が不完全です'
      );
    }

    const dtUserId = session.user.dbUserId;

    const body = await request.json();
    
    logApiRequest('POST', '/api/quiz/submit');

    if (!validateSubmitRequest(body)) {
      return createValidationError(
        '無効なリクエストデータです',
        'attemptId と answers が正しく設定されている必要があります'
      );
    }

    const { attemptId, answers } = body;

    // 試験開始記録の存在確認と権限チェック
    const attempt = await getExamAttempt(attemptId, dtUserId);
    if (!attempt) {
      return createNotFoundError(
        'クイズセッションが見つかりません',
        `ID ${attemptId} の試験開始記録は存在しません`
      );
    }

    if (attempt.user_id !== dtUserId) {
      return createUnauthorizedError(
        'このクイズセッションにアクセスする権限がありません',
        '異なるユーザーの試験記録です'
      );
    }

    if (attempt.finished_at) {
      return createValidationError(
        'このクイズは既に完了しています',
        '完了済みの試験記録に対する操作は許可されていません'
      );
    }

    // 各回答を処理
    let correctCount = 0;
    const results: Array<{ questionId: number; isCorrect: boolean }> = [];

    for (const answer of answers) {
      try {
        const question = await getQuestionById(answer.questionId);
        
        if (!question) {
          console.warn(`Question not found: ${answer.questionId}`);
          continue;
        }

        const isCorrect = isAnswerCorrect(answer.answerIds, question.correct_key);
        if (isCorrect) {
          correctCount++;
        }

        // 回答を記録
        await saveQuestionResponse(
          attemptId,
          answer.questionId,
          answer.answerIds,
          isCorrect
        );

        results.push({ questionId: answer.questionId, isCorrect });
      } catch (error) {
        Logger.error(`Error processing answer for question ${answer.questionId}:`, error instanceof Error ? error : new Error(String(error)));
        // 個別の問題エラーは記録するが、全体の処理は継続
      }
    }

    // 試験開始記録を完了状態に更新
    await finishExamAttempt(attemptId, answers.length, correctCount);

    const response: SubmitQuizResponse = {
      success: true,
      totalQuestions: answers.length,
      correctCount,
      attemptId
    };

    return NextResponse.json(response);

  } catch (error) {
    logApiError('POST', '/api/quiz/submit', error);
    return createDatabaseError(error);
  }
}
