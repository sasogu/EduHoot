const VALID_TYPES = new Set(['quiz', 'multiple', 'true-false']);

function normalizeQuestionType(rawType) {
  const value = (rawType || '').toString().toLowerCase().trim();
  if (!value) return 'quiz';
  if (value === 'multiple' || value.includes('multi')) return 'multiple';
  if (
    value === 'true-false' ||
    value === 'truefalse' ||
    value === 'tf' ||
    (value.includes('true') && value.includes('false')) ||
    (value.includes('verdadero') && value.includes('falso'))
  ) {
    return 'true-false';
  }
  return 'quiz';
}

function toValidAnswerIndex(value) {
  if (value === undefined || value === null) return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  if (parsed < 1) return 1;
  if (parsed > 4) return 4;
  return parsed;
}

function normalizeCorrectAnswers(rawCorrect, fallback = true) {
  const answers = [];
  const seen = new Set();
  const add = (candidate) => {
    const idx = toValidAnswerIndex(candidate);
    if (!idx || seen.has(idx)) return;
    seen.add(idx);
    answers.push(idx);
  };

  if (Array.isArray(rawCorrect)) {
    rawCorrect.forEach(add);
  } else if (typeof rawCorrect === 'string') {
    rawCorrect.split(',').forEach((part) => add(part.trim()));
  } else if (typeof rawCorrect === 'number') {
    add(rawCorrect);
  }

  if (!answers.length && fallback) {
    answers.push(1);
  }

  return answers;
}

function normalizeQuestionMeta(item = {}) {
  const type = normalizeQuestionType(item.type || item.tipo);
  const correctCandidates = item.correctAnswers || item.correcta || item.correct;
  let correctAnswers = normalizeCorrectAnswers(correctCandidates);
  if (type === 'true-false') {
    // En verdadero/falso solo hay 2 opciones visibles.
    const seen = new Set();
    const clamped = [];
    correctAnswers.forEach((value) => {
      let v = parseInt(value, 10);
      if (Number.isNaN(v)) return;
      if (v < 1) v = 1;
      if (v > 2) v = 2;
      if (seen.has(v)) return;
      seen.add(v);
      clamped.push(v);
    });
    correctAnswers = clamped.length ? clamped : [1];
  }
  return {
    type,
    correctAnswers,
    correct: correctAnswers[0] || 1
  };
}

module.exports = {
  normalizeQuestionType,
  normalizeCorrectAnswers,
  normalizeQuestionMeta,
  VALID_TYPES
};
