import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/database';

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

    // パスワードなどの機密情報を除外してレスポンス
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
    console.error('Get user error:', error);
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
