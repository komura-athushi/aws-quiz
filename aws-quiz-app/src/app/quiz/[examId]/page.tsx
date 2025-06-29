"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import QuizSelection from "@/components/QuizSelection";
import Quiz from "@/components/Quiz";
import LoginForm from "@/components/auth/LoginForm";

export default function QuizPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const examId = parseInt(params.examId as string);
  const step = searchParams.get('step') || 'selection';
  const attemptId = searchParams.get('attemptId');
  const questionIds = searchParams.get('questionIds');

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
  const handleQuizStart = (newAttemptId: number, newQuestionIds: number[]) => {
    const questionIdsString = newQuestionIds.join(',');
    router.push(`/quiz/${examId}?step=quiz&attemptId=${newAttemptId}&questionIds=${questionIdsString}`);
  };

  // クイズからクイズ選択への戻り
  const handleBackToSelection = () => {
    router.push(`/quiz/${examId}?step=selection`);
  };

  // クイズ中の場合
  if (step === 'quiz' && attemptId && questionIds) {
    const questionIdArray = questionIds.split(',').map(id => parseInt(id));
    return (
      <Quiz
        attemptId={parseInt(attemptId)}
        questionIds={questionIdArray}
        onBack={handleBackToSelection}
      />
    );
  }

  // クイズ選択画面
  return (
    <QuizSelection
      examId={examId}
      onBack={handleBackToDashboard}
      onQuizStart={handleQuizStart}
    />
  );
}
