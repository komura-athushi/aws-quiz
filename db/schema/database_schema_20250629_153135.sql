-- Database: aws_quiz
-- Exported at: 2025-06-29T15:31:35.986336

CREATE DATABASE IF NOT EXISTS `aws_quiz`;
USE `aws_quiz`;

-- Table: categories
CREATE TABLE `categories` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `category_name` VARCHAR(100) COLLATE "utf8mb4_0900_ai_ci" NOT NULL COMMENT 'カテゴリー名',
  `description` TEXT COLLATE "utf8mb4_0900_ai_ci" COMMENT '概要',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)

);

CREATE UNIQUE INDEX `category_name` ON `categories` (`category_name`);

-- Table: exam_attempts
CREATE TABLE `exam_attempts` (
  `id` INTEGER NOT NULL DEFAULT (0),
  `user_id` INTEGER NOT NULL,
  `exam_id` INTEGER NOT NULL,
  `started_at` DATETIME NOT NULL DEFAULT (now()) COMMENT '回答開始時刻',
  `finished_at` DATETIME COMMENT '回答終了時刻',
  `answer_count` INTEGER COMMENT '回答数',
  `correct_count` INTEGER COMMENT '正答数',
  `question_ids` JSON NOT NULL COMMENT '回答した(予定)のクイズID一覧'
,
  PRIMARY KEY (`id`)
,
  CONSTRAINT `FK_exam_attempts_exams` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`)
,
  CONSTRAINT `FK_exam_attempts_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)

);

CREATE INDEX `FK_exam_attempts_exams` ON `exam_attempts` (`exam_id`);
CREATE INDEX `FK_exam_attempts_users` ON `exam_attempts` (`user_id`);

-- Table: exam_categories
CREATE TABLE `exam_categories` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `exam_id` INTEGER NOT NULL,
  `category_id` INTEGER NOT NULL
,
  PRIMARY KEY (`id`)
,
  CONSTRAINT `FK_exam_categories_categories` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
,
  CONSTRAINT `FK_exam_categories_exams` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`)

);

CREATE INDEX `FK_exam_categories_categories` ON `exam_categories` (`category_id`);
CREATE INDEX `FK_exam_categories_exams` ON `exam_categories` (`exam_id`);

-- Table: exams
CREATE TABLE `exams` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `exam_name` VARCHAR(255) COLLATE "utf8mb4_0900_ai_ci" NOT NULL COMMENT '試験名',
  `exam_code` VARCHAR(20) COLLATE "utf8mb4_0900_ai_ci" NOT NULL COMMENT 'AWS 公認のコード例：SAA-C03',
  `level` ENUM COMMENT '難易度',
  `description` TEXT COLLATE "utf8mb4_0900_ai_ci" COMMENT '試験概要',
  `is_active` TINYINT NOT NULL DEFAULT '1' COMMENT '0なら非アクティブ',
  `created_at` DATETIME NOT NULL DEFAULT (now()),
  `updated_at` DATETIME
,
  PRIMARY KEY (`id`)

);


-- Table: question_responses
CREATE TABLE `question_responses` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `attempt_id` INTEGER NOT NULL,
  `question_id` INTEGER NOT NULL,
  `answer_ids` JSON NOT NULL,
  `is_correct` TINYINT NOT NULL DEFAULT '0',
  `answered_at` DATETIME NOT NULL DEFAULT (now()),
  `feedback` TEXT COLLATE "utf8mb4_0900_ai_ci"
,
  PRIMARY KEY (`id`)
,
  CONSTRAINT `FK_question_responses_exam_attempts` FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts` (`id`)
,
  CONSTRAINT `FK_question_responses_questions` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`)

);

CREATE INDEX `FK_question_responses_exam_attempts` ON `question_responses` (`attempt_id`);
CREATE INDEX `FK_question_responses_questions` ON `question_responses` (`question_id`);

-- Table: questions
CREATE TABLE `questions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `body` TEXT COLLATE "utf8mb4_0900_ai_ci" NOT NULL COMMENT '問題文',
  `explanation` TEXT COLLATE "utf8mb4_0900_ai_ci" NOT NULL COMMENT '解説',
  `choices` JSON NOT NULL COMMENT '選択肢\r\n例: [{"choice_id": 1, "choice_text": "弾力性（Elasticity）"}, {"choice_id": 2, "choice_text": "機敏性（Agility）"}, {"choice_id": 3, "choice_text": "スケーラビリティ（Scalability）"}, {"choice_id": 4, "choice_text": "高可用性（High Availability）"}]',
  `correct_key` JSON NOT NULL COMMENT '答えの選択肢ID\r\n例: [2]',
  `exam_categories_id` INTEGER NOT NULL COMMENT '試験・カテゴリー',
  `created_at` DATETIME NOT NULL DEFAULT (now()),
  `updated_at` DATETIME,
  `deleted_at` DATETIME
,
  PRIMARY KEY (`id`)
,
  CONSTRAINT `FK_questions_exam_categories` FOREIGN KEY (`exam_categories_id`) REFERENCES `exam_categories` (`id`)

);

CREATE INDEX `FK_questions_exam_categories` ON `questions` (`exam_categories_id`);

-- Table: users
CREATE TABLE `users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `provider` ENUM NOT NULL DEFAULT 'google',
  `subject_id` VARCHAR(255) COLLATE "utf8mb4_0900_ai_ci" NOT NULL COMMENT 'ユニークな一意なID',
  `name` VARCHAR(255) COLLATE "utf8mb4_0900_ai_ci" NOT NULL COMMENT 'ユーザ名',
  `role` ENUM NOT NULL DEFAULT 'user',
  `deleted_at` DATETIME,
  `updated_at` DATETIME,
  `created_at` DATETIME NOT NULL DEFAULT (now()),
  `last_login_at` DATETIME
,
  PRIMARY KEY (`id`)

);

CREATE UNIQUE INDEX `subject_id` ON `users` (`subject_id`);
