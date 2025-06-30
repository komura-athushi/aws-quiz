import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

export async function GET() {
  try {
    // Get raw data from exam_attempts to debug the issue
    const attempts = await executeQuery(`
      SELECT 
        id,
        user_id,
        exam_id,
        question_ids,
        typeof(question_ids) as question_ids_type,
        LENGTH(question_ids) as question_ids_length
      FROM exam_attempts 
      WHERE id = 16
      LIMIT 5
    `);

    return NextResponse.json({ 
      attempts,
      debug: 'Raw data from exam_attempts table'
    });
  } catch (error) {
    console.error('Debug query error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
