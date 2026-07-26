import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreclassAssessment } from '../../src/preclass-assessment.mjs';

const fixedNow = new Date('2026-01-15T08:00:00.000Z');

function completeSections(count = 4) {
  return Array.from({ length: count }, (_, index) => ({
    id: `section-synthetic-${index + 1}`,
    title: `Unit ${index + 1}`,
    learning_objective: `Synthetic objective ${index + 1}`,
    time_range: `${9 + index}:00-${10 + index}:00`,
  }));
}

function coveredQuestions(sections) {
  return sections.flatMap((section) =>
    Array.from({ length: 3 }, (_, index) => ({
      id: `question-${section.id}-${index + 1}`,
      section_id: section.id,
      review_state: index === 2 ? 'published' : 'approved',
      exercise_scope: 'immediate',
    })),
  );
}

test('returns ready for a fully prepared synthetic teaching day', () => {
  const sections = completeSections();
  const result = buildPreclassAssessment({
    classroom: { id: 'class-synthetic-001', class_name: 'Synthetic Class' },
    teacher: { id: 'teacher-synthetic-001', display_name: 'Synthetic Teacher' },
    day: { id: 'day-synthetic-001', teaching_date: '2026-01-16', is_published: true },
    sections,
    questions: coveredQuestions(sections),
    materials: [{ id: 'material-synthetic-001', storage_state: 'storage_ready' }],
    confirmation: { confirmed_at: '2026-01-15T07:30:00.000Z', valid: true },
    now: fixedNow,
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.metrics.blockedChecks, 0);
  assert.equal(result.metrics.openTasks, 0);
  assert.equal(result.metrics.readyChecks, result.metrics.totalChecks);
  assert.equal(result.classId, 'class-synthetic-001');
});

test('returns blocked when schedule and materials are missing', () => {
  const result = buildPreclassAssessment({ now: fixedNow });

  assert.equal(result.status, 'blocked');
  assert.equal(result.metrics.blockedChecks, 2);
  assert.ok(result.tasks.some((item) => item.key === 'schedule-missing'));
  assert.ok(result.tasks.some((item) => item.key === 'materials-missing'));
});

test('returns at_risk for incomplete units, exercise gaps, and stale confirmation', () => {
  const result = buildPreclassAssessment({
    classroom: { id: 'class-synthetic-002', class_name: 'Synthetic Class B' },
    teacher: { id: 'teacher-synthetic-002', display_name: 'Synthetic Teacher B' },
    day: { id: 'day-synthetic-002', teaching_date: '2026-01-17', is_published: true },
    sections: [
      {
        id: 'section-synthetic-incomplete',
        title: 'Incomplete Unit',
        learning_objective: '',
        time_range: '09:00-10:00',
      },
    ],
    questions: [],
    materials: [{ id: 'material-synthetic-002', storage_state: 'storage_ready' }],
    confirmation: { confirmed_at: '2026-01-15T07:30:00.000Z', valid: false },
    now: fixedNow,
  });

  assert.equal(result.status, 'at_risk');
  assert.ok(result.tasks.some((item) => item.key === 'unit-count-policy'));
  assert.ok(result.tasks.some((item) => item.key.startsWith('unit-fields:')));
  assert.ok(result.tasks.some((item) => item.key.startsWith('exercise-gap:')));
  assert.ok(result.tasks.some((item) => item.key === 'teacher-preparation-confirmation'));
});

test('counts only approved or published immediate exercises', () => {
  const sections = completeSections();
  const questions = coveredQuestions(sections);
  questions.push(
    {
      id: 'question-draft-noise',
      section_id: sections[0].id,
      review_state: 'draft',
      exercise_scope: 'immediate',
    },
    {
      id: 'question-deferred-noise',
      section_id: sections[0].id,
      review_state: 'approved',
      exercise_scope: 'deferred',
    },
  );

  const result = buildPreclassAssessment({
    day: { id: 'day-synthetic-003', teaching_date: '2026-01-18', is_published: true },
    sections,
    questions,
    materials: [{ id: 'material-synthetic-003', storage_state: 'storage_ready' }],
    confirmation: { confirmed_at: '2026-01-15T07:30:00.000Z', valid: true },
    now: fixedNow,
  });

  const exerciseCheck = result.checks.find((item) => item.id === 'exercises');
  assert.equal(exerciseCheck.status, 'ready');
  assert.equal(exerciseCheck.evidence.missingTotal, 0);
});

test('does not invent identifiers when optional actors are absent', () => {
  const result = buildPreclassAssessment({ now: fixedNow });

  assert.equal(result.classId, null);
  assert.equal(result.teacherId, null);
  assert.equal(result.teachingDayId, null);
  assert.equal(result.generatedAt, fixedNow.toISOString());
});
