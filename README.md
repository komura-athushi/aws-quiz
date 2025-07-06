# AWS Quiz Application

AWSの資格取得のためのクイズアプリケーション。Next.js 14のApp Routerを使用し、NextAuthでGoogle認証を実装しています。

## プロジェクト構成

### `src/` ディレクトリ構成

#### `src/app/` - Next.js App Router
Next.js 14のApp Routerを使用したアプリケーションのルーティングとページ構成。

- **`layout.tsx`** - アプリケーション全体のレイアウト
  - フォント設定（Geist Sans, Geist Mono）
  - メタデータ設定
  - AuthProviderでの認証状態管理

- **`page.tsx`** - ホームページ（ルートページ）
  - 認証状態によるコンテンツ切り替え
  - 未認証時：ログインフォーム表示
  - 認証済み時：ダッシュボード表示

- **`globals.css`** - グローバルスタイル

##### `src/app/api/` - API Routes
Next.js API Routesによるバックエンド機能。

- **`auth/[...nextauth]/route.ts`** - NextAuth認証エンドポイント
  - Google OAuth認証の設定
  - 環境変数の検証

- **`exams/`** - 試験関連API
  - `route.ts` - 試験一覧取得
  - `[id]/route.ts` - 特定試験の詳細取得
  - `[id]/categories/route.ts` - 試験カテゴリ取得
  - `stats/route.ts` - 試験統計情報取得

- **`exam-attempts/`** - 試験受験記録API
  - `[id]/route.ts` - 特定受験記録の取得

- **`questions/`** - 問題関連API
  - `[id]/route.ts` - 特定問題の取得

- **`quiz/`** - クイズ実行API
  - `start/route.ts` - クイズ開始
  - `submit/route.ts` - クイズ回答送信
  - `results/[id]/route.ts` - クイズ結果取得

- **`user/`** - ユーザー関連API
  - `me/route.ts` - 現在のユーザー情報取得

- **`test-db/`** - データベース接続テスト
- **`test-db-connection/`** - データベース接続確認

##### `src/app/auth/` - 認証関連ページ
認証に関するページ群（現在は空）。

##### `src/app/quiz/` - クイズ関連ページ
- **`[examId]/page.tsx`** - 試験選択ページ
- **`[examId]/[attemptId]/page.tsx`** - クイズ実行ページ
- **`results/[id]/page.tsx`** - クイズ結果表示ページ

#### `src/components/` - Reactコンポーネント
再利用可能なUIコンポーネント群。

- **`Dashboard.tsx`** - メインダッシュボード
  - 試験一覧表示
  - 試験統計情報
  - クイズ開始機能

- **`Quiz.tsx`** - クイズ実行コンポーネント
  - 問題表示
  - 回答選択
  - 進捗管理
  - 回答送信

- **`QuizSelection.tsx`** - クイズ選択コンポーネント

##### `src/components/auth/` - 認証関連コンポーネント
- **`LoginForm.tsx`** - ログインフォーム
  - Google認証ボタン
  - 認証状態管理

##### `src/components/providers/` - Context Provider
- **`AuthProvider.tsx`** - 認証状態のContext Provider
  - NextAuthのSessionProvider

#### `src/lib/` - ユーティリティライブラリ
共通機能とビジネスロジック。

- **`auth.ts`** - NextAuth認証設定
  - Google OAuth設定
  - セッション管理設定
  - Aurora Serverless v2対応の接続設定

- **`database.ts`** - データベース接続管理
  - Aurora Serverless v2 Data API対応
  - ローカルMySQL対応
  - 接続プール管理
  - CRUD操作関数群

- **`quiz-service.ts`** - クイズ関連のビジネスロジック
  - クイズ実行管理
  - 問題取得
  - 回答処理

- **`api-utils.ts`** - API共通ユーティリティ
  - エラーハンドリング
  - レスポンス処理

#### `src/types/` - TypeScript型定義
- **`database.ts`** - データベーススキーマ対応型定義
  - User, Category, Exam, Question等のテーブル型
  - API レスポンス型
  - Enum型定義

#### `types/` - グローバル型定義
- **`next-auth.d.ts`** - NextAuth型拡張

## 技術スタック

- **Frontend**: Next.js 15.3.4 (App Router), React 19, TypeScript 5
- **Authentication**: NextAuth.js 4.24.11 (Google OAuth)
- **Database**: Aurora Serverless v2 (Production), MySQL 2 (Development)
- **Styling**: Tailwind CSS 4
- **Package Manager**: pnpm
- **AWS SDK**: @aws-sdk/client-rds-data 3.840.0

## 主要機能

1. **認証機能**
   - Google OAuth認証
   - セッション管理

2. **クイズ機能**
   - 試験選択
   - 問題表示・回答
   - 結果表示・統計

3. **ダッシュボード**
   - 試験一覧
   - 学習進捗表示