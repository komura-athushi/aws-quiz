import { NextResponse } from 'next/server';
import { getExamById } from '@/lib/quiz-service';
import { 
  createValidationError, 
  createNotFoundError, 
  createDatabaseError, 
  validatePositiveInteger,
  logApiRequest,
  logApiError
} from '@/lib/api-utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestedId = '';
  try {
    const { id } = await params;
    requestedId = id;
    
    logApiRequest('GET', `/api/exams/${id}`);
    
    const examId = validatePositiveInteger(id);
    if (!examId) {
      return createValidationError(
        '無効な試験IDです',
        '試験IDは正の整数である必要があります'
      );
    }

    const exam = await getExamById(examId);

    if (!exam) {
      return createNotFoundError(
        '試験が見つかりません',
        `ID ${examId} の試験は存在しないか、無効になっています`
      );
    }

    return NextResponse.json({ exam });
  } catch (error) {
    logApiError('GET', `/api/exams/${requestedId}`, error);
    return createDatabaseError(error);
  }
}
