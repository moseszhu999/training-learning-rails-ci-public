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

const ANSI_ESCAPE = /(?:\u001B\[[0-?]*[ -/]*[@-~]|\u009B[0-?]*[ -/]*[@-~])/g;
const FAILURE_LINE = /^\s*(?:\d+\)|(?:✘|×|✗|⨯|x|X)\s*(?:\d+)?(?:\s|\[)|\[[^\]]+\]\s+›)/;
const PASS_LINE = /^\s*(?:✓|✔|√)/;

function normalizeReporterLine(line) {
  return String(line || '').replace(ANSI_ESCAPE, '');
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

  return failed.size ? [...failed].sort().join('+') : 'unknown';
}

export const teacherHubPlaywrightDiagnosticContract = Object.freeze({
  version: 'teacher-hub-playwright-diagnostics-v2-ansi-safe',
  allowedFailureIds: Object.freeze(FAILURE_CASES.map((item) => item.id)),
  ansiControlCodesPublished: false,
  rawLogPublished: false,
  privateSourcePublished: false,
});
