// AWS SDK Error type interface
interface AWSError extends Error {
  code?: string;
  message: string;
  statusCode?: number;
  retryable?: boolean;
  requestId?: string;
}

// Type guard for AWS errors
function isAWSError(error: unknown): error is AWSError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  );
}

import { executeQuery, executeInsert } from '@/lib/database';
import { logInfo, logWarn, logError, logDebug } from '@/lib/api-utils';
import { 
  Exam, 
  CategoryWithQuestionCount, 
  Question,
  ExamAttempt,
  QuestionResponse,
  QuestionResponseWithDetails
} from '@/types/database';

/**
 * 試験情報を取得する
 */
export async function getExamById(examId: number): Promise<Exam | null> {
  const exams = await executeQuery<Exam>(`
    SELECT 
      id,
      exam_name,
      exam_code,
      level,
      description,
      is_active,
      created_at,
      updated_at
    FROM exams 
    WHERE id = ? AND is_active = 1
  `, [examId]);

  return exams.length > 0 ? exams[0] : null;
}

/**
 * 試験のカテゴリー情報と問題数を取得する
 */
export async function getExamCategories(examId: number): Promise<{
  categories: CategoryWithQuestionCount[];
  totalQuestions: number;
}> {
  const categories = await executeQuery<CategoryWithQuestionCount>(`
    SELECT 
      c.id,
      c.category_name,
      c.description,
      c.created_at,
      COUNT(q.id) as question_count
    FROM categories c
    INNER JOIN exam_categories ec ON c.id = ec.category_id
    LEFT JOIN questions q ON ec.id = q.exam_categories_id AND q.deleted_at IS NULL
    WHERE ec.exam_id = ?
    GROUP BY c.id, c.category_name, c.description, c.created_at
    ORDER BY c.category_name
  `, [examId]);

  const totalQuestions = categories.reduce((sum, category) => sum + category.question_count, 0);

  return { categories, totalQuestions };
}

/**
 * 指定されたカテゴリーから問題をランダムに取得する
 */
export async function getRandomQuestions(
  examId: number, 
  categoryIds: number[], 
  limit: number
): Promise<Question[]> {
  if (categoryIds.length === 0) {
    return [];
  }

  // limitは数値として直接クエリに埋め込む
  const validatedLimit = Math.max(1, Math.min(1000, Math.floor(limit))); // 1-1000の範囲で制限
  const categoryPlaceholders = categoryIds.map(() => '?').join(',');
  
  const questions = await executeQuery<Question>(`
    SELECT q.id, q.body, q.explanation, q.choices, q.correct_key, q.exam_categories_id
    FROM questions q
    INNER JOIN exam_categories ec ON q.exam_categories_id = ec.id
    WHERE ec.exam_id = ?
      AND ec.category_id IN (${categoryPlaceholders})
      AND q.deleted_at IS NULL
    ORDER BY RAND()
    LIMIT ${validatedLimit}
  `, [examId, ...categoryIds]);

  return questions;
}

/**
 * カテゴリー別の問題数を取得する
 */
export async function getCategoryQuestionCounts(
  examId: number, 
  categoryIds: number[]
): Promise<{ category_id: number; question_count: number }[]> {
  if (categoryIds.length === 0) {
    return [];
  }

  const categoryPlaceholders = categoryIds.map(() => '?').join(',');
  
  return await executeQuery<{ category_id: number; question_count: number }>(`
    SELECT ec.category_id, COUNT(q.id) as question_count
    FROM questions q
    INNER JOIN exam_categories ec ON q.exam_categories_id = ec.id
    WHERE ec.exam_id = ?
      AND ec.category_id IN (${categoryPlaceholders})
      AND q.deleted_at IS NULL
    GROUP BY ec.category_id
  `, [examId, ...categoryIds]);
}

/**
 * 試験開始記録を作成する
 */
export async function createExamAttempt(
  userId: number,
  examId: number,
  questionIds: number[]
): Promise<number> {
  // 入力検証
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new Error('questionIds must be a non-empty array');
  }
  
  // 各要素が有効な数値であることを確認
  const validQuestionIds = questionIds.filter(id => 
    typeof id === 'number' && !isNaN(id) && id > 0
  );
  
  if (validQuestionIds.length !== questionIds.length) {
    await logWarn('Some invalid question IDs were filtered out', {
      original: questionIds,
      filtered: validQuestionIds
    });
  }
  
  if (validQuestionIds.length === 0) {
    throw new Error('No valid question IDs provided');
  }

  await logInfo('Creating exam attempt', {
    userId,
    examId,
    questionCount: validQuestionIds.length
  });

  try {
    const result = await executeInsert(`
      INSERT INTO exam_attempts (user_id, exam_id, question_ids, started_at)
      VALUES (?, ?, ?, NOW())
    `, [userId, examId, JSON.stringify(validQuestionIds)]);

    await logDebug('Insert result', { result });
    
    if (!result.insertId || result.insertId <= 0) {
      throw new Error('Failed to create exam attempt: Invalid insert ID');
    }

    const insertId = result.insertId;
    
    await logInfo('Successfully created exam attempt', { insertId });
    return insertId;
  } catch (error) {
    await logError('Failed to create exam attempt', error as Error);
    throw error;
  }
}

/**
 * 試験開始記録を取得する
 */
export async function getExamAttempt(attemptId: number, dtUserId: number): Promise<ExamAttempt | null> {
  await logDebug('Fetching exam attempt', { attemptId });
  
  // 該当ユーザーの記録かどうかも同時に検証する
  const attempts = await executeQuery<ExamAttempt>(`
    SELECT 
      id,
      user_id,
      exam_id,
      started_at,
      finished_at,
      answer_count,
      correct_count,
      question_ids
    FROM exam_attempts
    WHERE id = ? AND user_id = ?
  `, [attemptId, dtUserId]);

  await logDebug('Database query result for attempt', { attempts });

  if (!attempts || !Array.isArray(attempts) || attempts.length === 0) {
    await logDebug('No attempt found', { attemptId });
    return null;
  }

  const attempt = attempts[0];
  await logDebug('Raw attempt data', { attempt });
  
  try {
    let questionIds = attempt.question_ids;
    await logDebug('Raw question_ids from database', { questionIds });
    
    // question_idsが文字列の場合はパース
    if (typeof questionIds === 'string') {
      try {
        await logDebug('Parsing question_ids as JSON string');
        questionIds = JSON.parse(questionIds);
      } catch (parseError) {
        await logError('Failed to parse question_ids as JSON', parseError as Error);
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        throw new Error(`Failed to parse question_ids as JSON: ${errorMessage}`);
      }
    }
    
    // 配列であることを確認
    if (Array.isArray(questionIds)) {
      await logDebug('question_ids is an array, filtering valid IDs');
      // 各要素が有効な数値であることを確認
      const validQuestionIds = questionIds.filter(id => 
        typeof id === 'number' && !isNaN(id) && id > 0
      );
      
      await logDebug('Valid question IDs', { validQuestionIds });
      attempt.question_ids = validQuestionIds;
    } else {
      await logError('question_ids is not an array', undefined, { 
        type: typeof questionIds, 
        value: questionIds 
      });
      throw new Error(`question_ids is not an array. Type: ${typeof questionIds}, Value: ${JSON.stringify(questionIds)}`);
    }
  } catch (error) {
    await logError('Failed to process question_ids', error as Error);
    // 処理に失敗した場合は空の配列を設定
    attempt.question_ids = [];
  }
  
  await logDebug('Returning processed attempt', { attempt });
  return attempt;
}

/**
 * 問題をIDで取得する
 */
export async function getQuestionById(questionId: number): Promise<Question | null> {
  const questions = await executeQuery<Question>(`
    SELECT 
      id,
      body,
      explanation,
      choices,
      correct_key,
      exam_categories_id,
      created_at,
      updated_at,
      deleted_at
    FROM questions 
    WHERE id = ? AND deleted_at IS NULL
  `, [questionId]);

  if (questions.length === 0) {
    return null;
  }

  const question = questions[0];
  
  // MySQL JSON型カラムは自動的にパースされているため、JSON.parse()は通常不要
  // しかし、古いデータや特殊なケースでstring型の場合もあるため、両方に対応
  try {
    if (typeof question.choices === 'string') {
      question.choices = JSON.parse(question.choices);
    }
  } catch (error) {
    await logError('Failed to parse choices', error as Error);
    question.choices = [];
  }
  
  try {
    if (typeof question.correct_key === 'string') {
      question.correct_key = JSON.parse(question.correct_key);
    }
  } catch (error) {
    await logError('Failed to parse correct_key', error as Error);
    question.correct_key = [];
  }
  
  return question;
}

/**
 * 試験開始記録を完了状態に更新する
 */
export async function finishExamAttempt(
  attemptId: number,
  answerCount: number,
  correctCount: number
): Promise<void> {
  await logInfo('Finishing exam attempt', { attemptId, answerCount, correctCount });
  
  try {
    const params = [answerCount, correctCount, attemptId];
    await logDebug('UPDATE parameters', { 
      params, 
      paramTypes: params.map(p => typeof p) 
    });
    
    const sql = `
      UPDATE exam_attempts 
      SET finished_at = NOW(), answer_count = ?, correct_count = ?
      WHERE id = ?
    `;
    await logDebug('SQL query', { sql });
    
    const result = await executeQuery(sql, params);
    await logDebug('UPDATE result', { result });
    
    await logInfo('Exam attempt finished successfully');
  } catch (error) {
    await logError('Failed to finish exam attempt', error as Error, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * 問題回答を記録する
 */
export async function saveQuestionResponse(
  attemptId: number,
  questionId: number,
  answerIds: number[],
  isCorrect: boolean,
  feedback?: string
): Promise<void> {
  await logInfo('Saving question response', { attemptId, questionId, answerIds, isCorrect, feedback });
  
  try {
    // 外部キー制約の確認
    await logDebug('Checking foreign key constraints');
    
    // attempt_idの存在確認
    const attemptExists = await executeQuery('SELECT id FROM exam_attempts WHERE id = ?', [attemptId]);
    await logDebug('Attempt exists check', { attemptId, exists: attemptExists.length > 0 });
    if (attemptExists.length === 0) {
      throw new Error(`exam_attempts record with id ${attemptId} does not exist`);
    }
    
    // question_idの存在確認
    const questionExists = await executeQuery('SELECT id FROM questions WHERE id = ? AND deleted_at IS NULL', [questionId]);
    await logDebug('Question exists check', { questionId, exists: questionExists.length > 0 });
    if (questionExists.length === 0) {
      throw new Error(`questions record with id ${questionId} does not exist or is deleted`);
    }
    
    // Aurora Data APIのためにfeedbackをnullに明示的に設定
    const feedbackValue = feedback !== undefined ? feedback : null;
    
    // Aurora Data APIでNULL値がうまく処理されない場合があるため、
    // feedbackがnullの場合は異なるクエリを使用
    let sql: string;
    let params: unknown[];
    
    if (feedbackValue === null) {
      sql = `
        INSERT INTO question_responses (attempt_id, question_id, answer_ids, is_correct, answered_at)
        VALUES (?, ?, ?, ?, NOW())
      `;
      params = [attemptId, questionId, JSON.stringify(answerIds), isCorrect ? 1 : 0];
      await logDebug('Using INSERT without feedback field (NULL case)');
    } else {
      sql = `
        INSERT INTO question_responses (attempt_id, question_id, answer_ids, is_correct, feedback, answered_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;
      params = [attemptId, questionId, JSON.stringify(answerIds), isCorrect ? 1 : 0, feedbackValue];
      await logDebug('Using INSERT with feedback field');
    }
    
    await logDebug('INSERT parameters', { 
      params, 
      paramTypes: params.map(p => typeof p) 
    });
    await logDebug('SQL query', { sql });
    
    // INSERTクエリなのでexecuteInsertを使用
    await logDebug('Executing INSERT');
    const result = await executeInsert(sql, params);
    await logDebug('INSERT result', { result });
    
    // question_responsesテーブルのidはBIGINT型AUTO_INCREMENTなので、
    // insertIdが0でもaffectedRowsが1以上なら成功
    if (result.affectedRows === 0) {
      throw new Error('INSERT failed: No rows were affected');
    }
    
    await logInfo('Question response saved successfully', { affectedRows: result.affectedRows });
  } catch (error) {
    await logError('Failed to save question response', error as Error, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // より詳細なAurora Data APIエラー情報
    if (isAWSError(error)) {
      await logError('AWS Error Details', undefined, {
        code: error.code,
        message: error.message,
        details: error
      });
    }
    
    throw error;
  }
}

/**
 * 試験結果の詳細を取得する
 */
export async function getQuizResults(attemptId: number, dtUserId: number): Promise<{
  attempt: ExamAttempt;
  exam: Exam;
  responses: QuestionResponseWithDetails[];
} | null> {
  // 試験開始記録を取得
  const attempt = await getExamAttempt(attemptId, dtUserId);
  if (!attempt || !attempt.finished_at) {
    return null;
  }

  // 試験情報を取得
  const exam = await getExamById(attempt.exam_id);
  if (!exam) {
    return null;
  }

  // 回答履歴を取得（同じ問題IDに対して複数の回答がある場合は最新のもののみ）
  const responses = await executeQuery<QuestionResponse>(`
    SELECT 
      qr.id,
      qr.attempt_id,
      qr.question_id,
      qr.answer_ids,
      qr.is_correct,
      qr.answered_at,
      qr.feedback
    FROM question_responses qr
    INNER JOIN (
      SELECT question_id, MAX(answered_at) as max_answered_at
      FROM question_responses
      WHERE attempt_id = ?
      GROUP BY question_id
    ) latest ON qr.question_id = latest.question_id 
              AND qr.answered_at = latest.max_answered_at
    WHERE qr.attempt_id = ?
    ORDER BY qr.answered_at
  `, [attemptId, attemptId]);

  // 各回答に問題詳細を追加
  const responsesWithDetails: QuestionResponseWithDetails[] = [];
  
  for (const response of responses) {
    const question = await getQuestionById(response.question_id);
    if (question) {
      // MySQL JSON型カラムの処理
      let answerIds = response.answer_ids;
      try {
        if (typeof response.answer_ids === 'string') {
          answerIds = JSON.parse(response.answer_ids);
        }
      } catch (error) {
        logError('Failed to parse answer_ids in getQuizResults:', error instanceof Error ? error : new Error(String(error)));
        answerIds = [];
      }
      
      const parsedResponse = {
        ...response,
        answer_ids: answerIds,
        question
      };
      responsesWithDetails.push(parsedResponse);
    }
  }

  return {
    attempt,
    exam,
    responses: responsesWithDetails
  };
}
