# AWS Quiz Application

AWSの資格取得のためのクイズアプリケーション。Next.js 15のApp Routerを使用し、NextAuthでGoogle認証を実装しています。

## URL
https://quizexample.com/

## プロジェクト構成

### `aws-quiz-app/` - メインアプリケーション
Next.js 15を使用したフロントエンド・バックエンドアプリケーション
- Google OAuth認証
- クイズ機能（問題表示・回答・結果表示）
- ダッシュボード（試験一覧・学習進捗）
- API Routes（試験・問題・ユーザー管理）

### `db/` - データベース関連
- `docker-compose.yml` - ローカル開発用MySQL環境
- `create-quiz/` - クイズデータ作成スクリプト
- `schema/` - データベーススキーマ取得スクリプト

### `infra/` - インフラ構成
- `terraform/` - AWS インフラストラクチャの構成管理
  - VPC、RDS（Aurora Serverless v2）、その他AWS リソースの定義

## 技術スタック

- **Frontend**: Next.js 15.3.4 (App Router), React 19.0.0, TypeScript 5
- **Authentication**: NextAuth.js 4.24.11 (Google OAuth)
- **Database**: Aurora Serverless v2 (Production), MySQL2 3.14.1 (Development)
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
