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

const FAILURE_LINE = /^\s*(?:\d+\)|[✘×xX]\s+\d+|\[[^\]]+\]\s+›)/;
const PASS_LINE = /^\s*[✓✔]/;

export function sanitizeTeacherHubPlaywrightFailure(text) {
  const lines = String(text || '').split(/\r?\n/);
  const failed = new Set();

  for (const line of lines) {
    if (PASS_LINE.test(line)) continue;
    if (!FAILURE_LINE.test(line) && !/\bfailed\b/i.test(line)) continue;
    for (const item of FAILURE_CASES) {
      if (line.includes(item.title)) failed.add(item.id);
    }
  }

  return failed.size ? [...failed].sort().join('+') : 'unknown';
}

export const teacherHubPlaywrightDiagnosticContract = Object.freeze({
  version: 'teacher-hub-playwright-diagnostics-v1',
  allowedFailureIds: Object.freeze(FAILURE_CASES.map((item) => item.id)),
  rawLogPublished: false,
  privateSourcePublished: false,
});
