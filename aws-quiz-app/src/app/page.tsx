"use client";

import { useSession } from "next-auth/react";
import LoginForm from "@/components/auth/LoginForm";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const { data: session, status } = useSession();

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

  // 未ログインならログインフォームを表示
  if (!session) {
    return <LoginForm />;
  }

  // ログイン済みならダッシュボードを表示
  return <Dashboard />;
}
