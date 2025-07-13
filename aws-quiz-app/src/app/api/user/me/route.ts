import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/database';
import { logError } from '@/lib/api-utils';

/**
 * ユーザー情報取得エンドポイント
 * 
 * セッション情報からユーザーIDを取得し、
 * データベースから対応するユーザー情報を返す
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'ログインが必要です' },
        { status: 401 }
      );
    }

    // データベースからユーザー情報を取得
    const user = await UserService.findBySubjectId(session.user.id);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    // レスポンス
    const userResponse = {
      id: user.id,
      subject_id: user.subject_id,
      name: user.name,
      role: user.role,
      provider: user.provider,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    };

    return NextResponse.json({
      success: true,
      user: userResponse,
    });
  } catch (error) {
    await logError('Get user error', error as Error);
    return NextResponse.json(
      {
        success: false,
        message: 'ユーザー情報の取得に失敗しました',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
