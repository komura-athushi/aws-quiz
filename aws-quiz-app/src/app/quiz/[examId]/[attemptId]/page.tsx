"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Quiz from "@/components/Quiz";
import LoginForm from "@/components/auth/LoginForm";

export default function QuizAttemptPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  
  const examId = parseInt(params.examId as string);
  const attemptId = parseInt(params.attemptId as string);
  const [questionIds, setQuestionIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // exam_attemptsテーブルから問題IDsを取得
  useEffect(() => {
    const fetchAttemptData = async () => {
      console.log('Fetching attempt data for attemptId:', attemptId);
      try {
        const apiUrl = `/api/exam-attempts/${attemptId}`;
        console.log('Fetching from API:', apiUrl);
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        console.log('API Response:', { status: response.status, data });
        
        if (response.ok) {
          if (Array.isArray(data.questionIds) && data.questionIds.length > 0) {
            console.log('Setting question IDs:', data.questionIds);
            setQuestionIds(data.questionIds);
          } else {
            console.error('Invalid questionIds in response:', data.questionIds);
            setError('クイズデータのフォーマットが正しくありません');
          }
        } else {
          console.error('Failed API response:', data);
          setError(data.error || 'クイズデータの取得に失敗しました');
        }
      } catch (error) {
        console.error('Exception during fetch attempt data:', error);
        setError('クイズデータの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    if (attemptId && !isNaN(attemptId)) {
      fetchAttemptData();
    } else {
      console.error('Invalid attemptId:', attemptId);
      setError('無効なクイズ試行IDです');
      setLoading(false);
    }
  }, [attemptId]);

  // ログイン状態の確認
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  // データの読み込み中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">クイズデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  // エラーが発生した場合
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push(`/quiz/${examId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            カテゴリー選択に戻る
          </button>
        </div>
      </div>
    );
  }

  // questionIdsが取得できていない場合はカテゴリー選択画面に戻る
  if (!questionIds || questionIds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">問題データが見つかりません</p>
          <button
            onClick={() => router.push(`/quiz/${examId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            カテゴリー選択に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <Quiz
      attemptId={attemptId}
      questionIds={questionIds}
    />
  );
}
