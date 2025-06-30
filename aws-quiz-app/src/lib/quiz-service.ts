import { executeQuery } from '@/lib/database';
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

  // limitは数値として直接クエリに埋め込む（SQLインジェクション対策で数値検証済み）
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
    console.warn('Some invalid question IDs were filtered out:', {
      original: questionIds,
      filtered: validQuestionIds
    });
  }
  
  if (validQuestionIds.length === 0) {
    throw new Error('No valid question IDs provided');
  }

  const result = await executeQuery(`
    INSERT INTO exam_attempts (user_id, exam_id, question_ids, started_at)
    VALUES (?, ?, ?, NOW())
  `, [userId, examId, JSON.stringify(validQuestionIds)]);

  return (result as any).insertId;
}

/**
 * 試験開始記録を取得する
 */
export async function getExamAttempt(attemptId: number): Promise<ExamAttempt | null> {
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
    WHERE id = ?
  `, [attemptId]);

  if (attempts.length === 0) {
    return null;
  }

  const attempt = attempts[0];
  
  // MySQL JSON型カラムは自動的にパースされているため、JSON.parse()は不要
  try {
    // MySQL JSON型の場合、既にパースされたデータが返される
    let questionIds = attempt.question_ids;
    
    // 配列であることを確認
    if (Array.isArray(questionIds)) {
      // 各要素が有効な数値であることを確認
      const validQuestionIds = questionIds.filter(id => 
        typeof id === 'number' && !isNaN(id) && id > 0
      );
      
      attempt.question_ids = validQuestionIds;
    } else {
      throw new Error(`question_ids is not an array. Type: ${typeof questionIds}, Value: ${JSON.stringify(questionIds)}`);
    }
  } catch (error) {
    console.error('Failed to process question_ids:', error);
    // 処理に失敗した場合は空の配列を設定
    attempt.question_ids = [];
  }
  
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
    console.error('Failed to parse choices:', error);
    question.choices = [];
  }
  
  try {
    if (typeof question.correct_key === 'string') {
      question.correct_key = JSON.parse(question.correct_key);
    }
  } catch (error) {
    console.error('Failed to parse correct_key:', error);
    question.correct_key = [];
  }
  
  return question;
}

/**
 * 試験統計情報を取得する
 */
export async function getExamStats(examId: number): Promise<{
  totalQuestions: number;
  totalCategories: number;
  activeUsers: number;
  completedAttempts: number;
}> {
  const [statsResult] = await Promise.all([
    executeQuery<{
      total_questions: number;
      total_categories: number;
      active_users: number;
      completed_attempts: number;
    }>(`
      SELECT 
        (SELECT COUNT(*) FROM questions q 
         INNER JOIN exam_categories ec ON q.exam_categories_id = ec.id 
         WHERE ec.exam_id = ? AND q.deleted_at IS NULL) as total_questions,
        (SELECT COUNT(DISTINCT ec.category_id) FROM exam_categories ec 
         WHERE ec.exam_id = ?) as total_categories,
        (SELECT COUNT(DISTINCT ea.user_id) FROM exam_attempts ea 
         WHERE ea.exam_id = ?) as active_users,
        (SELECT COUNT(*) FROM exam_attempts ea 
         WHERE ea.exam_id = ? AND ea.finished_at IS NOT NULL) as completed_attempts
    `, [examId, examId, examId, examId])
  ]);

  return {
    totalQuestions: statsResult[0]?.total_questions || 0,
    totalCategories: statsResult[0]?.total_categories || 0,
    activeUsers: statsResult[0]?.active_users || 0,
    completedAttempts: statsResult[0]?.completed_attempts || 0
  };
}

/**
 * 試験開始記録を完了状態に更新する
 */
export async function finishExamAttempt(
  attemptId: number,
  answerCount: number,
  correctCount: number
): Promise<void> {
  await executeQuery(`
    UPDATE exam_attempts 
    SET finished_at = NOW(), answer_count = ?, correct_count = ?
    WHERE id = ?
  `, [answerCount, correctCount, attemptId]);
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
  await executeQuery(`
    INSERT INTO question_responses (attempt_id, question_id, answer_ids, is_correct, feedback, answered_at)
    VALUES (?, ?, ?, ?, ?, NOW())
  `, [attemptId, questionId, JSON.stringify(answerIds), isCorrect ? 1 : 0, feedback || null]);
}

/**
 * 試験の回答履歴を取得する
 */
export async function getQuestionResponses(attemptId: number): Promise<QuestionResponse[]> {
  const responses = await executeQuery<QuestionResponse>(`
    SELECT 
      id,
      attempt_id,
      question_id,
      answer_ids,
      is_correct,
      answered_at,
      feedback
    FROM question_responses
    WHERE attempt_id = ?
    ORDER BY answered_at
  `, [attemptId]);

  // MySQL JSON型カラムの処理
  return responses.map(response => {
    try {
      // answer_idsがstring型の場合のみJSON.parse()を実行
      if (typeof response.answer_ids === 'string') {
        response.answer_ids = JSON.parse(response.answer_ids);
      }
    } catch (error) {
      console.error('Failed to parse answer_ids:', error);
      response.answer_ids = [];
    }
    return response;
  });
}

/**
 * 試験結果の詳細を取得する
 */
export async function getQuizResults(attemptId: number): Promise<{
  attempt: ExamAttempt;
  exam: Exam;
  responses: QuestionResponseWithDetails[];
} | null> {
  // 試験開始記録を取得
  const attempt = await getExamAttempt(attemptId);
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
        console.error('Failed to parse answer_ids in getQuizResults:', error);
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
