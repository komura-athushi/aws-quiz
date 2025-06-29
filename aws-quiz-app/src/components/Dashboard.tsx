"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import QuizSelection from "./QuizSelection";

interface Exam {
  id: number;
  exam_name: string;
  exam_code: string;
  level: string;
  description: string;
  is_active: number;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'quiz-selection'>('dashboard');
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const response = await fetch('/api/exams');
        const data = await response.json();
        setExams(data.exams || []);
      } catch (error) {
        console.error('Failed to fetch exams:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const handleStartQuiz = (examId: number) => {
    setSelectedExamId(examId);
    setCurrentView('quiz-selection');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedExamId(null);
  };

  // 問題選択画面を表示
  if (currentView === 'quiz-selection' && selectedExamId) {
    return <QuizSelection examId={selectedExamId} onBack={handleBackToDashboard} />;
  }

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
