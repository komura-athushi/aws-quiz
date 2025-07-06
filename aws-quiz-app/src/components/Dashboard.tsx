"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Exam, ApiError } from "@/types/database";
import { ClientLogger } from "@/lib/client-logger";

interface ExamWithStats extends Exam {
  totalQuestions: number;
  userCorrectAnswers: number;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      // 試験情報を取得（統計情報も含む）
      const examsResponse = await fetch('/api/exams/stats');
      const examsData = await examsResponse.json();
      
      if (!examsResponse.ok) {
        const errorData = examsData as ApiError;
        throw new Error(errorData.error || '試験情報の取得に失敗しました');
      }
      
      setExams(examsData.exams || []);
    } catch (error) {
      await ClientLogger.error('Failed to fetch data', error as Error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = useCallback(async () => {
    await signOut({ callbackUrl: "/" });
  }, []);

  const handleStartQuiz = useCallback((examId: number) => {
    router.push(`/quiz/${examId}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                AWS Quiz Application
              </h1>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-gray-600 mb-1">
                      ようこそ、{session?.user?.name}さん！
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  AWSの資格取得に向けて、クイズで学習を始めましょう。
                </p>
              </div>

              {/* エラー表示 */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      fetchData();
                    }}
                    className="mt-2 text-red-600 text-sm underline hover:text-red-800"
                  >
                    再試行
                  </button>
                </div>
              )}
              
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">資格情報を読み込み中...</p>
                  </div>
                ) : exams.length > 0 ? (
                  exams.map((exam, index) => {
                    const colors = [
                      { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", desc: "text-blue-600", button: "bg-blue-600 hover:bg-blue-700" },
                      { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", desc: "text-green-600", button: "bg-green-600 hover:bg-green-700" },
                      { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800", desc: "text-purple-600", button: "bg-purple-600 hover:bg-purple-700" },
                      { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800", desc: "text-orange-600", button: "bg-orange-600 hover:bg-orange-700" },
                    ];
                    const colorSet = colors[index % colors.length];
                    
                    return (
                      <div key={exam.id} className={`${colorSet.bg} border ${colorSet.border} rounded-lg p-4`}>
                        <h3 className={`text-lg font-medium ${colorSet.text} mb-2`}>
                          {exam.exam_name}
                        </h3>
                        <p className={`${colorSet.desc} text-sm mb-3`}>
                          {exam.description || '試験の概要'}
                        </p>
                        
                        {/* 統計情報 */}
                        <div className="mb-4">
                          <div className={`${colorSet.bg} border ${colorSet.border} rounded-md p-3 bg-opacity-50`}>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="text-center">
                                <div className={`text-lg font-bold ${colorSet.text}`}>{exam.totalQuestions}</div>
                                <div className={`text-xs ${colorSet.desc}`}>総問題数</div>
                              </div>
                              <div className="text-center">
                                <div className={`text-lg font-bold ${colorSet.text}`}>{exam.userCorrectAnswers}</div>
                                <div className={`text-xs ${colorSet.desc}`}>正解数</div>
                              </div>
                            </div>
                            {exam.totalQuestions > 0 && (
                              <div className="mt-3 pt-2 border-t border-white border-opacity-50">
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs ${colorSet.desc}`}>正解率</span>
                                  <span className={`text-sm font-medium ${colorSet.text}`}>
                                    {Math.round((exam.userCorrectAnswers / exam.totalQuestions) * 100)}%
                                  </span>
                                </div>
                                <div className="w-full bg-white bg-opacity-50 rounded-full h-2 mt-1">
                                  <div
                                    className={`${colorSet.button.split(' ')[0]} h-2 rounded-full transition-all duration-300`}
                                    style={{
                                      width: `${Math.round((exam.userCorrectAnswers / exam.totalQuestions) * 100)}%`
                                    }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <span className={`text-xs ${colorSet.text} bg-white px-2 py-1 rounded`}>
                            {exam.exam_code}
                          </span>
                          {exam.level && (
                            <span className={`text-xs ${colorSet.text} bg-white px-2 py-1 rounded ml-2`}>
                              {exam.level}
                            </span>
                          )}
                        </div>
                        <button 
                          onClick={() => handleStartQuiz(exam.id)}
                          className={`${colorSet.button} text-white px-4 py-2 rounded-md text-sm font-medium transition-colors`}
                        >
                          クイズを開始
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600">利用可能な資格情報がありません</p>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
