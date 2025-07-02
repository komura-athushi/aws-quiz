import { NextResponse } from 'next/server';
import { testConnection, getDatabaseInfo } from '@/lib/database';

export async function GET() {
  try {
    const connectionTest = await testConnection();
    const dbInfo = getDatabaseInfo();
    
    return NextResponse.json({
      ...connectionTest,
      info: dbInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
