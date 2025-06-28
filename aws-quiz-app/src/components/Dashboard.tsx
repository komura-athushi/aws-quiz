"use client";

import { signOut, useSession } from "next-auth/react";

export default function Dashboard() {
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

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
                <p className="text-gray-600 mb-2">
                  ようこそ、{session?.user?.name}さん！
                </p>
                <p className="text-sm text-gray-500">
                  AWSの資格取得に向けて、クイズで学習を始めましょう。
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-blue-800 mb-2">
                    AWS クラウドプラクティショナー
                  </h3>
                  <p className="text-blue-600 text-sm mb-3">
                    AWSの基本的な概念を学習しましょう
                  </p>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                    クイズを開始
                  </button>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-green-800 mb-2">
                    AWS ソリューションアーキテクト
                  </h3>
                  <p className="text-green-600 text-sm mb-3">
                    アーキテクチャ設計のスキルを向上させましょう
                  </p>
                  <button className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors">
                    クイズを開始
                  </button>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-purple-800 mb-2">
                    AWS デベロッパー
                  </h3>
                  <p className="text-purple-600 text-sm mb-3">
                    開発者向けのAWSサービスを学習しましょう
                  </p>
                  <button className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors">
                    クイズを開始
                  </button>
                </div>
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
