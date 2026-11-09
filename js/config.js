// ─── REVIEW CYCLE — bump these two lines to open a new cycle ─────
// Everything else (tenure display, PDF export, form defaults) reads from here.
const REVIEW_PERIOD      = '2025-2026';
const TENURE_CUTOFF_DATE = new Date(2026, 2, 31); // month is 0-indexed: 2 = March
const TENURE_CUTOFF_LABEL = formatCutoffLabel(TENURE_CUTOFF_DATE);

// ─── SEPTEMBER TENURE CUTOFF — used by the Sep-Oct annual review cycle above and by the
// Performance Incentive forms below, both of which fall in this window ──────────────────
const SEPT_CYCLE_TENURE_CUTOFF_DATE  = new Date(2026, 8, 30); // 30 Sep 2026
const SEPT_CYCLE_TENURE_CUTOFF_LABEL = formatCutoffLabel(SEPT_CYCLE_TENURE_CUTOFF_DATE);

// ─── SELECTABLE REVIEW CYCLES — add a new entry here to open a new cycle ──
// `value` is stored as review_period in Supabase, so keep it stable once reviews exist under it.
// Two genuinely distinct annual review cycles run under the 2025-2026 banner: the main
// April-March cycle, and a real September-October cycle for employees reviewed on that
// schedule. Performance Incentive (PI, see PI_REVIEW_PERIOD below) is a separate September
// bonus-linked re-rating for a fixed employee list — it is not either of these annual cycles
// and is not a selectable entry here; it has its own dedicated tab/table.
const REVIEW_CYCLES = [
    { value: REVIEW_PERIOD,                label: REVIEW_PERIOD + ' - Annual Review (April - March)',       tenureCutoffDate: TENURE_CUTOFF_DATE,           tenureCutoffLabel: TENURE_CUTOFF_LABEL },
    { value: REVIEW_PERIOD + ' (Sep-Oct)', label: REVIEW_PERIOD + ' - Annual Review (September - October)', tenureCutoffDate: SEPT_CYCLE_TENURE_CUTOFF_DATE, tenureCutoffLabel: SEPT_CYCLE_TENURE_CUTOFF_LABEL }
];

// ─── PERFORMANCE INCENTIVE (PI) CYCLE — separate September cycle, fixed eligibility list ──
// PI is not an annual review: it rates a genuinely different window (this cycle: April-Sep
// 2026) than the annual review's April-March window, using the same rating scale/formulas,
// for a fixed set of employees, declared fresh each cycle. Bump PI_REVIEW_PERIOD (the value
// actually stored as review_period — keep it stable once PI ratings exist under it) and
// PI_REVIEW_PERIOD_LABEL's date range together to open a new PI cycle; edit
// PI_ELIGIBLE_EMPLOYEE_IDS to update who's in scope for that cycle.
const PI_REVIEW_PERIOD = 'PI - September 2026';
const PI_REVIEW_PERIOD_LABEL = PI_REVIEW_PERIOD + ' (Apr–Sep 2026)';

const PI_ELIGIBLE_EMPLOYEE_IDS = [
    'E001', 'E002', 'E004'  // sample — replace with your own eligible employee IDs each cycle
];

// Notified by email on every PI self-assessment and manager-rating submission
// (confirmed with HR — set to '' to disable admin notifications entirely).
const PI_ADMIN_NOTIFY_EMAIL = ''; // set to your HR admin's email, or leave blank to disable

function isPIEligible(employeeId) {
    return PI_ELIGIBLE_EMPLOYEE_IDS.indexOf(employeeId) !== -1;
}

function getReviewCycle(value) {
    for (var i = 0; i < REVIEW_CYCLES.length; i++) {
        if (REVIEW_CYCLES[i].value === value) return REVIEW_CYCLES[i];
    }
    return REVIEW_CYCLES[0];
}

// The cycle immediately before the given one in REVIEW_CYCLES order, or null if it's the first.
function getPreviousReviewCycle(value) {
    var idx = -1;
    for (var i = 0; i < REVIEW_CYCLES.length; i++) {
        if (REVIEW_CYCLES[i].value === value) { idx = i; break; }
    }
    if (idx <= 0) return null;
    return REVIEW_CYCLES[idx - 1];
}

function formatCutoffLabel(d) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

// ─── SUPABASE — raw fetch (no SDK, sandbox-safe) ─────────────────
// Fill in your own Supabase project's URL + anon key below.
const SUPABASE_URL  = '';
const SUPABASE_ANON = '';
const REST = SUPABASE_URL + '/rest/v1';
const SB_HEADERS = {
    'apikey':        SUPABASE_ANON,
    'Authorization': 'Bearer ' + SUPABASE_ANON,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation'
};

// ─── Populate cycle-period fields/labels from config (DOM already parsed — this script tag sits at the end of body) ───
(function() {
    // Review-period fields are <select> elements populated from REVIEW_CYCLES,
    // defaulting to the current annual cycle. onReviewCycleChange (app.js) keeps
    // the tenure-cutoff labels and any displayed tenure in sync when switched.
    ['selfReviewPeriod', 'reviewPeriod'].forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        REVIEW_CYCLES.forEach(function(cycle) {
            var option = document.createElement('option');
            option.value = cycle.value;
            option.textContent = cycle.label;
            el.appendChild(option);
        });
        el.value = REVIEW_PERIOD;
    });
    ['selfTenureCutoffLabel', 'mgrTenureCutoffLabel'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = TENURE_CUTOFF_LABEL;
    });
    // PI review cycle is fixed (not user-selectable) — just display it, with the date
    // range so it's clear this is a different window than the annual review, not the
    // same period being rated twice.
    ['piSelfReviewPeriodDisplay', 'piReviewPeriodDisplay'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = PI_REVIEW_PERIOD_LABEL;
    });
})();

// ─── ADMIN AUTH (validated against Supabase admin_users table) ────
