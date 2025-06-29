"use client";

import { useEffect, useState } from "react";
import Quiz from "./Quiz";

interface Exam {
  id: number;
  exam_name: string;
  exam_code: string;
  level: string;
  description: string;
}

interface Category {
  id: number;
  category_name: string;
  description: string;
  question_count: number;
}

interface QuizSelectionProps {
  examId: number;
  onBack: () => void;
  onQuizStart?: (attemptId: number, questionIds: number[]) => void;
}

export default function QuizSelection({ examId, onBack, onQuizStart }: QuizSelectionProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
  const [questionCount, setQuestionCount] = useState<number | string>(10);
  const [quizStarted, setQuizStarted] = useState(false);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [questionIds, setQuestionIds] = useState<number[]>([]);
  const [startingQuiz, setStartingQuiz] = useState(false);

  useEffect(() => {
    const fetchExamDetails = async () => {
      try {
        // 試験情報を取得
        const examResponse = await fetch(`/api/exams/${examId}`);
        const examData = await examResponse.json();
        setExam(examData.exam);

        // カテゴリー別問題数を取得
        const categoriesResponse = await fetch(`/api/exams/${examId}/categories`);
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData.categories || []);
        setTotalQuestions(categoriesData.totalQuestions || 0);
      } catch (error) {
        console.error('Failed to fetch exam details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExamDetails();
  }, [examId]);

  // カテゴリーの選択/解除
  const handleCategoryToggle = (categoryId: number) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // 全選択
  const handleSelectAll = () => {
    setSelectedCategories(new Set(categories.map(category => category.id)));
  };

  // 全解除
  const handleDeselectAll = () => {
    setSelectedCategories(new Set());
  };

  // 選択されたカテゴリーの問題数を計算
  const selectedQuestionCount = categories
    .filter(category => selectedCategories.has(category.id))
    .reduce((sum, category) => sum + category.question_count, 0);

  // 自由入力での問題数変更処理
  const handleInputChange = (value: string) => {
    if (value === '') {
      // 空文字の場合はそのまま設定（クリア可能にする）
      setQuestionCount('');
    } else {
      const count = parseInt(value);
      if (!isNaN(count) && count > 0) {
        const maxQuestions = Math.min(selectedQuestionCount, 100);
        const validCount = Math.min(count, maxQuestions);
        setQuestionCount(validCount);
      }
    }
  };

  // プルダウン用の選択肢を生成
  const getQuestionOptions = () => {
    if (selectedQuestionCount === 0) return [];
    
    const options = [];
    const maxQuestions = Math.min(selectedQuestionCount, 100);
    
    // よく使われそうな選択肢を生成
    const commonOptions = [5, 10, 15, 20, 25, 30, 40, 50];
    
    for (const option of commonOptions) {
      if (option <= maxQuestions) {
        options.push(option);
      }
    }
    
    // 最大問題数も追加（上記に含まれていない場合）
    if (!options.includes(maxQuestions)) {
      options.push(maxQuestions);
    }
    
    return options.sort((a, b) => a - b);
  };

  // 選択されたカテゴリーが変更された時に問題数の初期値を調整
  useEffect(() => {
    if (selectedQuestionCount > 0) {
      const maxQuestions = Math.min(selectedQuestionCount, 100);
      const currentCount = typeof questionCount === 'string' ? parseInt(questionCount) || 0 : questionCount;
      if (currentCount > maxQuestions) {
        setQuestionCount(Math.min(10, maxQuestions));
      }
    }
  }, [selectedQuestionCount, questionCount]);

  // クイズを開始する処理
  const handleStartQuiz = async () => {
    if (selectedCategories.size === 0 || !questionCount) return;
    
    setStartingQuiz(true);
    try {
      const response = await fetch('/api/quiz/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examId,
          categoryIds: Array.from(selectedCategories),
          questionCount: typeof questionCount === 'string' ? parseInt(questionCount) : questionCount,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        if (onQuizStart) {
          // 新しいルーティング方式を使用
          onQuizStart(data.attemptId, data.questionIds);
        } else {
          // 従来の方式（後方互換性のため）
          setAttemptId(data.attemptId);
          setQuestionIds(data.questionIds);
          setQuizStarted(true);
        }
      } else {
        console.error('Failed to start quiz:', data.error);
        alert(data.error || 'クイズの開始に失敗しました');
      }
    } catch (error) {
      console.error('Failed to start quiz:', error);
      alert('クイズの開始に失敗しました');
    } finally {
      setStartingQuiz(false);
    }
  };

  // クイズから戻る処理
  const handleBackFromQuiz = () => {
    setQuizStarted(false);
    setAttemptId(null);
    setQuestionIds([]);
  };

  // クイズが開始されている場合は、Quizコンポーネントを表示
  if (quizStarted && attemptId && questionIds.length > 0) {
    return (
      <Quiz
        attemptId={attemptId}
        questionIds={questionIds}
        onBack={handleBackFromQuiz}
      />
    );
  }

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
                    <input
                      type="number"
                      min="1"
                      max={selectedQuestionCount}
                      value={questionCount}
                      onChange={(e) => handleInputChange(e.target.value)}
                      list="question-options"
                      className="w-24 px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="選択"
                    />
                    <datalist id="question-options">
                      {getQuestionOptions().map((count) => (
                        <option key={count} value={count} />
                      ))}
                    </datalist>
                    <span className="text-green-800">問</span>
                  </div>
                </div>
              )}

              {/* クイズ開始ボタン */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                {(() => {
                  const isValidQuestionCount = questionCount !== '' && questionCount !== 0 && 
                    (typeof questionCount === 'number' ? questionCount > 0 : parseInt(questionCount) > 0);
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
