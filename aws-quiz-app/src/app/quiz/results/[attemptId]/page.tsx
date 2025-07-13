"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QuizResultResponse } from "@/types/database";
import { ClientLogger } from "@/lib/client-logger";

export default function QuizResultsPage() {
  const params = useParams();
  const attemptId = params.attemptId as string;
  const [resultsData, setResultsData] = useState<QuizResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 試験結果を取得
  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/quiz/results/${attemptId}`);
        if (response.ok) {
          const data = await response.json();
          setResultsData(data);
        } else {
          setError('結果の取得に失敗しました');
        }
      } catch (error) {
        ClientLogger.error('Error fetching results:', error instanceof Error ? error : new Error(String(error)));
        setError('結果の取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    if (attemptId) {
      fetchResults();
    }
  }, [attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">結果を読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !resultsData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <p className="text-red-600">{error || '結果データが見つかりません'}</p>
            <Link 
              href="/"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { responses, correctCount, totalQuestions, scorePercentage } = resultsData;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 結果サマリー */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  クイズ結果
                </h1>
                <div className={`text-6xl font-bold mb-4 ${
                  scorePercentage >= 80 ? 'text-green-600' : 
                  scorePercentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {scorePercentage}%
                </div>
                <p className="text-xl text-gray-600 mb-6">
                  {correctCount} / {totalQuestions} 問正解
                </p>
                <div className="flex justify-center space-x-4">
                  <Link
                    href={`/quiz/${resultsData.exam.id}`}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    カテゴリー選択画面に戻る
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 問題別結果 */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">問題別結果</h2>
            
            {responses.map((response, index) => (
              <div key={response.question_id} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  {/* 問題ヘッダー */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      問題 {index + 1}
                    </h3>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      response.is_correct 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {response.is_correct ? '正解' : '不正解'}
                    </div>
                  </div>

                  {/* 問題文 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {response.question.body}
                    </p>
                  </div>

                  {/* 選択肢一覧 */}
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-3">選択肢:</h4>
                    <div className="space-y-2">
                      {response.question.choices.map((choice) => {
                        const isUserAnswer = response.answer_ids.includes(choice.choice_id);
                        const isCorrectAnswer = response.question.correct_key.includes(choice.choice_id);
                        
                        let bgColor = 'bg-gray-50 border-gray-200';
                        let textColor = 'text-gray-800';
                        let badge = null;
                        
                        if (isCorrectAnswer && isUserAnswer) {
                          // 正解かつユーザーが選択
                          bgColor = 'bg-green-50 border-green-300';
                          textColor = 'text-green-800';
                          badge = (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">
                              正解・選択済み
                            </span>
                          );
                        } else if (isCorrectAnswer) {
                          // 正解だがユーザーが選択していない
                          bgColor = 'bg-green-50 border-green-300';
                          textColor = 'text-green-800';
                          badge = (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">
                              正解
                            </span>
                          );
                        } else if (isUserAnswer) {
                          // ユーザーが選択したが不正解
                          bgColor = 'bg-red-50 border-red-300';
                          textColor = 'text-red-800';
                          badge = (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 ml-2">
                              選択済み
                            </span>
                          );
                        }
                        
                        return (
                          <div
                            key={choice.choice_id}
                            className={`border rounded-lg p-3 ${bgColor}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`${textColor} flex-1`}>
                                {choice.choice_text}
                              </span>
                              {badge}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 解説 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">解説:</h4>
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {response.question.explanation}

                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
