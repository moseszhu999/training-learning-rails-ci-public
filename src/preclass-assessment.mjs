const DEFAULT_EXERCISES_PER_UNIT = 3;
const MIN_UNITS_PER_DAY = 4;
const MAX_UNITS_PER_DAY = 10;

function text(value) {
  return String(value ?? '').trim();
}

function task({
  key,
  category,
  title,
  detail,
  severity = 'medium',
  actionKind = 'navigate',
  targetModule = 'overview',
  requiresConfirmation = false,
  evidence = {},
}) {
  return {
    key,
    category,
    title,
    detail,
    severity,
    actionKind,
    targetModule,
    requiresConfirmation,
    evidence,
  };
}

function check(id, label, status, detail, evidence = {}) {
  return { id, label, status, detail, evidence };
}

function activeQuestionCounts(questions = []) {
  const counts = new Map();
  for (const question of questions) {
    if (!question?.section_id) continue;
    if (!['approved', 'published'].includes(text(question.review_state))) continue;
    if (text(question.exercise_scope) !== 'immediate') continue;
    counts.set(question.section_id, (counts.get(question.section_id) ?? 0) + 1);
  }
  return counts;
}

export function buildPreclassAssessment({
  classroom,
  teacher,
  day,
  sections = [],
  questions = [],
  materials = [],
  confirmation = null,
  now = new Date(),
  targetTeachingDate = null,
} = {}) {
  const checks = [];
  const tasks = [];
  const className = text(classroom?.class_name) || 'Current class';
  const teacherName = text(teacher?.display_name) || 'Current teacher';
  const teachingDate = text(day?.teaching_date);
  const questionCounts = activeQuestionCounts(questions);

  if (!day) {
    checks.push(check('schedule', 'Schedule', 'blocked', 'No executable teaching day was found.'));
    tasks.push(task({
      key: 'schedule-missing',
      category: 'schedule',
      title: 'Create a teaching day',
      detail: 'The class has no teaching-day record available for readiness checks.',
      severity: 'high',
      targetModule: 'schedule',
      requiresConfirmation: true,
    }));
  } else if (!day.is_published) {
    checks.push(check('schedule', 'Schedule', 'attention', `${teachingDate} is not published.`, { teachingDayId: day.id }));
    tasks.push(task({
      key: 'schedule-publish',
      category: 'schedule',
      title: 'Confirm and publish the schedule',
      detail: `${teachingDate} exists but is_published=false.`,
      severity: 'high',
      targetModule: 'schedule',
      requiresConfirmation: true,
      evidence: { teachingDayId: day.id, isPublished: false },
    }));
  } else {
    checks.push(check('schedule', 'Schedule', 'ready', `${teachingDate} is published.`, {
      teachingDayId: day.id,
      isPublished: true,
    }));
  }

  if (!day) {
    checks.push(check('units', 'Units', 'unknown', 'A teaching day is required before units can be checked.'));
  } else if (!sections.length) {
    checks.push(check('units', 'Units', 'blocked', 'The teaching day has no units.'));
    tasks.push(task({
      key: 'units-missing',
      category: 'unit',
      title: 'Create units',
      detail: `${teachingDate} has no unit records.`,
      severity: 'high',
      targetModule: 'units',
      requiresConfirmation: true,
      evidence: { teachingDayId: day.id },
    }));
  } else {
    const incomplete = sections.filter(
      (section) => !text(section.title) || !text(section.learning_objective) || !text(section.time_range),
    );
    const countOutsidePolicy = sections.length < MIN_UNITS_PER_DAY || sections.length > MAX_UNITS_PER_DAY;
    const issues = [];
    if (countOutsidePolicy) {
      issues.push(`Unit count ${sections.length} is outside ${MIN_UNITS_PER_DAY}-${MAX_UNITS_PER_DAY}`);
    }
    if (incomplete.length) issues.push(`${incomplete.length} units have incomplete fields`);

    checks.push(check(
      'units',
      'Units',
      issues.length ? 'attention' : 'ready',
      issues.length ? issues.join('; ') : `${sections.length} units are complete.`,
      { sectionCount: sections.length, incompleteSectionIds: incomplete.map((item) => item.id) },
    ));

    if (countOutsidePolicy) {
      tasks.push(task({
        key: 'unit-count-policy',
        category: 'unit',
        title: 'Review unit count',
        detail: `Current unit count is ${sections.length}.`,
        targetModule: 'units',
        requiresConfirmation: true,
        evidence: { sectionCount: sections.length },
      }));
    }

    for (const section of incomplete) {
      tasks.push(task({
        key: `unit-fields:${section.id}`,
        category: 'unit',
        title: `Complete unit: ${text(section.title) || 'Untitled unit'}`,
        detail: 'Title, learning objective, and time range are required.',
        targetModule: 'units',
        requiresConfirmation: true,
        evidence: { sectionId: section.id },
      }));
    }
  }

  const readyMaterials = materials.filter((item) => text(item.storage_state) === 'storage_ready');
  if (!materials.length) {
    checks.push(check('materials', 'Materials', 'blocked', 'No material catalog records were found.'));
    tasks.push(task({
      key: 'materials-missing',
      category: 'material',
      title: 'Add materials',
      detail: 'The class has no material catalog records.',
      severity: 'high',
      targetModule: 'units',
      requiresConfirmation: true,
    }));
  } else if (!readyMaterials.length) {
    checks.push(check('materials', 'Materials', 'attention', 'Materials exist but none are ready for use.', {
      materialCount: materials.length,
      storageReadyCount: 0,
    }));
    tasks.push(task({
      key: 'materials-storage',
      category: 'material',
      title: 'Prepare material files',
      detail: 'Catalog records exist but no material is storage_ready.',
      targetModule: 'units',
      evidence: { materialCount: materials.length, storageReadyCount: 0 },
    }));
  } else {
    checks.push(check('materials', 'Materials', 'ready', `${readyMaterials.length}/${materials.length} materials are ready.`, {
      materialCount: materials.length,
      storageReadyCount: readyMaterials.length,
    }));
  }

  if (!sections.length) {
    checks.push(check('exercises', 'Exercises', 'unknown', 'Units are required before exercises can be checked.'));
  } else {
    let missingTotal = 0;
    const gaps = [];
    for (const section of sections) {
      const existing = questionCounts.get(section.id) ?? 0;
      const missing = Math.max(0, DEFAULT_EXERCISES_PER_UNIT - existing);
      if (!missing) continue;
      missingTotal += missing;
      gaps.push({ sectionId: section.id, title: text(section.title) || 'Untitled unit', existing, missing });
      tasks.push(task({
        key: `exercise-gap:${section.id}`,
        category: 'exercise',
        title: `Add ${missing} exercises`,
        detail: `${existing} approved or published immediate exercises exist; target is ${DEFAULT_EXERCISES_PER_UNIT}.`,
        targetModule: 'exercises',
        requiresConfirmation: true,
        evidence: { sectionId: section.id, existing, target: DEFAULT_EXERCISES_PER_UNIT, missing },
      }));
    }
    checks.push(check(
      'exercises',
      'Exercises',
      missingTotal ? 'attention' : 'ready',
      missingTotal ? `${gaps.length} units are missing ${missingTotal} exercises.` : 'Exercise coverage meets policy.',
      { missingTotal, gaps },
    ));
  }

  if (!day) {
    checks.push(check('teacher', 'Teacher confirmation', 'unknown', 'A teaching day is required.'));
  } else {
    const confirmationValid = Boolean(confirmation?.confirmed_at) && confirmation?.valid === true;
    if (!confirmationValid) {
      const stale = Boolean(confirmation?.confirmed_at) && confirmation?.valid !== true;
      checks.push(check(
        'teacher',
        'Teacher confirmation',
        'attention',
        stale ? 'The previous confirmation is stale.' : `${teacherName} has not confirmed readiness.`,
        { teachingDayId: day.id, stale },
      ));
      tasks.push(task({
        key: 'teacher-preparation-confirmation',
        category: 'teacher',
        title: 'Submit teacher confirmation',
        detail: 'This is a human confirmation and cannot be completed by the agent.',
        actionKind: 'confirm_teacher_preparation',
        targetModule: 'agent-workbench',
        requiresConfirmation: true,
        evidence: { teachingDayId: day.id, stale },
      }));
    } else {
      checks.push(check('teacher', 'Teacher confirmation', 'ready', `${teacherName} confirmed readiness.`, {
        confirmedAt: confirmation.confirmed_at,
      }));
    }
  }

  const readyCount = checks.filter((item) => item.status === 'ready').length;
  const blockedCount = checks.filter((item) => item.status === 'blocked').length;
  const status = blockedCount ? 'blocked' : tasks.length ? 'at_risk' : 'ready';

  return {
    service: 'preclass-readiness',
    classId: classroom?.id ?? null,
    className,
    teacherId: teacher?.id ?? null,
    teacherName,
    teachingDayId: day?.id ?? null,
    teachingDate: teachingDate || null,
    targetTeachingDate: targetTeachingDate || null,
    generatedAt: now.toISOString(),
    status,
    policy: {
      minimumUnitsPerDay: MIN_UNITS_PER_DAY,
      maximumUnitsPerDay: MAX_UNITS_PER_DAY,
      approvedExercisesPerUnit: DEFAULT_EXERCISES_PER_UNIT,
    },
    metrics: {
      readyChecks: readyCount,
      totalChecks: checks.length,
      openTasks: tasks.length,
      blockedChecks: blockedCount,
      unitCount: sections.length,
      materialCount: materials.length,
      storageReadyMaterials: readyMaterials.length,
    },
    checks,
    tasks,
  };
}
