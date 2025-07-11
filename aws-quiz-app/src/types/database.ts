/**
 * データベーススキーマに対応した型定義
 */

// Enum型の定義
export type UserProvider = 'google';
export type UserRole = 'user' | 'admin';
export type ExamLevel = 'beginner' | 'intermediate' | 'advanced';

// データベーステーブルの型定義
export interface User {
  id: number;
  provider: UserProvider;
  subject_id: string;
  name: string;
  role: UserRole;
  deleted_at: Date | null;
  updated_at: Date | null;
  created_at: Date;
  last_login_at: Date | null;
}

export interface Category {
  id: number;
  category_name: string;
  description: string | null;
  created_at: Date;
}

export interface Exam {
  id: number;
  exam_name: string;
  exam_code: string;
  level: ExamLevel | null;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
}

export interface ExamCategory {
  id: number;
  exam_id: number;
  category_id: number;
}

export interface Question {
  id: number;
  body: string;
  explanation: string;
  choices: QuestionChoice[];
  correct_key: number[];
  exam_categories_id: number;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
}

export interface QuestionChoice {
  choice_id: number;
  choice_text: string;
}

export interface ExamAttempt {
  id: number;
  user_id: number;
  exam_id: number;
  started_at: Date;
  finished_at: Date | null;
  answer_count: number | null;
  correct_count: number | null;
  question_ids: number[];
}

export interface QuestionResponse {
  id: number;
  attempt_id: number;
  question_id: number;
  answer_ids: number[];
  is_correct: boolean;
  answered_at: Date;
  feedback: string | null;
}

// API レスポンス用の型定義
export interface CategoryWithQuestionCount extends Category {
  question_count: number;
}

export interface ExamWithStats extends Exam {
  total_questions: number;
  categories: CategoryWithQuestionCount[];
}

// API リクエスト用の型定義
export interface StartQuizRequest {
  examId: number;
  categoryIds: number[];
  questionCount: number;
}

export interface StartQuizResponse {
  success: boolean;
  attemptId: number;
  questionIds: number[];
}

// エラーレスポンス用の型定義
export interface ApiError {
  error: string;
  details?: string;
}

// クライアント向けの問題型（正解を含まない）
export interface QuestionForClient {
  id: number;
  body: string;
  choices: QuestionChoice[];
  exam_categories_id: number;
}

// 問題回答用のリクエスト型
export interface SubmitAnswerRequest {
  attemptId: number;
  questionId: number;
  answerIds: number[];
}

// 問題回答レスポンス型
export interface SubmitAnswerResponse {
  success: boolean;
  isCorrect: boolean;
  correctAnswers: number[];
  explanation: string;
}

// 試験結果取得レスポンス型
export interface QuizResultResponse {
  attempt: ExamAttempt;
  exam: Exam;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  scorePercentage: number;
  responses: QuestionResponseWithDetails[];
}

export interface QuestionResponseWithDetails extends QuestionResponse {
  question: Question;
}

// Quiz関連の複合型
export interface QuizAttemptWithQuestions {
  attempt: ExamAttempt;
  questions: QuestionForClient[];
}

// API共通エラーコード
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// 拡張エラーレスポンス
export interface ExtendedApiError extends ApiError {
  code?: ApiErrorCode;
  timestamp?: string;
}
