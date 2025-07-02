"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { 
  Exam, 
  CategoryWithQuestionCount, 
  StartQuizRequest, 
  StartQuizResponse, 
  ApiError 
} from "@/types/database";

interface QuizSelectionProps {
  examId: number;
  onBack: () => void;
  onQuizStart: (attemptId: number) => void;
}

// 問題数の選択肢を生成する定数
const DEFAULT_QUESTION_OPTIONS = [1, 5, 10, 15, 20, 30, 50, 100, 200];

export default function QuizSelection({ examId, onBack, onQuizStart }: QuizSelectionProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [categories, setCategories] = useState<CategoryWithQuestionCount[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [startingQuiz, setStartingQuiz] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 選択されたカテゴリーの問題数を計算
  const selectedQuestionCount = useMemo(() => {
    return categories
      .filter(category => selectedCategories.has(category.id))
      .reduce((sum, category) => sum + category.question_count, 0);
  }, [categories, selectedCategories]);

  // 利用可能な問題数オプションを生成
  const questionOptions = useMemo(() => {
    if (selectedQuestionCount === 0) return [];
    
    const options = DEFAULT_QUESTION_OPTIONS.filter(option => option <= selectedQuestionCount);
    
    // 最大問題数も追加（上記に含まれていない場合）
    if (!options.includes(selectedQuestionCount)) {
      options.push(selectedQuestionCount);
    }
    
    return options.sort((a, b) => a - b);
  }, [selectedQuestionCount]);

  // 試験データを取得
  const fetchExamDetails = useCallback(async () => {
    try {
      setError(null);
      
      // 試験情報を取得
      const examResponse = await fetch(`/api/exams/${examId}`);
      const examData = await examResponse.json();
      
      if (!examResponse.ok) {
        throw new Error(examData.error || '試験情報の取得に失敗しました');
      }
      
      setExam(examData.exam);

      // カテゴリー別問題数を取得
      const categoriesResponse = await fetch(`/api/exams/${examId}/categories`);
      const categoriesData = await categoriesResponse.json();
      
      if (!categoriesResponse.ok) {
        throw new Error(categoriesData.error || 'カテゴリー情報の取得に失敗しました');
      }
      
      setCategories(categoriesData.categories || []);
      setTotalQuestions(categoriesData.totalQuestions || 0);
    } catch (error) {
      console.error('Failed to fetch exam details:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExamDetails();
  }, [fetchExamDetails]);

  // カテゴリーの選択/解除
  const handleCategoryToggle = useCallback((categoryId: number) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  // 全選択
  const handleSelectAll = useCallback(() => {
    setSelectedCategories(new Set(categories.map(category => category.id)));
  }, [categories]);

  // 全解除
  const handleDeselectAll = useCallback(() => {
    setSelectedCategories(new Set());
  }, []);

  // 問題数変更処理
  const handleQuestionCountChange = useCallback((value: string) => {
    const count = parseInt(value);
    if (!isNaN(count) && count > 0) {
      setQuestionCount(count);
    }
  }, []);

  // 選択されたカテゴリーが変更された時に問題数の初期値を調整
  useEffect(() => {
    if (selectedQuestionCount > 0) {
      if (questionCount > selectedQuestionCount || questionCount === 0) {
        // デフォルト値を設定（10問または最大問題数の小さい方）
        setQuestionCount(Math.min(10, selectedQuestionCount));
      }
    }
  }, [selectedQuestionCount, questionCount]);

  // クイズを開始する処理
  const handleStartQuiz = useCallback(async () => {
    if (selectedCategories.size === 0 || questionCount <= 0) return;
    
    setStartingQuiz(true);
    setError(null);
    
    try {
      const requestBody: StartQuizRequest = {
        examId,
        categoryIds: Array.from(selectedCategories),
        questionCount,
      };

      console.log('Starting quiz with request:', requestBody);

      const response = await fetch('/api/quiz/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data: StartQuizResponse | ApiError = await response.json();
      console.log('Quiz start API response:', { status: response.status, data });
      
      if (response.ok && 'success' in data) {
        console.log('Quiz started successfully, redirecting to quiz page with attemptId:', data.attemptId);
        if (!data.attemptId || data.attemptId <= 0) {
          console.error('Invalid attemptId received from API:', data.attemptId);
          setError('無効な試験IDが返されました。もう一度お試しください。');
          return;
        }
        // 正常な遷移のためのデバッグ
        try {
          onQuizStart(data.attemptId);
        } catch (redirectError) {
          console.error('Error during navigation:', redirectError);
          setError('クイズ画面への遷移中にエラーが発生しました。');
        }
      } else {
        const errorData = data as ApiError;
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error;
        setError(errorMessage);
        console.error('Failed to start quiz:', errorData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'クイズの開始に失敗しました';
      setError(errorMessage);
      console.error('Failed to start quiz:', error);
    } finally {
      setStartingQuiz(false);
    }
  }, [examId, selectedCategories, questionCount, onQuizStart]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">試験情報を読み込み中...</p>
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
                  ← ダッシュボードに戻る
                </button>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  問題選択
                </h1>
                {exam && (
                  <div>
                    <h2 className="text-xl font-medium text-gray-800 mb-2">
                      {exam.exam_name}
                    </h2>
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {exam.exam_code}
                      </span>
                      {exam.level && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          {exam.level}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                      {exam.description}
                    </p>
                  </div>
                )}
              </div>

              {/* 総問題数 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-blue-800 mb-2">
                  総問題数
                </h3>
                <p className="text-2xl font-bold text-blue-900">
                  {totalQuestions}問
                </p>
              </div>

              {/* カテゴリー選択 */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    カテゴリー選択
                  </h3>
                  <div className="space-x-2">
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      全選択
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      全解除
                    </button>
                  </div>
                </div>
                {categories.length > 0 ? (
                  <div className="space-y-3">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className={`border rounded-lg p-4 transition-colors ${
                          selectedCategories.has(category.id)
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`category-${category.id}`}
                            checked={selectedCategories.has(category.id)}
                            onChange={() => handleCategoryToggle(category.id)}
                            className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor={`category-${category.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {category.category_name}
                                </h4>
                                {category.description && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {category.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <span className="text-lg font-bold text-gray-900">
                                  {category.question_count}問
                                </span>
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600">
                      この試験にはカテゴリーが設定されていません
                    </p>
                  </div>
                )}
              </div>

              {/* 問題数選択 */}
              {selectedQuestionCount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6 mb-6">
                  <h3 className="text-lg font-medium text-green-800 mb-3">
                    問題数を選択
                  </h3>
                  <div className="flex items-center space-x-2">
                    <select
                      value={questionCount}
                      onChange={(e) => handleQuestionCountChange(e.target.value)}
                      className="w-32 px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {questionOptions.map((count: number) => (
                        <option key={count} value={count}>
                          {count}問
                        </option>
                      ))}
                    </select>
                    <span className="text-green-800">
                      （最大 {selectedQuestionCount}問）
                    </span>
                  </div>
                </div>
              )}

              {/* クイズ開始ボタン */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}
                {(() => {
                  const isValidQuestionCount = questionCount > 0;
                  const isDisabled = selectedCategories.size === 0 || !isValidQuestionCount || startingQuiz;
                  
                  return (
                    <button
                      disabled={isDisabled}
                      onClick={handleStartQuiz}
                      className={`w-full py-3 px-6 rounded-lg text-lg font-medium transition-colors ${
                        isDisabled
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      }`}
                    >
                      {startingQuiz
                        ? 'クイズを開始中...'
                        : selectedCategories.size === 0 
                        ? 'カテゴリーを選択してください' 
                        : !isValidQuestionCount
                        ? '問題数を入力してください'
                        : `クイズを開始（${questionCount}問）`
                      }
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
