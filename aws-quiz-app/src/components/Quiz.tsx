"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Question {
  id: number;
  body: string;
  choices: Array<{
    choice_id: number;
    choice_text: string;
  }>;
  correct_key: number[];
}

interface QuizProps {
  attemptId: number;
  questionIds: number[];
  onBack: () => void;
}

export default function Quiz({ attemptId, questionIds, onBack }: QuizProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    // URLから現在の問題番号を取得（0ベース）
    const questionParam = searchParams.get('question');
    const index = questionParam ? parseInt(questionParam) - 1 : 0;
    return Math.max(0, Math.min(index, questionIds.length - 1));
  });
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [allAnswers, setAllAnswers] = useState<Map<number, number[]>>(new Map()); // 問題ID -> 選択した回答IDsの配列
  const [isSubmitting, setIsSubmitting] = useState(false);

  // URLの問題番号が変更された時に状態を同期
  useEffect(() => {
    const questionParam = searchParams.get('question');
    if (questionParam) {
      const index = parseInt(questionParam) - 1;
      const validIndex = Math.max(0, Math.min(index, questionIds.length - 1));
      if (validIndex !== currentQuestionIndex) {
        setCurrentQuestionIndex(validIndex);
      }
    }
  }, [searchParams, questionIds.length, currentQuestionIndex]);

  // 現在の問題を取得
  useEffect(() => {
    const fetchQuestion = async () => {
      if (currentQuestionIndex >= questionIds.length) return;
      
      setLoading(true);
      try {
        const questionId = questionIds[currentQuestionIndex];
        const response = await fetch(`/api/questions/${questionId}`);
        const data = await response.json();
        setCurrentQuestion(data.question);
        
        // 既に回答している場合は、その回答を復元
        const existingAnswers = allAnswers.get(questionId) || [];
        setSelectedAnswers(new Set(existingAnswers));
      } catch (error) {
        console.error('Failed to fetch question:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestion();
  }, [currentQuestionIndex, questionIds, allAnswers]);

  // 選択肢の選択/解除
  const handleAnswerToggle = (choiceId: number) => {
    if (!currentQuestion) return;
    
    const isMultipleChoice = currentQuestion.correct_key.length > 1;
    
    setSelectedAnswers(prev => {
      const newSet = new Set(prev);
      
      if (isMultipleChoice) {
        // 複数選択：チェックボックス形式
        if (newSet.has(choiceId)) {
          newSet.delete(choiceId);
        } else {
          newSet.add(choiceId);
        }
      } else {
        // 単一選択：ラジオボタン形式
        newSet.clear();
        newSet.add(choiceId);
      }
      
      // 現在の問題の回答を保存
      setAllAnswers(prevAllAnswers => {
        const newAllAnswers = new Map(prevAllAnswers);
        newAllAnswers.set(currentQuestion.id, Array.from(newSet));
        return newAllAnswers;
      });
      
      return newSet;
    });
  };

  // 次の問題へ
  const handleNext = () => {
    if (currentQuestionIndex < questionIds.length - 1) {
      setAllAnswers(prev => {
        const newMap = new Map(prev);
        newMap.set(questionIds[currentQuestionIndex], Array.from(selectedAnswers));
        return newMap;
      });
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      // URLクエリパラメータを更新
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.set('question', (nextIndex + 1).toString());
      router.replace(`${window.location.pathname}?${currentParams.toString()}`);
    }
  };

  // 前の問題へ
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIndex);
      
      // URLクエリパラメータを更新
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.set('question', (prevIndex + 1).toString());
      router.replace(`${window.location.pathname}?${currentParams.toString()}`);
    }
  };

  // クイズを送信
  const handleSubmitQuiz = async () => {
    setIsSubmitting(true);
    try {
      // 現在の回答も保存
      if (currentQuestion && selectedAnswers.size > 0) {
        setAllAnswers(prev => {
          const newMap = new Map(prev);
          newMap.set(currentQuestion.id, Array.from(selectedAnswers));
          return newMap;
        });
      }

      // 回答データを準備
      const answers = questionIds.map(questionId => ({
        questionId,
        answerIds: allAnswers.get(questionId) || []
      }));

      // 未回答の問題がある場合は現在の選択も含める
      if (currentQuestion && selectedAnswers.size > 0) {
        const currentAnswerIndex = answers.findIndex(a => a.questionId === currentQuestion.id);
        if (currentAnswerIndex >= 0) {
          answers[currentAnswerIndex].answerIds = Array.from(selectedAnswers);
        }
      }

      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attemptId,
          answers
        }),
      });

      if (response.ok) {
        // 結果画面に遷移
        router.push(`/quiz/results/${attemptId}`);
      } else {
        console.error('Failed to submit quiz');
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 全問題が回答済みかチェック
  const isAllQuestionsAnswered = () => {
    // 現在の問題の回答状況もチェック
    const currentAnswered = selectedAnswers.size > 0;
    
    return questionIds.every((questionId, index) => {
      if (index === currentQuestionIndex) {
        return currentAnswered;
      }
      const answers = allAnswers.get(questionId);
      return answers && answers.length > 0;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">問題を読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              {/* ヘッダー */}
              <div className="mb-6">
                <button
                  onClick={onBack}
                  className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  ← 問題選択に戻る
                </button>
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-gray-900">
                    クイズ
                  </h1>
                  <div className="text-sm text-gray-600">
                    問題 {currentQuestionIndex + 1} / {questionIds.length}
                  </div>
                </div>
              </div>

              {/* 進捗バー */}
              <div className="mb-6">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${((currentQuestionIndex + 1) / questionIds.length) * 100}%`
                    }}
                  ></div>
                </div>
              </div>

              {/* 問題 */}
              {currentQuestion && (
                <div className="mb-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">
                      問題 {currentQuestionIndex + 1}
                    </h2>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {currentQuestion.body}
                    </p>
                  </div>

                  {/* 選択肢 */}
                  <div className="space-y-3">
                    {currentQuestion.choices.map((choice) => {
                      const isMultipleChoice = currentQuestion.correct_key.length > 1;
                      const isSelected = selectedAnswers.has(choice.choice_id);
                      
                      return (
                        <div
                          key={choice.choice_id}
                          className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                          onClick={() => handleAnswerToggle(choice.choice_id)}
                        >
                          <div className="flex items-center">
                            {isMultipleChoice ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleAnswerToggle(choice.choice_id)}
                                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            ) : (
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => handleAnswerToggle(choice.choice_id)}
                                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                            )}
                            <label className="flex-1 cursor-pointer text-gray-800">
                              {choice.choice_text}
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ナビゲーションボタン */}
              <div className="flex justify-between pt-6 border-t border-gray-200">
                <button
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    currentQuestionIndex === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                >
                  前の問題
                </button>

                {currentQuestionIndex === questionIds.length - 1 ? (
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={isSubmitting || !isAllQuestionsAnswered()}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      isSubmitting || !isAllQuestionsAnswered()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isSubmitting ? '送信中...' : 'クイズを送信'}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
                  >
                    次の問題
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
