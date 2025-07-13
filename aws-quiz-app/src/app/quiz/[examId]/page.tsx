"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import CategorySelection from "@/components/CategorySelection";
import LoginForm from "@/components/auth/LoginForm";
import { ClientLogger } from "@/lib/client-logger";

export default function QuizPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  
  const examId = parseInt(params.examId as string);

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

  // ダッシュボードに戻る関数
  const handleBackToDashboard = () => {
    router.push('/');
  };

  // クイズ選択からクイズ開始への遷移
  const handleQuizStart = (newAttemptId: number) => {
    ClientLogger.info('Redirecting to quiz with attemptId:', { attemptId: newAttemptId });
    if (!newAttemptId || newAttemptId <= 0) {
      ClientLogger.error('Invalid attemptId, cannot navigate to quiz:', new Error('Invalid attemptId'), { attemptId: newAttemptId });
      return;
    }
    // 絶対URLパスを使用して遷移を確保
    const quizUrl = `/quiz/${examId}/${newAttemptId}`;
    ClientLogger.info('Navigating to:', { url: quizUrl });
    router.push(quizUrl);
  };

  // カテゴリー選択画面を表示
  return (
    <CategorySelection
      examId={examId}
      onBack={handleBackToDashboard}
      onQuizStart={handleQuizStart}
    />
  );
}
