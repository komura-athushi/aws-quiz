"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { 
  QuestionForClient, 
  ApiError,
  QuizAttemptWithQuestions
} from "@/types/database";
import { ClientLogger } from "@/lib/client-logger";

// ユーザーの回答を保存
interface QuizAnswer {
  questionId: number;
  answerIds: number[];
}

// ユーザの回答を送信するリクエストの型
interface QuizSubmitRequest {
  attemptId: number;
  answers: QuizAnswer[];
}

export default function Quiz({ attemptId }: { attemptId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  
  // URLから examId を取得
  const examId = params.examId ? parseInt(params.examId as string) : null;
  
  // クイズデータの状態管理
  const [quizData, setQuizData] = useState<QuizAttemptWithQuestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // URLから現在の問題番号を取得（0ベース）
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // ユーザーの回答状態
  const [allAnswers, setAllAnswers] = useState<Map<number, number[]>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 現在の問題と選択された回答
  const currentQuestion = quizData?.questions?.[currentQuestionIndex] || null;
  const currentQuestionId = currentQuestion?.id;
  const selectedAnswers = currentQuestionId ? new Set(allAnswers.get(currentQuestionId) || []) : new Set<number>();

  // 初回読み込み時にクイズデータを取得
  useEffect(() => {
    const fetchQuizData = async () => {
      if (!attemptId) return;
      
      ClientLogger.info('Fetching quiz data for attemptId:', { attemptId });
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/exam-attempts/${attemptId}/questions`);
        const data = await response.json();
        
        if (!response.ok) {
          const errorData = data as ApiError;
          throw new Error(errorData.error || 'クイズデータの取得に失敗しました');
        }
        
        ClientLogger.info('Quiz data fetched successfully:', { questionCount: data.questions?.length });
        setQuizData(data);
        
        // 全問題に対して空の回答を初期化
        const initialAnswers = new Map<number, number[]>();
        data.questions.forEach((question: QuestionForClient) => {
          initialAnswers.set(question.id, []);
        });
        setAllAnswers(initialAnswers);
        
      } catch (error) {
        ClientLogger.error('Failed to fetch quiz data:', error instanceof Error ? error : new Error(String(error)));
        setError(error instanceof Error ? error.message : 'クイズデータの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizData();
  }, [attemptId]);

  // 問題選択画面に戻る関数
  const handleBackToSelection = useCallback(() => {
    if (examId) {
      router.push(`/quiz/${examId}`);
    } else {
      router.push('/');
    }
  }, [router, examId]);

  // URLの問題番号が変更された時に状態を同期
  useEffect(() => {
    if (!quizData?.questions) return;
    
    const questionParam = searchParams.get('question');
    if (questionParam) {
      const index = parseInt(questionParam) - 1;
      const validIndex = Math.max(0, Math.min(index, quizData.questions.length - 1));
      if (validIndex !== currentQuestionIndex) {
        setCurrentQuestionIndex(validIndex);
      }
    }
  }, [quizData?.questions, searchParams, currentQuestionIndex]);

  // 選択肢の選択/解除
  const handleAnswerToggle = useCallback((choiceId: number) => {
    if (!currentQuestion || !currentQuestionId) return;
    
    setAllAnswers(previousAnswers => {
      const newAnswers = new Map(previousAnswers);
      const currentAnswers = newAnswers.get(currentQuestionId) || [];
      const newCurrentAnswers = [...currentAnswers];

      // ラジオボタン形式
      // TODO チェックボックス形式も実装
      const existingIndex = newCurrentAnswers.indexOf(choiceId);
      if (existingIndex > -1) {
          // 既に選択されている場合は解除
          newCurrentAnswers.splice(existingIndex, 1);
      } else {
        // 新しく選択
        newCurrentAnswers.length = 0;
        newCurrentAnswers.push(choiceId);
      }
      
      newAnswers.set(currentQuestionId, newCurrentAnswers);
      return newAnswers;
    });
  }, [currentQuestion, currentQuestionId]);

  // ナビゲーション関数
  const navigateToQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(index);
    
    // URLクエリパラメータを更新
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('question', (index + 1).toString());
    router.replace(`${window.location.pathname}?${currentParams.toString()}`);
  }, [router]);

  // 次の問題へ
  const handleNext = useCallback(() => {
    if (!quizData?.questions) return;
    if (currentQuestionIndex < quizData.questions.length - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    }
  }, [currentQuestionIndex, quizData?.questions, navigateToQuestion]);

  // 前の問題へ
  const handlePrevious = useCallback(() => {
    if (!quizData?.questions) return;
    if (currentQuestionIndex > 0) {
      navigateToQuestion(currentQuestionIndex - 1);
    }
  }, [currentQuestionIndex, quizData?.questions, navigateToQuestion]);

  // クイズを送信
  const handleSubmitQuiz = useCallback(async () => {
    if (!quizData?.questions) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // 送信用の回答データ形式に変換
      const answers: QuizAnswer[] = [];
      allAnswers.forEach((answerIds, questionId) => {
        answers.push({
          questionId,
          answerIds
        });
      });
      
      const payload: QuizSubmitRequest = {
        attemptId,
        answers
      };
      
      // 回答を送信
      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorData = data as ApiError;
        throw new Error(errorData.error || 'クイズの送信に失敗しました');
      }
      
      // 結果ページに遷移
      router.push(`/quiz/results/${data.attemptId}`);
    } catch (error) {
      ClientLogger.error('Failed to submit quiz:', error instanceof Error ? error : new Error(String(error)));
      setError(error instanceof Error ? error.message : 'クイズの送信に失敗しました');
      setIsSubmitting(false);
    }
  }, [allAnswers, attemptId, router, quizData?.questions]);

  // 初期検証: クイズデータが無効な場合は早期リターン
  if (!loading && (!quizData?.questions || quizData.questions.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">問題データが不正です</p>
          <button
            onClick={handleBackToSelection}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // 読み込み中表示
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-700">問題を読み込んでいます...</p>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
          >
            再試行
          </button>
          <button
            onClick={handleBackToSelection}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!quizData) return null;

  // 問題表示
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* ヘッダーナビゲーション */}
      <div className="mb-8 flex justify-between items-center">
        <button
          onClick={handleBackToSelection}
          className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          試験選択に戻る
        </button>
        <div className="text-center">
          <span className="font-bold">{currentQuestionIndex + 1}</span> / <span>{quizData.questions.length}</span>
        </div>
        <div className="invisible px-3 py-1">
          {/* 右側のバランスを取るためのダミー要素 */}
        </div>
      </div>

      {/* 問題コンテナ */}
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-6 mb-6">
        {currentQuestion ? (
          <>
            {/* 問題文 */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">問題 {currentQuestionIndex + 1}</h2>
              <p className="whitespace-pre-wrap text-gray-900">{currentQuestion.body}</p>
            </div>

            {/* 選択肢 */}
            <div className="space-y-3">
              {currentQuestion.choices.map(choice => (
                <div
                  key={choice.choice_id}
                  onClick={() => handleAnswerToggle(choice.choice_id)}
                  className={`p-3 border rounded cursor-pointer ${
                    selectedAnswers.has(choice.choice_id)
                      ? 'bg-blue-100 border-blue-500'
                      : 'hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  <div className="flex items-start">
                    <div className="mr-3">
                      {currentQuestion.choices.length > 4 ? (
                        <div
                          className={`w-5 h-5 border rounded ${
                            selectedAnswers.has(choice.choice_id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-400'
                          } flex items-center justify-center`}
                        >
                          {selectedAnswers.has(choice.choice_id) && (
                            <span className="text-white text-xs">✓</span>
                          )}
                        </div>
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-full border ${
                            selectedAnswers.has(choice.choice_id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-400'
                          } flex items-center justify-center`}
                        >
                          {selectedAnswers.has(choice.choice_id) && (
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-gray-900">{choice.choice_text}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-center p-10">問題の読み込みに失敗しました</p>
        )}
      </div>

      {/* ナビゲーションボタン */}
      <div className="max-w-4xl mx-auto flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className={`px-4 py-2 rounded ${
            currentQuestionIndex === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          前へ
        </button>

        {currentQuestionIndex === quizData.questions.length - 1 ? (
          <button
            onClick={handleSubmitQuiz}
            disabled={isSubmitting}
            className={`px-4 py-2 rounded ${
              isSubmitting 
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSubmitting ? '送信中...' : '回答を提出'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            次へ
          </button>
        )}
      </div>

      {/* 問題ナビゲーションインジケーター */}
      <div className="max-w-4xl mx-auto mt-8">
        <div className="flex flex-wrap gap-2 justify-center">
          {quizData.questions.map((question, index) => {
            const hasAnswer = allAnswers.has(question.id) && (allAnswers.get(question.id)?.length ?? 0) > 0;
            
            return (
              <button
                key={index}
                onClick={() => navigateToQuestion(index)}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : hasAnswer
                    ? 'bg-green-100 border border-green-500 text-green-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
