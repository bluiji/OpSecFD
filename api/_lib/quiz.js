// Pure quiz grading (no dependencies besides HttpError), used by /api/quiz/submit.
import { HttpError } from './errors.js';

export const PASS_MARK = 60; // percent needed to mark a lesson complete

/** Questions and options only: what the browser may see before answering. */
export function publicQuiz(quiz) {
  return (Array.isArray(quiz) ? quiz : []).map((q) => ({ question: q.question, options: q.options }));
}

/** Checks the submitted answers have the right shape for this quiz. */
export function validateAnswers(quiz, answers) {
  if (!Array.isArray(answers)) throw new HttpError(400, 'answers must be an array');
  if (answers.length !== quiz.length) throw new HttpError(400, `answers must contain ${quiz.length} entries`);
  answers.forEach((a, i) => {
    if (!Number.isInteger(a) || a < 0 || a >= (quiz[i].options?.length ?? 0)) {
      throw new HttpError(400, `Answer ${i + 1} must be a valid option index`);
    }
  });
  return answers;
}

/**
 * Grades answers against the stored quiz. Correct answers and explanations
 * are returned only here, after the user has submitted.
 */
export function gradeQuiz(quiz, answers) {
  if (!Array.isArray(quiz) || !quiz.length) throw new HttpError(400, 'This lesson has no quiz');
  validateAnswers(quiz, answers);
  const results = quiz.map((q, i) => ({
    correct: answers[i] === q.answer,
    answer: q.answer,
    explanation: q.explanation || ''
  }));
  const correct = results.filter((r) => r.correct).length;
  const score = Math.round((correct / quiz.length) * 100);
  return { correct, total: quiz.length, score, passed: score >= PASS_MARK, pass_mark: PASS_MARK, results };
}

/** Combines a new attempt with the stored progress row: keeps the best score, never un-completes. */
export function mergeProgress(prev, graded) {
  return {
    completed: graded.passed || !!prev?.completed,
    best: Math.max(graded.score, Number.isInteger(prev?.quiz_score) ? prev.quiz_score : 0)
  };
}
