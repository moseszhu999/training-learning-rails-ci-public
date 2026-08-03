const FAILURE_CASES = Object.freeze([
  {
    id: 'canonical-owner-context',
    title: 'renders canonical owner context, exact links and inference boundaries',
  },
  {
    id: 'fail-closed-states',
    title: 'keeps loading, empty, error, offline and unavailable states fail-closed',
  },
  {
    id: 'stale-provenance',
    title: 'shows stale provenance without treating old data as safe or complete',
  },
  {
    id: 'class-change-reset',
    title: 'resets selected occurrence and disclosure state when the authorized class changes',
  },
  {
    id: 'queue-destinations',
    title: 'keeps Teacher Queue items bound to canonical destination parameters',
  },
  {
    id: 'visual-desktop-1440',
    title: 'visual acceptance desktop-1440',
  },
  {
    id: 'visual-tablet-1024',
    title: 'visual acceptance tablet-1024',
  },
  {
    id: 'visual-tablet-768',
    title: 'visual acceptance tablet-768',
  },
]);

const CLASS_CHANGE_STEP_BY_LINE = Object.freeze({
  74: 'select-occurrence-click',
  75: 'selected-detail-visible',
  76: 'expand-boundary-click',
  77: 'expanded-boundary-visible',
  79: 'switch-authorized-class',
  81: 'switched-header-visible',
  82: 'switched-detail-visible',
  83: 'boundary-reset-visible',
  84: 'old-occurrence-removed',
});

const ANSI_ESCAPE = /(?:\u001B\[[0-?]*[ -/]*[@-~]|\u009B[0-?]*[ -/]*[@-~])/g;
const FAILURE_LINE = /^\s*(?:\d+\)|(?:✘|×|✗|⨯|x|X)\s*(?:\d+)?(?:\s|\[)|\[[^\]]+\]\s+›)/;
const PASS_LINE = /^\s*(?:✓|✔|√)/;

function normalizeReporterLine(line) {
  return String(line || '').replace(ANSI_ESCAPE, '');
}

function normalizeReporterText(text) {
  return String(text || '').replace(ANSI_ESCAPE, '');
}

function classChangeStepId(text) {
  const normalized = normalizeReporterText(text);
  const codeFrameLines = [...normalized.matchAll(/^\s*>\s*(\d+)\s*\|/gm)]
    .map((match) => Number(match[1]));
  for (const lineNumber of codeFrameLines) {
    const step = CLASS_CHANGE_STEP_BY_LINE[lineNumber];
    if (step) return step;
  }

  const stackLines = [...normalized.matchAll(/teacher-operations-hub-fixture\.spec\.ts:(\d+):\d+/g)]
    .map((match) => Number(match[1]));
  for (const lineNumber of stackLines) {
    const step = CLASS_CHANGE_STEP_BY_LINE[lineNumber];
    if (step) return step;
  }
  return null;
}

export function sanitizeTeacherHubPlaywrightFailure(text) {
  const lines = String(text || '').split(/\r?\n/);
  const failed = new Set();

  for (const rawLine of lines) {
    const line = normalizeReporterLine(rawLine);
    if (PASS_LINE.test(line)) continue;
    if (!FAILURE_LINE.test(line) && !/\bfailed\b/i.test(line)) continue;
    for (const item of FAILURE_CASES) {
      if (line.includes(item.title)) failed.add(item.id);
    }
  }

  if (failed.has('class-change-reset')) {
    const step = classChangeStepId(text);
    if (step) {
      failed.delete('class-change-reset');
      failed.add(`class-change-reset--${step}`);
    }
  }

  return failed.size ? [...failed].sort().join('+') : 'unknown';
}

const detailedClassChangeIds = Object.values(CLASS_CHANGE_STEP_BY_LINE)
  .map((step) => `class-change-reset--${step}`);

export const teacherHubPlaywrightDiagnosticContract = Object.freeze({
  version: 'teacher-hub-playwright-diagnostics-v3-class-step-safe',
  allowedFailureIds: Object.freeze([
    ...FAILURE_CASES.map((item) => item.id),
    ...detailedClassChangeIds,
  ]),
  classChangeStepLinesPublished: false,
  ansiControlCodesPublished: false,
  rawLogPublished: false,
  privateSourcePublished: false,
});
