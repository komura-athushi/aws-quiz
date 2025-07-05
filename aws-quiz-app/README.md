# AWS Quiz Application

AWSの資格取得を支援するクイズアプリケーションです。

## 技術スタック

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Authentication**: NextAuth.js (Google OAuth)
- **Database**: MySQL 8.0
- **Language**: TypeScript

## 機能

- Googleアカウントでのログイン/ログアウト
- ユーザー情報の自動登録・更新
- ロールベースのアクセス制御（user/admin）
- レスポンシブデザイン

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env.local`を作成し、必要な値を設定してください。

```bash
cp .env.example .env.local
```

#### Google OAuth設定

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)にアクセス
2. 新しいプロジェクトを作成またはプロジェクトを選択
3. 「OAuth 2.0 クライアント ID」を作成
4. 承認済みリダイレクトURIに `http://localhost:3000/api/auth/callback/google` を追加
5. クライアントIDとシークレットを`.env.local`に設定

#### NextAuth Secret生成

```bash
openssl rand -base64 32
```

生成された値を`NEXTAUTH_SECRET`に設定してください。

### 3. データベースのセットアップ

#### MySQLサーバーの起動

```bash
# Docker Composeを使用する場合
cd ../db
docker-compose up -d
```

#### データベースとテーブルの作成

```bash
mysql -u root -p < ../db/schema/database_schema_20250629_153135.sql
```

### 4. 開発サーバーの起動

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000)でアプリケーションにアクセスできます。

## API エンドポイント

### 認証関連

- `GET/POST /api/auth/[...nextauth]` - NextAuth.js認証エンドポイント

### ユーザー関連

- `GET /api/user/me` - 現在のユーザー情報を取得

### システム関連

- `GET /api/test-db` - データベース接続テスト

## 開発

### コードフォーマット

```bash
pnpm format
```

### リント

```bash
pnpm lint
```

## ライセンス

MIT License
