// ─── EMAILJS CONFIG ───────────────────────────────────────────────
// EmailJS account credentials removed from this
// backup copy — set up your own EmailJS account/templates before using
// the email-notification features.
var EMAILJS_PUBLIC_KEY = '';
var EMAILJS_SERVICE_ID = '';
var EMAILJS_TEMPLATE_SELF = '';
var EMAILJS_TEMPLATE_MANAGER = '';

// Initialize EmailJS
(function() {
    if (window.emailjs && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }
})();

// ─── MOTION ACCESSIBILITY ─────────────────────────────────────────
// Checked before every GSAP tween below so users with the OS/browser
// "reduce motion" setting on get the exact same end state instantly
// instead of an animated reveal — no data or layout difference either way.
function prefersReducedMotion() {
    return typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ─── SSO GATE — MOCK STAT CARD ────────────────────────────────────
// Purely decorative and purely client-side: this renders before login, so
// it must never query real data (that would leak org-wide numbers to an
// unauthenticated visitor). Cycles through fixed illustrative values only;
// labeled "Sample figures — not live data" in the UI so it's never mistaken
// for a real feed. Frozen on the first frame under prefers-reduced-motion.
var SSO_STAT_FRAMES = [
    { num: '132', label: 'total reviews', bars: [40, 70, 55, 90, 60, 100] },
    { num: '4.1', label: 'average score', bars: [60, 65, 70, 75, 80, 82] },
    { num: '25', label: 'promotion-ready', bars: [20, 30, 35, 45, 55, 65] }
];
function initSSOStatCard() {
    var card = document.getElementById('ssoStatCard');
    if (!card || prefersReducedMotion()) return;
    var numEl = document.getElementById('ssoStatNum');
    var labelEl = document.getElementById('ssoStatLabel');
    var bars = document.querySelectorAll('#ssoStatBars i');
    var dots = document.querySelectorAll('#ssoStatDots span');
    var i = 0;
    setInterval(function() {
        i = (i + 1) % SSO_STAT_FRAMES.length;
        numEl.style.opacity = 0;
        labelEl.style.opacity = 0;
        setTimeout(function() {
            var f = SSO_STAT_FRAMES[i];
            numEl.textContent = f.num;
            labelEl.textContent = f.label;
            f.bars.forEach(function(h, idx) { bars[idx].style.height = h + '%'; });
            dots.forEach(function(d, idx) { d.classList.toggle('on', idx === i); });
            numEl.style.opacity = 1;
            labelEl.style.opacity = 1;
        }, 300);
    }, 2600);
}
initSSOStatCard();

// ─── SUPABASE DATABASE FUNCTIONS ─────────────────────────────────
async function sbSelect(params) {
    var url = REST + '/performance_reviews?' + params + '&order=submitted_at.desc';
    var lastErr;
    for (var attempt = 0; attempt < 3; attempt++) {
        try {
            var res = await fetch(url, { headers: SB_HEADERS });
            if (!res.ok) {
                var errBody = {};
                try { errBody = await res.json(); } catch(_) {}
                throw new Error('Supabase error ' + res.status + ': ' + (errBody.message || res.statusText));
            }
            return res.json();
        } catch(err) {
            lastErr = err;
            if (err.message && err.message.indexOf('Supabase error') === 0) throw err;
            if (attempt < 2) await new Promise(function(r){ setTimeout(r, 1000 * (attempt + 1)); });
        }
    }
    throw new Error('Network error — unable to reach Supabase. Please check your internet connection or try refreshing the page. (' + (lastErr && lastErr.message || 'Load failed') + ')');
}
async function sbInsert(body) {
    const res = await fetch(REST + '/performance_reviews', {
        method: 'POST', headers: SB_HEADERS, body: JSON.stringify(body)
    });
    if (!res.ok) throw await res.json();
    return res.json();
}
async function sbUpdate(id, body) {
    const res = await fetch(REST + '/performance_reviews?id=eq.' + id, {
        method: 'PATCH',
        headers: Object.assign({}, SB_HEADERS, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify(body)
    });
    if (!res.ok) throw await res.json();
}
async function sbUpdateIn(table, id, body) {
    const res = await fetch(REST + '/' + table + '?id=eq.' + id, {
        method: 'PATCH',
        headers: Object.assign({}, SB_HEADERS, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify(body)
    });
    if (!res.ok) throw await res.json();
}
async function sbDelete(id) {
    const res = await fetch(REST + '/performance_reviews?id=eq.' + id, {
        method: 'DELETE', headers: SB_HEADERS
    });
    if (!res.ok) throw await res.json();
}

// Generic table helpers (used for skiplevel_notes — a table separate from
// performance_reviews, so the hardcoded helpers above don't apply).
async function sbSelectFrom(table, params) {
    var res = await fetch(REST + '/' + table + '?' + params, { headers: SB_HEADERS });
    if (!res.ok) {
        var errBody = {};
        try { errBody = await res.json(); } catch(_) {}
        throw new Error('Supabase error ' + res.status + ': ' + (errBody.message || res.statusText));
    }
    return res.json();
}
async function sbInsertInto(table, body) {
    var res = await fetch(REST + '/' + table, {
        method: 'POST', headers: SB_HEADERS, body: JSON.stringify(body)
    });
    if (!res.ok) throw await res.json();
    return res.json();
}
async function sbDeleteFrom(table, id) {
    var res = await fetch(REST + '/' + table + '?id=eq.' + id, {
        method: 'DELETE', headers: SB_HEADERS
    });
    if (!res.ok) throw await res.json();
}

// Escapes text being interpolated into an HTML attribute or text node
// (title="...", a textarea's initial content) — not a full sanitizer, just
// enough to keep a note containing &, ", <, or > from breaking the markup.
function escapeForAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── TOAST (replaces alert — works in sandboxed iframes) ─────────
function toast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(function() {
        t.style.opacity = '0';
        t.style.transform = 'translateY(10px)';
        setTimeout(function() { t.remove(); }, 300);
    }, 3500);
}

// ─── NORMALISE Supabase row → camelCase shape used by UI ─────────
function normalizeRating(row) {
    return {
        id:                      row.id,
        timestamp:               row.submitted_at,
        ratingDate:              row.rating_date,
        employeeId:              row.employee_id || '',
        employeeName:            row.employee_name,
        position:                row.position,
        department:              row.department || '',
        reviewPeriod:            row.review_period,
        reviewerName:            row.reviewer_name,
        ratings:                 row.ratings || {},
        overallScore:            parseFloat(row.overall_score) || 0,
        overallRating:           row.overall_rating,
        promotionRecommendation: row.promotion_recommendation || '',
        potential:               row.potential || '',
        justification:           row.justification || '',
        keeperTest:              row.keeper_test || null,
        managementDecision:      row.management_decision || { finalDecision:'', approvedBy:'', effectiveDate:'', managementNotes:'' },
        isSelfAssessment:        row.is_self_assessment || false,
        submittedByEmail:        row.submitted_by_email || '',
        submittedByName:         row.submitted_by_name || '',
        editHistory:             row.edit_history || [],
        lastEditedAt:            row.last_edited_at || null,
        lastEditedBy:            row.last_edited_by || null
    };
}

// Same shape as normalizeRating(), for the pi_reviews table — which has no
// department/promotion_recommendation/potential/management_decision columns,
// so those come back as safely-empty defaults (generatePDFBlob and the email
// builders already treat them as optional).
function normalizePIRating(row) {
    return {
        id:                      row.id,
        timestamp:               row.submitted_at,
        ratingDate:              (row.submitted_at || '').slice(0, 10),
        employeeId:              row.employee_id || '',
        employeeName:            row.employee_name,
        position:                row.position || '',
        department:              '',
        reviewPeriod:            row.review_period,
        reviewerName:            row.reviewer_name,
        ratings:                 row.ratings || {},
        overallScore:            parseFloat(row.overall_score) || 0,
        overallRating:           '',
        promotionRecommendation: '',
        potential:               '',
        justification:           row.justification || '',
        keeperTest:              row.keeper_test || null,
        managementDecision:      { finalDecision:'', approvedBy:'', effectiveDate:'', managementNotes:'' },
        isSelfAssessment:        row.is_self_assessment || false,
        submittedByEmail:        row.submitted_by_email || '',
        submittedByName:         row.submitted_by_name || ''
    };
}

// ─── STATE ───────────────────────────────────────────────────────
var ratings              = {};
var currentTab           = 'methodology';
var isAdminLoggedIn      = false;
var currentEditingRatingId = null;
var ratingsCache         = [];
// Sentinel value for the admin Cycle dropdown's PI option — lets the one
// dropdown switch the same "All Employee Ratings" card between the annual
// list and the PI report, instead of keeping PI in its own separate card.
var PI_CYCLE_FILTER_VALUE = '__PI_CYCLE__';
var selfRatings          = {};
var mgrAiSubs            = { adoption: null, fluency: null, impact: null };
var selfAiSubs           = { adoption: null, fluency: null, impact: null };
var selfAccSubs          = { accountability: null, efficiency: null, competency: null };
var mgrAccSubs           = { accountability: null, efficiency: null, competency: null };
var selfOkrPercent       = null;
var mgrOkrPercent         = null;
var selectedSelfEmployee = null; // Selected employee in self-assessment
var selectedManager      = null; // Selected manager
var selectedMgrEmployee  = null; // Selected employee in manager rating
var autocompleteIndex    = -1;   // Keyboard navigation index

// ─── PI (Performance Incentive) STATE — fully separate from the annual-review
// state above so an employee/manager can have both an annual review and a PI
// review open or pending at once without the two forms colliding. ──────────
var piSelfRatings          = {};
var piSelfAiSubs           = { adoption: null, fluency: null, impact: null };
var piSelfAccSubs          = { accountability: null, efficiency: null, competency: null };
var piSelfOkrPercent       = null;
var piSelectedSelfEmployee = null;

var piMgrRatings         = {};
var piMgrAiSubs          = { adoption: null, fluency: null, impact: null };
var piMgrAccSubs         = { accountability: null, efficiency: null, competency: null };
var piMgrOkrPercent      = null;
var piSelectedManager     = null;
var piSelectedMgrEmployee = null;
var piKeeperTestState = { kt_retention_score: null, comments: { kt_keeper_comment: '' } };

// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    // Close dropdowns on outside click
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.autocomplete-wrapper')) {
            closeAllDropdowns();
        }
    });

    // Every modal can be closed the same three ways: its × button (already
    // wired per-modal), Escape, or clicking the dimmed backdrop outside the
    // modal-content box. Escape/backdrop were previously only wired for
    // the × button, forcing a mouse trip to the corner every time.
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        var openModal = document.querySelector('.modal.active');
        if (openModal && MODAL_CLOSERS[openModal.id]) MODAL_CLOSERS[openModal.id]();
    });
    document.addEventListener('click', function(e) {
        // Only the backdrop itself (the .modal element), not anything inside modal-content
        if (e.target.classList && e.target.classList.contains('modal') && e.target.classList.contains('active') && MODAL_CLOSERS[e.target.id]) {
            MODAL_CLOSERS[e.target.id]();
        }
    });
});

// Maps each modal's id to its existing close function, so Escape/backdrop-click
// can close whichever one is open without guessing which function to call.
var MODAL_CLOSERS = {
    comparisonModal: function() { closeComparisonModal(); },
    employeeProfileModal: function() { closeEmployeeProfileModal(); },
    editModal: function() { closeEditModal(); },
    viewDetailsModal: function() { closeViewDetailsModal(); },
    editRatingsModal: function() { closeEditRatingsModal(); },
    skipLevelNoteModal: function() { closeSkipLevelNoteModal(); },
    boxCellModal: function() { closeBoxCellModal(); }
};

// ─── TAB NAVIGATION ───────────────────────────────────────────────
function showTab(tabName, evt) {
    document.querySelectorAll('.tab-content').forEach(function(tab) {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.nav-menu button').forEach(function(btn) {
        btn.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    if (evt && evt.target) evt.target.classList.add('active');
    currentTab = tabName;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tabName === 'dashboard' && isAdminLoggedIn) loadAdminData();
}

// ─── ROLE SELECTION & NAVIGATION ──────────────────────────────────

// Resolve the logged-in employee — tries employeeId first, falls back to email match
function resolveCurrentEmployee() {
    if (!currentSSOUser) return null;
    if (currentSSOUser.employeeId) {
        var emp = findEmployeeById(currentSSOUser.employeeId);
        if (emp) return emp;
    }
    // Fallback: retry email match (handles cached sessions where employeeId wasn't set)
    if (currentSSOUser.email) {
        var matched = findEmployeeByEmail(currentSSOUser.email);
        if (matched) {
            currentSSOUser.employeeId = matched.id;
            currentSSOUser.employeeName = matched.name;
            return matched;
        }
    }
    return null;
}

function selectRole(role) {
    if (role === 'self') {
        document.getElementById('navSelfAssessment').style.display = 'inline-block';
        document.getElementById('navManagerRating').style.display = 'none';
        document.getElementById('navManagerGuidelines').style.display = 'none';
        setTodayDate('selfRatingDate');
        showTab('self-assessment', null);

        // Auto-fill from SSO — self-assessment is locked to the logged-in user
        var selfEmp = resolveCurrentEmployee();
        if (selfEmp) {
            selectSelfEmployee(selfEmp);
            // Disable search entirely — users can only rate themselves
            var searchInput = document.getElementById('selfEmployeeSearch');
            if (searchInput) { searchInput.disabled = true; searchInput.style.cursor = 'not-allowed'; searchInput.style.opacity = '0.6'; }
            var searchBtn = document.querySelector('#self-assessment .autocomplete-wrapper .btn-secondary');
            if (searchBtn) { searchBtn.disabled = true; searchBtn.style.cursor = 'not-allowed'; searchBtn.style.opacity = '0.6'; }
            var clearBtn = document.querySelector('#selfEmployeeDetails button[onclick="clearEmployeeSelection(\'self\')"]');
            if (clearBtn) { clearBtn.style.display = 'none'; }
        } else {
            // No matching employee found — show warning, disable the form
            toast('Your email (' + (currentSSOUser ? currentSSOUser.email : 'unknown') + ') is not found in the employee directory. You cannot submit a self-assessment.', 'error');
            var searchInput = document.getElementById('selfEmployeeSearch');
            if (searchInput) { searchInput.disabled = true; searchInput.style.cursor = 'not-allowed'; searchInput.style.opacity = '0.6'; }
            var searchBtn = document.querySelector('#self-assessment .autocomplete-wrapper .btn-secondary');
            if (searchBtn) { searchBtn.disabled = true; searchBtn.style.cursor = 'not-allowed'; searchBtn.style.opacity = '0.6'; }
        }
    } else if (role === 'manager') {
        document.getElementById('navManagerRating').style.display = 'inline-block';
        document.getElementById('navSelfAssessment').style.display = 'none';
        document.getElementById('navManagerGuidelines').style.display = 'inline-block';
        setTodayDate('ratingDate');
        showTab('rating-form', null);

        // Auto-fill manager from SSO — manager identity is locked to the logged-in user
        var mgrEmp = resolveCurrentEmployee();
        if (mgrEmp) {
            selectManager(mgrEmp);
            // Disable search entirely — managers are identified by SSO
            var mgrSearchInput = document.getElementById('managerSearch');
            if (mgrSearchInput) { mgrSearchInput.disabled = true; mgrSearchInput.style.cursor = 'not-allowed'; mgrSearchInput.style.opacity = '0.6'; }
        } else {
            // No matching employee found — show warning
            toast('Your email (' + (currentSSOUser ? currentSSOUser.email : 'unknown') + ') is not found in the employee directory. You cannot submit manager ratings.', 'error');
            var mgrSearchInput = document.getElementById('managerSearch');
            if (mgrSearchInput) { mgrSearchInput.disabled = true; mgrSearchInput.style.cursor = 'not-allowed'; mgrSearchInput.style.opacity = '0.6'; }
        }
    }
}

function setTodayDate(fieldId) {
    var today = new Date();
    var year = today.getFullYear();
    var month = String(today.getMonth() + 1).padStart(2, '0');
    var day = String(today.getDate()).padStart(2, '0');
    document.getElementById(fieldId).value = year + '-' + month + '-' + day;
}

// ─── AUTOCOMPLETE FUNCTIONS ──────────────────────────────────────

function closeAllDropdowns() {
    document.querySelectorAll('.autocomplete-dropdown').forEach(function(d) { d.style.display = 'none'; });
    autocompleteIndex = -1;
}

function renderDropdownItems(dropdown, results, onSelectFn) {
    dropdown.innerHTML = '';
    if (results.length === 0) {
        dropdown.innerHTML = '<div style="padding: 0.75rem 1rem; color: var(--gray-medium); font-size: 0.9rem;">No results found</div>';
        dropdown.style.display = 'block';
        return;
    }
    results.forEach(function(emp, idx) {
        var item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.setAttribute('data-index', idx);
        item.style.cssText = 'padding: 0.75rem 1rem; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background 0.15s;';
        item.innerHTML = '<div style="font-weight: 600; color: var(--gray-dark);">' + emp.name + ' <span style="color: var(--purple-medium); font-size: 0.85rem;">(' + emp.id + ')</span></div>'
            + '<div style="font-size: 0.8rem; color: var(--gray-medium);">' + emp.designation + '</div>';
        item.onmouseenter = function() { this.style.background = '#f0f0ff'; };
        item.onmouseleave = function() { this.style.background = 'white'; };
        item.onclick = function() { onSelectFn(emp); };
        dropdown.appendChild(item);
    });
    dropdown.style.display = 'block';
    autocompleteIndex = -1;
}

function onAutocompleteKeydown(event, context) {
    var dropdownId = context === 'self' ? 'selfAutocompleteDropdown' : 'managerAutocompleteDropdown';
    var dropdown = document.getElementById(dropdownId);
    var items = dropdown.querySelectorAll('.autocomplete-item');
    if (!items.length) return;

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        autocompleteIndex = Math.min(autocompleteIndex + 1, items.length - 1);
        highlightItem(items);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        autocompleteIndex = Math.max(autocompleteIndex - 1, 0);
        highlightItem(items);
    } else if (event.key === 'Enter' && autocompleteIndex >= 0) {
        event.preventDefault();
        items[autocompleteIndex].click();
    } else if (event.key === 'Escape') {
        closeAllDropdowns();
    }
}

function highlightItem(items) {
    items.forEach(function(item, i) {
        item.style.background = i === autocompleteIndex ? '#f0f0ff' : 'white';
    });
    if (items[autocompleteIndex]) items[autocompleteIndex].scrollIntoView({ block: 'nearest' });
}

// ─── SELF-ASSESSMENT: EMPLOYEE SEARCH ────────────────────────────

function onEmployeeSearch() {
    // Self-assessment search is disabled — employee is auto-filled from SSO
    // This function is kept as a no-op to prevent errors from existing event handlers
    var dropdown = document.getElementById('selfAutocompleteDropdown');
    if (dropdown) dropdown.style.display = 'none';
    return;
}

function selectSelfEmployee(emp) {
    selectedSelfEmployee = emp;
    document.getElementById('selfEmployeeSearch').value = emp.name + ' (' + emp.id + ')';
    document.getElementById('selfEmployeeId').value = emp.id;
    document.getElementById('selfEmployeeName').value = emp.name;

    // Fill details card
    document.getElementById('selfEmpName').textContent = emp.name;
    document.getElementById('selfEmpId').textContent = emp.id;
    document.getElementById('selfEmpDesignation').textContent = emp.designation;
    document.getElementById('selfEmpEmail').textContent = emp.email;
    document.getElementById('selfEmpDateJoined').textContent = formatDate(emp.dateJoined);
    document.getElementById('selfEmpTenure').textContent = calculateTenure(emp.dateJoined, getReviewCycle(document.getElementById('selfReviewPeriod').value).tenureCutoffDate);
    document.getElementById('selfEmployeeDetails').style.display = 'block';

    fetchPreviousCycleRating(emp.id, emp.name, document.getElementById('selfReviewPeriod').value, 'selfPreviousCyclePanel', 'selfPreviousCycleLabel', 'selfPreviousCycleContent');
    updateSelfAlreadySubmittedBanner(emp.id, document.getElementById('selfReviewPeriod').value);
}

// Shows an "already submitted" banner and locks the form the moment we know a
// self-assessment already exists for this employee/cycle, instead of only
// telling them at Submit time. A monotonic token guards against a stale
// response landing after the employee or the Review Cycle dropdown has since
// changed again (whichever changed last should be the one that wins).
var selfBannerCheckToken = 0;
async function updateSelfAlreadySubmittedBanner(employeeId, reviewPeriod) {
    var myToken = ++selfBannerCheckToken;
    var alreadySubmitted = false;
    try {
        var existing = await sbSelect(
            'employee_id=eq.' + encodeURIComponent(employeeId) +
            '&review_period=eq.' + encodeURIComponent(reviewPeriod) +
            '&is_self_assessment=eq.true&select=id');
        alreadySubmitted = existing && existing.length > 0;
    } catch (e) { console.error('updateSelfAlreadySubmittedBanner:', e); }
    if (myToken !== selfBannerCheckToken) return;
    var banner = document.getElementById('selfAlreadySubmittedBanner');
    var formBody = document.getElementById('selfFormBody');
    if (banner) banner.style.display = alreadySubmitted ? 'block' : 'none';
    if (formBody) formBody.style.display = alreadySubmitted ? 'none' : 'block';
}

// ─── Review cycle switch: keep tenure-cutoff label + any displayed tenure in sync ──
function onReviewCycleChange(context) {
    var selectId = context === 'self' ? 'selfReviewPeriod' : 'reviewPeriod';
    var labelId  = context === 'self' ? 'selfTenureCutoffLabel' : 'mgrTenureCutoffLabel';
    var cycle = getReviewCycle(document.getElementById(selectId).value);

    var labelEl = document.getElementById(labelId);
    if (labelEl) labelEl.textContent = cycle.tenureCutoffLabel;

    if (context === 'self' && selectedSelfEmployee) {
        document.getElementById('selfEmpTenure').textContent = calculateTenure(selectedSelfEmployee.dateJoined, cycle.tenureCutoffDate);
        fetchPreviousCycleRating(selectedSelfEmployee.id, selectedSelfEmployee.name, cycle.value, 'selfPreviousCyclePanel', 'selfPreviousCycleLabel', 'selfPreviousCycleContent');
        updateSelfAlreadySubmittedBanner(selectedSelfEmployee.id, cycle.value);
    } else if (context === 'mgr') {
        if (selectedManager) loadDirectReports(selectedManager.name);
        if (selectedMgrEmployee) {
            document.getElementById('selEmpTenure').textContent = calculateTenure(selectedMgrEmployee.dateJoined, cycle.tenureCutoffDate);
            fetchSelfAssessment(selectedMgrEmployee.name, selectedMgrEmployee.id);
            fetchPreviousCycleRating(selectedMgrEmployee.id, selectedMgrEmployee.name, cycle.value, 'mgrPreviousCyclePanel', 'mgrPreviousCycleLabel', 'mgrPreviousCycleContent');
            updateMgrAlreadySubmittedBanner(selectedMgrEmployee.id, cycle.value);
        }
    }
}

// ─── PREVIOUS CYCLE RATING (reference panel shown alongside a later cycle, if REVIEW_CYCLES has more than one entry) ──
async function fetchPreviousCycleRating(employeeId, employeeName, currentCycleValue, panelId, labelId, contentId) {
    var panel = document.getElementById(panelId);
    var labelEl = document.getElementById(labelId);
    var content = document.getElementById(contentId);
    if (!panel) return;

    var prevCycle = getPreviousReviewCycle(currentCycleValue);
    if (!prevCycle) { panel.style.display = 'none'; return; }

    labelEl.textContent = prevCycle.label;
    panel.style.display = 'block';
    content.innerHTML = '<em>Loading...</em>';

    try {
        // Prefer the manager's final rating from the previous cycle; fall back to the employee's own self-assessment.
        var data = [];
        var sourceLabel = 'Manager Rating';
        if (employeeId) {
            data = await sbSelect('is_self_assessment=eq.false&employee_id=eq.' + encodeURIComponent(employeeId) + '&review_period=eq.' + encodeURIComponent(prevCycle.value));
        }
        if ((!data || data.length === 0) && employeeName) {
            data = await sbSelect('is_self_assessment=eq.false&employee_name=eq.' + encodeURIComponent(employeeName) + '&review_period=eq.' + encodeURIComponent(prevCycle.value));
        }
        if (!data || data.length === 0) {
            sourceLabel = 'Self-Assessment';
            if (employeeId) {
                data = await sbSelect('is_self_assessment=eq.true&employee_id=eq.' + encodeURIComponent(employeeId) + '&review_period=eq.' + encodeURIComponent(prevCycle.value));
            }
            if ((!data || data.length === 0) && employeeName) {
                data = await sbSelect('is_self_assessment=eq.true&employee_name=eq.' + encodeURIComponent(employeeName) + '&review_period=eq.' + encodeURIComponent(prevCycle.value));
            }
        }

        if (!data || data.length === 0) {
            content.innerHTML = '<em>No rating found for ' + prevCycle.label + '.</em>';
            return;
        }

        var prior = normalizeRating(data[0]);
        // Shown on the employee's own self-assessment form — Keeper Test and
        // Promotion Recommendation are internal leadership/HR signals, not
        // feedback the employee should see about themselves. The manager's
        // own panel (mgrPreviousCyclePanel) keeps full detail.
        var hideSensitive = panelId === 'selfPreviousCyclePanel';
        var html = '<div style="margin-bottom: 0.4rem;"><strong>Source:</strong> ' + sourceLabel + '</div>';
        html += '<div style="margin-bottom: 0.75rem;"><strong>Overall Score:</strong> ' + prior.overallScore.toFixed(2) + ' / 5.0' + (prior.overallRating ? ' (' + prior.overallRating + ')' : '') + '</div>';
        // Self-assessment and manager ratings use different category/index layouts —
        // reuse the same renderers the "View Details" modal uses so this stays correct.
        html += prior.isSelfAssessment
            ? renderSelfDetailRatings(prior.ratings, prior.overallScore)
            : renderManagerDetailRatings(prior.ratings, prior.keeperTest, prior.overallScore, hideSensitive);
        if (!hideSensitive && prior.promotionRecommendation) {
            html += '<div style="margin-top: 0.5rem;"><strong>Promotion Recommendation:</strong> ' + prior.promotionRecommendation + '</div>';
        }
        content.innerHTML = html;
    } catch (e) {
        console.error('Error fetching previous cycle rating:', e);
        content.innerHTML = '<em>Could not load previous cycle rating.</em>';
    }
}

function clearEmployeeSelection(context) {
    if (context === 'self') {
        // Self-assessment is locked to the logged-in user — prevent clearing
        toast('Self-assessment is locked to your own profile.', 'warn');
        return;
    }
}

// ─── MANAGER RATING: MANAGER SEARCH ─────────────────────────────

function onManagerSearch() {
    // Manager search is disabled — manager identity is auto-filled from SSO
    var dropdown = document.getElementById('managerAutocompleteDropdown');
    if (dropdown) dropdown.style.display = 'none';
    return;
}

function selectManager(emp) {
    selectedManager = emp;
    document.getElementById('managerSearch').value = emp.name;
    document.getElementById('managerSelect').value = emp.name;
    document.getElementById('reviewerName').value = emp.name;

    // Fill manager details
    document.getElementById('mgrName').textContent = emp.name;
    document.getElementById('mgrEmpId').textContent = emp.id;
    document.getElementById('mgrDesignation').textContent = emp.designation;
    document.getElementById('mgrEmail').textContent = emp.email;
    document.getElementById('managerDetailsSection').style.display = 'block';

    // Load direct reports
    loadDirectReports(emp.name);
}

function clearManagerSelection() {
    // Manager identity is locked to the logged-in user — prevent clearing
    toast('Manager identity is locked to your SSO profile.', 'warn');
    return;
}

function loadDirectReports(managerName) {
    var directReports = getDirectReports(managerName);
    var countDiv = document.getElementById('directReportsCount');
    var tableDiv = document.getElementById('directReportsTable');
    var employeeSelect = document.getElementById('employeeSelect');
    var tenureCutoffDate = getReviewCycle(document.getElementById('reviewPeriod').value).tenureCutoffDate;

    countDiv.innerHTML = '<strong>' + directReports.length + ' direct report' + (directReports.length !== 1 ? 's' : '') + '</strong>';

    // Build table
    if (directReports.length === 0) {
        tableDiv.innerHTML = '<p style="color: var(--gray-medium); font-style: italic;">No direct reports found for this name.</p>';
        document.getElementById('employeeSelectionSection').style.display = 'none';
        return;
    }

    var html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">';
    html += '<thead><tr style="background: rgba(106,76,147,0.1);">';
    html += '<th style="padding: 0.5rem; text-align: left; border-bottom: 2px solid var(--purple-light);">Emp ID</th>';
    html += '<th style="padding: 0.5rem; text-align: left; border-bottom: 2px solid var(--purple-light);">Name</th>';
    html += '<th style="padding: 0.5rem; text-align: left; border-bottom: 2px solid var(--purple-light);">Designation</th>';
    html += '<th style="padding: 0.5rem; text-align: left; border-bottom: 2px solid var(--purple-light);">Date Joined</th>';
    html += '<th style="padding: 0.5rem; text-align: left; border-bottom: 2px solid var(--purple-light);">Tenure</th>';
    html += '</tr></thead><tbody>';
    directReports.forEach(function(emp) {
        html += '<tr style="border-bottom: 1px solid #eee;">';
        html += '<td style="padding: 0.5rem; font-weight: 600; color: var(--purple-medium);">' + emp.id + '</td>';
        html += '<td style="padding: 0.5rem;">' + emp.name + '</td>';
        html += '<td style="padding: 0.5rem; font-size: 0.8rem;">' + emp.designation + '</td>';
        html += '<td style="padding: 0.5rem;">' + formatDate(emp.dateJoined) + '</td>';
        html += '<td style="padding: 0.5rem; font-size: 0.8rem;">' + calculateTenure(emp.dateJoined, tenureCutoffDate) + '</td>';
        html += '</tr>';
    });
    html += '</tbody></table>';
    tableDiv.innerHTML = html;

    // Populate employee dropdown
    employeeSelect.innerHTML = '<option value="">-- Select Employee --</option>';
    directReports.forEach(function(emp) {
        var option = document.createElement('option');
        option.value = JSON.stringify(emp);
        option.textContent = emp.name + ' (' + emp.id + ')';
        employeeSelect.appendChild(option);
    });

    document.getElementById('employeeSelectionSection').style.display = 'block';
}

// Select employee (manager rating)
function selectEmployee() {
    var employeeSelect = document.getElementById('employeeSelect');
    if (!employeeSelect.value) {
        document.getElementById('selectedEmployeeDetails').style.display = 'none';
        document.getElementById('selfAssessmentPanel').style.display = 'none';
        document.getElementById('mgrPreviousCyclePanel').style.display = 'none';
        selectedMgrEmployee = null;
        var mgrBanner = document.getElementById('mgrAlreadySubmittedBanner');
        var mgrBody = document.getElementById('mgrFormBody');
        if (mgrBanner) mgrBanner.style.display = 'none';
        if (mgrBody) mgrBody.style.display = 'block';
        return;
    }

    try {
        var emp = JSON.parse(employeeSelect.value);
        selectedMgrEmployee = emp;

        // Show employee details
        document.getElementById('selEmpName').textContent = emp.name;
        document.getElementById('selEmpId').textContent = emp.id;
        document.getElementById('selEmpDesignation').textContent = emp.designation;
        document.getElementById('selEmpEmail').textContent = emp.email;
        document.getElementById('selEmpDateJoined').textContent = formatDate(emp.dateJoined);
        document.getElementById('selEmpTenure').textContent = calculateTenure(emp.dateJoined, getReviewCycle(document.getElementById('reviewPeriod').value).tenureCutoffDate);
        document.getElementById('selectedEmployeeDetails').style.display = 'block';

        toast('Selected: ' + emp.name, 'success');

        // Fetch and display self-assessment
        fetchSelfAssessment(emp.name, emp.id);
        fetchPreviousCycleRating(emp.id, emp.name, document.getElementById('reviewPeriod').value, 'mgrPreviousCyclePanel', 'mgrPreviousCycleLabel', 'mgrPreviousCycleContent');
        updateMgrAlreadySubmittedBanner(emp.id, document.getElementById('reviewPeriod').value);
    } catch(e) {
        console.error('Error parsing employee data:', e);
        toast('Error selecting employee', 'error');
    }
}

// Mirrors updateSelfAlreadySubmittedBanner — same monotonic-token guard against
// a stale response landing after the employee or Review Cycle dropdown changes again.
var mgrBannerCheckToken = 0;
async function updateMgrAlreadySubmittedBanner(employeeId, reviewPeriod) {
    var myToken = ++mgrBannerCheckToken;
    var alreadySubmitted = false;
    try {
        var existing = await sbSelect(
            'employee_id=eq.' + encodeURIComponent(employeeId) +
            '&review_period=eq.' + encodeURIComponent(reviewPeriod) +
            '&is_self_assessment=eq.false&select=id');
        alreadySubmitted = existing && existing.length > 0;
    } catch (e) { console.error('updateMgrAlreadySubmittedBanner:', e); }
    if (myToken !== mgrBannerCheckToken) return;
    var banner = document.getElementById('mgrAlreadySubmittedBanner');
    var formBody = document.getElementById('mgrFormBody');
    if (banner) banner.style.display = alreadySubmitted ? 'block' : 'none';
    if (formBody) formBody.style.display = alreadySubmitted ? 'none' : 'block';
}

// ─── FETCH & DISPLAY SELF-ASSESSMENT IN MANAGER RATING ──────────

async function fetchSelfAssessment(employeeName, employeeId) {
    var panel = document.getElementById('selfAssessmentPanel');
    var content = document.getElementById('selfAssessmentContent');
    var reviewPeriod = document.getElementById('reviewPeriod').value.trim();

    try {
        // Try matching by employee_id first, then by name
        var data = [];
        if (employeeId) {
            data = await sbSelect(
                'is_self_assessment=eq.true&employee_id=eq.' + encodeURIComponent(employeeId) +
                '&review_period=eq.' + encodeURIComponent(reviewPeriod)
            );
        }
        if ((!data || data.length === 0) && employeeName) {
            data = await sbSelect(
                'is_self_assessment=eq.true&employee_name=eq.' + encodeURIComponent(employeeName) +
                '&review_period=eq.' + encodeURIComponent(reviewPeriod)
            );
        }

        if (data && data.length > 0) {
            var selfAssess = normalizeRating(data[0]);
            var selfCatNames = ['Job Knowledge & Skills', 'Quality of Work', '', 'Problem Solving & Initiative', 'Teamwork & Collaboration', 'AI Utilization', '', 'Accountability, Efficiency & Competency'];

            var html = '<div style="margin-bottom: 0.5rem;"><strong>Overall Self-Score:</strong> ' + selfAssess.overallScore.toFixed(2) + ' / 5.0</div>';
            html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-top: 0.5rem;">';
            selfCatNames.forEach(function(catName, i) {
                if (!catName) return;
                var val = selfAssess.ratings[i];
                if ((i === 5 || i === 7) && val !== undefined) {
                    html += '<div>' + catName + ': <strong>' + Number(val).toFixed(2) + '</strong></div>';
                } else if (val !== undefined) {
                    html += '<div>' + catName + ': <strong>' + val + '</strong></div>';
                } else {
                    html += '<div>' + catName + ': <em>N/A</em></div>';
                }
            });
            // OKR
            var selfOkrPctDisplay = selfAssess.ratings.okr_percent;
            if (selfOkrPctDisplay !== undefined && selfOkrPctDisplay !== null) {
                html += '<div>OKR % Completion: <strong>' + selfOkrPctDisplay + '% (' + Number(selfAssess.ratings[10]).toFixed(2) + ' / 5)</strong></div>';
            }
            html += '</div>';

            if (selfAssess.justification) {
                html += '<div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid rgba(12,84,96,0.3);"><strong>Comments:</strong> <em>' + selfAssess.justification + '</em></div>';
            }

            content.innerHTML = html;
            panel.style.display = 'block';

            // Carry the self-reported OKR % into the manager's own field as a
            // starting point — it's a factual number already shown just above,
            // not a judgment call, so there's no reason to make the manager
            // retype it. Only pre-fills an empty field, never overwrites
            // something the manager has already entered.
            var okrInputEl = document.getElementById('mgrOkrInput');
            if (okrInputEl && !okrInputEl.value && selfOkrPctDisplay !== undefined && selfOkrPctDisplay !== null) {
                setMgrOkrPercent(selfOkrPctDisplay);
            }
        } else {
            content.innerHTML = '<em>No self-assessment submitted yet for this review period.</em>';
            panel.style.display = 'block';
        }
    } catch(err) {
        console.error('Error fetching self-assessment:', err);
        content.innerHTML = '<em>Could not load self-assessment data.</em>';
        panel.style.display = 'block';
    }
}

// ─── HELPER: FORMAT DATE ─────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function backToWelcome() {
    document.getElementById('navSelfAssessment').style.display = 'none';
    document.getElementById('navManagerRating').style.display = 'none';
    document.getElementById('navManagerGuidelines').style.display = 'inline-block';
    resetSelfForm();
    resetForm();
    showTab('welcome', null);
}

// ─── EMPLOYEE ID VALIDATION ───────────────────────────────────────
function validateEmployeeId(empId) {
    if (!empId || empId.trim() === '') {
        toast('Please select an employee first.', 'error');
        return false;
    }
    return true;
}

async function checkExistingSelfAssessment(employeeId, reviewPeriod) {
    try {
        const data = await sbSelect(
            `employee_id=eq.${encodeURIComponent(employeeId)}&` +
            `review_period=eq.${encodeURIComponent(reviewPeriod)}&` +
            `is_self_assessment=eq.true`
        );

        if (data && data.length > 0) {
            const existing = data[0];
            const submittedDate = new Date(existing.submitted_at).toLocaleDateString();
            toast(
                `You have already submitted a self-assessment on ${submittedDate}. Only one self-assessment is allowed per review period.`,
                'error'
            );
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking existing submission:', error);
        return false;
    }
}

// ─── ADMIN DASHBOARD ANIMATION ──────────────────────────────────────
function animateStatCards() {
    if (typeof gsap === 'undefined') return;
    if (prefersReducedMotion()) { gsap.set('.stat-card', { opacity: 1, y: 0 }); return; }
    // fromTo (not from) — the ancestor's display just flipped from none to block in this
    // same call stack, so .from()'s implicit "capture current style" reads a stale value.
    gsap.fromTo('.stat-card', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .5, stagger: .08, ease: 'power3.out' });
}
function animateCount(el, target, decimals) {
    if (!el) return;
    if (typeof gsap === 'undefined' || prefersReducedMotion()) { el.textContent = target.toFixed(decimals); return; }
    var obj = { val: 0 };
    gsap.to(obj, {
        val: target, duration: 1.1, ease: 'power2.out',
        onUpdate: function () { el.textContent = obj.val.toFixed(decimals); }
    });
}

// ─── ADMIN AUTH ───────────────────────────────────────────────────
// NOTE: this compares a plaintext password via a Supabase REST query-string
// filter — simple, but the password travels in the URL (can end up in logs)
// and admin_users.password is presumably stored in plaintext too. Replace
// with Supabase Auth (or any real auth) before using this beyond a demo.
async function adminLogin() {
    var username = document.getElementById('adminUsername').value.trim();
    var password = document.getElementById('adminPassword').value;
    if (!username || !password) {
        document.getElementById('loginError').style.display = 'block';
        return;
    }
    try {
        var res = await fetch(REST + '/admin_users?username=eq.' + encodeURIComponent(username) + '&password=eq.' + encodeURIComponent(password) + '&select=id', { headers: SB_HEADERS });
        var data = await res.json();
        if (data && data.length > 0) {
            isAdminLoggedIn = true;
            document.getElementById('loginView').style.display  = 'none';
            document.getElementById('adminView').style.display  = 'block';
            document.getElementById('loginError').style.display = 'none';
            animateStatCards();
            loadAdminData();
        } else {
            document.getElementById('loginError').style.display = 'block';
        }
    } catch(err) {
        console.error('Admin login error:', err);
        document.getElementById('loginError').style.display = 'block';
    }
}
function adminLogout() {
    isAdminLoggedIn = false;
    document.getElementById('loginView').style.display  = 'block';
    document.getElementById('adminView').style.display  = 'none';
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
}

// ─── LIKERT SCALE ─────────────────────────────────────────────────
function setRating(categoryIndex, score) {
    ratings[categoryIndex] = score;
    document.querySelectorAll('#rating-form [data-category="' + categoryIndex + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    calculateOverallScore();
}

function setMgrAISub(sub, score) {
    mgrAiSubs[sub] = score;
    document.querySelectorAll('#rating-form [data-category="ai_' + sub + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    var subs = Object.values(mgrAiSubs);
    if (subs.every(function(v){ return v !== null; })) {
        var avg = (subs[0] + subs[1] + subs[2]) / 3;
        ratings[5] = avg;
        var row = document.getElementById('mgrAiAvgRow');
        if (row) { row.style.display = 'flex'; document.getElementById('mgrAiAvgScore').textContent = avg.toFixed(2) + ' / 5'; }
    }
    calculateOverallScore();
}

function setMgrAccSub(sub, score) {
    mgrAccSubs[sub] = score;
    document.querySelectorAll('#rating-form [data-category="acc_' + sub + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    var subs = Object.values(mgrAccSubs);
    if (subs.every(function(v){ return v !== null; })) {
        var avg = (subs[0] + subs[1] + subs[2]) / 3;
        ratings[2] = avg;
        var row = document.getElementById('mgrAccAvgRow');
        if (row) { row.style.display = 'flex'; document.getElementById('mgrAccAvgScore').textContent = avg.toFixed(2) + ' / 5'; }
    }
    calculateOverallScore();
}

function setMgrOkrPercent(value) {
    var pct = parseFloat(value);
    if (isNaN(pct) || pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    document.getElementById('mgrOkrInput').value = pct;
    mgrOkrPercent = pct;
    ratings[6] = (pct / 100) * 5;
    var display = document.getElementById('mgrOkrScoreDisplay');
    if (display) { display.style.display = 'block'; display.textContent = 'OKR Score: ' + ratings[6].toFixed(2) + ' / 5'; }
    calculateOverallScore();
}

function calculateOverallScore() {
    // Manager rating: 4 sections × 25% each
    // Section 1: Accountability/Efficiency/Competency avg (ratings[2])
    // Section 2: AI Utilization avg (ratings[5])
    // Section 3: OKR % Completion (ratings[6])
    // Section 4: Keeper's Test (keeperTestState.kt_retention_score)
    var sections = [];
    var totalSections = 4;
    if (ratings[2] !== undefined) sections.push(ratings[2]);
    if (ratings[5] !== undefined) sections.push(ratings[5]);
    if (ratings[6] !== undefined) sections.push(ratings[6]);
    if (keeperTestState.kt_retention_score !== null) sections.push(keeperTestState.kt_retention_score);

    if (sections.length === 0) {
        document.getElementById('overallScore').textContent = '0.0';
        document.getElementById('overallRating').textContent = 'Not Rated';
        return;
    }
    var sum = sections.reduce(function(a, b) { return a + b; }, 0);
    var avg = sum / totalSections;
    document.getElementById('overallScore').textContent = avg.toFixed(2);
    var label = avg >= 4.5 ? 'Exceptional'
              : avg >= 3.5 ? 'Exceeds Expectations'
              : avg >= 2.5 ? 'Meets Expectations'
              : avg >= 1.5 ? 'Needs Improvement'
              : 'Unsatisfactory';
    var suffix = sections.length < totalSections ? ' (' + sections.length + '/4 sections)' : '';
    document.getElementById('overallRating').textContent = label + suffix;
}

// ─── RESET FORM ───────────────────────────────────────────────────
function resetForm() {
    clearManagerSelection();
    document.getElementById('justification').value = '';
    document.querySelectorAll('input[name="promotion"]').forEach(function(r) { r.checked = false; });
    document.querySelectorAll('input[name="potential"]').forEach(function(r) { r.checked = false; });
    document.querySelectorAll('#rating-form .rating-btn').forEach(function(b) { b.classList.remove('selected'); });
    ratings = {};
    mgrAiSubs = { adoption: null, fluency: null, impact: null };
    mgrAccSubs = { accountability: null, efficiency: null, competency: null };
    mgrOkrPercent = null;
    var mgrRow = document.getElementById('mgrAiAvgRow');
    if (mgrRow) mgrRow.style.display = 'none';
    var mgrAccRow = document.getElementById('mgrAccAvgRow');
    if (mgrAccRow) mgrAccRow.style.display = 'none';
    var okrInput = document.getElementById('mgrOkrInput');
    if (okrInput) okrInput.value = '';
    var okrDisplay = document.getElementById('mgrOkrScoreDisplay');
    if (okrDisplay) okrDisplay.style.display = 'none';
    // Reset keeper test inline state
    keeperTestState.kt_retention_score = null;
    keeperTestState.comments.kt_keeper_comment = '';
    document.querySelectorAll('#rating-form .kt-score-btn').forEach(function(b){ b.classList.remove('selected'); });
    var ktComment = document.getElementById('kt_keeper_comment');
    if (ktComment) ktComment.value = '';
    var ktPanel = document.getElementById('ktEmotionPanel');
    if (ktPanel) { ktPanel.style.display = 'none'; ktPanel.innerHTML = ''; }

    document.getElementById('overallScore').textContent  = '0.0';
    document.getElementById('overallRating').textContent = 'Not Rated';
    setTodayDate('ratingDate');

    // Re-auto-fill manager from SSO if available
    if (currentSSOUser && currentSSOUser.employeeId) {
        var mgr = findEmployeeById(currentSSOUser.employeeId);
        if (mgr) selectManager(mgr);
    }
}

// ─── SELF ASSESSMENT FUNCTIONS ───────────────────────────────────
function setSelfRating(categoryIndex, score) {
    selfRatings[categoryIndex] = score;
    document.querySelectorAll('#self-assessment [data-category="' + categoryIndex + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    calculateSelfOverallScore();
}

function setSelfAISub(sub, score) {
    selfAiSubs[sub] = score;
    document.querySelectorAll('#self-assessment [data-category="ai_' + sub + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    var subs = Object.values(selfAiSubs);
    if (subs.every(function(v){ return v !== null; })) {
        var avg = (subs[0] + subs[1] + subs[2]) / 3;
        selfRatings[5] = avg;
        var row = document.getElementById('selfAiAvgRow');
        if (row) { row.style.display = 'flex'; document.getElementById('selfAiAvgScore').textContent = avg.toFixed(2) + ' / 5'; }
    }
    calculateSelfOverallScore();
}

function setSelfAccSub(sub, score) {
    selfAccSubs[sub] = score;
    document.querySelectorAll('#self-assessment [data-category="acc_' + sub + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    var subs = Object.values(selfAccSubs);
    if (subs.every(function(v){ return v !== null; })) {
        var avg = (subs[0] + subs[1] + subs[2]) / 3;
        selfRatings[7] = avg;
        var row = document.getElementById('selfAccAvgRow');
        if (row) { row.style.display = 'flex'; document.getElementById('selfAccAvgScore').textContent = avg.toFixed(2) + ' / 5'; }
    }
    calculateSelfOverallScore();
}

function setSelfOkrPercent(value) {
    var pct = parseFloat(value);
    if (isNaN(pct) || pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    document.getElementById('selfOkrInput').value = pct;
    selfOkrPercent = pct;
    selfRatings[10] = (pct / 100) * 5;
    var display = document.getElementById('selfOkrScoreDisplay');
    if (display) { display.style.display = 'block'; display.textContent = 'OKR Score: ' + selfRatings[10].toFixed(2) + ' / 5'; }
    calculateSelfOverallScore();
}

function calculateSelfOverallScore() {
    var NON_AI_W = 70 / 6;
    var AI_W = 30;
    var NON_AI_INDICES = [0,1,3,4,7,10];
    var wSum = 0, wTotal = 0;
    NON_AI_INDICES.forEach(function(i) {
        if (selfRatings[i] !== undefined) { wSum += selfRatings[i] * NON_AI_W; wTotal += NON_AI_W; }
    });
    if (selfRatings[5] !== undefined) { wSum += selfRatings[5] * AI_W; wTotal += AI_W; }
    if (wTotal === 0) { document.getElementById('selfOverallScore').textContent = '0.0'; return; }
    var avg = wSum / wTotal;
    document.getElementById('selfOverallScore').textContent = avg.toFixed(2);
}

function resetSelfForm() {
    clearEmployeeSelection('self');
    document.getElementById('selfComments').value = '';
    document.querySelectorAll('#self-assessment .rating-btn').forEach(function(b) { b.classList.remove('selected'); });
    selfRatings = {};
    selfAiSubs = { adoption: null, fluency: null, impact: null };
    selfAccSubs = { accountability: null, efficiency: null, competency: null };
    selfOkrPercent = null;
    var selfRow = document.getElementById('selfAiAvgRow');
    if (selfRow) selfRow.style.display = 'none';
    var selfAccRow = document.getElementById('selfAccAvgRow');
    if (selfAccRow) selfAccRow.style.display = 'none';
    var okrInput = document.getElementById('selfOkrInput');
    if (okrInput) okrInput.value = '';
    var okrDisplay = document.getElementById('selfOkrScoreDisplay');
    if (okrDisplay) okrDisplay.style.display = 'none';
    document.getElementById('selfOverallScore').textContent = '0.0';
    setTodayDate('selfRatingDate');

    // Re-auto-fill from SSO if available
    if (currentSSOUser && currentSSOUser.employeeId) {
        var emp = findEmployeeById(currentSSOUser.employeeId);
        if (emp) selectSelfEmployee(emp);
    }
}

async function submitSelfAssessment() {
    var employeeId = (document.getElementById('selfEmployeeId').value || '').trim().toUpperCase();
    var selfEmployeeName = (document.getElementById('selfEmployeeName').value || '').trim();
    var reviewPeriod = document.getElementById('selfReviewPeriod').value.trim();

    if (!validateEmployeeId(employeeId)) { return; }
    if (!selfEmployeeName || !reviewPeriod) {
        toast('Please select an employee and fill in all required fields.', 'warn');
        return;
    }

    // Validate: logged-in user can only rate themselves
    var currentEmp = resolveCurrentEmployee();
    if (!currentEmp) {
        toast('Your email is not found in the employee directory. Self-assessment is not allowed.', 'error');
        return;
    }
    if (currentEmp.id !== employeeId) {
        toast('You can only submit a self-assessment for yourself (' + currentEmp.name + '). Rating other employees is not allowed.', 'error');
        return;
    }
    var nonAiRated = [0,1,3,4].filter(function(i){ return selfRatings[i] !== undefined; }).length;
    var aiRated = Object.values(selfAiSubs).filter(function(v){ return v !== null; }).length;
    var accRated = Object.values(selfAccSubs).filter(function(v){ return v !== null; }).length;
    if (nonAiRated !== 4 || aiRated !== 3 || accRated !== 3) {
        toast('Please rate all categories (including all AI and Accountability/Efficiency/Competency subcomponents).', 'warn');
        return;
    }
    if (selfOkrPercent === null || selfOkrPercent === undefined) {
        toast('Please enter your OKR % Completion.', 'warn');
        return;
    }

    const exists = await checkExistingSelfAssessment(employeeId, reviewPeriod);
    if (exists) { return; }

    // Get employee details for PDF
    var emp = selectedSelfEmployee || findEmployeeById(employeeId);

    var ssoInfo = getSSOSubmitterInfo();
    var row = {
        rating_date:              document.getElementById('selfRatingDate').value,
        employee_id:              employeeId,
        employee_name:            selfEmployeeName,
        position:                 emp ? emp.designation : '',
        department:               '',
        review_period:            reviewPeriod,
        reviewer_name:            selfEmployeeName + ' (Self)',
        ratings:                  Object.assign({}, selfRatings, { ai_subs: selfAiSubs, acc_subs: selfAccSubs, okr_percent: selfOkrPercent }),
        overall_score:            parseFloat(document.getElementById('selfOverallScore').textContent) || 0,
        overall_rating:           '',
        promotion_recommendation: '',
        justification:            document.getElementById('selfComments').value.trim(),
        keeper_test:              null,
        management_decision:      { finalDecision:'', approvedBy:'', effectiveDate:'', managementNotes:'' },
        is_self_assessment:       true,
        submitted_by_email:       ssoInfo.submitted_by_email,
        submitted_by_name:        ssoInfo.submitted_by_name
    };

    try {
        await sbInsert(row);
        toast('Self-assessment submitted successfully!', 'success');

        // Generate PDF and email
        if (emp && emp.email) {
            var ratingObj = Object.assign({}, row, {
                employeeName: selfEmployeeName,
                position: emp.designation,
                overallScore: row.overall_score,
                reviewPeriod: reviewPeriod,
                ratingDate: row.rating_date,
                reviewerName: row.reviewer_name,
                ratings: row.ratings,
                justification: row.justification
            });
            fetchEmployeeInsights(emp.id).then(function(insights) {
                sendSelfAssessmentEmail(ratingObj, emp.email, insights);
            });
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        resetSelfForm();
    } catch(err) {
        console.error('submitSelfAssessment error:', err);
        var errorMsg = 'Error saving self-assessment. ';
        if (err.message) errorMsg += err.message;
        else if (err.hint) errorMsg += err.hint;
        else errorMsg += 'Please check if database migrations are run and try again.';
        toast(errorMsg, 'error');
    }
}

// ─── PDF GENERATION ──────────────────────────────────────────────

function generatePDFBlob(rating, includeComparison, selfAssessment) {
    var jsPDF = window.jspdf.jsPDF;
    var pdf   = new jsPDF();
    var y = 20, margin = 20, pageWidth = pdf.internal.pageSize.getWidth();

    // Header — brand accent color
    pdf.setFillColor(14, 156, 147);
    pdf.rect(0, 0, pageWidth, 38, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14); pdf.setFont(undefined, 'bold');
    var piPrefix = rating.reviewPeriod === PI_REVIEW_PERIOD ? 'Performance Incentive - ' : '';
    var title = piPrefix + (includeComparison ? 'Performance Review - Comparison Report' :
                rating.isSelfAssessment ? 'Self-Assessment Report' : 'Performance Rating Report');
    pdf.text(title, margin + 20, 22);
    pdf.setTextColor(0, 0, 0); y = 50;

    // Employee info
    pdf.setFontSize(14); pdf.setFont(undefined, 'bold');
    pdf.text('Employee Information', margin, y); y += 10;
    pdf.setFontSize(11); pdf.setFont(undefined, 'normal');
    pdf.text('Name: ' + rating.employeeName, margin, y); y += 7;
    if (rating.employeeId) { pdf.text('Employee ID: ' + rating.employeeId, margin, y); y += 7; }
    if (rating.position) { pdf.text('Designation: ' + rating.position, margin, y); y += 7; }
    pdf.text('Review Period: ' + rating.reviewPeriod, margin, y); y += 7;
    pdf.text('Reviewer: ' + rating.reviewerName, margin, y); y += 7;
    pdf.text('Date: ' + (rating.ratingDate || ''), margin, y); y += 15;

    // Look up employee for extra details
    var emp = findEmployeeById(rating.employeeId) || findEmployeeByName(rating.employeeName);
    if (emp) {
        // PI isn't in REVIEW_CYCLES (it's not a selectable annual cycle), so it needs its
        // own tenure cutoff instead of falling through to getReviewCycle()'s April-March default.
        var pdfCycle = rating.reviewPeriod === PI_REVIEW_PERIOD
            ? { tenureCutoffDate: SEPT_CYCLE_TENURE_CUTOFF_DATE, tenureCutoffLabel: SEPT_CYCLE_TENURE_CUTOFF_LABEL }
            : getReviewCycle(rating.reviewPeriod);
        pdf.text('Email: ' + emp.email, margin, y); y += 7;
        pdf.text('Date Joined: ' + formatDate(emp.dateJoined), margin, y); y += 7;
        pdf.text('Tenure (as of ' + pdfCycle.tenureCutoffLabel + '): ' + calculateTenure(emp.dateJoined, pdfCycle.tenureCutoffDate), margin, y); y += 15;
    }

    // Overall score box — brand dark accent
    pdf.setFillColor(10, 122, 115);
    pdf.rect(margin, y, pageWidth - 2 * margin, 25, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16); pdf.setFont(undefined, 'bold');
    var scoreText = includeComparison ? 'Manager Score: ' + rating.overallScore.toFixed(1) + (rating.overallRating ? ' - ' + rating.overallRating : '') :
                    'Overall Score: ' + rating.overallScore.toFixed(1) + (rating.overallRating ? ' - ' + rating.overallRating : '');
    pdf.text(scoreText, margin + 5, y + 16);
    pdf.setTextColor(0, 0, 0); y += 35;

    // If comparison, show both side by side
    if (includeComparison && selfAssessment) {
        // Self-assessment section
        pdf.setFontSize(12); pdf.setFont(undefined, 'bold');
        pdf.text('Employee Self-Assessment (Score: ' + selfAssessment.overallScore.toFixed(2) + ')', margin, y); y += 10;
        pdf.setFont(undefined, 'normal'); pdf.setFontSize(10);
        var selfCats = ['Job Knowledge & Skills','Quality of Work','','Problem Solving & Initiative','Teamwork & Collaboration','AI Utilization','','Accountability, Efficiency & Competency'];
        selfCats.forEach(function(cat, i) {
            if (!cat) return;
            if (y > 270) { pdf.addPage(); y = 20; }
            pdf.text(cat + ': ' + (selfAssessment.ratings[i] !== undefined ? Number(selfAssessment.ratings[i]).toFixed(1) : 'N/A'), margin + 5, y); y += 7;
        });
        // Self-assessment OKR
        var selfOkrPct = selfAssessment.ratings.okr_percent;
        if (selfOkrPct !== undefined && selfOkrPct !== null) {
            if (y > 270) { pdf.addPage(); y = 20; }
            pdf.text('OKR % Completion: ' + selfOkrPct + '% (' + Number(selfAssessment.ratings[10]).toFixed(2) + ' / 5)', margin + 5, y); y += 7;
        }
        y += 5;

        // Manager rating section
        if (y > 240) { pdf.addPage(); y = 20; }
        pdf.setFontSize(12); pdf.setFont(undefined, 'bold');
        pdf.text('Manager Rating (Score: ' + rating.overallScore.toFixed(2) + ' - ' + (rating.overallRating || '') + ')', margin, y); y += 10;
        pdf.setFont(undefined, 'normal'); pdf.setFontSize(10);
    }

    // Category ratings
    if (!includeComparison) {
        pdf.setFontSize(12); pdf.setFont(undefined, 'bold');
        pdf.text('Category Ratings:', margin, y); y += 10;
    }
    pdf.setFont(undefined, 'normal'); pdf.setFontSize(10);

    if (rating.isSelfAssessment) {
        // Self-assessment categories
        var selfPdfCats = ['Job Knowledge & Skills','Quality of Work','','Problem Solving & Initiative','Teamwork & Collaboration','AI Utilization','','Accountability, Efficiency & Competency'];
        selfPdfCats.forEach(function(cat, i) {
            if (!cat) return;
            if (y > 270) { pdf.addPage(); y = 20; }
            pdf.text(cat + ': ' + (rating.ratings[i] !== undefined ? Number(rating.ratings[i]).toFixed(1) : 'N/A'), margin + 5, y); y += 7;
        });
        var selfPdfOkr = rating.ratings.okr_percent;
        if (selfPdfOkr !== undefined && selfPdfOkr !== null) {
            if (y > 270) { pdf.addPage(); y = 20; }
            pdf.text('OKR % Completion: ' + selfPdfOkr + '% (' + Number(rating.ratings[10]).toFixed(2) + ' / 5)', margin + 5, y); y += 7;
        }
    } else {
        // Manager rating — 4 sections
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.text('Accountability, Efficiency & Competency (avg): ' + (rating.ratings[2] !== undefined ? Number(rating.ratings[2]).toFixed(2) : 'N/A') + ' / 5', margin + 5, y); y += 7;
        pdf.text('AI Utilization (avg): ' + (rating.ratings[5] !== undefined ? Number(rating.ratings[5]).toFixed(2) : 'N/A') + ' / 5', margin + 5, y); y += 7;
        var mgrPdfOkr = rating.ratings.okr_percent;
        pdf.text('OKR % Completion: ' + (mgrPdfOkr !== undefined && mgrPdfOkr !== null ? mgrPdfOkr + '% (' + Number(rating.ratings[6]).toFixed(2) + ' / 5)' : 'N/A'), margin + 5, y); y += 7;
    }
    y += 10;

    // Promotion recommendation (manager rating only — PI and self-assessments don't have this)
    if (rating.promotionRecommendation) {
        if (y > 240) { pdf.addPage(); y = 20; }
        pdf.setFont(undefined, 'bold'); pdf.setFontSize(11);
        pdf.text('Promotion Recommendation:', margin, y); y += 7;
        pdf.setFont(undefined, 'normal');
        pdf.text(rating.promotionRecommendation === 'yes' ? 'Yes, recommended for promotion' : 'Not recommended at this time', margin, y); y += 10;
    }

    // Remarks / comments — shown whenever present, independent of promotion recommendation
    // (previously nested inside the block above, so remarks never appeared for a self-assessment
    // or for a PI manager rating, since neither of those has a promotion recommendation at all).
    if (rating.justification) {
        if (y > 240) { pdf.addPage(); y = 20; }
        pdf.setFont(undefined, 'bold'); pdf.setFontSize(11);
        pdf.text('Remarks:', margin, y); y += 7;
        pdf.setFont(undefined, 'normal');
        var jLines = pdf.splitTextToSize(rating.justification, pageWidth - 2 * margin);
        pdf.text(jLines, margin, y); y += jLines.length * 7 + 10;
    }

    // Keeper test
    if (rating.keeperTest && rating.keeperTest.verdict) {
        if (y > 240) { pdf.addPage(); y = 20; }
        pdf.setFont(undefined, 'bold'); pdf.setFontSize(11);
        var ktScore = rating.keeperTest.responses ? rating.keeperTest.responses.kt_retention_score : '';
        pdf.text('Keeper Test Score: ' + (ktScore !== null && ktScore !== undefined ? ktScore + ' / 5' : '-'), margin, y); y += 7;
        pdf.text('Keeper Verdict: ' + rating.keeperTest.verdict.replace(/_/g, ' '), margin, y); y += 15;
    }

    // Management decision
    if (rating.managementDecision && rating.managementDecision.finalDecision) {
        if (y > 220) { pdf.addPage(); y = 20; }
        pdf.setFont(undefined, 'bold'); pdf.setFontSize(11);
        pdf.text('Management Decision:', margin, y); y += 7;
        pdf.setFont(undefined, 'normal');
        pdf.text('Final Decision: ' + rating.managementDecision.finalDecision, margin, y); y += 7;
        pdf.text('Approved By: ' + rating.managementDecision.approvedBy, margin, y); y += 7;
        pdf.text('Effective Date: ' + rating.managementDecision.effectiveDate, margin, y); y += 10;
        if (rating.managementDecision.managementNotes) {
            var nl = pdf.splitTextToSize(rating.managementDecision.managementNotes, pageWidth - 2 * margin);
            pdf.text(nl, margin, y);
        }
    }

    return pdf;
}

function downloadPDF(ratingId) {
    var rating = ratingsCache.find(function(r){ return r.id === ratingId; });
    if (!rating) { toast('Rating not found. Refresh the dashboard.', 'warn'); return; }
    var pdf = generatePDFBlob(rating, false, null);
    pdf.save('Rating_' + rating.employeeName.replace(/\s+/g, '_') + '_' + rating.id + '.pdf');
}

// Legacy wrapper
function generatePDF(rating) {
    var pdf = generatePDFBlob(rating, false, null);
    pdf.save('Rating_' + rating.employeeName.replace(/\s+/g, '_') + '_' + (rating.id || 'report') + '.pdf');
}

// ─── DOWNLOAD FINAL REPORT (comparison PDF with management decision) ──

async function downloadFinalReport(ratingId) {
    var rating = ratingsCache.find(function(r){ return r.id === ratingId; });
    if (!rating) { toast('Rating not found. Refresh the dashboard.', 'warn'); return; }

    // Fetch self-assessment for comparison
    var selfAssessment = null;
    try {
        var query = rating.employeeId ?
            'is_self_assessment=eq.true&employee_id=eq.' + encodeURIComponent(rating.employeeId) + '&review_period=eq.' + encodeURIComponent(rating.reviewPeriod) :
            'is_self_assessment=eq.true&employee_name=eq.' + encodeURIComponent(rating.employeeName) + '&review_period=eq.' + encodeURIComponent(rating.reviewPeriod);
        var data = await sbSelect(query);
        if (data && data.length > 0) selfAssessment = normalizeRating(data[0]);
    } catch(e) { console.log('No self-assessment found:', e); }

    var pdf = generatePDFBlob(rating, !!selfAssessment, selfAssessment);
    pdf.save('Final_Report_' + rating.employeeName.replace(/\s+/g, '_') + '_' + rating.id + '.pdf');
    toast('Final report PDF downloaded.', 'success');
}

// ─── EMAILJS SEND FUNCTIONS ─────────────────────────────────────

function isEmailJSConfigured() {
    return EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY' && EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID';
}

// Wraps an email body in the brand-colored header/footer — all styling is
// inline since email clients don't load external stylesheets. Matches the
// same teal used across the live platform (Phase 1) and the exported PDFs.
function emailWrapper(title, bodyHtml) {
    return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fbf6ee;border-radius:10px;overflow:hidden;">'
        + '<div style="background:#0e9c93;padding:22px 28px;">'
        + '<div style="color:#ffffff;font-size:20px;font-weight:700;">Acme</div>'
        + '<div style="color:#e7f4f1;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-top:2px;">Performance Management</div>'
        + '</div>'
        + '<div style="background:#ffffff;padding:26px 28px;">'
        + '<h2 style="color:#211c16;margin:0 0 16px;font-size:20px;">' + title + '</h2>'
        + bodyHtml
        + '</div>'
        + '<div style="text-align:center;color:#6b6156;font-size:11px;padding:14px;">This is an automated report from the Acme Performance Management System.</div>'
        + '</div>';
}

function emailScoreBox(label, score) {
    return '<div style="background:#0a7a73;color:#ffffff;border-radius:8px;padding:14px 18px;margin:14px 0;font-size:16px;font-weight:700;">' + label + ': ' + score + '</div>';
}

function emailSectionHeading(text) {
    return '<h3 style="color:#0a7a73;font-size:15px;margin:18px 0 8px;">' + text + '</h3>';
}

// Same rule-based insights shown in the admin dashboard / Employee Profile
// (computeEmployeeInsights — no external AI model), rendered with inline
// styles since email clients ignore external/embedded CSS.
//
// hideSensitive: true strips any insight computeEmployeeInsights tagged
// sensitive:true (Keeper Test, 9-Box/Potential, Promotion Recommendation) —
// these were leaking into every email the rated employee received (self-
// assessment confirmation AND the manager-rating comparison report) because
// this function rendered the insights array unfiltered, independent of the
// hideSensitive gating already applied to the rest of the email body.
function emailInsightsHtml(insights, hideSensitive) {
    if (!insights || insights.length === 0) return '';
    var visible = hideSensitive ? insights.filter(function(i) { return !i.sensitive; }) : insights;
    if (visible.length === 0) return '';
    var typeColor = { risk: '#d20820', warn: '#b4790e', good: '#0a7a73', info: '#6b6156' };
    var rows = visible.map(function(i) {
        return '<div style="border-left:4px solid ' + (typeColor[i.type] || '#6b6156') + ';padding:8px 12px;margin:8px 0;background:#f5f0e6;">'
            + '<div style="font-weight:700;font-size:13px;color:#211c16;">' + i.title + '</div>'
            + '<div style="font-size:12px;color:#6b6156;margin-top:2px;">' + i.detail + '</div>'
            + '</div>';
    }).join('');
    return emailSectionHeading('Insights') + rows;
}

function sendSelfAssessmentEmail(ratingObj, toEmail, insights) {
    if (!isEmailJSConfigured()) {
        toast('EmailJS not configured. PDF report not emailed. Please configure EmailJS credentials.', 'warn');
        return;
    }
    try {
        var selfCats = ['Job Knowledge & Skills','Quality of Work','','Problem Solving & Initiative','Teamwork & Collaboration','AI Utilization','','Accountability, Efficiency & Competency'];
        var body = '<p style="margin:4px 0;"><strong>Employee:</strong> ' + ratingObj.employeeName + '</p>';
        body += '<p style="margin:4px 0;"><strong>Review Period:</strong> ' + ratingObj.reviewPeriod + '</p>';
        body += '<p style="margin:4px 0;"><strong>Date:</strong> ' + ratingObj.ratingDate + '</p>';
        body += emailScoreBox('Overall Score', ratingObj.overallScore.toFixed(2) + ' / 5.0');
        body += emailSectionHeading('Category Ratings');
        body += '<ul style="margin:0;padding-left:20px;color:#3a322a;">';
        selfCats.forEach(function(cat, i) {
            if (!cat) return;
            body += '<li style="margin:4px 0;">' + cat + ': ' + (ratingObj.ratings[i] !== undefined ? Number(ratingObj.ratings[i]).toFixed(1) : 'N/A') + ' / 5</li>';
        });
        // OKR % Completion
        var okrPct = ratingObj.ratings.okr_percent;
        var okrScore = ratingObj.ratings[10];
        body += '<li style="margin:4px 0;">OKR % Completion: ' + (okrPct !== undefined && okrPct !== null ? okrPct + '% (' + Number(okrScore).toFixed(2) + ' / 5)' : 'N/A') + '</li>';
        body += '</ul>';
        if (ratingObj.justification) {
            body += '<p style="margin:14px 0 0;"><strong>Comments:</strong> ' + ratingObj.justification + '</p>';
        }
        // This email always goes to the employee about their own submission —
        // hideSensitive is always true here, not conditional on anything.
        body += emailInsightsHtml(insights, true);
        var selfTitle = ratingObj.reviewPeriod === PI_REVIEW_PERIOD ? 'Performance Incentive - Self-Assessment Report' : 'Self-Assessment Report';
        var html = emailWrapper(selfTitle, body);

        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_SELF, {
            to_email: toEmail,
            employee_name: ratingObj.employeeName,
            review_period: ratingObj.reviewPeriod,
            message_html: html
        }).then(function() {
            toast('Self-assessment report emailed to ' + toEmail, 'success');
        }, function(err) {
            console.error('EmailJS error:', err);
            toast('Could not send email. Please check EmailJS configuration.', 'error');
        });
    } catch(err) {
        console.error('sendSelfAssessmentEmail error:', err);
    }
}

// hideSensitive: true when toEmail belongs to the employee being rated — Keeper
// Test (retention score/verdict/comment) and Promotion Recommendation are internal
// leadership/HR signals, not feedback the employee should see about themselves.
function sendManagerRatingEmail(managerRating, selfAssessment, toEmail, insights, hideSensitive) {
    if (!isEmailJSConfigured()) {
        toast('EmailJS not configured. Comparison report not emailed.', 'warn');
        return;
    }
    try {
        var body = '<p style="margin:4px 0;"><strong>Employee:</strong> ' + managerRating.employeeName + '</p>';
        body += '<p style="margin:4px 0;"><strong>Review Period:</strong> ' + managerRating.reviewPeriod + '</p>';
        body += '<p style="margin:4px 0;"><strong>Manager:</strong> ' + managerRating.reviewerName + '</p>';

        // Self-assessment section
        body += emailSectionHeading('1. Employee Self-Assessment');
        if (selfAssessment) {
            body += emailScoreBox('Overall Self-Score', selfAssessment.overallScore.toFixed(2) + ' / 5.0');
            body += '<ul style="margin:0;padding-left:20px;color:#3a322a;">';
            var selfCats = ['Job Knowledge & Skills','Quality of Work','','Problem Solving & Initiative','Teamwork & Collaboration','AI Utilization','','Accountability, Efficiency & Competency'];
            selfCats.forEach(function(cat, i) {
                if (!cat) return;
                body += '<li style="margin:4px 0;">' + cat + ': ' + (selfAssessment.ratings[i] !== undefined ? Number(selfAssessment.ratings[i]).toFixed(1) : 'N/A') + '</li>';
            });
            // OKR
            var selfEmailOkr = selfAssessment.ratings.okr_percent;
            if (selfEmailOkr !== undefined && selfEmailOkr !== null) {
                body += '<li style="margin:4px 0;">OKR % Completion: ' + selfEmailOkr + '% (' + Number(selfAssessment.ratings[10]).toFixed(2) + ' / 5)</li>';
            }
            body += '</ul>';
        } else {
            body += '<p style="color:#6b6156;font-style:italic;">No self-assessment submitted.</p>';
        }

        // Manager rating section — 4 sections × 25%
        body += emailSectionHeading('2. Manager Rating');
        body += emailScoreBox('Overall Manager Score', managerRating.overallScore.toFixed(2) + ' / 5.0' + (managerRating.overallRating ? ' - ' + managerRating.overallRating : ''));
        body += '<ul style="margin:0;padding-left:20px;color:#3a322a;">';
        body += '<li style="margin:4px 0;">Accountability, Efficiency & Competency (avg): ' + (managerRating.ratings[2] !== undefined ? Number(managerRating.ratings[2]).toFixed(2) : 'N/A') + ' / 5</li>';
        body += '<li style="margin:4px 0;">AI Utilization (avg): ' + (managerRating.ratings[5] !== undefined ? Number(managerRating.ratings[5]).toFixed(2) : 'N/A') + ' / 5</li>';
        var mgrOkrPct = managerRating.ratings.okr_percent;
        body += '<li style="margin:4px 0;">OKR % Completion: ' + (mgrOkrPct !== undefined && mgrOkrPct !== null ? mgrOkrPct + '% (' + Number(managerRating.ratings[6]).toFixed(2) + ' / 5)' : 'N/A') + '</li>';
        if (!hideSensitive && managerRating.keeperTest && managerRating.keeperTest.responses) {
            var ktScore = managerRating.keeperTest.responses.kt_retention_score;
            body += '<li style="margin:4px 0;">Keeper Test Score: ' + (ktScore !== null && ktScore !== undefined ? ktScore + ' / 5' : 'N/A') + '</li>';
        }
        body += '</ul>';

        if (!hideSensitive && managerRating.promotionRecommendation) {
            body += '<p style="margin:14px 0 4px;"><strong>Promotion:</strong> ' + (managerRating.promotionRecommendation === 'yes' ? 'Recommended' : 'Not Recommended') + '</p>';
        }
        if (!hideSensitive && managerRating.keeperTest && managerRating.keeperTest.verdict) {
            var ktEmailScore = managerRating.keeperTest.responses ? managerRating.keeperTest.responses.kt_retention_score : null;
            body += '<p style="margin:4px 0;"><strong>Keeper Test Score:</strong> ' + (ktEmailScore !== null && ktEmailScore !== undefined ? ktEmailScore + ' / 5' : 'N/A') + '</p>';
            body += '<p style="margin:4px 0;"><strong>Keeper Verdict:</strong> ' + managerRating.keeperTest.verdict + '</p>';
        }
        if (managerRating.justification) {
            body += '<p style="margin:14px 0 0;"><strong>Remarks:</strong> ' + managerRating.justification + '</p>';
        }

        body += emailInsightsHtml(insights, hideSensitive);
        var mgrTitle = managerRating.reviewPeriod === PI_REVIEW_PERIOD ? 'Performance Incentive - Comparison Report' : 'Performance Review - Comparison Report';
        var html = emailWrapper(mgrTitle, body);

        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_MANAGER, {
            to_email: toEmail,
            employee_name: managerRating.employeeName,
            review_period: managerRating.reviewPeriod,
            message_html: html
        }).then(function() {
            toast('Comparison report emailed to ' + toEmail, 'success');
        }, function(err) {
            console.error('EmailJS error:', err);
            toast('Could not send email. Please check EmailJS configuration.', 'error');
        });
    } catch(err) {
        console.error('sendManagerRatingEmail error:', err);
    }
}

// (Final report email removed — not needed)

// ─── PI STAGE NOTIFICATIONS — lightweight nudges, not the full report ────
// Reuses the same EmailJS template/wrapper as the self/manager report emails
// above, just with a short status message instead of category breakdowns.
function sendPIStageEmail(toEmail, title, bodyHtml, employeeName) {
    if (!toEmail || !isEmailJSConfigured()) return;
    try {
        var html = emailWrapper(title, bodyHtml);
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_SELF, {
            to_email: toEmail,
            employee_name: employeeName,
            review_period: PI_REVIEW_PERIOD,
            message_html: html
        }).then(function() {}, function(err) {
            console.error('sendPIStageEmail error:', err);
        });
    } catch (err) {
        console.error('sendPIStageEmail error:', err);
    }
}

// Employee's manager isn't otherwise told a PI self-assessment came in — they'd
// only find out by opening the Manager Rating tab and checking. This nudges them.
function notifyManagerOfPISelfAssessment(emp) {
    var mgr = (emp.managerId && findEmployeeById(emp.managerId)) || (emp.manager && findEmployeeByName(emp.manager));
    if (!mgr || !mgr.email) return;
    var body = '<p style="margin:4px 0;"><strong>' + emp.name + '</strong> (' + emp.id + ') has submitted their Performance Incentive self-assessment.</p>'
        + '<p style="margin:14px 0 0;">Log in to the Performance Management System and open <strong>PI: Team Ratings</strong> to submit your rating for them.</p>';
    sendPIStageEmail(mgr.email, 'Action Needed: PI Self-Assessment Submitted', body, emp.name);
}

// Admin/HR isn't otherwise told anything happened in PI at all — they'd only find
// out by opening the admin dashboard. This gives them a running feed instead.
function notifyAdminOfPISubmission(employeeName, employeeId, stageLabel, score, reviewerName) {
    if (!PI_ADMIN_NOTIFY_EMAIL) return;
    var body = '<p style="margin:4px 0;"><strong>Employee:</strong> ' + employeeName + ' (' + employeeId + ')</p>'
        + '<p style="margin:4px 0;"><strong>Stage:</strong> ' + stageLabel + '</p>'
        + (reviewerName ? '<p style="margin:4px 0;"><strong>Submitted by:</strong> ' + reviewerName + '</p>' : '')
        + '<p style="margin:4px 0;"><strong>Score:</strong> ' + score.toFixed(2) + ' / 5.0</p>'
        + '<p style="margin:14px 0 0;">See the PI report on the admin Dashboard for full status across all eligible employees.</p>';
    sendPIStageEmail(PI_ADMIN_NOTIFY_EMAIL, 'PI Submission: ' + employeeName, body, employeeName);
}

// ─── EMAIL TO MANAGER (legacy mailto) ────────────────────────────
async function emailToManager(ratingId, employeeName, reviewerName) {
    // Now uses EmailJS instead of mailto
    var rating = ratingsCache.find(function(r){ return r.id === ratingId; });
    if (!rating) { toast('Rating not found.', 'warn'); return; }

    var mgrEmp = findEmployeeByName(reviewerName);
    if (mgrEmp && isEmailJSConfigured()) {
        var selfAssessment = null;
        try {
            var data = await sbSelect('is_self_assessment=eq.true&employee_name=eq.' + encodeURIComponent(employeeName) + '&review_period=eq.' + encodeURIComponent(rating.reviewPeriod));
            if (data && data.length > 0) selfAssessment = normalizeRating(data[0]);
        } catch(e) {}
        var insights = rating.employeeId ? await fetchEmployeeInsights(rating.employeeId) : [];
        sendManagerRatingEmail(rating, selfAssessment, mgrEmp.email, insights);
    } else {
        // Fallback to mailto
        var subject = 'Performance Review Summary - ' + employeeName;
        var body = 'Performance review summary for ' + employeeName + ' (' + rating.reviewPeriod + ').\n\nOverall Score: ' + rating.overallScore.toFixed(2);
        window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        toast('Email client opened.', 'success');
    }
}

// ─── ADMIN DATA ───────────────────────────────────────────────────
// "Promotion Ready" = distinct employees whose LATEST manager rating
// explicitly recommends promotion (promotion_recommendation === 'yes').
// Previously this counted every row scoring >=3.5, which double-counted
// people with multiple ratings (self-assessment + manager, or several
// cycles) and never actually checked the manager's promotion answer —
// e.g. it showed 124 against a ~69-person rated roster. This version
// dedupes to one (most recent) manager rating per employee and only
// counts an explicit "yes".
function countPromotionReady(all) {
    var latestByEmployee = {};
    all.forEach(function(r) {
        if (r.isSelfAssessment) return;
        var key = r.employeeId || r.employeeName;
        if (!key) return;
        if (!latestByEmployee[key] || new Date(r.timestamp) > new Date(latestByEmployee[key].timestamp)) {
            latestByEmployee[key] = r;
        }
    });
    return Object.values(latestByEmployee).filter(function(r) { return r.promotionRecommendation === 'yes'; }).length;
}

async function loadAdminData() {
    renderOrgChart();
    document.getElementById('ratingsList').innerHTML =
        '<p style="text-align:center;color:var(--gray-medium);padding:2rem;">Loading...</p>';
    try {
        var rows = await sbSelect('select=*');
        var all  = rows.map(normalizeRating);
        ratingsCache = all;

        animateCount(document.getElementById('totalRatings'), all.length, 0);
        if (all.length > 0) {
            var avg = all.reduce(function(s,r){ return s + r.overallScore; }, 0) / all.length;
            animateCount(document.getElementById('avgScore'), avg, 1);
            animateCount(document.getElementById('promotionReady'), countPromotionReady(all), 0);
            animateCount(document.getElementById('pendingReviews'), all.filter(function(r){ return !r.isSelfAssessment && (!r.managementDecision || !r.managementDecision.finalDecision); }).length, 0);
        } else {
            animateCount(document.getElementById('avgScore'), 0, 1);
            animateCount(document.getElementById('promotionReady'), 0, 0);
            animateCount(document.getElementById('pendingReviews'), 0, 0);
        }
        populateRatingsCycleFilter();
        filterRatingsList();
        populateBoxManagerFilter();
        renderNineBox();
        renderInsights();
    } catch(err) {
        console.error('loadAdminData:', err);
        document.getElementById('ratingsList').innerHTML =
            '<p style="text-align:center;color:var(--danger);padding:2rem;">Warning: ' + (err.message || 'Failed to load data.') + '</p>';
    }
}

// ─── ORGANIZATION CHART (admin dashboard) ────────────────────────
// Builds parent→children groupings from EMPLOYEES. When an employee's manager
// is excluded by a filter (wrong company, or inactive with "show inactive" off),
// walk up the real (unfiltered) chain to the nearest included ancestor instead
// of dropping them or leaving them orphaned.
function buildOrgTree(companyFilter, includeInactive) {
    var fullById = {};
    EMPLOYEES.forEach(function(e) { fullById[e.id] = e; });

    var pool = EMPLOYEES.filter(function(e) {
        if (companyFilter !== 'all' && e.company !== companyFilter) return false;
        if (!includeInactive && e.status === 'inactive') return false;
        return true;
    });
    var poolIds = {};
    pool.forEach(function(e) { poolIds[e.id] = true; });

    var childrenOf = {};
    var roots = [];
    pool.forEach(function(e) {
        var mgrId = e.managerId;
        while (mgrId && !poolIds[mgrId]) {
            var mgr = fullById[mgrId];
            mgrId = mgr ? mgr.managerId : null;
        }
        if (mgrId && poolIds[mgrId]) {
            (childrenOf[mgrId] = childrenOf[mgrId] || []).push(e);
        } else {
            roots.push(e);
        }
    });

    function byName(a, b) { return a.name.localeCompare(b.name); }
    roots.sort(byName);
    Object.keys(childrenOf).forEach(function(k) { childrenOf[k].sort(byName); });

    return { roots: roots, childrenOf: childrenOf, total: pool.length };
}

// Returns true if this employee or anyone in their subtree matches the search query.
function orgSubtreeMatches(emp, childrenOf, query) {
    if (!query) return false;
    var haystack = (emp.name + ' ' + emp.id + ' ' + emp.designation).toLowerCase();
    if (haystack.indexOf(query) !== -1) return true;
    var kids = childrenOf[emp.id] || [];
    for (var i = 0; i < kids.length; i++) {
        if (orgSubtreeMatches(kids[i], childrenOf, query)) return true;
    }
    return false;
}

function orgHighlight(text, query) {
    if (!query) return text;
    var idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;
    return text.slice(0, idx) + '<mark>' + text.slice(idx, idx + query.length) + '</mark>' + text.slice(idx + query.length);
}

var ORG_COMPANY_LABELS = { acme: 'Acme', nova: 'Nova' }; // sample sub-brand labels — match the `company` field in js/employees.js

function renderOrgNode(emp, childrenOf, query, depth, showCompanyBadge) {
    var kids = childrenOf[emp.id] || [];
    var isMatch = query && (emp.name + ' ' + emp.id + ' ' + emp.designation).toLowerCase().indexOf(query) !== -1;
    var nameHtml = orgHighlight(emp.name, query);
    var designationHtml = orgHighlight(emp.designation, query);

    var badges = '';
    if (emp.status === 'inactive') badges += ' <span class="org-badge org-badge-inactive">Inactive</span>';
    if (showCompanyBadge && emp.company) badges += ' <span class="org-badge org-badge-company org-badge-' + emp.company + '">' + (ORG_COMPANY_LABELS[emp.company] || emp.company) + '</span>';

    var label = '<span class="org-node-name' + (isMatch ? ' org-node-match' : '') + '">' + nameHtml + '</span>'
        + ' <span class="org-node-id">(' + emp.id + ')</span>'
        + ' &mdash; <span class="org-node-designation">' + designationHtml + '</span>'
        + badges;

    if (kids.length === 0) {
        return '<div class="org-leaf">' + label + '</div>';
    }

    var childrenHtml = kids.map(function(k) { return renderOrgNode(k, childrenOf, query, depth + 1, showCompanyBadge); }).join('');
    var hasMatchBelow = query && orgSubtreeMatches(emp, childrenOf, query);
    var shouldOpen = query ? hasMatchBelow : depth < 1;

    return '<details class="org-node"' + (shouldOpen ? ' open' : '') + '>'
        + '<summary>' + label + ' <span class="org-report-count">(' + kids.length + ' direct report' + (kids.length !== 1 ? 's' : '') + ')</span></summary>'
        + '<div class="org-children">' + childrenHtml + '</div>'
        + '</details>';
}

function renderOrgChart() {
    var container = document.getElementById('orgChartContainer');
    var countEl = document.getElementById('orgChartCount');
    if (!container) return;

    var companyFilter = document.getElementById('orgChartCompanyFilter').value;
    var includeInactive = document.getElementById('orgChartShowInactive').checked;
    var query = (document.getElementById('orgChartSearch').value || '').toLowerCase().trim();

    var tree = buildOrgTree(companyFilter, includeInactive);
    var showCompanyBadge = companyFilter === 'all';

    var visibleRoots = query
        ? tree.roots.filter(function(r) { return orgSubtreeMatches(r, tree.childrenOf, query) || (r.name + ' ' + r.id + ' ' + r.designation).toLowerCase().indexOf(query) !== -1; })
        : tree.roots;

    countEl.textContent = tree.total + ' employee' + (tree.total !== 1 ? 's' : '') + (companyFilter !== 'all' ? ' in ' + (ORG_COMPANY_LABELS[companyFilter] || companyFilter) : '') + (includeInactive ? ' (including inactive)' : '');

    if (visibleRoots.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-medium);padding:1rem;">No matching employees found.</p>';
        return;
    }

    container.innerHTML = visibleRoots.map(function(r) { return renderOrgNode(r, tree.childrenOf, query, 0, showCompanyBadge); }).join('');
}

// ─── 9-BOX TALENT MATRIX (admin-only) ────────────────────────────
// Performance axis = each rating's overall_score (already computed every cycle).
// Potential axis = the `potential` field captured on the Manager Rating form
// (Phase 3) — only ratings submitted since that field exists carry it, so this
// grid starts sparse and fills in cycle by cycle as new ratings come in.
//
// "Cycle" also offers a read-only imported snapshot (NINEBOX_SNAPSHOT_2026_04,
// from js/nineboxSnapshot.js) for the April 2026 offline exercise that predates
// the Potential field. That data is never written to Supabase and never mixed
// into ratingsCache — it only feeds this view when explicitly selected.
var boxView  = 'grid';
var boxCycle = 'live';
var lastNineBoxPool = []; // set by renderNineBox(); lets a clicked cell re-filter without recomputing the pool
// "moderate" is an alias for "medium" — the manually-imported April 2026
// 9-Box snapshot (nineboxSnapshot.js) uses that word for both axes, and
// without this alias every entry using it silently vanished from every
// grid cell (BOX_POT_RANK[e.performance]/[e.potential] came back
// undefined, which never equals a numeric row/column index).
var BOX_POT_RANK   = { low: 0, medium: 1, moderate: 1, high: 2 };
var BOX_POT_LABEL  = ['Low', 'Medium', 'High'];
// [potential][performance], both 0=Low/1=Medium/2=High. The low- and
// medium-potential rows were swapped: "Core Player" (the archetypal solid,
// dependable contributor) belongs at medium potential + medium performance
// — the grid's center cell — not at low potential. Confirmed the swap
// against Rithuparna Ghosh / Shakshi Das in the imported April 2026
// snapshot: both are recorded as low potential + moderate performance,
// which the old table mislabeled "Core Player" and now correctly reads
// "Average Performer".
var BOX_CELL_META  = [
    [{ name: 'Risk / Underperformer', tier: 'tier-risk' }, { name: 'Average Performer',   tier: '' },          { name: 'Solid Performer',      tier: '' }],
    [{ name: 'Inconsistent Player',   tier: 'tier-risk' }, { name: 'Core Player',        tier: '' },          { name: 'High Performer',       tier: '' }],
    [{ name: 'Enigma',                tier: '' },          { name: 'High Potential',      tier: 'tier-star' }, { name: 'Star / Top Talent',    tier: 'tier-star' }]
];

function perfTier(score) {
    if (score >= 3.5) return 2; // High
    if (score >= 2.5) return 1; // Medium
    return 0; // Low
}

function onBoxCycleChange() {
    boxCycle = document.getElementById('boxCycleFilter').value;
    var isLive = boxCycle === 'live';
    document.getElementById('boxCompanyFilterWrap').style.display = isLive ? '' : 'none';
    document.getElementById('boxManagerFilterWrap').style.display = isLive ? '' : 'none';
    renderNineBox();
}

function onBoxCompanyChange() {
    populateBoxManagerFilter();
    renderNineBox();
}

function populateBoxManagerFilter() {
    var sel = document.getElementById('boxManagerFilter');
    if (!sel) return;
    var companyFilter = document.getElementById('boxCompanyFilter').value;
    var prevValue = sel.value;
    var managers = EMPLOYEES.filter(function(e) {
        if (e.status === 'inactive') return false;
        if (companyFilter !== 'all' && e.company !== companyFilter) return false;
        return getDirectReports(e.name).length > 0;
    }).sort(function(a, b) { return a.name.localeCompare(b.name); });

    sel.innerHTML = '<option value="all">All Managers</option>' +
        managers.map(function(m) { return '<option value="' + m.name + '">' + m.name + '</option>'; }).join('');
    if (managers.some(function(m) { return m.name === prevValue; })) sel.value = prevValue;
}

function setBoxView(view) {
    boxView = view;
    document.getElementById('boxViewGridBtn').className = 'btn btn-sm ' + (view === 'grid' ? 'btn-primary' : 'btn-secondary');
    document.getElementById('boxViewPotentialBtn').className = 'btn btn-sm ' + (view === 'potential' ? 'btn-primary' : 'btn-secondary');
    document.getElementById('boxGridView').style.display = view === 'grid' ? '' : 'none';
    document.getElementById('boxPotentialView').style.display = view === 'potential' ? '' : 'none';
    renderNineBox();
}

// Reduce ratingsCache to one placement per employee (their latest manager
// rating that carries a potential value), scoped by company/manager filters.
function computeNineBoxPoolLive() {
    var companyFilter = document.getElementById('boxCompanyFilter').value;
    var managerFilter = document.getElementById('boxManagerFilter').value;

    var latestByEmployee = {};
    ratingsCache.forEach(function(r) {
        if (r.isSelfAssessment || !r.potential) return;
        var key = r.employeeId || r.employeeName;
        if (!key) return;
        if (!latestByEmployee[key] || new Date(r.timestamp) > new Date(latestByEmployee[key].timestamp)) {
            latestByEmployee[key] = r;
        }
    });

    var pool = [];
    Object.keys(latestByEmployee).forEach(function(key) {
        var r = latestByEmployee[key];
        var emp = findEmployeeById(r.employeeId) || findEmployeeByName(r.employeeName);
        if (companyFilter !== 'all' && (!emp || emp.company !== companyFilter)) return;
        if (managerFilter !== 'all' && r.reviewerName !== managerFilter) return;
        pool.push({
            name: r.employeeName,
            id: r.employeeId,
            perf: perfTier(r.overallScore),
            pot: BOX_POT_RANK[r.potential],
            score: r.overallScore,
            manager: r.reviewerName,
            exited: !!(emp && emp.status === 'inactive')
        });
    });
    return pool;
}

// Read-only: builds the pool from the imported April 2026 snapshot instead of
// live ratings. Unmatched names (couldn't be linked to an EMPLOYEES record)
// are surfaced separately via #boxUnmatchedNote rather than silently dropped.
function computeNineBoxPoolSnapshot(snapshot) {
    var pool = snapshot.entries.map(function(e) {
        var emp = findEmployeeById(e.employeeId);
        return {
            name: e.name,
            id: e.employeeId,
            perf: BOX_POT_RANK[e.performance],
            pot: BOX_POT_RANK[e.potential],
            score: null,
            manager: e.manager,
            exited: !!(emp && emp.status === 'inactive')
        };
    });
    var noteEl = document.getElementById('boxUnmatchedNote');
    if (noteEl) {
        if (snapshot.unmatched && snapshot.unmatched.length > 0) {
            noteEl.style.display = 'block';
            noteEl.textContent = snapshot.unmatched.length + ' name(s) from the imported file could not be matched to the employee directory and are not shown in the grid: '
                + snapshot.unmatched.map(function(u) { return u.name + ' (reports to ' + u.manager + ')'; }).join(', ') + '.';
        } else {
            noteEl.style.display = 'none';
        }
    }
    return pool;
}

function currentNineBoxSnapshot() {
    return boxCycle === '2026-04' ? NINEBOX_SNAPSHOT_2026_04 : null;
}

function computeNineBoxPool() {
    var snapshot = currentNineBoxSnapshot();
    if (snapshot) return computeNineBoxPoolSnapshot(snapshot);
    var noteEl = document.getElementById('boxUnmatchedNote');
    if (noteEl) noteEl.style.display = 'none';
    return computeNineBoxPoolLive();
}

function renderNineBox() {
    if (!document.getElementById('boxMatrixGrid')) return; // not logged in as admin yet
    var pool = computeNineBoxPool();
    var isLive = boxCycle === 'live';
    var companyFilter = isLive ? document.getElementById('boxCompanyFilter').value : 'all';
    var managerFilter = isLive ? document.getElementById('boxManagerFilter').value : 'all';

    var scopeBits = [];
    if (companyFilter !== 'all') scopeBits.push(ORG_COMPANY_LABELS[companyFilter] || companyFilter);
    if (managerFilter !== 'all') scopeBits.push('reporting to ' + managerFilter);
    document.getElementById('boxScopeNote').textContent =
        (scopeBits.length ? scopeBits.join(' · ') + ' — ' : '') + pool.length + ' placed'
        + (pool.length === 0 && isLive ? ' — no ratings with a Potential value yet in this scope.' : '');

    if (boxView === 'potential') { renderNineBoxPotentialView(pool); return; }

    lastNineBoxPool = pool; // so a clicked cell can re-filter without recomputing the pool

    var grid = document.getElementById('boxMatrixGrid');
    var html = '';
    for (var pot = 2; pot >= 0; pot--) {
        for (var perf = 0; perf <= 2; perf++) {
            var meta = BOX_CELL_META[pot][perf];
            var people = pool.filter(function(t) { return t.perf === perf && t.pot === pot; });
            var clickAttr = people.length > 0 ? ' onclick="openBoxCellModal(' + pot + ',' + perf + ')"' : '';
            html += '<div class="ninebox-cell ' + (meta.tier || 'box-cell') + (people.length > 0 ? ' ninebox-cell-clickable' : '') + '"' + clickAttr + ' style="border:1px solid var(--hc-light-gray);border-radius:10px;padding:0.6rem;min-height:110px;background:' + (meta.tier === 'tier-star' ? 'var(--purple-light)' : meta.tier === 'tier-risk' ? '#fdf0ee' : '#fff') + ';">'
                + '<div style="font-size:0.75rem;font-weight:700;color:var(--hc-mid-grey);margin-bottom:0.4rem;">' + meta.name + '</div>'
                + (people.length === 0
                    ? '<div style="font-size:0.75rem;color:var(--hc-light-gray);">—</div>'
                    : people.slice(0, 4).map(function(p) {
                        return '<div style="font-size:0.8rem;padding:0.15rem 0;">' + p.name + ' <span style="color:var(--hc-mid-grey);">(' + (p.id || '—') + ')</span>'
                            + (p.exited ? ' <span class="org-badge org-badge-inactive">Exited</span>' : '') + '</div>';
                    }).join('') + (people.length > 4 ? '<div style="font-size:0.75rem;color:var(--hc-teal-dark);font-weight:600;margin-top:0.2rem;">+' + (people.length - 4) + ' more — click to see all</div>' : ''))
                + '</div>';
        }
    }
    grid.innerHTML = html;
}

function renderNineBoxPotentialView(pool) {
    var cols = { 2: document.getElementById('boxPotHigh'), 1: document.getElementById('boxPotMed'), 0: document.getElementById('boxPotLow') };
    [2, 1, 0].forEach(function(potLevel) {
        var people = pool.filter(function(t) { return t.pot === potLevel; }).sort(function(a, b) { return b.perf - a.perf; });
        var el = cols[potLevel];
        if (!el) return;
        el.innerHTML = people.length === 0
            ? '<p style="font-size:0.8rem;color:var(--gray-medium);">No one placed here yet.</p>'
            : people.map(function(p) {
                return '<div style="border:1px solid var(--hc-light-gray);border-radius:8px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;">'
                    + '<div style="font-size:0.85rem;font-weight:600;">' + p.name + ' <span style="color:var(--hc-mid-grey);font-weight:400;">(' + (p.id || '—') + ')</span>'
                    + (p.exited ? ' <span class="org-badge org-badge-inactive">Exited</span>' : '') + '</div>'
                    + '<div style="font-size:0.75rem;color:var(--hc-mid-grey);">' + PERF_LABEL_BOX[p.perf] + ' Performance'
                    + (p.score !== null ? ' · Score ' + p.score.toFixed(1) : '') + '</div>'
                    + '</div>';
            }).join('');
    });
}
var PERF_LABEL_BOX = ['Low', 'Medium', 'High'];

// Opens the full name list for one 9-Box cell — every cell with at least
// one person is clickable (see renderNineBox()), since a cell only shows
// its first 4 names inline and truncates the rest behind "click to see all".
// Reuses the existing modal chrome (.modal/.modal-content/.modal-header)
// and the same person-card style already used by the By Potential view,
// so it looks like the rest of the app rather than a one-off widget.
function openBoxCellModal(pot, perf) {
    var meta = BOX_CELL_META[pot][perf];
    var people = lastNineBoxPool.filter(function(t) { return t.perf === perf && t.pot === pot; });
    document.getElementById('boxCellModalTitle').textContent =
        meta.name + ' — ' + BOX_POT_LABEL[pot] + ' Potential / ' + PERF_LABEL_BOX[perf] + ' Performance (' + people.length + ')';
    document.getElementById('boxCellModalContent').innerHTML = people.map(function(p) {
        return '<div style="border:1px solid var(--hc-hairline);border-radius:8px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;">'
            + '<div style="font-size:0.85rem;font-weight:600;">' + p.name + ' <span style="color:var(--hc-mid-grey);font-weight:400;">(' + (p.id || '—') + ')</span>'
            + (p.exited ? ' <span class="org-badge org-badge-inactive">Exited</span>' : '') + '</div>'
            + (p.manager || p.score !== null
                ? '<div style="font-size:0.75rem;color:var(--hc-mid-grey);">' + (p.manager ? 'Manager: ' + p.manager : '') + (p.manager && p.score !== null ? ' · ' : '') + (p.score !== null ? 'Score ' + p.score.toFixed(1) : '') + '</div>'
                : '')
            + '</div>';
    }).join('');
    document.getElementById('boxCellModal').classList.add('active');
}

function closeBoxCellModal() {
    document.getElementById('boxCellModal').classList.remove('active');
}

// ─── 9-BOX CSV DOWNLOAD ───────────────────────────────────────────
function downloadNineBoxCSV() {
    var pool = computeNineBoxPool();
    if (pool.length === 0) { toast('Nothing to download in this scope.', 'warn'); return; }
    var cycleLabel = boxCycle === 'live' ? 'Live' : (currentNineBoxSnapshot() || {}).label || boxCycle;
    var headers = ['Employee ID', 'Employee Name', 'Manager', 'Performance', 'Potential', 'Score', 'Exited'];
    var rows = pool.map(function(p) {
        return [
            p.id || '', p.name, p.manager || '', PERF_LABEL_BOX[p.perf], PERF_LABEL_BOX[p.pot],
            p.score !== null ? p.score.toFixed(1) : '', p.exited ? 'Yes' : ''
        ].map(function(c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
    });
    var csv = '"9-Box Matrix — ' + cycleLabel + '"\n' + headers.map(function(h){ return '"'+h+'"'; }).join(',') + '\n' + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '9box-matrix-' + boxCycle + '-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── INSIGHTS (admin-only, rule-based — no external AI model) ────
// Every insight here is a plain threshold/aggregate computed over
// ratingsCache, which loadAdminData() already loads unchanged. Nothing
// is written anywhere; this is a read-only summary layer.
//
// Sample-size guards are deliberate: a claim about "the team average"
// or "this cycle's risk count" from a handful of ratings is misleading,
// so those cards are simply omitted until there's enough data to say
// something real. Cards that DO render always show the underlying
// numbers, not just a sentence, so nothing here is a black box.
var INSIGHT_MIN_PERIOD_SAMPLE = 3;   // minimum ratings in a review period before we'll compare it
var INSIGHT_DECLINE_THRESHOLD = 0.3; // minimum score drop (out of 5) to flag an individual decline

function avgOf(nums) {
    if (!nums.length) return null;
    return nums.reduce(function(a, b) { return a + b; }, 0) / nums.length;
}

function ratingSortDate(r) {
    var d = new Date(r.ratingDate || r.timestamp);
    return isNaN(d.getTime()) ? null : d;
}

// Orders distinct review periods chronologically by the average rating
// date within each — robust to review_period being a free-text label
// rather than a strictly sortable value.
function orderReviewPeriods(mgrRatings) {
    var byPeriod = {};
    mgrRatings.forEach(function(r) {
        var d = ratingSortDate(r);
        if (!d || !r.reviewPeriod) return;
        (byPeriod[r.reviewPeriod] = byPeriod[r.reviewPeriod] || []).push(d.getTime());
    });
    return Object.keys(byPeriod).map(function(p) {
        var dates = byPeriod[p];
        return { period: p, avgDate: avgOf(dates), count: dates.length };
    }).sort(function(a, b) { return a.avgDate - b.avgDate; });
}

function computeInsights() {
    var insights = [];
    var mgrRatings = (ratingsCache || []).filter(function(r) { return !r.isSelfAssessment; });
    if (mgrRatings.length === 0) return insights;

    var periodOrder = orderReviewPeriods(mgrRatings);
    var latest = periodOrder[periodOrder.length - 1];
    var prevPeriod = periodOrder.length > 1 ? periodOrder[periodOrder.length - 2] : null;
    var latestRatings = latest ? mgrRatings.filter(function(r) { return r.reviewPeriod === latest.period; }) : [];
    var prevRatings = prevPeriod ? mgrRatings.filter(function(r) { return r.reviewPeriod === prevPeriod.period; }) : [];

    // 1. Cycle-over-cycle average score movement (needs both periods well-sampled)
    if (latest && prevPeriod && latest.count >= INSIGHT_MIN_PERIOD_SAMPLE && prevPeriod.count >= INSIGHT_MIN_PERIOD_SAMPLE) {
        var latestAvg = avgOf(latestRatings.map(function(r) { return r.overallScore; }));
        var prevAvg = avgOf(prevRatings.map(function(r) { return r.overallScore; }));
        var delta = latestAvg - prevAvg;
        if (Math.abs(delta) >= 0.05) {
            insights.push({
                type: delta > 0 ? 'good' : 'warn',
                title: 'Average score ' + (delta > 0 ? 'up' : 'down') + ' this cycle',
                detail: '"' + latest.period + '" averaged ' + latestAvg.toFixed(2) + ' vs ' + prevAvg.toFixed(2) + ' in "' + prevPeriod.period + '" ('
                    + (delta > 0 ? '+' : '') + delta.toFixed(2) + '), across ' + latest.count + ' and ' + prevPeriod.count + ' ratings respectively.'
            });
        }
    }

    // 2. Keeper Test risk count in the latest well-sampled cycle
    if (latest && latest.count >= INSIGHT_MIN_PERIOD_SAMPLE) {
        var riskRatings = latestRatings.filter(function(r) {
            var s = r.keeperTest && r.keeperTest.responses ? r.keeperTest.responses.kt_retention_score : null;
            return s === 0 || s === 2;
        });
        if (riskRatings.length > 0) {
            var pct = Math.round((riskRatings.length / latest.count) * 100);
            insights.push({
                type: riskRatings.length / latest.count >= 0.15 ? 'risk' : 'warn',
                title: riskRatings.length + ' Keeper Test flag' + (riskRatings.length !== 1 ? 's' : '') + ' this cycle',
                detail: riskRatings.length + ' of ' + latest.count + ' ratings (' + pct + '%) in "' + latest.period + '" scored 0 (Plan Exit) or 2 (Would Not Fight to Retain) on the Keeper Test.'
            });
        }
    }

    // 3. Promotion-ready trend (same >=3.5 threshold as the "Promotion Ready" stat card)
    if (latest && prevPeriod && latest.count >= INSIGHT_MIN_PERIOD_SAMPLE && prevPeriod.count >= INSIGHT_MIN_PERIOD_SAMPLE) {
        var latestReady = latestRatings.filter(function(r) { return r.overallScore >= 3.5; }).length;
        var prevReady = prevRatings.filter(function(r) { return r.overallScore >= 3.5; }).length;
        var latestPct = Math.round((latestReady / latest.count) * 100);
        var prevPct = Math.round((prevReady / prevPeriod.count) * 100);
        if (latestPct !== prevPct) {
            insights.push({
                type: latestPct > prevPct ? 'good' : 'info',
                title: 'Promotion-ready share ' + (latestPct > prevPct ? 'grew' : 'shrank') + ' to ' + latestPct + '%',
                detail: latestReady + ' of ' + latest.count + ' (' + latestPct + '%) scored 3.5+ in "' + latest.period + '", vs ' + prevReady + ' of ' + prevPeriod.count + ' (' + prevPct + '%) in "' + prevPeriod.period + '".'
            });
        }
    }

    // 4. Individual score declines — each person's own two most recent distinct-period
    // ratings, regardless of which global cycle they fall in (some people are rated
    // less often than others). A minimum drop of INSIGHT_DECLINE_THRESHOLD filters
    // out normal fluctuation.
    var byEmployee = {};
    mgrRatings.forEach(function(r) {
        var key = r.employeeId || r.employeeName;
        var d = ratingSortDate(r);
        if (!key || !d || !r.reviewPeriod) return;
        (byEmployee[key] = byEmployee[key] || {})[r.reviewPeriod] = { r: r, d: d };
    });
    var decliners = [];
    Object.keys(byEmployee).forEach(function(key) {
        var periods = Object.values(byEmployee[key]).sort(function(a, b) { return a.d - b.d; });
        if (periods.length < 2) return;
        var last = periods[periods.length - 1];
        var prior = periods[periods.length - 2];
        var delta = last.r.overallScore - prior.r.overallScore;
        if (delta <= -INSIGHT_DECLINE_THRESHOLD) {
            decliners.push({ name: last.r.employeeName, id: last.r.employeeId, from: prior.r.overallScore, to: last.r.overallScore, delta: delta });
        }
    });
    if (decliners.length > 0) {
        decliners.sort(function(a, b) { return a.delta - b.delta; }); // largest decline first
        var shown = decliners.slice(0, 6);
        insights.push({
            type: 'risk',
            title: decliners.length + ' employee' + (decliners.length !== 1 ? 's' : '') + ' declined ' + INSIGHT_DECLINE_THRESHOLD.toFixed(1) + '+ points cycle-over-cycle',
            detail: shown.map(function(d) {
                return d.name + ' (' + (d.id || '—') + '): ' + d.from.toFixed(1) + ' → ' + d.to.toFixed(1);
            }).join('; ') + (decliners.length > shown.length ? '; +' + (decliners.length - shown.length) + ' more' : '') + '.'
        });
    }

    return insights;
}

// Shared markup for a list of {type, title, detail} insight objects —
// used by both the dashboard-level Insights card and the per-employee
// profile's insights section, so the two never drift apart visually.
function insightCardsHTML(insights) {
    var typeColor = { risk: 'var(--hc-error)', warn: 'var(--hc-warning)', good: 'var(--hc-teal-dark)', info: 'var(--hc-mid-grey)' };
    return insights.map(function(i) {
        return '<div style="display:flex;gap:0.75rem;padding:0.85rem 0;border-bottom:1px solid var(--hc-hairline);">'
            + '<div style="width:8px;border-radius:4px;background:' + (typeColor[i.type] || 'var(--hc-mid-grey)') + ';flex-shrink:0;"></div>'
            + '<div><div style="font-weight:700;font-size:0.9rem;margin-bottom:0.2rem;">' + i.title + '</div>'
            + '<div style="font-size:0.82rem;color:var(--hc-mid-grey);">' + i.detail + '</div></div>'
            + '</div>';
    }).join('');
}

function renderInsights() {
    var container = document.getElementById('insightsList');
    if (!container) return; // not on the admin dashboard
    var insights = computeInsights();
    if (insights.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-medium);padding:0.5rem 0;">Not enough data yet for a reliable insight — needs at least ' + INSIGHT_MIN_PERIOD_SAMPLE + ' ratings in two comparable review periods, or a clear individual score drop.</p>';
        return;
    }
    container.innerHTML = insightCardsHTML(insights);
}

// Per-employee insights — same rule-based approach as the dashboard-level
// Insights card (no external AI model), scoped to one person's own rating
// history. Unlike the dashboard version there's no minimum-sample-size
// gate on the score trend, because it's describing this specific person's
// own two most recent ratings, not claiming anything about a population.
// sourceRatings: optional — pass an explicit array of normalized ratings when
// ratingsCache isn't populated (it's only ever loaded behind admin login, but
// this is also called right after a self-assessment/manager-rating submission
// by an ordinary SSO-logged-in user, to build the emailed report's insights).
function computeEmployeeInsights(employeeId, sourceRatings) {
    var insights = [];
    var mine = (sourceRatings || ratingsCache || []).filter(function(r) { return r.employeeId === employeeId; });
    var mgr = mine.filter(function(r) { return !r.isSelfAssessment; }).sort(function(a, b) { return ratingSortDate(a) - ratingSortDate(b); });
    var self_ = mine.filter(function(r) { return r.isSelfAssessment; }).sort(function(a, b) { return ratingSortDate(a) - ratingSortDate(b); });

    // 1. Score trend across this person's own manager ratings
    if (mgr.length >= 2) {
        var last = mgr[mgr.length - 1], prior = mgr[mgr.length - 2];
        var delta = last.overallScore - prior.overallScore;
        if (Math.abs(delta) >= 0.05) {
            insights.push({
                type: delta > 0 ? 'good' : (delta <= -INSIGHT_DECLINE_THRESHOLD ? 'risk' : 'warn'),
                title: 'Score ' + (delta > 0 ? 'improved' : 'declined') + ' ' + Math.abs(delta).toFixed(2) + ' pts',
                detail: prior.reviewPeriod + ': ' + prior.overallScore.toFixed(1) + ' → ' + last.reviewPeriod + ': ' + last.overallScore.toFixed(1) + '.'
            });
        }
    }

    // 2. Self vs manager gap, most recent cycle where both exist
    var latestMgr = mgr[mgr.length - 1];
    if (latestMgr) {
        var counterpart = self_.filter(function(r) { return r.reviewPeriod === latestMgr.reviewPeriod; })[0];
        if (counterpart) {
            var gap = counterpart.overallScore - latestMgr.overallScore;
            if (Math.abs(gap) >= 0.3) {
                insights.push({
                    type: 'info',
                    title: gap > 0 ? 'Self-assessment higher than manager rating' : 'Self-assessment lower than manager rating',
                    detail: '"' + latestMgr.reviewPeriod + '": self-rated ' + counterpart.overallScore.toFixed(1) + ' vs manager-rated ' + latestMgr.overallScore.toFixed(1) + ' (' + (gap > 0 ? '+' : '') + gap.toFixed(1) + ').'
                });
            }
        }
    }

    // 3. Keeper Test status (latest manager rating only)
    // sensitive: true — internal retention signal, must never reach the rated
    // employee (emailInsightsHtml filters these out of the employee's copy).
    if (latestMgr && latestMgr.keeperTest && latestMgr.keeperTest.responses) {
        var kt = latestMgr.keeperTest.responses.kt_retention_score;
        if (kt === 0 || kt === 2) {
            insights.push({
                type: 'risk',
                sensitive: true,
                title: 'Keeper Test flagged this cycle',
                detail: '"' + latestMgr.reviewPeriod + '": scored ' + kt + ' (' + (kt === 0 ? 'Plan Exit' : 'Would Not Fight to Retain') + ') — verdict: ' + (latestMgr.keeperTest.verdict || 'n/a').replace(/_/g, ' ') + '.'
            });
        } else if (kt === 4 || kt === 5) {
            insights.push({
                type: 'good',
                sensitive: true,
                title: 'Keeper Test strong this cycle',
                detail: '"' + latestMgr.reviewPeriod + '": scored ' + kt + ' — verdict: ' + (latestMgr.keeperTest.verdict || 'n/a').replace(/_/g, ' ') + '.'
            });
        }
    }

    // 4. Potential / 9-Box position (latest manager rating only, if set)
    // sensitive: true — same reasoning as Keeper Test above.
    if (latestMgr && latestMgr.potential) {
        var meta = BOX_CELL_META[BOX_POT_RANK[latestMgr.potential]][perfTier(latestMgr.overallScore)];
        insights.push({
            type: 'info',
            sensitive: true,
            title: '9-Box: ' + meta.name,
            detail: PERF_LABEL_BOX[perfTier(latestMgr.overallScore)] + ' Performance / ' + BOX_POT_LABEL[BOX_POT_RANK[latestMgr.potential]] + ' Potential, from "' + latestMgr.reviewPeriod + '".'
        });
    }

    // 5. Promotion recommendation, latest manager rating only
    // sensitive: true — same reasoning as Keeper Test above.
    if (latestMgr && latestMgr.promotionRecommendation) {
        insights.push({
            type: latestMgr.promotionRecommendation === 'yes' ? 'good' : 'info',
            sensitive: true,
            title: latestMgr.promotionRecommendation === 'yes' ? 'Recommended for promotion' : 'Not recommended for promotion',
            detail: 'Per the manager rating for "' + latestMgr.reviewPeriod + '".'
        });
    }

    return insights;
}

// Fetches one employee's full rating history directly (works for any
// SSO-logged-in user — ratingsCache is admin-only) and computes their
// insights from it, for embedding in the emailed self-assessment/manager
// rating reports. Never throws — returns [] on any failure so a slow or
// failed insights fetch never blocks the email itself from sending.
async function fetchEmployeeInsights(employeeId) {
    try {
        var rows = await sbSelect('employee_id=eq.' + encodeURIComponent(employeeId));
        var all = rows.map(normalizeRating);
        return computeEmployeeInsights(employeeId, all);
    } catch(err) {
        console.error('fetchEmployeeInsights:', err);
        return [];
    }
}

// ─── EMPLOYEE PROFILE (admin-only) ───────────────────────────────
function onProfileEmployeeSearch() {
    var query = (document.getElementById('profileEmployeeSearch').value || '').toLowerCase().trim();
    var dropdown = document.getElementById('profileAutocompleteDropdown');
    if (!query) { dropdown.style.display = 'none'; return; }
    var results = EMPLOYEES.filter(function(e) {
        return e.name.toLowerCase().indexOf(query) !== -1 || e.id.toLowerCase().indexOf(query) !== -1;
    }).slice(0, 8);
    renderDropdownItems(dropdown, results, function(emp) {
        dropdown.style.display = 'none';
        document.getElementById('profileEmployeeSearch').value = emp.name + ' (' + emp.id + ')';
        openEmployeeProfile(emp);
    });
}

function closeEmployeeProfileModal() {
    document.getElementById('employeeProfileModal').classList.remove('active');
}

function openEmployeeProfile(emp) {
    document.getElementById('employeeProfileTitle').textContent = emp.name + ' (' + emp.id + ')';
    document.getElementById('employeeProfileContent').innerHTML = buildEmployeeProfileHTML(emp);
    document.getElementById('employeeProfileModal').classList.add('active');
}

function buildEmployeeProfileHTML(emp) {
    var mine = (ratingsCache || []).filter(function(r) { return r.employeeId === emp.id; })
        .sort(function(a, b) { return ratingSortDate(b) - ratingSortDate(a); }); // newest first

    var html = '<div style="background:var(--cream);padding:1.25rem;border-radius:8px;margin-bottom:1.5rem;">'
        + '<div style="display:flex;flex-wrap:wrap;gap:0.4rem 1.5rem;font-size:0.9rem;">'
        + '<div><strong>Designation:</strong> ' + (emp.designation || '-') + '</div>'
        + '<div><strong>Company:</strong> ' + (ORG_COMPANY_LABELS[emp.company] || emp.company || '-') + '</div>'
        + '<div><strong>Manager:</strong> ' + (emp.manager || '-') + '</div>'
        + (emp.status === 'inactive' ? '<div><span class="org-badge org-badge-inactive">Exited</span></div>' : '')
        + '</div></div>';

    html += '<h4 style="margin-bottom:0.75rem;">Insights</h4>';
    var insights = computeEmployeeInsights(emp.id);
    html += insights.length > 0
        ? '<div style="margin-bottom:1.5rem;">' + insightCardsHTML(insights) + '</div>'
        : '<p style="color:var(--gray-medium);margin-bottom:1.5rem;">Not enough rating history yet for an insight.</p>';

    html += '<h4 style="margin-bottom:0.75rem;">Rating History</h4>';
    if (mine.length === 0) {
        html += '<p style="color:var(--gray-medium);">No ratings on file for this employee yet.</p>';
    } else {
        html += '<div style="display:flex;flex-direction:column;gap:0.5rem;">' + mine.map(function(r) {
            var typeLabel = r.isSelfAssessment ? 'Self-Assessment' : 'Manager Rating';
            var typeColor = r.isSelfAssessment ? '#0C5460' : 'var(--hc-teal-dark)';
            var typeBg = r.isSelfAssessment ? '#D1ECF1' : 'var(--hc-teal-tint)';
            return '<div style="display:flex;justify-content:space-between;align-items:center;border:1px solid var(--hc-light-gray);border-radius:8px;padding:0.7rem 1rem;cursor:pointer;" onclick="closeEmployeeProfileModal();viewRatingDetails(' + r.id + ', \'' + emp.id + '\')">'
                + '<div>'
                + '<span style="display:inline-block;background:' + typeBg + ';color:' + typeColor + ';padding:0.2rem 0.6rem;border-radius:4px;font-size:0.72rem;font-weight:700;margin-right:0.6rem;">' + typeLabel + '</span>'
                + '<strong>' + r.reviewPeriod + '</strong>'
                + '<span style="color:var(--hc-mid-grey);font-size:0.8rem;margin-left:0.6rem;">' + new Date(r.timestamp).toLocaleDateString() + '</span>'
                + '</div>'
                + '<div style="text-align:right;">'
                + '<span style="font-weight:800;font-size:1.1rem;color:var(--purple-dark);">' + r.overallScore.toFixed(1) + '</span>'
                + '<span style="color:var(--hc-mid-grey);font-size:0.8rem;margin-left:0.4rem;">' + (r.overallRating || '') + '</span>'
                + '</div></div>';
        }).join('') + '</div>';
    }
    return html;
}

// ─── TEAM RATINGS (skip-level visibility, any logged-in manager) ─────────
// Unlike the admin dashboard's ratingsCache (only ever populated behind
// admin login), this fetches directly — Team Ratings must work for any
// manager who just signed in via SSO, admin or not.
var teamRatingsCurrent = { emp: null, ratingsByEmployee: {}, selfByEmployee: {}, notesByRating: {} };

// "View Full Rating" and "Compare Self vs Manager" both look a rating up by id
// via ratingsCache, which only the admin Dashboard populates (loadAdminData()).
// A manager using Team Ratings without ever opening the Dashboard would get a
// false "Rating not found" even though the rating genuinely exists — this
// checks the Team Ratings caches too, since renderTeamRatings() fetches those
// rows independently. Also checks piRatingsCache so the same modal works for
// PI rows (clicking a name in the admin PI report), not just annual ones.
function findRatingByIdAnywhere(ratingId, isPI) {
    if (isPI) {
        return piRatingsCache.find(function(r) { return r.id === ratingId; }) || null;
    }
    var found = ratingsCache.find(function(r) { return r.id === ratingId; });
    if (found) return found;
    var teamRatings = Object.values(teamRatingsCurrent.ratingsByEmployee)
        .concat(Object.values(teamRatingsCurrent.selfByEmployee));
    return teamRatings.find(function(r) { return r.id === ratingId; }) || null;
}

async function renderTeamRatings() {
    var container = document.getElementById('teamRatingsList');
    var currentEmp = resolveCurrentEmployee();
    if (!currentEmp) {
        container.innerHTML = '<p style="color:var(--gray-medium);padding:1rem;">Your email is not found in the employee directory.</p>';
        return;
    }
    var downline = getAllDownline(currentEmp.id);
    if (downline.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-medium);padding:1rem;">No one reports up to you yet.</p>';
        return;
    }
    container.innerHTML = '<p style="text-align:center;color:var(--gray-medium);padding:1rem;">Loading…</p>';

    try {
        var ids = downline.map(function(e) { return e.id; }).filter(Boolean);
        var idFilter = ids.map(encodeURIComponent).join(',');
        var rows = await sbSelectFrom('performance_reviews', 'is_self_assessment=eq.false&employee_id=in.(' + idFilter + ')&order=submitted_at.desc');
        var all = rows.map(normalizeRating);

        var latestByEmp = {};
        all.forEach(function(r) {
            var key = r.employeeId;
            if (!key) return;
            if (!latestByEmp[key] || new Date(r.timestamp) > new Date(latestByEmp[key].timestamp)) latestByEmp[key] = r;
        });
        teamRatingsCurrent.emp = currentEmp;
        teamRatingsCurrent.ratingsByEmployee = latestByEmp;

        // Also fetch self-assessments (not shown in the list itself, but needed so
        // "Compare Self vs Manager" inside the details modal has a counterpart to find).
        var selfRows = await sbSelectFrom('performance_reviews', 'is_self_assessment=eq.true&employee_id=in.(' + idFilter + ')&order=submitted_at.desc');
        var selfAll = selfRows.map(normalizeRating);
        var latestSelfByEmp = {};
        selfAll.forEach(function(r) {
            var key = r.employeeId;
            if (!key) return;
            if (!latestSelfByEmp[key] || new Date(r.timestamp) > new Date(latestSelfByEmp[key].timestamp)) latestSelfByEmp[key] = r;
        });
        teamRatingsCurrent.selfByEmployee = latestSelfByEmp;

        var ratingIds = Object.values(latestByEmp).map(function(r) { return r.id; });
        var notesByRating = {};
        if (ratingIds.length > 0) {
            var notesRows = await sbSelectFrom('skiplevel_notes', 'rating_id=in.(' + ratingIds.join(',') + ')&order=created_at.desc');
            notesRows.forEach(function(n) { (notesByRating[n.rating_id] = notesByRating[n.rating_id] || []).push(n); });
        }
        teamRatingsCurrent.notesByRating = notesByRating;

        renderTeamRatingsList();
    } catch(err) {
        console.error('renderTeamRatings:', err);
        container.innerHTML = '<p style="color:var(--danger);padding:1rem;">Could not load team ratings: ' + (err.message || 'unknown error') + '</p>';
    }
}

var SKIPLEVEL_REC_LABEL = { endorse: 'Endorse', flag: 'Flag for discussion', recalibrate: 'Recommend recalibration' };

function renderTeamRatingsList() {
    var container = document.getElementById('teamRatingsList');
    var currentEmp = teamRatingsCurrent.emp;
    var downline = getAllDownline(currentEmp.id);

    container.innerHTML = downline.map(function(emp) {
        var r = teamRatingsCurrent.ratingsByEmployee[emp.id];
        var notes = r ? (teamRatingsCurrent.notesByRating[r.id] || []) : [];
        var isDirect = emp.managerId === currentEmp.id;

        var scoreHtml = r
            ? '<span style="font-weight:800;font-size:1.05rem;color:var(--purple-dark);font-variant-numeric:tabular-nums;">' + r.overallScore.toFixed(1) + '</span>'
              + '<span style="color:var(--hc-mid-grey);font-size:0.78rem;margin-left:0.4rem;">' + (r.overallRating || '') + ' · ' + r.reviewPeriod + '</span>'
            : '<span style="color:var(--hc-light-gray);font-size:0.85rem;">No manager rating yet</span>';

        var actionsHtml = r
            ? '<button class="btn btn-secondary btn-sm" onclick="viewRatingDetails(' + r.id + ')">View Full Rating</button> '
              + '<button class="btn btn-secondary btn-sm" onclick="openSkipLevelNoteModal(' + r.id + ', \'' + emp.id + '\', \'' + emp.name.replace(/'/g, "\\'") + '\')">+ Add Note</button>'
            : '';

        var notesHtml = notes.length > 0
            ? '<div style="margin-top:0.6rem;display:flex;flex-direction:column;gap:0.4rem;">' + notes.map(function(n) {
                return '<div style="background:var(--purple-light);border-radius:6px;padding:0.5rem 0.7rem;font-size:0.82rem;">'
                    + '<strong>' + (SKIPLEVEL_REC_LABEL[n.recommendation] || 'Note') + '</strong>'
                    + ' <span style="color:var(--hc-mid-grey);">— ' + n.commenter_name + ', ' + new Date(n.created_at).toLocaleDateString() + '</span>'
                    + '<div style="margin-top:0.2rem;">' + n.note + '</div>'
                    + '</div>';
            }).join('') + '</div>'
            : '';

        return '<div style="border:1px solid var(--hc-hairline);border-radius:8px;padding:0.85rem 1rem;margin-bottom:0.6rem;transition:border-color .15s ease;">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;">'
            + '<div>'
            + '<strong>' + emp.name + '</strong> <span style="color:var(--hc-mid-grey);font-size:0.82rem;">(' + emp.id + ')</span>'
            + '<div style="font-size:0.8rem;color:var(--hc-mid-grey);">' + (emp.designation || '') + (isDirect ? '' : ' · reports to ' + emp.manager) + '</div>'
            + '<div style="margin-top:0.3rem;">' + scoreHtml + '</div>'
            + '</div>'
            + '<div style="text-align:right;white-space:nowrap;">' + actionsHtml + '</div>'
            + '</div>'
            + notesHtml
            + '</div>';
    }).join('');
}

function openSkipLevelNoteModal(ratingId, employeeId, employeeName) {
    document.getElementById('skipLevelNoteTitle').textContent = 'Skip-Level Note — ' + employeeName;
    document.getElementById('skipLevelNoteRatingId').value = ratingId;
    document.getElementById('skipLevelNoteEmployeeId').value = employeeId;
    document.getElementById('skipLevelNoteEmployeeName').value = employeeName;
    document.getElementById('skipLevelNoteRecommendation').value = '';
    document.getElementById('skipLevelNoteText').value = '';
    document.getElementById('skipLevelNoteModal').classList.add('active');
}

function closeSkipLevelNoteModal() {
    document.getElementById('skipLevelNoteModal').classList.remove('active');
}

async function submitSkipLevelNote() {
    var ratingId = document.getElementById('skipLevelNoteRatingId').value;
    var employeeId = document.getElementById('skipLevelNoteEmployeeId').value;
    var employeeName = document.getElementById('skipLevelNoteEmployeeName').value;
    var recommendation = document.getElementById('skipLevelNoteRecommendation').value;
    var note = document.getElementById('skipLevelNoteText').value.trim();

    if (!recommendation) { toast('Please select a recommendation.', 'warn'); return; }
    if (!note) { toast('Please write your note.', 'warn'); return; }

    var currentEmp = resolveCurrentEmployee();
    if (!currentEmp) { toast('Could not identify you — please refresh and try again.', 'error'); return; }

    try {
        await sbInsertInto('skiplevel_notes', {
            rating_id: parseInt(ratingId, 10),
            employee_id: employeeId,
            employee_name: employeeName,
            commenter_id: currentEmp.id,
            commenter_name: currentEmp.name,
            recommendation: recommendation,
            note: note
        });
        toast('Skip-level note added.', 'success');
        closeSkipLevelNoteModal();
        renderTeamRatings();
    } catch(err) {
        console.error('submitSkipLevelNote:', err);
        toast('Could not save note: ' + (err.message || 'unknown error'), 'error');
    }
}

// ─── CYCLE FILTER (admin ratings list) ───────────────────────────
// Populates from the canonical REVIEW_CYCLES list, plus any other
// review_period value actually present in the data (older/legacy cycles
// not in that list), so nothing in the data is ever hidden by omission.
function populateRatingsCycleFilter() {
    var sel = document.getElementById('ratingsCycleFilter');
    if (!sel) return;
    var prevValue = sel.value;
    var known = REVIEW_CYCLES.map(function(c) { return c.value; });
    var extra = [];
    (ratingsCache || []).forEach(function(r) {
        if (r.reviewPeriod && known.indexOf(r.reviewPeriod) === -1 && extra.indexOf(r.reviewPeriod) === -1) {
            extra.push(r.reviewPeriod);
        }
    });
    var options = ['<option value="all">All Cycles</option>'];
    var piLabel = 'Performance Incentive ' + PI_REVIEW_PERIOD_LABEL.slice(PI_REVIEW_PERIOD_LABEL.indexOf('('));
    options.push('<option value="' + PI_CYCLE_FILTER_VALUE + '">' + piLabel + '</option>');
    REVIEW_CYCLES.forEach(function(c) { options.push('<option value="' + c.value + '">' + c.label + '</option>'); });
    extra.sort().forEach(function(v) { options.push('<option value="' + v + '">' + v + '</option>'); });
    sel.innerHTML = options.join('');
    if (prevValue && (prevValue === 'all' || prevValue === PI_CYCLE_FILTER_VALUE || known.indexOf(prevValue) !== -1 || extra.indexOf(prevValue) !== -1)) {
        sel.value = prevValue;
    }
}

// Toggles the "All Employee Ratings" card's header, description, and export
// buttons between the annual and PI presentation — kept in one place so
// filterRatingsList() and loadAdminData() don't duplicate the DOM toggling.
function updateRatingsViewChrome(isPICycle) {
    var titleEl = document.getElementById('ratingsListTitle');
    if (titleEl) titleEl.textContent = isPICycle ? 'Performance Incentive (PI)' : 'All Employee Ratings';
    var subtextEl = document.getElementById('ratingsListSubtext');
    if (subtextEl) subtextEl.style.display = isPICycle ? 'block' : 'none';
    var annualActions = document.getElementById('ratingsActionsAnnual');
    if (annualActions) annualActions.style.display = isPICycle ? 'none' : 'flex';
    var piActions = document.getElementById('ratingsActionsPI');
    if (piActions) piActions.style.display = isPICycle ? 'flex' : 'none';
}

function getFilteredRatings() {
    var query = (document.getElementById('ratingsSearchBox').value || '').toLowerCase().trim();
    var cycleEl = document.getElementById('ratingsCycleFilter');
    var cycle = cycleEl ? cycleEl.value : 'all';
    if (!ratingsCache || ratingsCache.length === 0) return [];
    return ratingsCache.filter(function(r) {
        if (cycle !== 'all' && r.reviewPeriod !== cycle) return false;
        if (!query) return true;
        return (r.employeeName || '').toLowerCase().indexOf(query) !== -1
            || (r.employeeId || '').toLowerCase().indexOf(query) !== -1
            || (r.department || '').toLowerCase().indexOf(query) !== -1
            || (r.position || '').toLowerCase().indexOf(query) !== -1
            || (r.reviewerName || '').toLowerCase().indexOf(query) !== -1
            || (r.reviewPeriod || '').toLowerCase().indexOf(query) !== -1;
    });
}

// ─── SEARCH / FILTER ──────────────────────────────────────────────
function filterRatingsList() {
    var cycleEl = document.getElementById('ratingsCycleFilter');
    var isPICycle = !!cycleEl && cycleEl.value === PI_CYCLE_FILTER_VALUE;
    updateRatingsViewChrome(isPICycle);
    if (isPICycle) {
        renderPIReport();
        return;
    }
    if (!ratingsCache || ratingsCache.length === 0) return;
    renderRatingsList(getFilteredRatings());
}

// Downloads exactly what's currently visible in the ratings list (search +
// cycle filter applied) — complements "Export All to CSV", which always
// exports everything regardless of the on-screen filters.
function downloadFilteredRatingsCSV() {
    var filtered = getFilteredRatings();
    if (filtered.length === 0) { toast('Nothing to download for this view.', 'warn'); return; }
    var cycleEl = document.getElementById('ratingsCycleFilter');
    var cycleLabel = cycleEl && cycleEl.selectedOptions[0] ? cycleEl.selectedOptions[0].textContent : 'All Cycles';

    var headers = ['Employee ID','Employee Name','Position','Department','Review Period','Reviewer',
        'Rating Date','Overall Score','Rating','Promotion Recommendation','Potential','Justification',
        'KT Verdict','KT Score','Final Decision','Approved By','Effective Date',
        'Management Notes','Submitted At'];
    var csvRows = filtered.map(function(r) {
        return [
            r.employeeId, r.employeeName, r.position, r.department, r.reviewPeriod, r.reviewerName,
            r.ratingDate || '', r.overallScore.toFixed(1), r.overallRating,
            r.promotionRecommendation, r.potential || '', r.justification,
            r.keeperTest ? r.keeperTest.verdict || '' : '',
            r.keeperTest && r.keeperTest.responses ? (r.keeperTest.responses.kt_retention_score || '') : '',
            r.managementDecision.finalDecision, r.managementDecision.approvedBy,
            r.managementDecision.effectiveDate, r.managementDecision.managementNotes,
            new Date(r.timestamp).toLocaleString()
        ].map(function(c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
    });
    var csv = '"' + cycleLabel + '"\n' + headers.map(function(h){ return '"'+h+'"'; }).join(',') + '\n' + csvRows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'Acme_Ratings_filtered_' + Date.now() + '.csv'; a.click();
    window.URL.revokeObjectURL(url);
}

// ─── RENDER LIST ──────────────────────────────────────────────────
function renderRatingsList(all) {
    var container = document.getElementById('ratingsList');
    if (all.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--gray-medium);padding:2rem;">No ratings submitted yet</p>';
        return;
    }

    // Group ratings by employee key (employeeId or employeeName) for the same review period
    var groups = {};
    var groupOrder = [];
    all.forEach(function(rating) {
        var key = (rating.employeeId || rating.employeeName).toLowerCase() + '||' + (rating.reviewPeriod || '');
        if (!groups[key]) {
            groups[key] = { self: null, manager: null };
            groupOrder.push(key);
        }
        if (rating.isSelfAssessment) {
            groups[key].self = rating;
        } else {
            groups[key].manager = rating;
        }
    });

    container.innerHTML = groupOrder.map(function(key) {
        var group = groups[key];
        var primary = group.manager || group.self;

        var empIdBadge = primary.employeeId ? '<span style="display:inline-block;background:var(--purple-light);color:var(--purple-dark);padding:0.2rem 0.6rem;border-radius:4px;font-size:0.75rem;font-weight:600;margin-left:0.5rem;">' + primary.employeeId + '</span>' : '';
        var deptText = primary.department ? ' | ' + primary.department : '';

        // ── Build Self-Assessment section ──
        var selfSection = '';
        if (group.self) {
            var s = group.self;
            var selfEditedBadge = '';
            if (s.editHistory && s.editHistory.length > 0) {
                selfEditedBadge = '<span style="display:inline-block;background:#FFF3CD;color:#856404;padding:0.2rem 0.6rem;border-radius:4px;font-size:0.72rem;font-weight:700;margin-left:0.5rem;">EDITED</span>';
            }
            var selfComments = '';
            if (s.justification) {
                selfComments = '<div style="background:var(--cream);padding:0.75rem;border-radius:6px;margin-top:0.75rem;">'
                    + '<strong>Additional Comments:</strong><br><em style="color:var(--gray-medium);">' + s.justification + '</em>'
                    + '</div>';
            }
            selfSection = '<div style="padding:1rem 0;">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">'
                +   '<div>'
                +     '<span style="display:inline-block;background:var(--purple-light);color:var(--purple-dark);padding:0.25rem 0.75rem;border-radius:4px;font-size:0.75rem;font-weight:700;">SELF ASSESSMENT</span>'
                +     selfEditedBadge
                +     '<span style="font-size:0.85rem;color:var(--gray-medium);margin-left:0.75rem;">Submitted: ' + new Date(s.timestamp).toLocaleDateString() + '</span>'
                +   '</div>'
                +   '<div style="text-align:center;">'
                +     '<span style="font-size:1.5rem;font-weight:800;color:var(--purple-dark);font-variant-numeric:tabular-nums;">' + s.overallScore.toFixed(1) + '</span>'
                +     '<span style="font-size:0.8rem;color:var(--gray-medium);margin-left:0.35rem;">' + (s.overallRating || '') + '</span>'
                +   '</div>'
                + '</div>'
                + selfComments
                + '<div class="rating-item-actions" style="margin-top:0.75rem;">'
                +   '<button class="btn btn-secondary btn-sm" onclick="viewRatingDetails(' + s.id + ')">View Details</button>'
                +   '<button class="btn btn-secondary btn-sm" onclick="openEditRatingsModal(' + s.id + ', false)">Edit Ratings</button>'
                +   '<button class="btn btn-primary btn-sm" onclick="downloadPDF(' + s.id + ')">Download PDF</button>'
                +   '<button class="btn btn-danger btn-sm" onclick="deleteRating(' + s.id + ')">Delete</button>'
                + '</div>'
                + '</div>';
        }

        // ── Build Manager Review section ──
        var mgrSection = '';
        if (group.manager) {
            var m = group.manager;

            var promoText = m.promotionRecommendation === 'yes' ? 'Yes, recommended'
                          : m.promotionRecommendation === 'no'  ? 'Not recommended'
                          : 'Not specified';
            var promoBlock = '<div style="background:var(--cream);padding:0.75rem;border-radius:6px;margin-bottom:0.75rem;">'
                           + '<strong>Promotion Recommendation:</strong> ' + promoText
                           + (m.justification ? '<br><em style="color:var(--gray-medium);">' + m.justification + '</em>' : '')
                           + '</div>';

            var ktBlock = '';
            if (m.keeperTest) {
                var ktComment = (m.keeperTest.comments && m.keeperTest.comments.kt_keeper_comment) || '';
                ktBlock = '<div style="background:#F8F4FF;padding:0.75rem;border-radius:6px;margin-bottom:0.75rem;border-left:4px solid var(--purple-medium);">'
                        + '<strong>Keeper Verdict:</strong> ' + ((m.keeperTest.verdict || '-').replace(/_/g, ' '))
                        + (ktComment ? '<br><em style="color:var(--gray-medium);margin-top:0.25rem;display:inline-block;">' + ktComment + '</em>' : '')
                        + '</div>';
            }

            var decisionBlock = m.managementDecision && m.managementDecision.finalDecision
                ? '<div style="background:#E8F5E9;padding:0.75rem;border-radius:6px;margin-bottom:0.75rem;border-left:4px solid var(--success);">'
                  + '<strong>Management Decision:</strong> ' + m.managementDecision.finalDecision + '<br>'
                  + '<small>Approved by: ' + m.managementDecision.approvedBy + ' | Date: ' + m.managementDecision.effectiveDate + '</small>'
                  + (m.managementDecision.managementNotes ? '<br><em style="color:var(--gray-medium);">' + m.managementDecision.managementNotes + '</em>' : '')
                  + '</div>'
                : '<div style="background:#FFF3CD;padding:0.75rem;border-radius:6px;margin-bottom:0.75rem;border-left:4px solid var(--warning);">'
                  + '<strong>Status:</strong> Pending management decision</div>';

            var editButton = '<button class="btn btn-secondary btn-sm" onclick="editManagementDecision(' + m.id + ')">' + ((m.managementDecision && m.managementDecision.finalDecision) ? 'Edit' : 'Add') + ' Management Decision</button>';

            var mgrViewDetailsBtn = '<button class="btn btn-secondary btn-sm" onclick="viewRatingDetails(' + m.id + ')">View Details</button>';
            var mgrEditRatingsBtn = '<button class="btn btn-secondary btn-sm" onclick="openEditRatingsModal(' + m.id + ', false)">Edit Ratings</button>';

            var mgrEditedBadge = '';
            if (m.editHistory && m.editHistory.length > 0) {
                mgrEditedBadge = '<span style="display:inline-block;background:#FFF3CD;color:#856404;padding:0.2rem 0.6rem;border-radius:4px;font-size:0.72rem;font-weight:700;margin-left:0.5rem;">EDITED</span>';
            }

            var emailButton = '';
            if (m.managementDecision && m.managementDecision.finalDecision) {
                emailButton = '<button class="btn btn-success btn-sm" onclick="emailToManager(' + m.id + ', \'' + m.employeeName.replace(/'/g, "\\'") + '\', \'' + m.reviewerName.replace(/'/g, "\\'") + '\')">Email to Manager</button>';
            }

            var finalReportBtn = '';
            if (m.managementDecision && m.managementDecision.finalDecision) {
                finalReportBtn = '<button class="btn btn-primary btn-sm" onclick="downloadFinalReport(' + m.id + ')" style="background: linear-gradient(135deg, #1B7A3B, #2ECC71);">Download Final Report</button>';
            }

            mgrSection = '<div style="padding:1rem 0;">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">'
                +   '<div>'
                +     '<span style="display:inline-block;background:rgba(26,135,84,0.12);color:var(--hc-success);padding:0.25rem 0.75rem;border-radius:4px;font-size:0.75rem;font-weight:700;">MANAGER REVIEW</span>'
                +     mgrEditedBadge
                +     '<span style="font-size:0.85rem;color:var(--gray-medium);margin-left:0.75rem;">Reviewer: ' + m.reviewerName + ' | Submitted: ' + new Date(m.timestamp).toLocaleDateString() + '</span>'
                +   '</div>'
                +   '<div style="text-align:center;">'
                +     '<span style="font-size:1.5rem;font-weight:800;color:var(--purple-dark);font-variant-numeric:tabular-nums;">' + m.overallScore.toFixed(1) + '</span>'
                +     '<span style="font-size:0.8rem;color:var(--gray-medium);margin-left:0.35rem;">' + (m.overallRating || '') + '</span>'
                +   '</div>'
                + '</div>'
                + promoBlock
                + ktBlock
                + decisionBlock
                + '<div class="rating-item-actions" style="margin-top:0.75rem;">'
                +   mgrViewDetailsBtn
                +   mgrEditRatingsBtn
                +   '<button class="btn btn-primary btn-sm" onclick="downloadPDF(' + m.id + ')">Download PDF</button>'
                +   emailButton
                +   finalReportBtn
                +   editButton
                +   '<button class="btn btn-danger btn-sm" onclick="deleteRating(' + m.id + ')">Delete</button>'
                + '</div>'
                + '</div>';
        }

        // ── Divider between sections ──
        var divider = (group.self && group.manager)
            ? '<hr style="border:none;border-top:1.5px dashed #e0e0e0;margin:0;">'
            : '';

        // ── Submitted-by line (from primary) ──
        var submittedBy = primary.submittedByEmail
            ? '<p style="font-size:0.78rem;margin-top:0.25rem;color:var(--purple-dark);">Submitted by: ' + primary.submittedByName + ' (' + primary.submittedByEmail + ')</p>'
            : '';

        return '<div class="rating-item">'
            + '<div class="rating-item-header">'
            +   '<div class="rating-item-info">'
            +     '<h4>' + primary.employeeName + empIdBadge + '</h4>'
            +     '<p>' + (primary.position || '') + deptText + '</p>'
            +     '<p style="font-size:0.85rem;margin-top:0.5rem;">Review Period: ' + primary.reviewPeriod + '</p>'
            +     submittedBy
            +   '</div>'
            + '</div>'
            + (group.self ? selfSection : '')
            + divider
            + (group.manager ? mgrSection : '')
            + '</div>';
    }).join('');

    if (typeof gsap !== 'undefined') {
        if (prefersReducedMotion()) {
            gsap.set('#ratingsList .rating-item', { opacity: 1, y: 0 });
        } else {
            gsap.fromTo('#ratingsList .rating-item', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .4, stagger: .05, ease: 'power3.out' });
        }
    }
}

// ─── EDIT MANAGEMENT DECISION ─────────────────────────────────────
function editManagementDecision(ratingId) {
    currentEditingRatingId = ratingId;
    var rating = ratingsCache.find(function(r){ return r.id === ratingId; });
    if (!rating) return;
    document.getElementById('editRatingDetails').innerHTML =
        '<div style="background:var(--cream);padding:1.5rem;border-radius:8px;margin-bottom:2rem;">'
        + '<h4 style="margin-bottom:1rem;color:var(--purple-dark);">' + rating.employeeName + (rating.employeeId ? ' (' + rating.employeeId + ')' : '') + '</h4>'
        + '<p><strong>Position:</strong> ' + (rating.position || '-') + '</p>'
        + '<p><strong>Review Period:</strong> ' + rating.reviewPeriod + '</p>'
        + '<p><strong>Overall Score:</strong> ' + rating.overallScore.toFixed(1) + ' - ' + (rating.overallRating || '') + '</p>'
        + '</div>';
    document.getElementById('editFinalDecision').value   = rating.managementDecision.finalDecision   || '';
    document.getElementById('editApprovedBy').value      = rating.managementDecision.approvedBy      || '';
    document.getElementById('editEffectiveDate').value   = '2026-04-01';
    document.getElementById('editManagementNotes').value = rating.managementDecision.managementNotes || '';
    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    currentEditingRatingId = null;
}

async function saveManagementDecision() {
    if (!currentEditingRatingId) return;
    var finalDecision   = document.getElementById('editFinalDecision').value.trim();
    var approvedBy      = document.getElementById('editApprovedBy').value.trim();
    var effectiveDate   = '2026-04-01';
    var managementNotes = document.getElementById('editManagementNotes').value.trim();
    if (!finalDecision || !approvedBy) {
        toast('Please fill in Final Decision and Approved By.', 'warn');
        return;
    }
    try {
        await sbUpdate(currentEditingRatingId, {
            management_decision: { finalDecision, approvedBy, effectiveDate, managementNotes }
        });
        toast('Management decision saved!', 'success');
        closeEditModal();
        loadAdminData();
    } catch(err) {
        console.error('saveManagementDecision:', err);
        toast('Error saving decision. Please try again.', 'error');
    }
}

// ─── DELETE ───────────────────────────────────────────────────────
async function deleteRating(ratingId) {
    var rating = ratingsCache.find(function(r){ return r.id === ratingId; });
    var name   = rating ? rating.employeeName : 'this entry';
    if (!window.confirm('Delete rating for ' + name + '? This cannot be undone.')) return;
    try {
        await sbDelete(ratingId);
        ratingsCache = ratingsCache.filter(function(r){ return r.id !== ratingId; });
        toast('Rating deleted.', 'success');
        loadAdminData();
    } catch(err) {
        console.error('deleteRating:', err);
        toast('Error deleting rating.', 'error');
    }
}

// ─── EXPORT CSV ───────────────────────────────────────────────────
async function exportAllRatings() {
    try {
        var rows = await sbSelect('select=*');
        var all  = rows.map(normalizeRating);
        if (all.length === 0) { toast('No data to export.', 'warn'); return; }

        var headers = ['Employee ID','Employee Name','Position','Department','Review Period','Reviewer',
            'Rating Date','Overall Score','Rating','Promotion Recommendation','Potential','Justification',
            'KT Verdict','KT Score','Final Decision','Approved By','Effective Date',
            'Management Notes','Submitted At'];

        var csvRows = all.map(function(r) {
            return [
                r.employeeId, r.employeeName, r.position, r.department, r.reviewPeriod, r.reviewerName,
                r.ratingDate || '', r.overallScore.toFixed(1), r.overallRating,
                r.promotionRecommendation, r.potential || '', r.justification,
                r.keeperTest ? r.keeperTest.verdict || '' : '',
                r.keeperTest && r.keeperTest.responses ? (r.keeperTest.responses.kt_retention_score || '') : '',
                r.managementDecision.finalDecision, r.managementDecision.approvedBy,
                r.managementDecision.effectiveDate, r.managementDecision.managementNotes,
                new Date(r.timestamp).toLocaleString()
            ].map(function(c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
        });

        var csv  = headers.map(function(h){ return '"'+h+'"'; }).join(',') + '\n' + csvRows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var url  = window.URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = 'Acme_Ratings_' + Date.now() + '.csv'; a.click();
        window.URL.revokeObjectURL(url);
        toast('CSV exported successfully!', 'success');
    } catch(err) {
        console.error('exportAllRatings:', err);
        toast('Error exporting data.', 'error');
    }
}

// ─── COMPARISON VIEW ───────────────────────────────────────────
async function showComparisonView() {
    try {
        var rows = await sbSelect('select=*');
        var all = rows.map(normalizeRating);
        var comparisons = findComparisons(all);

        if (comparisons.length === 0) {
            toast('No comparisons found. Need both self-assessments and manager ratings for same employees.', 'warn');
            return;
        }

        displayComparisonList(comparisons);
        document.getElementById('comparisonModal').classList.add('active');
    } catch(err) {
        console.error('showComparisonView:', err);
        toast('Error loading comparisons.', 'error');
    }
}

function findComparisons(allRatings) {
    var comparisons = [];
    var selfAssessments = allRatings.filter(function(r) { return r.isSelfAssessment; });
    var managerRatings = allRatings.filter(function(r) { return !r.isSelfAssessment; });

    selfAssessments.forEach(function(self) {
        var matches = managerRatings.filter(function(mgr) {
            // Match by employee_id first
            if (self.employeeId && mgr.employeeId && self.employeeId === mgr.employeeId) return true;
            // Fallback: match by name
            var selfName = self.employeeName.replace(' (Self)', '');
            return selfName === mgr.employeeName;
        });

        if (matches.length > 0) {
            comparisons.push({
                employee: self.employeeName.replace(' (Self)', ''),
                employeeId: self.employeeId,
                self: self,
                manager: matches[0]
            });
        }
    });

    return comparisons;
}

function displayComparisonList(comparisons) {
    var html = '<div class="comparison-list">';

    comparisons.forEach(function(comp, index) {
        var selfScore = comp.self.overallScore.toFixed(1);
        var mgrScore = comp.manager.overallScore.toFixed(1);
        var diff = (parseFloat(mgrScore) - parseFloat(selfScore)).toFixed(1);

        html += '<div class="comparison-item" onclick="showDetailedComparison(' + index + ')">';
        html += '  <div class="comparison-item-header">';
        html += '    <div>';
        html += '      <div class="comparison-employee-name">' + comp.employee + '</div>';
        if (comp.employeeId) {
            html += '      <div style="font-size: 0.85rem; color: var(--gray-medium);">ID: ' + comp.employeeId + '</div>';
        }
        html += '    </div>';
        html += '    <div class="comparison-stats">';
        html += '      <div class="comparison-stat"><div class="comparison-stat-label">Self</div><div class="comparison-stat-value">' + selfScore + '</div></div>';
        html += '      <div class="comparison-stat"><div class="comparison-stat-label">Manager</div><div class="comparison-stat-value">' + mgrScore + '</div></div>';
        html += '      <div class="comparison-stat"><div class="comparison-stat-label">Difference</div>';
        html += '        <div class="comparison-stat-value" style="color: ' + (diff > 0 ? '#27ae60' : diff < 0 ? '#e74c3c' : '#7f8c8d') + '">' + (diff > 0 ? '+' : '') + diff + '</div>';
        html += '      </div>';
        html += '    </div>';
        html += '  </div>';

        if (comp.manager.keeperTest && comp.manager.keeperTest.verdict) {
            html += '  <div class="comparison-keeper">Keeper Verdict: <strong>' + comp.manager.keeperTest.verdict.replace(/_/g, ' ').toUpperCase() + '</strong></div>';
        }

        html += '</div>';
    });

    html += '</div>';
    window.currentComparisons = comparisons;
    document.getElementById('comparisonContent').innerHTML = html;
}

function showDetailedComparison(index) {
    var comp = window.currentComparisons[index];

    var html = '<div>';
    html += '<div style="text-align: center; margin-bottom: 2rem;">';
    html += '  <h3 style="font-size: 1.5rem; color: var(--gray-dark);">' + comp.employee + '</h3>';
    if (comp.employeeId) {
        html += '  <div style="color: var(--gray-medium);">Employee ID: ' + comp.employeeId + '</div>';
    }
    html += '</div>';

    html += '<div class="comparison-grid">';

    // Self-Assessment Card
    var selfCatIndices = [0, 1, 3, 4, 5, 7];
    html += '<div class="comparison-card self">';
    html += '  <div class="comparison-header"><span class="comparison-badge self">Self Assessment</span></div>';
    html += '  <div class="comparison-score">' + comp.self.overallScore.toFixed(1) + '</div>';
    html += '  <div class="comparison-section-title">Category Ratings</div>';
    var selfCatMap = {0:'Job Knowledge & Skills', 1:'Quality of Work', 3:'Problem Solving & Initiative', 4:'Teamwork & Collaboration', 5:'AI Utilization (avg)', 7:'Accountability, Efficiency & Competency (avg)'};
    selfCatIndices.forEach(function(i) {
        var catName = selfCatMap[i];
        var r = comp.self.ratings[i] !== undefined ? Number(comp.self.ratings[i]).toFixed(1) : 'N/A';
        html += '  <div class="comparison-category"><div class="comparison-category-name">' + catName + '</div><div class="comparison-rating">' + r + '</div></div>';
    });
    // OKR
    var selfCompOkr = comp.self.ratings.okr_percent;
    if (selfCompOkr !== undefined && selfCompOkr !== null) {
        html += '  <div class="comparison-category"><div class="comparison-category-name">OKR % Completion</div><div class="comparison-rating">' + selfCompOkr + '% (' + Number(comp.self.ratings[10]).toFixed(1) + ')</div></div>';
    }
    if (comp.self.justification) {
        html += '  <div class="comparison-section-title">Comments</div>';
        html += '  <div class="comparison-text">' + comp.self.justification + '</div>';
    }
    html += '</div>';

    // Manager Rating Card — 4 sections
    html += '<div class="comparison-card manager">';
    html += '  <div class="comparison-header"><span class="comparison-badge manager">Manager Rating</span>';
    html += '    <span style="font-size: 0.85rem; color: var(--gray-medium);">' + comp.manager.reviewerName + '</span></div>';
    html += '  <div class="comparison-score">' + comp.manager.overallScore.toFixed(1) + '</div>';
    html += '  <div style="text-align: center; color: var(--gray-medium); margin-bottom: 1rem;">' + (comp.manager.overallRating || '') + '</div>';
    html += '  <div class="comparison-section-title">Section Ratings (25% each)</div>';
    html += '  <div class="comparison-category"><div class="comparison-category-name">Accountability, Efficiency & Competency (avg)</div><div class="comparison-rating">' + (comp.manager.ratings[2] !== undefined ? Number(comp.manager.ratings[2]).toFixed(1) : 'N/A') + '</div></div>';
    html += '  <div class="comparison-category"><div class="comparison-category-name">AI Utilization (avg)</div><div class="comparison-rating">' + (comp.manager.ratings[5] !== undefined ? Number(comp.manager.ratings[5]).toFixed(1) : 'N/A') + '</div></div>';
    var mgrCompOkr = comp.manager.ratings.okr_percent;
    html += '  <div class="comparison-category"><div class="comparison-category-name">OKR % Completion</div><div class="comparison-rating">' + (mgrCompOkr !== undefined && mgrCompOkr !== null ? mgrCompOkr + '% (' + Number(comp.manager.ratings[6]).toFixed(1) + ')' : 'N/A') + '</div></div>';
    if (comp.manager.keeperTest && comp.manager.keeperTest.responses) {
        var ktCompScore = comp.manager.keeperTest.responses.kt_retention_score;
        html += '  <div class="comparison-category"><div class="comparison-category-name">Keeper Test</div><div class="comparison-rating">' + (ktCompScore !== null && ktCompScore !== undefined ? ktCompScore + ' / 5' : 'N/A') + '</div></div>';
    }
    if (comp.manager.justification) {
        html += '  <div class="comparison-section-title">Justification</div>';
        html += '  <div class="comparison-text">' + comp.manager.justification + '</div>';
    }
    if (comp.manager.keeperTest) {
        html += '  <div class="comparison-section-title">Keeper Test Result</div>';
        html += '  <div class="comparison-text" style="background: #e8f5e9; border-color: #4caf50;">';
        html += '    <strong>Score:</strong> ' + (comp.manager.keeperTest.responses ? comp.manager.keeperTest.responses.kt_retention_score + ' / 5' : 'N/A');
        html += '    | <strong>Verdict:</strong> ' + (comp.manager.keeperTest.verdict || 'Not completed').replace(/_/g, ' ').toUpperCase();
        html += '  </div>';
    }
    html += '</div>';
    html += '</div>';

    html += '<div style="text-align: center; margin-top: 2rem;">';
    html += '  <button class="btn btn-secondary" onclick="displayComparisonList(window.currentComparisons)">Back to List</button>';
    html += '</div></div>';

    document.getElementById('comparisonContent').innerHTML = html;
}

function getCategoryName(index) {
    var names = ['Job Knowledge & Skills','Quality of Work','Accountability, Efficiency & Competency (avg)','Problem Solving & Initiative','Teamwork & Collaboration','AI Utilization (avg)','OKR Completion','Accountability, Efficiency & Competency (avg)'];
    return names[index] || 'Category ' + (index + 1);
}

function closeComparisonModal() {
    document.getElementById('comparisonModal').classList.remove('active');
}

// ─── KEEPER TEST STATE ────────────────────────────────────────────
var KT_SCORE_LABELS = {
    5: { label: 'Fight to Retain',           cls: 'verdict-strong',  emotion: 'Extremely Anxious',   desc: 'Would fight aggressively to retain; losing this employee would be a major loss to the team.', bg:'#D4EDDA', border:'#28a745', color:'#155724', urgency:'Critical',  barW:'100%' },
    4: { label: 'Strongly Prefer to Retain', cls: 'verdict-retain',  emotion: 'Concerned',           desc: 'Would strongly prefer to retain; their departure would create a noticeable gap.',           bg:'#D1ECF1', border:'#17a2b8', color:'#0C5460', urgency:'High',     barW:'80%'  },
    3: { label: 'Okay if Stay / Leave',      cls: 'verdict-discuss', emotion: 'Neutral',             desc: 'Comfortable either way; employee is performing adequately but replaceable.',                  bg:'#FFF3CD', border:'#ffc107', color:'#856404', urgency:'Moderate', barW:'50%'  },
    2: { label: 'Would Not Fight to Retain', cls: 'verdict-warn',    emotion: 'Mostly Relaxed',      desc: 'Would not actively try to retain; replacement would not be difficult.',                      bg:'#FFE8D0', border:'#fd7e14', color:'#7B3F00', urgency:'Low',      barW:'25%'  },
    0: { label: 'Plan Exit',                 cls: 'verdict-exit',    emotion: 'Completely Relaxed',  desc: 'Would encourage exit — would be comfortable letting the employee go.',                       bg:'#F8F9FA', border:'#ADB5BD', color:'#343A40', urgency:'None',     barW:'2%'   }
};

var keeperTestState = {
    kt_retention_score: null,
    comments: { kt_keeper_comment: '' }
};

var currentKTStep  = 0;
var KT_TOTAL_STEPS = 2;

var KT_STEP_REQUIRED = {
    0: ['kt_retention_score'],
    1: []
};

// ─── SUBMIT MANAGER RATING (inline — no modal) ──────────────────
async function submitManagerRating() {
    if (!selectedMgrEmployee) {
        toast('Please select an employee to rate.', 'warn'); return;
    }

    // Validate: logged-in user must match the manager identity
    var currentEmp = resolveCurrentEmployee();
    if (!currentEmp) {
        toast('Your email is not found in the employee directory. Manager rating is not allowed.', 'error'); return;
    }
    if (!selectedManager || currentEmp.id !== selectedManager.id) {
        toast('You can only submit ratings as yourself (' + currentEmp.name + '). Rating as another manager is not allowed.', 'error'); return;
    }

    var reviewPeriod = document.getElementById('reviewPeriod').value.trim();
    var reviewerName = document.getElementById('reviewerName').value.trim();

    if (!reviewPeriod || !reviewerName) {
        toast('Please fill in all information fields.', 'warn'); return;
    }
    var accRatedMgr = Object.values(mgrAccSubs).filter(function(v){ return v !== null; }).length;
    var aiRatedMgr = Object.values(mgrAiSubs).filter(function(v){ return v !== null; }).length;
    if (accRatedMgr !== 3) {
        toast('Please rate all 3 Accountability, Efficiency & Competency subcomponents.', 'warn'); return;
    }
    if (aiRatedMgr !== 3) {
        toast('Please rate all 3 AI Utilization subcomponents.', 'warn'); return;
    }
    if (mgrOkrPercent === null || mgrOkrPercent === undefined) {
        toast('Please enter OKR % Completion.', 'warn'); return;
    }
    if (keeperTestState.kt_retention_score === null) {
        toast('Please select a Keeper Test retention score.', 'warn'); return;
    }
    var selectedPotential = (document.querySelector('input[name="potential"]:checked') || {}).value || '';
    if (!selectedPotential) {
        toast('Please select a Potential level (Low, Medium or High).', 'warn'); return;
    }

    // Read keeper comment (required)
    var el = document.getElementById('kt_keeper_comment');
    if (el) keeperTestState.comments.kt_keeper_comment = el.value.trim();
    if (!keeperTestState.comments.kt_keeper_comment) {
        toast('Please enter additional comments for the Keeper Test.', 'warn'); return;
    }

    // Guard against double-submission — this flow previously had no check at
    // all before the insert, unlike the self-assessment and PI manager flows.
    try {
        var existing = await sbSelect(
            'employee_id=eq.' + encodeURIComponent(selectedMgrEmployee.id) +
            '&review_period=eq.' + encodeURIComponent(reviewPeriod) +
            '&is_self_assessment=eq.false&select=id');
        if (existing && existing.length > 0) {
            toast('A manager rating has already been submitted for this employee for this review period.', 'error');
            return;
        }
    } catch (e) { console.error('submitManagerRating existing check:', e); }

    finalSubmit();
}

// ─── KEEPER NAVIGATION ────────────────────────────────────────────
function ktNext(fromStep) {
    var required = KT_STEP_REQUIRED[fromStep];
    for (var i = 0; i < required.length; i++) {
        if (keeperTestState[required[i]] === null) {
            toast('Please select a retention score.', 'warn'); return;
        }
    }
    if (fromStep === 0) {
        var cmtEl = document.getElementById('kt_keeper_comment');
        if (cmtEl) keeperTestState.comments.kt_keeper_comment = cmtEl.value.trim();
        if (!keeperTestState.comments.kt_keeper_comment) {
            toast('Please enter additional comments.', 'warn'); return;
        }
        buildKTConfirmation();
    }
    goToKTStep(fromStep + 1);
}

function ktBack(fromStep) {
    if (fromStep === 0) closeKeeperModal();
    else goToKTStep(fromStep - 1);
}

function goToKTStep(step) {
    currentKTStep = step;
    document.querySelectorAll('.kt-step').forEach(function(s){ s.classList.remove('active'); });
    document.getElementById('ktStep' + step).classList.add('active');
    for (var i = 0; i < KT_TOTAL_STEPS; i++) {
        var dot = document.getElementById('kdot' + i);
        if (!dot) continue;
        dot.classList.remove('filled','active');
        if (i < step) dot.classList.add('filled');
        else if (i === step) dot.classList.add('active');
    }
    var labels = ['Section 1 of 1', 'Review & Submit'];
    document.getElementById('ktProgressLabel').textContent = labels[step] || '';
    var shell = document.querySelector('.keeper-shell');
    if (shell) shell.scrollTop = 0;
}

function setKTScore(score, btn) {
    keeperTestState.kt_retention_score = score;
    document.querySelectorAll('.kt-score-btn').forEach(function(b){ b.classList.remove('selected'); });
    btn.classList.add('selected');
    var meta = KT_SCORE_LABELS[score];
    if (meta) {
        var panel = document.getElementById('ktEmotionPanel');
        if (panel) {
            panel.style.display = 'block';
            panel.style.background = meta.bg;
            panel.style.border = '1.5px solid ' + meta.border;
            panel.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px;">'
                + '<div style="width:48px;height:48px;border-radius:12px;flex-shrink:0;background:#fff;border:2px solid ' + meta.border + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;">'
                + '<span style="font-size:1.2rem;font-weight:900;color:' + meta.color + ';line-height:1;">' + score + '</span>'
                + '<span style="font-size:0.5rem;color:' + meta.color + ';opacity:0.7;">/ 5</span></div>'
                + '<div><div style="font-size:1rem;font-weight:800;color:' + meta.color + ';margin-bottom:3px;">' + meta.emotion
                + ' <span style="font-size:0.68rem;font-weight:700;background:' + meta.border + ';color:#fff;border-radius:20px;padding:2px 8px;margin-left:4px;">' + meta.label + '</span></div>'
                + '<div style="font-size:0.85rem;color:' + meta.color + ';line-height:1.5;">' + meta.desc + '</div>'
                + '<div style="margin-top:10px;">'
                + '<div style="display:flex;justify-content:space-between;font-size:0.68rem;opacity:0.7;color:' + meta.color + ';margin-bottom:4px;"><span>Retention urgency</span><span>' + meta.urgency + '</span></div>'
                + '<div style="height:6px;border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.1);">'
                + '<div style="height:100%;border-radius:6px;background:' + meta.border + ';width:' + meta.barW + ';transition:width 0.4s ease;"></div></div>'
                + '</div></div></div>';
        }
    }
    calculateOverallScore();
}

function computeKTVerdict() {
    var score = keeperTestState.kt_retention_score;
    if (score === null || score === undefined) return { label: 'Not Completed', cls: 'verdict-discuss' };
    return KT_SCORE_LABELS[score] || { label: 'Unknown', cls: 'verdict-discuss' };
}

function buildKTConfirmation() {
    var el = document.getElementById('kt_keeper_comment');
    if (el) keeperTestState.comments.kt_keeper_comment = el.value.trim();
    var score = keeperTestState.kt_retention_score;
    var rowsHTML = '<div class="kt-summary-row">'
        + '<span class="kt-summary-label">Retention Score</span>'
        + '<span class="kt-summary-val-yes">' + (score !== null && score !== undefined ? score : '-') + ' / 5</span>'
        + '</div>';
    rowsHTML += '<div class="kt-summary-row" style="flex-direction:column;align-items:flex-start;gap:4px;">'
        + '<span class="kt-summary-label">Comments</span>'
        + '<span style="font-size:0.88rem;color:#2A2A2A;">' + (keeperTestState.comments.kt_keeper_comment || '-') + '</span>'
        + '</div>';
    document.getElementById('ktSummaryRows').innerHTML = rowsHTML;
    var verdict = computeKTVerdict();
    var badge   = document.getElementById('ktVerdictBadge');
    badge.textContent = 'Keeper Verdict: ' + verdict.label;
    badge.className   = 'kt-verdict-badge ' + verdict.cls;
}

function resetKeeperUI() {
    keeperTestState.kt_retention_score = null;
    keeperTestState.comments.kt_keeper_comment = '';
    document.querySelectorAll('.kt-score-btn').forEach(function(b){ b.classList.remove('selected'); });
    var el = document.getElementById('kt_keeper_comment'); if (el) el.value = '';
    var ep = document.getElementById('ktEmotionPanel'); if (ep) { ep.style.display = 'none'; ep.innerHTML = ''; }
}

// ─── FINAL SUBMIT → Supabase INSERT ──────────────────────────────
async function finalSubmit() {
    var el = document.getElementById('kt_keeper_comment');
    if (el) keeperTestState.comments.kt_keeper_comment = el.value.trim();

    var verdict = computeKTVerdict();
    var keeperTestPayload = {
        completedAt: new Date().toISOString(),
        responses: { kt_retention_score: keeperTestState.kt_retention_score },
        comments: Object.assign({}, keeperTestState.comments),
        verdict:  verdict.label
    };

    var emp = selectedMgrEmployee;
    if (!emp) {
        toast('No employee selected.', 'error');
        return;
    }

    // Compute final overall score including keeper test (4 sections × 25%)
    var keeperScore = keeperTestState.kt_retention_score || 0;
    var sec1 = ratings[2] || 0; // Accountability/Efficiency/Competency avg
    var sec2 = ratings[5] || 0; // AI Utilization avg
    var sec3 = ratings[6] || 0; // OKR % Completion
    var sec4 = keeperScore;     // Keeper Test
    var finalOverallScore = (sec1 + sec2 + sec3 + sec4) / 4;
    var finalLabel = finalOverallScore >= 4.5 ? 'Exceptional'
                   : finalOverallScore >= 3.5 ? 'Exceeds Expectations'
                   : finalOverallScore >= 2.5 ? 'Meets Expectations'
                   : finalOverallScore >= 1.5 ? 'Needs Improvement'
                   : 'Unsatisfactory';

    var ssoInfo = getSSOSubmitterInfo();
    var row = {
        rating_date:              document.getElementById('ratingDate').value,
        employee_id:              emp.id || '',
        employee_name:            emp.name,
        position:                 emp.designation || '',
        department:               '',
        review_period:            document.getElementById('reviewPeriod').value.trim(),
        reviewer_name:            document.getElementById('reviewerName').value.trim(),
        ratings:                  Object.assign({}, ratings, { ai_subs: mgrAiSubs, acc_subs: mgrAccSubs, okr_percent: mgrOkrPercent }),
        overall_score:            parseFloat(finalOverallScore.toFixed(2)),
        overall_rating:           finalLabel,
        promotion_recommendation: (document.querySelector('input[name="promotion"]:checked') || {}).value || '',
        potential:                (document.querySelector('input[name="potential"]:checked') || {}).value || '',
        justification:            document.getElementById('justification').value,
        keeper_test:              keeperTestPayload,
        management_decision:      { finalDecision:'', approvedBy:'', effectiveDate:'', managementNotes:'' },
        is_self_assessment:       false,
        submitted_by_email:       ssoInfo.submitted_by_email,
        submitted_by_name:        ssoInfo.submitted_by_name
    };

    try {
        await sbInsert(row);
        toast('Rating submitted successfully!', 'success');

        // Send the combined self-vs-manager comparison report (+ insights) to
        // BOTH the manager and the employee who was just rated — previously
        // only the manager received this, so the employee never actually saw
        // how their self-assessment compared to their manager's rating.
        var recipients = [];
        if (selectedManager && selectedManager.email) recipients.push(selectedManager.email);
        if (emp.email && recipients.indexOf(emp.email) === -1) recipients.push(emp.email);

        if (recipients.length > 0) {
            var selfAssessment = null;
            try {
                var data = await sbSelect(
                    'is_self_assessment=eq.true&employee_id=eq.' + encodeURIComponent(emp.id) +
                    '&review_period=eq.' + encodeURIComponent(row.review_period)
                );
                if (data && data.length > 0) selfAssessment = normalizeRating(data[0]);
            } catch(e) {}

            var ratingObj = Object.assign({}, row, {
                employeeName: emp.name,
                overallScore: row.overall_score,
                overallRating: row.overall_rating,
                reviewPeriod: row.review_period,
                reviewerName: row.reviewer_name,
                ratings: row.ratings,
                promotionRecommendation: row.promotion_recommendation,
                justification: row.justification,
                keeperTest: keeperTestPayload
            });
            var insights = await fetchEmployeeInsights(emp.id);
            recipients.forEach(function(email) {
                sendManagerRatingEmail(ratingObj, selfAssessment, email, insights, email === emp.email);
            });
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        resetForm();
    } catch(err) {
        console.error('finalSubmit error:', err);
        var errorMsg = 'Error saving rating. ';
        if (err.message) errorMsg += err.message;
        else if (err.hint) errorMsg += err.hint;
        else errorMsg += 'Please check if database migrations are run and try again.';
        toast(errorMsg, 'error');
    }
}

// ─── VIEW DETAILS MODAL ──────────────────────────────────────────
var viewDetailsShowingOriginal = false;
var viewDetailsCurrentRating = null;
var viewDetailsReturnToEmployee = null; // employeeId to reopen in Employee Profile when this modal closes, or null

// returnToEmployeeId: when set (only passed from the Employee Profile's rating
// history), closing this modal reopens that profile instead of just leaving
// the dashboard behind — otherwise closing this modal is final, as before.
function viewRatingDetails(ratingId, returnToEmployeeId, isPI) {
    viewDetailsReturnToEmployee = returnToEmployeeId || null;
    var rating = findRatingByIdAnywhere(ratingId, isPI);
    if (!rating) { toast('Rating not found. Refresh and try again.', 'warn'); return; }
    viewDetailsCurrentRating = rating;
    viewDetailsShowingOriginal = false;
    viewDetailsCompareMode = false;
    renderViewDetails(rating, false);
    // Show compare button only if counterpart exists
    var counterpart = findCounterpartRating(rating);
    var compareBtn = document.getElementById('compareToggleBtn');
    compareBtn.style.display = counterpart ? 'inline-flex' : 'none';
    compareBtn.title = 'Compare Self vs Manager';
    document.getElementById('viewDetailsModal').classList.add('active');
}

function renderViewDetails(rating, isOriginal) {
    var isSelf = rating.isSelfAssessment || false;
    var title = rating.employeeName + (rating.employeeId ? ' (' + rating.employeeId + ')' : '');
    document.getElementById('viewDetailsTitle').textContent = (isOriginal ? 'Original ' : '') + 'Rating Details — ' + title;

    var html = '';

    // Edit history toggle
    var hasHistory = rating.editHistory && rating.editHistory.length > 0;
    if (hasHistory) {
        html += '<div style="margin-bottom:1rem;text-align:right;">'
            + '<button class="btn btn-secondary btn-sm" onclick="toggleOriginalRatings()">'
            + (isOriginal ? 'View Current' : 'View Original') + '</button>'
            + '<span style="margin-left:0.75rem;font-size:0.8rem;color:var(--gray-medium);">Edited '
            + rating.editHistory.length + ' time(s), last: '
            + new Date(rating.editHistory[rating.editHistory.length - 1].timestamp).toLocaleString()
            + '</span></div>';
    }

    // Resolve display data before rendering (so header uses correct score)
    var displayRatings = rating.ratings || {};
    var displayKeeperTest = rating.keeperTest;
    var displayOverall = rating.overallScore;
    var displayOverallRating = rating.overallRating || '';

    if (isOriginal && hasHistory) {
        var first = rating.editHistory[0];
        displayRatings = first.previousRatings || {};
        displayKeeperTest = first.previousKeeperTest || null;
        displayOverall = first.previousOverallScore || 0;
        displayOverallRating = first.previousOverallRating || '';
    }

    // Header info
    html += '<div style="background:var(--cream);padding:1.25rem;border-radius:8px;margin-bottom:1.5rem;">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1.5rem;">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="margin-bottom:0.4rem;"><strong>Position:</strong> ' + (rating.position || '-') + '</div>'
        + '<div style="margin-bottom:0.4rem;"><strong>Review Period:</strong> ' + rating.reviewPeriod + '</div>'
        + '<div><strong>Reviewer:</strong> ' + rating.reviewerName + '</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0;">'
        + '<div style="font-size:2.5rem;font-weight:800;color:var(--purple-dark);line-height:1;">' + displayOverall.toFixed(2) + '</div>'
        + '<div style="font-size:0.9rem;color:var(--gray-medium);margin-top:0.25rem;">' + displayOverallRating + '</div>'
        + '</div></div></div>';

    if (isSelf) {
        html += renderSelfDetailRatings(displayRatings, displayOverall);
    } else {
        html += renderManagerDetailRatings(displayRatings, displayKeeperTest, displayOverall);
    }

    // Promotion & justification
    if (!isSelf && rating.promotionRecommendation) {
        var promoText = rating.promotionRecommendation === 'yes' ? 'Yes, recommended' : 'Not recommended';
        html += '<div style="background:#F0F7FF;padding:1rem;border-radius:8px;margin-top:1rem;border-left:4px solid #2196F3;">'
            + '<strong>Promotion Recommendation:</strong> ' + promoText + '</div>';
    }
    if (rating.justification) {
        html += '<div style="background:#FAFAFA;padding:1rem;border-radius:8px;margin-top:1rem;">'
            + '<strong>' + (isSelf ? 'Additional Comments' : 'Justification') + ':</strong><br>'
            + '<em style="color:var(--gray-medium);">' + rating.justification + '</em></div>';
    }

    // Management decision
    if (!isSelf && rating.managementDecision && rating.managementDecision.finalDecision) {
        html += '<div style="background:#E8F5E9;padding:1rem;border-radius:8px;margin-top:1rem;border-left:4px solid var(--success);">'
            + '<strong>Management Decision:</strong> ' + rating.managementDecision.finalDecision + '<br>'
            + '<small>Approved by: ' + rating.managementDecision.approvedBy + ' | Date: ' + rating.managementDecision.effectiveDate + '</small>'
            + (rating.managementDecision.managementNotes ? '<br><em style="color:var(--gray-medium);">' + rating.managementDecision.managementNotes + '</em>' : '')
            + '</div>';
    }

    // Submitted by
    if (rating.submittedByEmail) {
        html += '<div style="margin-top:1rem;font-size:0.82rem;color:var(--gray-medium);">'
            + 'Submitted by: ' + rating.submittedByName + ' (' + rating.submittedByEmail + ')'
            + ' on ' + new Date(rating.timestamp).toLocaleString() + '</div>';
    }

    document.getElementById('viewDetailsContent').innerHTML = html;
}

function renderSelfDetailRatings(r, overallScore) {
    var cats = [
        { idx: 0, name: 'Job Knowledge & Skills' },
        { idx: 1, name: 'Quality of Work' },
        { idx: 3, name: 'Problem Solving & Initiative' },
        { idx: 4, name: 'Teamwork & Collaboration' }
    ];
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';

    // Left: Individual ratings
    html += '<div>';
    html += '<h4 style="margin-bottom:0.75rem;color:var(--purple-dark);">Category Ratings</h4>';
    cats.forEach(function(c) {
        var val = r[c.idx] !== undefined ? Number(r[c.idx]).toFixed(1) : 'N/A';
        html += ratingRow(c.name, val);
    });

    // AI Utilization subs
    html += '<h4 style="margin-top:1rem;margin-bottom:0.5rem;color:var(--purple-dark);font-size:0.95rem;">AI Utilization</h4>';
    if (r.ai_subs) {
        html += ratingRow('Adoption', r.ai_subs.adoption !== null ? r.ai_subs.adoption : 'N/A');
        html += ratingRow('Fluency', r.ai_subs.fluency !== null ? r.ai_subs.fluency : 'N/A');
        html += ratingRow('Impact', r.ai_subs.impact !== null ? r.ai_subs.impact : 'N/A');
    }
    var aiAvg = r[5] !== undefined ? Number(r[5]).toFixed(2) : 'N/A';
    html += ratingRow('AI Utilization (avg)', aiAvg, true);
    html += '</div>';

    // Right: Accountability + OKR
    html += '<div>';
    html += '<h4 style="margin-bottom:0.75rem;color:var(--purple-dark);">Accountability, Efficiency & Competency</h4>';
    if (r.acc_subs) {
        html += ratingRow('Accountability', r.acc_subs.accountability !== null ? r.acc_subs.accountability : 'N/A');
        html += ratingRow('Efficiency', r.acc_subs.efficiency !== null ? r.acc_subs.efficiency : 'N/A');
        html += ratingRow('Competency', r.acc_subs.competency !== null ? r.acc_subs.competency : 'N/A');
    }
    var accAvg = r[7] !== undefined ? Number(r[7]).toFixed(2) : 'N/A';
    html += ratingRow('AEC (avg)', accAvg, true);

    html += '<h4 style="margin-top:1rem;margin-bottom:0.5rem;color:var(--purple-dark);font-size:0.95rem;">OKR Completion</h4>';
    var okrPct = r.okr_percent;
    var okrScore = r[10] !== undefined ? Number(r[10]).toFixed(2) : 'N/A';
    html += ratingRow('OKR %', okrPct !== undefined && okrPct !== null ? okrPct + '%' : 'N/A');
    html += ratingRow('OKR Score', okrScore, true);
    html += '</div>';

    html += '</div>';
    return html;
}

function renderManagerDetailRatings(r, keeperTest, overallScore, hideSensitive) {
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';

    // Left: Accountability + AI
    html += '<div>';
    html += '<h4 style="margin-bottom:0.75rem;color:var(--purple-dark);">Accountability, Efficiency & Competency (25%)</h4>';
    if (r.acc_subs) {
        html += ratingRow('Accountability', r.acc_subs.accountability !== null ? r.acc_subs.accountability : 'N/A');
        html += ratingRow('Efficiency', r.acc_subs.efficiency !== null ? r.acc_subs.efficiency : 'N/A');
        html += ratingRow('Competency', r.acc_subs.competency !== null ? r.acc_subs.competency : 'N/A');
    }
    var accAvg = r[2] !== undefined ? Number(r[2]).toFixed(2) : 'N/A';
    html += ratingRow('Section Average', accAvg, true);

    html += '<h4 style="margin-top:1rem;margin-bottom:0.5rem;color:var(--purple-dark);">AI Utilization (25%)</h4>';
    if (r.ai_subs) {
        html += ratingRow('Adoption', r.ai_subs.adoption !== null ? r.ai_subs.adoption : 'N/A');
        html += ratingRow('Fluency', r.ai_subs.fluency !== null ? r.ai_subs.fluency : 'N/A');
        html += ratingRow('Impact', r.ai_subs.impact !== null ? r.ai_subs.impact : 'N/A');
    }
    var aiAvg = r[5] !== undefined ? Number(r[5]).toFixed(2) : 'N/A';
    html += ratingRow('Section Average', aiAvg, true);
    html += '</div>';

    // Right: OKR + Keeper Test
    html += '<div>';
    html += '<h4 style="margin-bottom:0.75rem;color:var(--purple-dark);">OKR % Completion (25%)</h4>';
    var okrPct = r.okr_percent;
    var okrScore = r[6] !== undefined ? Number(r[6]).toFixed(2) : 'N/A';
    html += ratingRow('OKR %', okrPct !== undefined && okrPct !== null ? okrPct + '%' : 'N/A');
    html += ratingRow('OKR Score', okrScore, true);

    // Keeper Test is an internal retention signal for managers/HR/admin only —
    // skipped entirely (not just redacted) when rendering for the employee's
    // own self-assessment form.
    if (!hideSensitive) {
        html += '<h4 style="margin-top:1rem;margin-bottom:0.5rem;color:var(--purple-dark);">Keeper Test (25%)</h4>';
        if (keeperTest && keeperTest.responses) {
            var ktScore = keeperTest.responses.kt_retention_score;
            html += ratingRow('Retention Score', ktScore !== null && ktScore !== undefined ? ktScore + ' / 5' : 'N/A');
            html += ratingRow('Verdict', (keeperTest.verdict || '-').replace(/_/g, ' '), true);
            if (keeperTest.comments && keeperTest.comments.kt_keeper_comment) {
                html += '<div style="margin-top:0.5rem;padding:0.75rem;background:#F8F4FF;border-radius:6px;font-size:0.88rem;color:var(--gray-dark);">'
                    + '<strong>Comment:</strong> ' + keeperTest.comments.kt_keeper_comment + '</div>';
            }
        } else {
            html += ratingRow('Keeper Test', 'Not completed');
        }
    }
    html += '</div>';

    html += '</div>';
    return html;
}

function ratingRow(label, value, isBold) {
    return '<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid #f0f0f0;'
        + (isBold ? 'font-weight:700;background:#FAFAFA;padding:0.5rem 0.5rem;border-radius:4px;margin-top:0.25rem;' : '')
        + '"><span>' + label + '</span><span style="color:var(--purple-dark);font-weight:600;">' + value + '</span></div>';
}

function toggleOriginalRatings() {
    if (!viewDetailsCurrentRating) return;
    viewDetailsShowingOriginal = !viewDetailsShowingOriginal;
    renderViewDetails(viewDetailsCurrentRating, viewDetailsShowingOriginal);
}

function closeViewDetailsModal() {
    document.getElementById('viewDetailsModal').classList.remove('active');
    viewDetailsCurrentRating = null;
    viewDetailsCompareMode = false;
    if (viewDetailsReturnToEmployee) {
        var emp = findEmployeeById(viewDetailsReturnToEmployee);
        viewDetailsReturnToEmployee = null;
        if (emp) openEmployeeProfile(emp);
    }
}

// ─── COMPARE SELF vs MANAGER ─────────────────────────────────────
var viewDetailsCompareMode = false;

function findCounterpartRating(rating) {
    if (!rating) return null;
    var targetIsSelf = !rating.isSelfAssessment;
    var pool = ratingsCache.concat(
        Object.values(teamRatingsCurrent.ratingsByEmployee),
        Object.values(teamRatingsCurrent.selfByEmployee),
        piRatingsCache
    );
    return pool.find(function(r) {
        return r.employeeId === rating.employeeId
            && r.reviewPeriod === rating.reviewPeriod
            && r.isSelfAssessment === targetIsSelf;
    }) || null;
}

function toggleCompareView() {
    if (!viewDetailsCurrentRating) return;
    viewDetailsCompareMode = !viewDetailsCompareMode;
    var btn = document.getElementById('compareToggleBtn');
    if (viewDetailsCompareMode) {
        btn.title = 'Back to details';
        renderCompareView(viewDetailsCurrentRating);
    } else {
        btn.title = 'Compare Self vs Manager';
        renderViewDetails(viewDetailsCurrentRating, viewDetailsShowingOriginal);
    }
}

function renderCompareView(rating) {
    var counterpart = findCounterpartRating(rating);
    if (!counterpart) { toast('No counterpart assessment found for this employee/period.', 'warn'); viewDetailsCompareMode = false; return; }

    var selfR = rating.isSelfAssessment ? rating : counterpart;
    var mgrR  = rating.isSelfAssessment ? counterpart : rating;

    document.getElementById('viewDetailsTitle').textContent = 'Self vs Manager — ' + rating.employeeName;
    document.getElementById('compareToggleBtn').title = 'Back to details';

    var html = '';
    // Header
    html += '<div style="background:var(--cream);padding:1.25rem;border-radius:8px;margin-bottom:1.5rem;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<div><strong>Position:</strong> ' + (rating.position || '-') + ' &nbsp;|&nbsp; <strong>Period:</strong> ' + rating.reviewPeriod + '</div>'
        + '<div style="display:flex;gap:2rem;text-align:center;">'
        + '<div><div style="font-size:1.8rem;font-weight:800;color:#4CAF50;">' + selfR.overallScore.toFixed(2) + '</div><div style="font-size:0.78rem;color:var(--gray-medium);">Self</div></div>'
        + '<div><div style="font-size:1.8rem;font-weight:800;color:var(--purple-dark);">' + mgrR.overallScore.toFixed(2) + '</div><div style="font-size:0.78rem;color:var(--gray-medium);">Manager</div></div>'
        + '</div></div></div>';

    // Shared categories: AEC subs + AI subs + OKR
    html += '<h4 style="margin-bottom:0.75rem;color:var(--purple-dark);">Accountability, Efficiency & Competency</h4>';
    var accFields = [
        { label: 'Accountability', get: function(r){ return r.ratings.acc_subs ? r.ratings.acc_subs.accountability : null; } },
        { label: 'Efficiency',     get: function(r){ return r.ratings.acc_subs ? r.ratings.acc_subs.efficiency : null; } },
        { label: 'Competency',     get: function(r){ return r.ratings.acc_subs ? r.ratings.acc_subs.competency : null; } },
        { label: 'AEC Average',    get: function(r){ var idx = r.isSelfAssessment ? 7 : 2; return r.ratings[idx]; }, bold: true }
    ];
    html += renderCompareRows(accFields, selfR, mgrR);

    html += '<h4 style="margin-top:1.25rem;margin-bottom:0.75rem;color:var(--purple-dark);">AI Utilization</h4>';
    var aiFields = [
        { label: 'Adoption', get: function(r){ return r.ratings.ai_subs ? r.ratings.ai_subs.adoption : null; } },
        { label: 'Fluency',  get: function(r){ return r.ratings.ai_subs ? r.ratings.ai_subs.fluency : null; } },
        { label: 'Impact',   get: function(r){ return r.ratings.ai_subs ? r.ratings.ai_subs.impact : null; } },
        { label: 'AI Average', get: function(r){ return r.ratings[5]; }, bold: true }
    ];
    html += renderCompareRows(aiFields, selfR, mgrR);

    html += '<h4 style="margin-top:1.25rem;margin-bottom:0.75rem;color:var(--purple-dark);">OKR Completion</h4>';
    var okrFields = [
        { label: 'OKR %',     get: function(r){ return r.ratings.okr_percent != null ? r.ratings.okr_percent + '%' : null; }, raw: true },
        { label: 'OKR Score', get: function(r){ var idx = r.isSelfAssessment ? 10 : 6; return r.ratings[idx]; }, bold: true }
    ];
    html += renderCompareRows(okrFields, selfR, mgrR);

    // These four categories are only ever rated in the self-assessment — the manager
    // form has no equivalent fields for them. A Manager/Diff column here would always
    // read as blank, which looks like a missed score rather than a structural gap, so
    // this renders as a single Score column instead of reusing renderCompareRows.
    html += '<h4 style="margin-top:1.25rem;margin-bottom:0.75rem;color:var(--purple-dark);">Assessment Categories</h4>';
    var selfOnlyCats = [
        { label: 'Job Knowledge & Skills',      get: function(r){ return r.ratings[0]; } },
        { label: 'Quality of Work',              get: function(r){ return r.ratings[1]; } },
        { label: 'Problem Solving & Initiative', get: function(r){ return r.ratings[3]; } },
        { label: 'Teamwork & Collaboration',     get: function(r){ return r.ratings[4]; } }
    ];
    html += renderSelfOnlyRows(selfOnlyCats, selfR);

    // Manager-only: Keeper Test
    if (mgrR.keeperTest && mgrR.keeperTest.responses) {
        html += '<h4 style="margin-top:1.25rem;margin-bottom:0.75rem;color:var(--purple-dark);">Keeper Test (Manager Only)</h4>';
        var ktScore = mgrR.keeperTest.responses.kt_retention_score;
        html += '<div style="display:flex;justify-content:space-between;padding:0.5rem 0.5rem;background:#F8F4FF;border-radius:4px;">'
            + '<span>Retention Score</span><span style="font-weight:700;color:var(--purple-dark);">'
            + (ktScore != null ? ktScore + ' / 5' : 'N/A') + '</span></div>';
    }

    document.getElementById('viewDetailsContent').innerHTML = html;
}

function renderCompareRows(fields, selfR, mgrR) {
    var html = '<div style="border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">';
    // Header row
    html += '<div style="display:grid;grid-template-columns:1fr 80px 80px 80px;padding:0.5rem 0.75rem;background:var(--purple-dark);color:#fff;font-size:0.82rem;font-weight:600;">'
        + '<span>Category</span><span style="text-align:center;">Self</span><span style="text-align:center;">Manager</span><span style="text-align:center;">Diff</span></div>';
    fields.forEach(function(f) {
        var sv = f.get(selfR);
        var mv = f.get(mgrR);
        var svFmt = f.raw ? (sv != null ? sv : 'N/A') : (sv != null ? Number(sv).toFixed(1) : '—');
        var mvFmt = f.raw ? (mv != null ? mv : 'N/A') : (mv != null ? Number(mv).toFixed(1) : '—');
        var diff = '';
        var diffColor = 'var(--gray-medium)';
        if (sv != null && mv != null && !f.raw) {
            var d = Number(mv) - Number(sv);
            diff = (d > 0 ? '+' : '') + d.toFixed(1);
            diffColor = d > 0 ? '#4CAF50' : d < 0 ? '#F44336' : 'var(--gray-medium)';
        }
        var bg = f.bold ? '#FAFAFA' : '#fff';
        var fw = f.bold ? '700' : '400';
        html += '<div style="display:grid;grid-template-columns:1fr 80px 80px 80px;padding:0.5rem 0.75rem;border-top:1px solid #f0f0f0;background:' + bg + ';font-weight:' + fw + ';">'
            + '<span>' + f.label + '</span>'
            + '<span style="text-align:center;color:#4CAF50;">' + svFmt + '</span>'
            + '<span style="text-align:center;color:var(--purple-dark);">' + mvFmt + '</span>'
            + '<span style="text-align:center;color:' + diffColor + ';font-weight:600;">' + diff + '</span>'
            + '</div>';
    });
    html += '</div>';
    return html;
}

function renderSelfOnlyRows(fields, selfR) {
    var html = '<div style="border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">';
    html += '<div style="display:grid;grid-template-columns:1fr 80px;padding:0.5rem 0.75rem;background:var(--purple-dark);color:#fff;font-size:0.82rem;font-weight:600;">'
        + '<span>Category</span><span style="text-align:center;">Score</span></div>';
    fields.forEach(function(f) {
        var sv = f.get(selfR);
        var svFmt = sv != null ? Number(sv).toFixed(1) : '—';
        html += '<div style="display:grid;grid-template-columns:1fr 80px;padding:0.5rem 0.75rem;border-top:1px solid #f0f0f0;background:#fff;">'
            + '<span>' + f.label + '</span>'
            + '<span style="text-align:center;color:#4CAF50;">' + svFmt + '</span>'
            + '</div>';
    });
    html += '</div>';
    return html;
}

// ─── ADMIN EDIT RATINGS MODAL ────────────────────────────────────
// Also doubles as the "Add PI Rating" modal (see openAddPIRatingModal below) —
// editRatingsMode distinguishes editing an existing row (any table) from
// inserting a brand-new one (PI only, since annual already requires an
// employee/manager to submit first and has no admin "create from nothing").
var editRatingsCurrentId = null;
var editRatingsCurrentTable = 'performance_reviews';
var editRatingsMode = 'edit'; // 'edit' | 'add'
var addPIRatingEmployeeId = null;
var addPIRatingIsSelf = null;

function openEditRatingsModal(ratingId, isPI) {
    isPI = !!isPI;
    var rating = (isPI ? piRatingsCache : ratingsCache).find(function(r){ return r.id === ratingId; });
    if (!rating) { toast('Rating not found. Refresh the dashboard.', 'warn'); return; }
    editRatingsMode = 'edit';
    editRatingsCurrentId = ratingId;
    editRatingsCurrentTable = isPI ? 'pi_reviews' : 'performance_reviews';
    var isSelf = rating.isSelfAssessment || false;
    var r = rating.ratings || {};

    var titleEl = document.getElementById('editRatingsModalTitle');
    if (titleEl) titleEl.textContent = (isPI ? 'Edit PI Rating' : 'Edit Ratings & OKRs');
    var saveBtn = document.getElementById('editRatingsSaveBtn');
    if (saveBtn) saveBtn.textContent = 'Save Changes';

    // Employee info header
    document.getElementById('editRatingsEmployeeInfo').innerHTML =
        '<div style="background:var(--cream);padding:1.25rem;border-radius:8px;margin-bottom:1.5rem;">'
        + '<h4 style="margin-bottom:0.5rem;color:var(--purple-dark);">' + rating.employeeName + (rating.employeeId ? ' (' + rating.employeeId + ')' : '') + '</h4>'
        + '<p><strong>Position:</strong> ' + (rating.position || '-')
        + ' &nbsp;|&nbsp; <strong>Review Period:</strong> ' + (isPI ? PI_REVIEW_PERIOD_LABEL : rating.reviewPeriod)
        + ' &nbsp;|&nbsp; <strong>Reviewer:</strong> ' + rating.reviewerName
        + ' &nbsp;|&nbsp; <strong>Type:</strong> ' + (isSelf ? 'Self Assessment' : 'Manager Rating') + '</p>'
        + '<p style="font-size:0.85rem;color:var(--gray-medium);margin-top:0.5rem;">Current Overall: '
        + rating.overallScore.toFixed(2) + (rating.overallRating ? ' — ' + rating.overallRating : '') + '</p>'
        + '</div>';

    var html = '';
    if (isSelf) {
        html = buildSelfEditFields(r);
    } else {
        html = buildManagerEditFields(r, rating.keeperTest);
    }
    document.getElementById('editRatingsFields').innerHTML = html;
    document.getElementById('editRatingsModal').classList.add('active');
}

function buildSelfEditFields(r) {
    var cats = [
        { idx: 0, name: 'Job Knowledge & Skills' },
        { idx: 1, name: 'Quality of Work' },
        { idx: 3, name: 'Problem Solving & Initiative' },
        { idx: 4, name: 'Teamwork & Collaboration' }
    ];
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">';

    // Left column
    html += '<div>';
    html += '<h4 style="margin-bottom:0.75rem;color:var(--purple-dark);">Category Ratings (1-5)</h4>';
    cats.forEach(function(c) {
        var val = r[c.idx] !== undefined ? Number(r[c.idx]) : '';
        html += editField('edit_self_' + c.idx, c.name, val, 1, 5, 0.1);
    });

    html += '<h4 style="margin-top:1rem;margin-bottom:0.5rem;color:var(--purple-dark);">AI Utilization (1-5 each)</h4>';
    var ai = r.ai_subs || {};
    html += editField('edit_self_ai_adoption', 'Adoption', ai.adoption, 1, 5, 1);
    html += editField('edit_self_ai_fluency', 'Fluency', ai.fluency, 1, 5, 1);
    html += editField('edit_self_ai_impact', 'Impact', ai.impact, 1, 5, 1);
    html += '</div>';

    // Right column
    html += '<div>';
    html += '<h4 style="margin-bottom:0.75rem;color:var(--purple-dark);">Accountability, Efficiency & Competency (1-5 each)</h4>';
    var acc = r.acc_subs || {};
    html += editField('edit_self_acc_accountability', 'Accountability', acc.accountability, 1, 5, 1);
    html += editField('edit_self_acc_efficiency', 'Efficiency', acc.efficiency, 1, 5, 1);
    html += editField('edit_self_acc_competency', 'Competency', acc.competency, 1, 5, 1);

    html += '<h4 style="margin-top:1rem;margin-bottom:0.5rem;color:var(--purple-dark);">OKR Completion</h4>';
    var okrPct = r.okr_percent;
    html += editField('edit_self_okr_percent', 'OKR % (0-100)', okrPct !== undefined && okrPct !== null ? okrPct : '', 0, 100, 1);
    html += '</div>';

    html += '</div>';
    return html;
}

function buildManagerEditFields(r, keeperTest) {
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">';

    // Left column: Accountability + AI
    html += '<div>';
    html += '<h4 style="margin-bottom:0.75rem;color:var(--purple-dark);">Accountability, Efficiency & Competency (1-5 each)</h4>';
    var acc = r.acc_subs || {};
    html += editField('edit_mgr_acc_accountability', 'Accountability', acc.accountability, 1, 5, 1);
    html += editField('edit_mgr_acc_efficiency', 'Efficiency', acc.efficiency, 1, 5, 1);
    html += editField('edit_mgr_acc_competency', 'Competency', acc.competency, 1, 5, 1);

    html += '<h4 style="margin-top:1rem;margin-bottom:0.5rem;color:var(--purple-dark);">AI Utilization (1-5 each)</h4>';
    var ai = r.ai_subs || {};
    html += editField('edit_mgr_ai_adoption', 'Adoption', ai.adoption, 1, 5, 1);
    html += editField('edit_mgr_ai_fluency', 'Fluency', ai.fluency, 1, 5, 1);
    html += editField('edit_mgr_ai_impact', 'Impact', ai.impact, 1, 5, 1);
    html += '</div>';

    // Right column: OKR + Keeper
    html += '<div>';
    html += '<h4 style="margin-bottom:0.75rem;color:var(--purple-dark);">OKR % Completion</h4>';
    var okrPct = r.okr_percent;
    html += editField('edit_mgr_okr_percent', 'OKR % (0-100)', okrPct !== undefined && okrPct !== null ? okrPct : '', 0, 100, 1);

    html += '<h4 style="margin-top:1rem;margin-bottom:0.5rem;color:var(--purple-dark);">Keeper Test</h4>';
    var ktScore = keeperTest && keeperTest.responses ? keeperTest.responses.kt_retention_score : '';
    var ktVal = ktScore !== null && ktScore !== undefined ? ktScore : '';
    html += '<div class="form-field" style="margin-bottom:0.75rem;">'
        + '<label style="font-size:0.88rem;font-weight:600;">Retention Score</label>'
        + '<select id="edit_mgr_kt_score" style="padding:0.5rem;border:1.5px solid #ddd;border-radius:6px;width:100%;font-size:0.95rem;">'
        + '<option value=""' + (ktVal === '' ? ' selected' : '') + '>— Not Completed —</option>'
        + '<option value="0"' + (ktVal === 0 ? ' selected' : '') + '>0 — Plan Exit</option>'
        + '<option value="2"' + (ktVal === 2 ? ' selected' : '') + '>2 — Would Not Fight to Retain</option>'
        + '<option value="3"' + (ktVal === 3 ? ' selected' : '') + '>3 — Okay if Stay / Leave</option>'
        + '<option value="4"' + (ktVal === 4 ? ' selected' : '') + '>4 — Strongly Prefer to Retain</option>'
        + '<option value="5"' + (ktVal === 5 ? ' selected' : '') + '>5 — Fight to Retain</option>'
        + '</select></div>';
    html += '</div>';

    html += '</div>';
    return html;
}

function editField(id, label, value, min, max, step) {
    return '<div class="form-field" style="margin-bottom:0.75rem;">'
        + '<label style="font-size:0.88rem;font-weight:600;">' + label + '</label>'
        + '<input type="number" id="' + id + '" value="' + (value !== null && value !== undefined ? value : '') + '" '
        + 'min="' + min + '" max="' + max + '" step="' + step + '" '
        + 'style="padding:0.5rem;border:1.5px solid #ddd;border-radius:6px;width:100%;font-size:0.95rem;">'
        + '</div>';
}

function closeEditRatingsModal() {
    document.getElementById('editRatingsModal').classList.remove('active');
    editRatingsCurrentId = null;
    editRatingsCurrentTable = 'performance_reviews';
    editRatingsMode = 'edit';
    addPIRatingEmployeeId = null;
    addPIRatingIsSelf = null;
}

async function saveEditedRatings() {
    if (editRatingsMode === 'add') { await saveNewPIRating(); return; }

    if (!editRatingsCurrentId) return;
    var isPI = editRatingsCurrentTable === 'pi_reviews';
    var rating = isPI
        ? piRatingsCache.find(function(r){ return r.id === editRatingsCurrentId; })
        : ratingsCache.find(function(r){ return r.id === editRatingsCurrentId; });
    if (!rating) { toast('Rating not found.', 'error'); return; }
    var isSelf = rating.isSelfAssessment || false;

    var newRatings, newOverallScore, newOverallRating, newKeeperTest;

    if (isSelf) {
        var parsed = parseSelfEditFields();
        if (!parsed) return;
        newRatings = parsed.ratings;
        newOverallScore = parsed.overallScore;
        newKeeperTest = null;
    } else {
        var parsed = parseManagerEditFields(rating);
        if (!parsed) return;
        newRatings = parsed.ratings;
        newOverallScore = parsed.overallScore;
        newKeeperTest = parsed.keeperTest;
    }

    newOverallRating = newOverallScore >= 4.5 ? 'Exceptional'
                     : newOverallScore >= 3.5 ? 'Exceeds Expectations'
                     : newOverallScore >= 2.5 ? 'Meets Expectations'
                     : newOverallScore >= 1.5 ? 'Needs Improvement'
                     : 'Unsatisfactory';

    try {
        var updateBody = {
            ratings: newRatings,
            overall_score: parseFloat(newOverallScore.toFixed(2))
        };
        if (newKeeperTest !== undefined) {
            updateBody.keeper_test = newKeeperTest;
        }

        // pi_reviews has no overall_rating/edit_history/last_edited_at/last_edited_by
        // columns (see normalizePIRating) — only performance_reviews tracks edit history.
        if (!isPI) {
            var snapshot = {
                timestamp: new Date().toISOString(),
                editedBy: currentSSOUser ? currentSSOUser.email : 'admin',
                previousRatings: JSON.parse(JSON.stringify(rating.ratings)),
                previousOverallScore: rating.overallScore,
                previousOverallRating: rating.overallRating,
                previousKeeperTest: rating.keeperTest ? JSON.parse(JSON.stringify(rating.keeperTest)) : null
            };
            var existingHistory = rating.editHistory || [];
            updateBody.overall_rating = isSelf ? '' : newOverallRating;
            updateBody.edit_history = existingHistory.concat([snapshot]);
            updateBody.last_edited_at = new Date().toISOString();
            updateBody.last_edited_by = currentSSOUser ? currentSSOUser.email : 'admin';
        }

        await sbUpdateIn(editRatingsCurrentTable, editRatingsCurrentId, updateBody);
        toast('Ratings updated successfully!', 'success');
        closeEditRatingsModal();
        if (isPI) { renderPIReport(); } else { loadAdminData(); }
    } catch(err) {
        console.error('saveEditedRatings:', err);
        toast('Error saving ratings. Please try again.', 'error');
    }
}

// ─── ADMIN: ADD A NEW PI RATING FROM NOTHING ─────────────────────
// PI-only — annual review has no equivalent since it already requires the
// employee/manager to submit first. Opens the same field UI as the edit
// modal (built from an empty ratings object), but inserts instead of updates.
function openAddPIRatingModal(empId, isSelf) {
    var emp = findEmployeeById(empId);
    if (!emp) { toast('Employee not found.', 'warn'); return; }
    if (!isPIEligible(empId)) { toast('This employee is not on the Performance Incentive eligibility list.', 'error'); return; }

    editRatingsMode = 'add';
    editRatingsCurrentId = null;
    editRatingsCurrentTable = 'pi_reviews';
    addPIRatingEmployeeId = empId;
    addPIRatingIsSelf = isSelf;

    var titleEl = document.getElementById('editRatingsModalTitle');
    if (titleEl) titleEl.textContent = 'Add PI ' + (isSelf ? 'Self Assessment' : 'Manager Rating') + ' (Admin)';
    var saveBtn = document.getElementById('editRatingsSaveBtn');
    if (saveBtn) saveBtn.textContent = isSelf ? 'Save Self Assessment' : 'Save Manager Rating';

    document.getElementById('editRatingsEmployeeInfo').innerHTML =
        '<div style="background:var(--cream);padding:1.25rem;border-radius:8px;margin-bottom:1.5rem;">'
        + '<h4 style="margin-bottom:0.5rem;color:var(--purple-dark);">' + emp.name + ' (' + emp.id + ')</h4>'
        + '<p><strong>Position:</strong> ' + (emp.designation || '-')
        + ' &nbsp;|&nbsp; <strong>Review Period:</strong> ' + PI_REVIEW_PERIOD_LABEL
        + ' &nbsp;|&nbsp; <strong>Type:</strong> ' + (isSelf ? 'Self Assessment' : 'Manager Rating') + '</p>'
        + '</div>';

    var html = '';
    if (!isSelf) {
        html += '<div class="form-field" style="margin-bottom:1rem;">'
            + '<label style="font-size:0.88rem;font-weight:600;">Reviewer Name</label>'
            + '<input type="text" id="add_pi_reviewer_name" value="' + (emp.manager || '') + '" '
            + 'style="padding:0.5rem;border:1.5px solid #ddd;border-radius:6px;width:100%;font-size:0.95rem;">'
            + '</div>'
            + '<p style="font-size:0.78rem;color:var(--gray-medium);margin:-0.5rem 0 1rem;">Pre-filled with this employee\'s manager on record. Editable if they\'ve since changed teams or left.</p>';
    }
    html += isSelf ? buildSelfEditFields({}) : buildManagerEditFields({}, null);
    document.getElementById('editRatingsFields').innerHTML = html;
    document.getElementById('editRatingsModal').classList.add('active');
}

async function saveNewPIRating() {
    var empId = addPIRatingEmployeeId;
    var isSelf = addPIRatingIsSelf;
    var emp = findEmployeeById(empId);
    if (!emp) { toast('Employee not found.', 'error'); return; }

    var parsed = isSelf ? parseSelfEditFields() : parseManagerEditFields(null);
    if (!parsed) return;

    var reviewerName = isSelf
        ? (emp.name + ' (Self)')
        : (document.getElementById('add_pi_reviewer_name').value || '').trim();
    if (!isSelf && !reviewerName) { toast('Please enter a reviewer name.', 'warn'); return; }

    // Guard against a duplicate slipping in between opening this modal and saving.
    // Unlike the reactive banner checks elsewhere, this fails CLOSED: if the
    // existence check itself errors, we block the insert rather than risk
    // silently creating a duplicate bonus-linked row (verified this matters —
    // a network hiccup here previously let a real duplicate through in testing).
    try {
        var existing = await sbSelectFrom('pi_reviews',
            'employee_id=eq.' + encodeURIComponent(empId) +
            '&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD) +
            '&is_self_assessment=eq.' + (isSelf ? 'true' : 'false') + '&select=id');
        if (existing && existing.length > 0) {
            toast('A PI ' + (isSelf ? 'self-assessment' : 'manager rating') + ' already exists for this employee — use Edit instead.', 'warn');
            return;
        }
    } catch(e) {
        console.error('saveNewPIRating existing check:', e);
        toast('Could not verify whether a rating already exists — not saving. Please try again.', 'error');
        return;
    }

    var ssoInfo = getSSOSubmitterInfo(); // records the admin who actually entered this, separate from reviewerName
    var row = {
        employee_id:         empId,
        employee_name:       emp.name,
        position:            emp.designation || '',
        review_period:       PI_REVIEW_PERIOD,
        reviewer_name:       reviewerName,
        ratings:             parsed.ratings,
        overall_score:       parseFloat(parsed.overallScore.toFixed(2)),
        is_self_assessment:  isSelf,
        submitted_by_email:  ssoInfo.submitted_by_email,
        submitted_by_name:   ssoInfo.submitted_by_name
    };
    if (!isSelf && parsed.keeperTest) row.keeper_test = parsed.keeperTest;

    try {
        await sbInsertInto('pi_reviews', row);
        toast('PI ' + (isSelf ? 'self-assessment' : 'manager rating') + ' added successfully!', 'success');
        closeEditRatingsModal();
        renderPIReport();
    } catch(err) {
        console.error('saveNewPIRating:', err);
        toast('Error saving PI rating. ' + (err.message || ''), 'error');
    }
}

function parseSelfEditFields() {
    var r = {};
    var cats = [0, 1, 3, 4];
    for (var i = 0; i < cats.length; i++) {
        var val = parseFloat(document.getElementById('edit_self_' + cats[i]).value);
        if (isNaN(val) || val < 1 || val > 5) {
            toast('All category ratings must be between 1 and 5.', 'warn'); return null;
        }
        r[cats[i]] = val;
    }

    // AI subs
    var aiAdoption = parseFloat(document.getElementById('edit_self_ai_adoption').value);
    var aiFluency = parseFloat(document.getElementById('edit_self_ai_fluency').value);
    var aiImpact = parseFloat(document.getElementById('edit_self_ai_impact').value);
    if ([aiAdoption, aiFluency, aiImpact].some(function(v){ return isNaN(v) || v < 1 || v > 5; })) {
        toast('AI sub-ratings must be between 1 and 5.', 'warn'); return null;
    }
    r.ai_subs = { adoption: aiAdoption, fluency: aiFluency, impact: aiImpact };
    r[5] = (aiAdoption + aiFluency + aiImpact) / 3;

    // Accountability subs
    var accA = parseFloat(document.getElementById('edit_self_acc_accountability').value);
    var accE = parseFloat(document.getElementById('edit_self_acc_efficiency').value);
    var accC = parseFloat(document.getElementById('edit_self_acc_competency').value);
    if ([accA, accE, accC].some(function(v){ return isNaN(v) || v < 1 || v > 5; })) {
        toast('Accountability/Efficiency/Competency ratings must be between 1 and 5.', 'warn'); return null;
    }
    r.acc_subs = { accountability: accA, efficiency: accE, competency: accC };
    r[7] = (accA + accE + accC) / 3;

    // OKR
    var okrPct = parseFloat(document.getElementById('edit_self_okr_percent').value);
    if (isNaN(okrPct) || okrPct < 0 || okrPct > 100) {
        toast('OKR % must be between 0 and 100.', 'warn'); return null;
    }
    r.okr_percent = okrPct;
    r[10] = (okrPct / 100) * 5;

    // Calculate self overall: weighted (70% non-AI / 30% AI)
    var NON_AI_W = 70 / 6;
    var AI_W = 30;
    var NON_AI_INDICES = [0, 1, 3, 4, 7, 10];
    var wSum = 0, wTotal = 0;
    NON_AI_INDICES.forEach(function(idx) {
        if (r[idx] !== undefined) { wSum += r[idx] * NON_AI_W; wTotal += NON_AI_W; }
    });
    if (r[5] !== undefined) { wSum += r[5] * AI_W; wTotal += AI_W; }
    var overallScore = wTotal > 0 ? wSum / wTotal : 0;

    return { ratings: r, overallScore: overallScore };
}

function parseManagerEditFields(existingRating) {
    var r = {};

    // Accountability subs
    var accA = parseFloat(document.getElementById('edit_mgr_acc_accountability').value);
    var accE = parseFloat(document.getElementById('edit_mgr_acc_efficiency').value);
    var accC = parseFloat(document.getElementById('edit_mgr_acc_competency').value);
    if ([accA, accE, accC].some(function(v){ return isNaN(v) || v < 1 || v > 5; })) {
        toast('Accountability/Efficiency/Competency ratings must be between 1 and 5.', 'warn'); return null;
    }
    r.acc_subs = { accountability: accA, efficiency: accE, competency: accC };
    r[2] = (accA + accE + accC) / 3;

    // AI subs
    var aiAdoption = parseFloat(document.getElementById('edit_mgr_ai_adoption').value);
    var aiFluency = parseFloat(document.getElementById('edit_mgr_ai_fluency').value);
    var aiImpact = parseFloat(document.getElementById('edit_mgr_ai_impact').value);
    if ([aiAdoption, aiFluency, aiImpact].some(function(v){ return isNaN(v) || v < 1 || v > 5; })) {
        toast('AI sub-ratings must be between 1 and 5.', 'warn'); return null;
    }
    r.ai_subs = { adoption: aiAdoption, fluency: aiFluency, impact: aiImpact };
    r[5] = (aiAdoption + aiFluency + aiImpact) / 3;

    // OKR
    var okrPct = parseFloat(document.getElementById('edit_mgr_okr_percent').value);
    if (isNaN(okrPct) || okrPct < 0 || okrPct > 100) {
        toast('OKR % must be between 0 and 100.', 'warn'); return null;
    }
    r.okr_percent = okrPct;
    r[6] = (okrPct / 100) * 5;

    // Keeper test score
    var ktScoreVal = document.getElementById('edit_mgr_kt_score').value;
    var newKeeperTest = null;
    var ktHasValue = ktScoreVal !== '';

    if (ktHasValue) {
        var ktScore = parseInt(ktScoreVal, 10);
        var validKTScores = [0, 2, 3, 4, 5];
        if (validKTScores.indexOf(ktScore) === -1) {
            toast('Invalid Keeper Test score.', 'warn'); return null;
        }
        newKeeperTest = (existingRating && existingRating.keeperTest) ? JSON.parse(JSON.stringify(existingRating.keeperTest)) : {
            completedAt: new Date().toISOString(),
            responses: {},
            comments: {},
            verdict: ''
        };
        newKeeperTest.responses = newKeeperTest.responses || {};
        newKeeperTest.responses.kt_retention_score = ktScore;
        var meta = KT_SCORE_LABELS[ktScore];
        newKeeperTest.verdict = meta ? meta.label : 'Score: ' + ktScore;
    }
    // else: keeper test left blank — preserve null (not completed)

    // Manager overall: sections × 25% each; skip keeper test if not completed
    var sections = [r[2], r[5], r[6]];
    if (ktHasValue) sections.push(parseInt(ktScoreVal, 10));
    var overallScore = sections.reduce(function(a, b){ return a + b; }, 0) / (ktHasValue ? 4 : 3);

    return { ratings: r, overallScore: overallScore, keeperTest: newKeeperTest };
}

// ─── LEGACY FUNCTIONS (kept for backward compat) ─────────────────
function initializeManagerForm() {
    // No longer needed - manager selection is now autocomplete-based
}
function populateManagerDropdown() {
    // No longer needed
}

// ════════════════════════════════════════════════════════════════
// ─── PERFORMANCE INCENTIVE (PI) ────────────────────────────────
// September-cycle, bonus-linked re-rating for a fixed eligibility list
// (PI_ELIGIBLE_EMPLOYEE_IDS in config.js). Reuses the annual review's exact
// rating scale/categories/formulas, but is a fully separate cycle: its own
// pi_reviews table (via the generic sbSelectFrom/sbInsertInto helpers), its
// own DOM ids, and its own state variables — never the annual review's.
// ════════════════════════════════════════════════════════════════

// ─── PI SELF-ASSESSMENT: INIT (called from the nav button) ──────
function initPISelfAssessment() {
    var emp = resolveCurrentEmployee();
    if (emp && isPIEligible(emp.id)) {
        selectPISelfEmployee(emp);
    } else if (emp) {
        toast('You are not on the Performance Incentive eligibility list for this cycle.', 'error');
    } else {
        toast('Your email is not found in the employee directory. You cannot submit a PI self-assessment.', 'error');
    }
}

async function selectPISelfEmployee(emp) {
    piSelectedSelfEmployee = emp;
    document.getElementById('piSelfEmployeeSearch').value = emp.name + ' (' + emp.id + ')';
    document.getElementById('piSelfEmployeeId').value = emp.id;
    document.getElementById('piSelfEmployeeName').value = emp.name;

    document.getElementById('piSelfEmpName').textContent = emp.name;
    document.getElementById('piSelfEmpId').textContent = emp.id;
    document.getElementById('piSelfEmpDesignation').textContent = emp.designation;
    document.getElementById('piSelfEmpEmail').textContent = emp.email;
    document.getElementById('piSelfEmpDateJoined').textContent = formatDate(emp.dateJoined);
    // PI is a September cycle, so tenure is shown as of the September cutoff, not the
    // April-March annual review's March cutoff.
    document.getElementById('piSelfEmpTenure').textContent = calculateTenure(emp.dateJoined, SEPT_CYCLE_TENURE_CUTOFF_DATE);
    document.getElementById('piSelfTenureCutoffLabel').textContent = SEPT_CYCLE_TENURE_CUTOFF_LABEL;
    document.getElementById('piSelfEmployeeDetails').style.display = 'block';

    // Show up front if already submitted, rather than only telling them at Submit time.
    // Guarded against a stale response landing after a newer selection has already
    // overwritten piSelectedSelfEmployee (e.g. two rapid selections in a row).
    var alreadySubmitted = false;
    try {
        var existing = await sbSelectFrom('pi_reviews',
            'employee_id=eq.' + encodeURIComponent(emp.id) +
            '&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD) +
            '&is_self_assessment=eq.true&select=id');
        alreadySubmitted = existing && existing.length > 0;
    } catch (e) { console.error('selectPISelfEmployee existing check:', e); }
    if (!piSelectedSelfEmployee || piSelectedSelfEmployee.id !== emp.id) return;
    document.getElementById('piSelfAlreadySubmittedBanner').style.display = alreadySubmitted ? 'block' : 'none';
    document.getElementById('piSelfFormBody').style.display = alreadySubmitted ? 'none' : 'block';
}

// ─── PI SELF-ASSESSMENT: RATING BUTTONS ──────────────────────────
function setPISelfRating(categoryIndex, score) {
    piSelfRatings[categoryIndex] = score;
    document.querySelectorAll('#pi-self-assessment [data-category="' + categoryIndex + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    calculatePISelfOverallScore();
}

function setPISelfAISub(sub, score) {
    piSelfAiSubs[sub] = score;
    document.querySelectorAll('#pi-self-assessment [data-category="ai_' + sub + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    var subs = Object.values(piSelfAiSubs);
    if (subs.every(function(v){ return v !== null; })) {
        var avg = (subs[0] + subs[1] + subs[2]) / 3;
        piSelfRatings[5] = avg;
        var row = document.getElementById('piSelfAiAvgRow');
        if (row) { row.style.display = 'flex'; document.getElementById('piSelfAiAvgScore').textContent = avg.toFixed(2) + ' / 5'; }
    }
    calculatePISelfOverallScore();
}

function setPISelfAccSub(sub, score) {
    piSelfAccSubs[sub] = score;
    document.querySelectorAll('#pi-self-assessment [data-category="acc_' + sub + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    var subs = Object.values(piSelfAccSubs);
    if (subs.every(function(v){ return v !== null; })) {
        var avg = (subs[0] + subs[1] + subs[2]) / 3;
        piSelfRatings[7] = avg;
        var row = document.getElementById('piSelfAccAvgRow');
        if (row) { row.style.display = 'flex'; document.getElementById('piSelfAccAvgScore').textContent = avg.toFixed(2) + ' / 5'; }
    }
    calculatePISelfOverallScore();
}

function setPISelfOkrPercent(value) {
    var pct = parseFloat(value);
    if (isNaN(pct) || pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    document.getElementById('piSelfOkrInput').value = pct;
    piSelfOkrPercent = pct;
    piSelfRatings[10] = (pct / 100) * 5;
    var display = document.getElementById('piSelfOkrScoreDisplay');
    if (display) { display.style.display = 'block'; display.textContent = 'OKR Score: ' + piSelfRatings[10].toFixed(2) + ' / 5'; }
    calculatePISelfOverallScore();
}

// Identical formula to calculateSelfOverallScore() — 6 non-AI categories at
// equal weight (70% combined) + AI Utilization at 30% — just reading/writing
// the PI-only state and DOM ids instead of the annual review's.
function calculatePISelfOverallScore() {
    var NON_AI_W = 70 / 6;
    var AI_W = 30;
    var NON_AI_INDICES = [0,1,3,4,7,10];
    var wSum = 0, wTotal = 0;
    NON_AI_INDICES.forEach(function(i) {
        if (piSelfRatings[i] !== undefined) { wSum += piSelfRatings[i] * NON_AI_W; wTotal += NON_AI_W; }
    });
    if (piSelfRatings[5] !== undefined) { wSum += piSelfRatings[5] * AI_W; wTotal += AI_W; }
    if (wTotal === 0) { document.getElementById('piSelfOverallScore').textContent = '0.0'; return; }
    var avg = wSum / wTotal;
    document.getElementById('piSelfOverallScore').textContent = avg.toFixed(2);
}

function resetPISelfForm() {
    document.getElementById('piSelfComments').value = '';
    document.querySelectorAll('#pi-self-assessment .rating-btn').forEach(function(b) { b.classList.remove('selected'); });
    piSelfRatings = {};
    piSelfAiSubs = { adoption: null, fluency: null, impact: null };
    piSelfAccSubs = { accountability: null, efficiency: null, competency: null };
    piSelfOkrPercent = null;
    var aiRow = document.getElementById('piSelfAiAvgRow'); if (aiRow) aiRow.style.display = 'none';
    var accRow = document.getElementById('piSelfAccAvgRow'); if (accRow) accRow.style.display = 'none';
    var okrInput = document.getElementById('piSelfOkrInput'); if (okrInput) okrInput.value = '';
    var okrDisplay = document.getElementById('piSelfOkrScoreDisplay'); if (okrDisplay) okrDisplay.style.display = 'none';
    document.getElementById('piSelfOverallScore').textContent = '0.0';

    if (currentSSOUser && currentSSOUser.employeeId) {
        var emp = findEmployeeById(currentSSOUser.employeeId);
        if (emp && isPIEligible(emp.id)) selectPISelfEmployee(emp);
    }
}

async function checkExistingPISelfAssessment(employeeId) {
    try {
        var data = await sbSelectFrom('pi_reviews',
            'employee_id=eq.' + encodeURIComponent(employeeId) +
            '&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD) +
            '&is_self_assessment=eq.true');
        if (data && data.length > 0) {
            var submittedDate = new Date(data[0].submitted_at).toLocaleDateString();
            toast('You have already submitted a PI self-assessment on ' + submittedDate + '. Only one is allowed per PI cycle.', 'error');
            return true;
        }
        return false;
    } catch (error) {
        console.error('checkExistingPISelfAssessment:', error);
        return false;
    }
}

async function submitPISelfAssessment() {
    var employeeId = (document.getElementById('piSelfEmployeeId').value || '').trim().toUpperCase();
    var employeeName = (document.getElementById('piSelfEmployeeName').value || '').trim();

    if (!validateEmployeeId(employeeId)) return;
    if (!employeeName) { toast('Please select an employee first.', 'warn'); return; }

    var currentEmp = resolveCurrentEmployee();
    if (!currentEmp) { toast('Your email is not found in the employee directory. Self-assessment is not allowed.', 'error'); return; }
    if (currentEmp.id !== employeeId) { toast('You can only submit a PI self-assessment for yourself (' + currentEmp.name + ').', 'error'); return; }
    if (!isPIEligible(employeeId)) { toast('You are not on the Performance Incentive eligibility list for this cycle.', 'error'); return; }

    var nonAiRated = [0,1,3,4].filter(function(i){ return piSelfRatings[i] !== undefined; }).length;
    var aiRated = Object.values(piSelfAiSubs).filter(function(v){ return v !== null; }).length;
    var accRated = Object.values(piSelfAccSubs).filter(function(v){ return v !== null; }).length;
    if (nonAiRated !== 4 || aiRated !== 3 || accRated !== 3) {
        toast('Please rate all categories (including all AI and Accountability/Efficiency/Competency subcomponents).', 'warn');
        return;
    }
    if (piSelfOkrPercent === null || piSelfOkrPercent === undefined) {
        toast('Please enter your OKR % Completion.', 'warn');
        return;
    }

    var exists = await checkExistingPISelfAssessment(employeeId);
    if (exists) return;

    var emp = piSelectedSelfEmployee || findEmployeeById(employeeId);
    var ssoInfo = getSSOSubmitterInfo();
    var row = {
        employee_id:         employeeId,
        employee_name:       employeeName,
        position:            emp ? emp.designation : '',
        review_period:       PI_REVIEW_PERIOD,
        reviewer_name:       employeeName + ' (Self)',
        ratings:             Object.assign({}, piSelfRatings, { ai_subs: piSelfAiSubs, acc_subs: piSelfAccSubs, okr_percent: piSelfOkrPercent }),
        overall_score:       parseFloat(document.getElementById('piSelfOverallScore').textContent) || 0,
        justification:       document.getElementById('piSelfComments').value.trim(),
        is_self_assessment:  true,
        submitted_by_email:  ssoInfo.submitted_by_email,
        submitted_by_name:   ssoInfo.submitted_by_name
    };

    try {
        await sbInsertInto('pi_reviews', row);
        toast('PI self-assessment submitted successfully!', 'success');

        if (emp && emp.email) {
            var piRatingObj = Object.assign({}, row, {
                employeeName: employeeName,
                overallScore: row.overall_score,
                reviewPeriod: PI_REVIEW_PERIOD,
                ratingDate: new Date().toISOString().slice(0, 10),
                ratings: row.ratings,
                justification: row.justification
            });
            fetchEmployeeInsights(emp.id).then(function(insights) {
                sendSelfAssessmentEmail(piRatingObj, emp.email, insights);
            });
        }
        if (emp) notifyManagerOfPISelfAssessment(emp);
        notifyAdminOfPISubmission(employeeName, employeeId, 'Self-Assessment', row.overall_score, employeeName + ' (Self)');

        window.scrollTo({ top: 0, behavior: 'smooth' });
        resetPISelfForm();
    } catch(err) {
        console.error('submitPISelfAssessment error:', err);
        var errorMsg = 'Error saving PI self-assessment. ';
        if (err.message) errorMsg += err.message;
        else if (err.hint) errorMsg += err.hint;
        else errorMsg += 'Please try again.';
        toast(errorMsg, 'error');
    }
}

// ─── PI MANAGER RATING: INIT (called from the nav button) ────────
function initPIManagerRating() {
    var emp = resolveCurrentEmployee();
    if (emp) {
        selectPIManager(emp);
    } else {
        toast('Your email is not found in the employee directory. You cannot submit PI ratings.', 'error');
    }
}

function selectPIManager(emp) {
    piSelectedManager = emp;
    document.getElementById('piMgrSearch').value = emp.name;
    document.getElementById('piMgrSelect').value = emp.name;
    document.getElementById('piReviewerName').value = emp.name;

    document.getElementById('piMgrName').textContent = emp.name;
    document.getElementById('piMgrEmpId').textContent = emp.id;
    document.getElementById('piMgrDesignation').textContent = emp.designation;
    document.getElementById('piMgrEmail').textContent = emp.email;
    document.getElementById('piMgrDetailsSection').style.display = 'block';

    loadPIEligibleReports(emp);
}

// Unlike the annual Manager Rating tab (direct reports only), PI ratings can
// be entered for a PI-eligible employee anywhere in the manager's downline —
// eligibility is a fixed, sparse list, so the eligible person for a given
// manager is often several levels down, not a direct report.
function loadPIEligibleReports(managerEmp) {
    var countDiv = document.getElementById('piDirectReportsCount');
    var tableDiv = document.getElementById('piDirectReportsTable');
    var employeeSelect = document.getElementById('piEmployeeSelect');

    var downline = getAllDownline(managerEmp.id).filter(function(e) { return isPIEligible(e.id); });

    countDiv.innerHTML = '<strong>' + downline.length + ' PI-eligible report' + (downline.length !== 1 ? 's' : '') + '</strong>';

    if (downline.length === 0) {
        tableDiv.innerHTML = '<p style="color: var(--gray-medium); font-style: italic;">No PI-eligible employees found in your reporting line.</p>';
        document.getElementById('piEmployeeSelectionSection').style.display = 'none';
        return;
    }

    var html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">';
    html += '<thead><tr style="background: rgba(106,76,147,0.1);">';
    html += '<th style="padding: 0.5rem; text-align: left; border-bottom: 2px solid var(--purple-light);">Emp ID</th>';
    html += '<th style="padding: 0.5rem; text-align: left; border-bottom: 2px solid var(--purple-light);">Name</th>';
    html += '<th style="padding: 0.5rem; text-align: left; border-bottom: 2px solid var(--purple-light);">Designation</th>';
    html += '</tr></thead><tbody>';
    downline.forEach(function(emp) {
        html += '<tr style="border-bottom: 1px solid #eee;">';
        html += '<td style="padding: 0.5rem; font-weight: 600; color: var(--purple-medium);">' + emp.id + '</td>';
        html += '<td style="padding: 0.5rem;">' + emp.name + '</td>';
        html += '<td style="padding: 0.5rem; font-size: 0.8rem;">' + emp.designation + '</td>';
        html += '</tr>';
    });
    html += '</tbody></table>';
    tableDiv.innerHTML = html;

    employeeSelect.innerHTML = '<option value="">-- Select Employee --</option>';
    downline.forEach(function(emp) {
        var option = document.createElement('option');
        option.value = JSON.stringify(emp);
        option.textContent = emp.name + ' (' + emp.id + ')';
        employeeSelect.appendChild(option);
    });

    document.getElementById('piEmployeeSelectionSection').style.display = 'block';
}

async function selectPIEmployee() {
    var employeeSelect = document.getElementById('piEmployeeSelect');
    if (!employeeSelect.value) {
        document.getElementById('piSelectedEmployeeDetails').style.display = 'none';
        document.getElementById('piSelfAssessmentPanel').style.display = 'none';
        document.getElementById('piMgrAlreadySubmittedBanner').style.display = 'none';
        document.getElementById('piMgrFormBody').style.display = 'block';
        piSelectedMgrEmployee = null;
        return;
    }

    try {
        var emp = JSON.parse(employeeSelect.value);
        piSelectedMgrEmployee = emp;

        document.getElementById('piSelEmpName').textContent = emp.name;
        document.getElementById('piSelEmpId').textContent = emp.id;
        document.getElementById('piSelEmpDesignation').textContent = emp.designation;
        document.getElementById('piSelEmpEmail').textContent = emp.email;
        document.getElementById('piSelectedEmployeeDetails').style.display = 'block';

        toast('Selected: ' + emp.name, 'success');
        fetchPISelfAssessment(emp.name, emp.id);

        // Show up front if this manager already rated this employee for this PI
        // cycle, rather than only telling them at Submit time. Guarded against a
        // stale response landing after a newer selection has already overwritten
        // piSelectedMgrEmployee.
        var alreadySubmitted = false;
        try {
            var existing = await sbSelectFrom('pi_reviews',
                'employee_id=eq.' + encodeURIComponent(emp.id) +
                '&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD) +
                '&is_self_assessment=eq.false&select=id');
            alreadySubmitted = existing && existing.length > 0;
        } catch (e) { console.error('selectPIEmployee existing check:', e); }
        if (!piSelectedMgrEmployee || piSelectedMgrEmployee.id !== emp.id) return;
        document.getElementById('piMgrAlreadySubmittedBanner').style.display = alreadySubmitted ? 'block' : 'none';
        document.getElementById('piMgrFormBody').style.display = alreadySubmitted ? 'none' : 'block';
    } catch(e) {
        console.error('Error parsing PI employee data:', e);
        toast('Error selecting employee', 'error');
    }
}

// Mirrors fetchSelfAssessment()'s display panel (6 categories + OKR line +
// overall score), pointed at pi_reviews / PI_REVIEW_PERIOD instead.
async function fetchPISelfAssessment(employeeName, employeeId) {
    var panel = document.getElementById('piSelfAssessmentPanel');
    var content = document.getElementById('piSelfAssessmentContent');

    try {
        var data = [];
        if (employeeId) {
            data = await sbSelectFrom('pi_reviews',
                'is_self_assessment=eq.true&employee_id=eq.' + encodeURIComponent(employeeId) +
                '&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD));
        }
        if ((!data || data.length === 0) && employeeName) {
            data = await sbSelectFrom('pi_reviews',
                'is_self_assessment=eq.true&employee_name=eq.' + encodeURIComponent(employeeName) +
                '&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD));
        }

        if (data && data.length > 0) {
            var selfAssess = normalizeRating(data[0]);
            var selfCatNames = ['Job Knowledge & Skills', 'Quality of Work', '', 'Problem Solving & Initiative', 'Teamwork & Collaboration', 'AI Utilization', '', 'Accountability, Efficiency & Competency'];

            var html = '<div style="margin-bottom: 0.5rem;"><strong>Overall Self-Score:</strong> ' + selfAssess.overallScore.toFixed(2) + ' / 5.0</div>';
            html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-top: 0.5rem;">';
            selfCatNames.forEach(function(catName, i) {
                if (!catName) return;
                var val = selfAssess.ratings[i];
                if ((i === 5 || i === 7) && val !== undefined) {
                    html += '<div>' + catName + ': <strong>' + Number(val).toFixed(2) + '</strong></div>';
                } else if (val !== undefined) {
                    html += '<div>' + catName + ': <strong>' + val + '</strong></div>';
                } else {
                    html += '<div>' + catName + ': <em>N/A</em></div>';
                }
            });
            var selfOkrPctDisplay = selfAssess.ratings.okr_percent;
            if (selfOkrPctDisplay !== undefined && selfOkrPctDisplay !== null) {
                html += '<div>OKR % Completion: <strong>' + selfOkrPctDisplay + '% (' + Number(selfAssess.ratings[10]).toFixed(2) + ' / 5)</strong></div>';
            }
            html += '</div>';

            if (selfAssess.justification) {
                html += '<div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid rgba(12,84,96,0.3);"><strong>Comments:</strong> <em>' + selfAssess.justification + '</em></div>';
            }

            content.innerHTML = html;
            panel.style.display = 'block';

            // Same pre-fill as the annual manager form — a factual number already
            // shown just above, only fills an empty field, never overwrites.
            var piOkrInputEl = document.getElementById('piMgrOkrInput');
            if (piOkrInputEl && !piOkrInputEl.value && selfOkrPctDisplay !== undefined && selfOkrPctDisplay !== null) {
                setPIMgrOkrPercent(selfOkrPctDisplay);
            }
        } else {
            content.innerHTML = '<em>No PI self-assessment submitted yet for this cycle.</em>';
            panel.style.display = 'block';
        }
    } catch(err) {
        console.error('Error fetching PI self-assessment:', err);
        content.innerHTML = '<em>Could not load PI self-assessment data.</em>';
        panel.style.display = 'block';
    }
}

// ─── PI MANAGER RATING: RATING CONTROLS ──────────────────────────
function setPIMgrAISub(sub, score) {
    piMgrAiSubs[sub] = score;
    document.querySelectorAll('#pi-manager-rating [data-category="ai_' + sub + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    var subs = Object.values(piMgrAiSubs);
    if (subs.every(function(v){ return v !== null; })) {
        var avg = (subs[0] + subs[1] + subs[2]) / 3;
        piMgrRatings[5] = avg;
        var row = document.getElementById('piMgrAiAvgRow');
        if (row) { row.style.display = 'flex'; document.getElementById('piMgrAiAvgScore').textContent = avg.toFixed(2) + ' / 5'; }
    }
    calculatePIOverallScore();
}

function setPIMgrAccSub(sub, score) {
    piMgrAccSubs[sub] = score;
    document.querySelectorAll('#pi-manager-rating [data-category="acc_' + sub + '"]').forEach(function(btn) {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.rating) === score) btn.classList.add('selected');
    });
    var subs = Object.values(piMgrAccSubs);
    if (subs.every(function(v){ return v !== null; })) {
        var avg = (subs[0] + subs[1] + subs[2]) / 3;
        piMgrRatings[2] = avg;
        var row = document.getElementById('piMgrAccAvgRow');
        if (row) { row.style.display = 'flex'; document.getElementById('piMgrAccAvgScore').textContent = avg.toFixed(2) + ' / 5'; }
    }
    calculatePIOverallScore();
}

function setPIMgrOkrPercent(value) {
    var pct = parseFloat(value);
    if (isNaN(pct) || pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    document.getElementById('piMgrOkrInput').value = pct;
    piMgrOkrPercent = pct;
    piMgrRatings[6] = (pct / 100) * 5;
    var display = document.getElementById('piMgrOkrScoreDisplay');
    if (display) { display.style.display = 'block'; display.textContent = 'OKR Score: ' + piMgrRatings[6].toFixed(2) + ' / 5'; }
    calculatePIOverallScore();
}

function setPIKTScore(score, btn) {
    piKeeperTestState.kt_retention_score = score;
    document.querySelectorAll('#pi-manager-rating .kt-score-btn').forEach(function(b){ b.classList.remove('selected'); });
    btn.classList.add('selected');
    var meta = KT_SCORE_LABELS[score];
    if (meta) {
        var panel = document.getElementById('piKtEmotionPanel');
        if (panel) {
            panel.style.display = 'block';
            panel.style.background = meta.bg;
            panel.style.border = '1.5px solid ' + meta.border;
            panel.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px;">'
                + '<div style="width:48px;height:48px;border-radius:12px;flex-shrink:0;background:#fff;border:2px solid ' + meta.border + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;">'
                + '<span style="font-size:1.2rem;font-weight:900;color:' + meta.color + ';line-height:1;">' + score + '</span>'
                + '<span style="font-size:0.5rem;color:' + meta.color + ';opacity:0.7;">/ 5</span></div>'
                + '<div><div style="font-size:1rem;font-weight:800;color:' + meta.color + ';margin-bottom:3px;">' + meta.emotion
                + ' <span style="font-size:0.68rem;font-weight:700;background:' + meta.border + ';color:#fff;border-radius:20px;padding:2px 8px;margin-left:4px;">' + meta.label + '</span></div>'
                + '<div style="font-size:0.85rem;color:' + meta.color + ';line-height:1.5;">' + meta.desc + '</div>'
                + '<div style="margin-top:10px;">'
                + '<div style="display:flex;justify-content:space-between;font-size:0.68rem;opacity:0.7;color:' + meta.color + ';margin-bottom:4px;"><span>Retention urgency</span><span>' + meta.urgency + '</span></div>'
                + '<div style="height:6px;border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.1);">'
                + '<div style="height:100%;border-radius:6px;background:' + meta.border + ';width:' + meta.barW + ';transition:width 0.4s ease;"></div></div>'
                + '</div></div></div>';
        }
    }
    calculatePIOverallScore();
}

// Identical to calculateOverallScore()'s 4-section model, reading/writing
// piMgrRatings / piKeeperTestState and the pi* DOM ids instead.
function calculatePIOverallScore() {
    var sections = [];
    var totalSections = 4;
    if (piMgrRatings[2] !== undefined) sections.push(piMgrRatings[2]);
    if (piMgrRatings[5] !== undefined) sections.push(piMgrRatings[5]);
    if (piMgrRatings[6] !== undefined) sections.push(piMgrRatings[6]);
    if (piKeeperTestState.kt_retention_score !== null) sections.push(piKeeperTestState.kt_retention_score);

    if (sections.length === 0) {
        document.getElementById('piOverallScore').textContent = '0.0';
        document.getElementById('piOverallRating').textContent = 'Not Rated';
        return;
    }
    var sum = sections.reduce(function(a, b) { return a + b; }, 0);
    var avg = sum / totalSections;
    document.getElementById('piOverallScore').textContent = avg.toFixed(2);
    var label = avg >= 4.5 ? 'Exceptional'
              : avg >= 3.5 ? 'Exceeds Expectations'
              : avg >= 2.5 ? 'Meets Expectations'
              : avg >= 1.5 ? 'Needs Improvement'
              : 'Unsatisfactory';
    var suffix = sections.length < totalSections ? ' (' + sections.length + '/4 sections)' : '';
    document.getElementById('piOverallRating').textContent = label + suffix;
}

function resetPIMgrForm() {
    document.querySelectorAll('#pi-manager-rating .rating-btn').forEach(function(b) { b.classList.remove('selected'); });
    piMgrRatings = {};
    piMgrAiSubs = { adoption: null, fluency: null, impact: null };
    piMgrAccSubs = { accountability: null, efficiency: null, competency: null };
    piMgrOkrPercent = null;
    var aiRow = document.getElementById('piMgrAiAvgRow'); if (aiRow) aiRow.style.display = 'none';
    var accRow = document.getElementById('piMgrAccAvgRow'); if (accRow) accRow.style.display = 'none';
    var okrInput = document.getElementById('piMgrOkrInput'); if (okrInput) okrInput.value = '';
    var okrDisplay = document.getElementById('piMgrOkrScoreDisplay'); if (okrDisplay) okrDisplay.style.display = 'none';

    piKeeperTestState.kt_retention_score = null;
    piKeeperTestState.comments.kt_keeper_comment = '';
    document.querySelectorAll('#pi-manager-rating .kt-score-btn').forEach(function(b){ b.classList.remove('selected'); });
    var ktComment = document.getElementById('piKt_keeper_comment'); if (ktComment) ktComment.value = '';
    var ktPanel = document.getElementById('piKtEmotionPanel'); if (ktPanel) { ktPanel.style.display = 'none'; ktPanel.innerHTML = ''; }

    var piJustification = document.getElementById('piMgrJustification'); if (piJustification) piJustification.value = '';

    document.getElementById('piOverallScore').textContent = '0.0';
    document.getElementById('piOverallRating').textContent = 'Not Rated';
    document.getElementById('piSelectedEmployeeDetails').style.display = 'none';
    document.getElementById('piSelfAssessmentPanel').style.display = 'none';
    document.getElementById('piMgrAlreadySubmittedBanner').style.display = 'none';
    document.getElementById('piMgrFormBody').style.display = 'block';
    var empSelect = document.getElementById('piEmployeeSelect'); if (empSelect) empSelect.value = '';
    piSelectedMgrEmployee = null;

    if (currentSSOUser && currentSSOUser.employeeId) {
        var mgr = findEmployeeById(currentSSOUser.employeeId);
        if (mgr) selectPIManager(mgr);
    }
}

async function submitPIManagerRating() {
    if (!piSelectedMgrEmployee) { toast('Please select an employee to rate.', 'warn'); return; }
    if (!isPIEligible(piSelectedMgrEmployee.id)) { toast('This employee is not on the Performance Incentive eligibility list.', 'error'); return; }

    var currentEmp = resolveCurrentEmployee();
    if (!currentEmp) { toast('Your email is not found in the employee directory. PI rating is not allowed.', 'error'); return; }
    if (!piSelectedManager || currentEmp.id !== piSelectedManager.id) {
        toast('You can only submit ratings as yourself (' + currentEmp.name + '). Rating as another manager is not allowed.', 'error'); return;
    }

    var reviewerName = document.getElementById('piReviewerName').value.trim();
    if (!reviewerName) { toast('Missing reviewer name.', 'warn'); return; }

    var accRatedMgr = Object.values(piMgrAccSubs).filter(function(v){ return v !== null; }).length;
    var aiRatedMgr = Object.values(piMgrAiSubs).filter(function(v){ return v !== null; }).length;
    if (accRatedMgr !== 3) { toast('Please rate all 3 Accountability, Efficiency & Competency subcomponents.', 'warn'); return; }
    if (aiRatedMgr !== 3) { toast('Please rate all 3 AI Utilization subcomponents.', 'warn'); return; }
    if (piMgrOkrPercent === null || piMgrOkrPercent === undefined) { toast('Please enter OKR % Completion.', 'warn'); return; }
    if (piKeeperTestState.kt_retention_score === null) { toast('Please select a Keeper Test retention score.', 'warn'); return; }

    var ktEl = document.getElementById('piKt_keeper_comment');
    if (ktEl) piKeeperTestState.comments.kt_keeper_comment = ktEl.value.trim();
    if (!piKeeperTestState.comments.kt_keeper_comment) { toast('Please enter additional comments for the Keeper Test.', 'warn'); return; }

    // Guard against double-submission — not required by any UI trigger here
    // (unlike the self-assessment flow there's no earlier step to catch it),
    // but a second manager row for the same employee/cycle would break
    // computePIStatus()'s "one self row + one manager row" assumption.
    try {
        var existing = await sbSelectFrom('pi_reviews',
            'employee_id=eq.' + encodeURIComponent(piSelectedMgrEmployee.id) +
            '&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD) +
            '&is_self_assessment=eq.false');
        if (existing && existing.length > 0) {
            toast('A PI manager rating has already been submitted for this employee.', 'error');
            return;
        }
    } catch (e) { console.error('submitPIManagerRating existing check:', e); }

    var verdict = KT_SCORE_LABELS[piKeeperTestState.kt_retention_score] || { label: 'Unknown' };
    var keeperTestPayload = {
        completedAt: new Date().toISOString(),
        responses: { kt_retention_score: piKeeperTestState.kt_retention_score },
        comments: Object.assign({}, piKeeperTestState.comments),
        verdict: verdict.label
    };

    var sec1 = piMgrRatings[2] || 0;
    var sec2 = piMgrRatings[5] || 0;
    var sec3 = piMgrRatings[6] || 0;
    var sec4 = piKeeperTestState.kt_retention_score || 0;
    var finalOverallScore = (sec1 + sec2 + sec3 + sec4) / 4;

    var ssoInfo = getSSOSubmitterInfo();
    var row = {
        employee_id:         piSelectedMgrEmployee.id || '',
        employee_name:       piSelectedMgrEmployee.name,
        position:            piSelectedMgrEmployee.designation || '',
        review_period:       PI_REVIEW_PERIOD,
        reviewer_name:       reviewerName,
        ratings:             Object.assign({}, piMgrRatings, { ai_subs: piMgrAiSubs, acc_subs: piMgrAccSubs, okr_percent: piMgrOkrPercent }),
        overall_score:       parseFloat(finalOverallScore.toFixed(2)),
        keeper_test:         keeperTestPayload,
        justification:       document.getElementById('piMgrJustification').value.trim(),
        is_self_assessment:  false,
        submitted_by_email:  ssoInfo.submitted_by_email,
        submitted_by_name:   ssoInfo.submitted_by_name
    };

    try {
        await sbInsertInto('pi_reviews', row);
        toast('PI rating submitted successfully!', 'success');

        var piEmailRecipients = [];
        if (piSelectedManager && piSelectedManager.email) piEmailRecipients.push(piSelectedManager.email);
        if (piSelectedMgrEmployee.email && piEmailRecipients.indexOf(piSelectedMgrEmployee.email) === -1) piEmailRecipients.push(piSelectedMgrEmployee.email);

        if (piEmailRecipients.length > 0) {
            var piSelfForEmail = null;
            try {
                var piSelfData = await sbSelectFrom('pi_reviews',
                    'is_self_assessment=eq.true&employee_id=eq.' + encodeURIComponent(piSelectedMgrEmployee.id) +
                    '&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD));
                if (piSelfData && piSelfData.length > 0) piSelfForEmail = normalizePIRating(piSelfData[0]);
            } catch (e) {}

            var piMgrRatingObj = Object.assign({}, row, {
                employeeName: piSelectedMgrEmployee.name,
                overallScore: row.overall_score,
                reviewPeriod: PI_REVIEW_PERIOD,
                reviewerName: row.reviewer_name,
                ratings: row.ratings,
                keeperTest: keeperTestPayload
            });
            var piInsights = await fetchEmployeeInsights(piSelectedMgrEmployee.id);
            piEmailRecipients.forEach(function(email) {
                sendManagerRatingEmail(piMgrRatingObj, piSelfForEmail, email, piInsights, email === piSelectedMgrEmployee.email);
            });
        }
        notifyAdminOfPISubmission(piSelectedMgrEmployee.name, piSelectedMgrEmployee.id, 'Manager Rating', row.overall_score, row.reviewer_name);

        window.scrollTo({ top: 0, behavior: 'smooth' });
        resetPIMgrForm();
    } catch(err) {
        console.error('submitPIManagerRating error:', err);
        var errorMsg = 'Error saving PI rating. ';
        if (err.message) errorMsg += err.message;
        else if (err.hint) errorMsg += err.hint;
        else errorMsg += 'Please try again.';
        toast(errorMsg, 'error');
    }
}

// ─── PI FINAL SCORE FORMULA — single source of truth ─────────────
// The bonus-linked PI % does NOT blend the self-assessment's and manager's
// full overall scores. OKR % Completion is always taken from the
// self-assessment (the employee's own reported figure — a fact, not a
// judgment call); every other section — Accountability/Efficiency/
// Competency, AI Utilization, Keeper Test — comes from the manager's
// rating only. The self-assessment's other category scores and the
// manager's own OKR % input (pre-filled from self but editable) play no
// part in this formula. Confirmed with Sushim.
// Takes raw pi_reviews rows (selfRow/mgrRow, as returned by sbSelectFrom —
// not the normalizePIRating() shape), since that's what every call site
// already has on hand.
function computePIFinalScore(selfRow, mgrRow) {
    var mgrRatings = (mgrRow && mgrRow.ratings) || {};
    var selfOkrPct = selfRow && selfRow.ratings ? selfRow.ratings.okr_percent : null;
    var sections = [];
    if (mgrRatings['2'] !== undefined && mgrRatings['2'] !== null) sections.push(parseFloat(mgrRatings['2']));
    if (mgrRatings['5'] !== undefined && mgrRatings['5'] !== null) sections.push(parseFloat(mgrRatings['5']));
    if (selfOkrPct !== undefined && selfOkrPct !== null) sections.push((parseFloat(selfOkrPct) / 100) * 5);
    var ktScore = mgrRow && mgrRow.keeper_test && mgrRow.keeper_test.responses ? mgrRow.keeper_test.responses.kt_retention_score : null;
    if (ktScore !== undefined && ktScore !== null) sections.push(parseFloat(ktScore));
    if (sections.length === 0) return 0;
    return sections.reduce(function(a, b) { return a + b; }, 0) / sections.length;
}
function computePIFinalPercent(selfRow, mgrRow) {
    return Math.round(computePIFinalScore(selfRow, mgrRow) / 5 * 100);
}

// ─── PI STATUS — computed fresh from pi_reviews every time (no stored
// pi_percent column). Returns:
//   { status: 'pending-employee' }                      — no self row yet
//   { status: 'pending-manager' }                        — self row exists, no manager row yet
//   { status: 'complete', piPercent, selfScore, mgrScore } — both exist
// ─────────────────────────────────────────────────────────────────
async function computePIStatus(employeeId) {
    try {
        var rows = await sbSelectFrom('pi_reviews',
            'employee_id=eq.' + encodeURIComponent(employeeId) +
            '&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD));
        var selfRow = rows.find(function(r) { return r.is_self_assessment === true; });
        var mgrRow = rows.find(function(r) { return r.is_self_assessment === false; });
        if (!selfRow) return { status: 'pending-employee' };
        if (!mgrRow) return { status: 'pending-manager' };
        var selfScore = parseFloat(selfRow.overall_score) || 0;
        var mgrScore = parseFloat(mgrRow.overall_score) || 0;
        var piPercent = computePIFinalPercent(selfRow, mgrRow);
        return { status: 'complete', piPercent: piPercent, selfScore: selfScore, mgrScore: mgrScore };
    } catch (e) {
        console.error('computePIStatus:', e);
        return { status: 'pending-employee' };
    }
}

// ─── ADMIN: PI REPORT ─────────────────────────────────────────────
var piRatingsCache = []; // normalized pi_reviews rows, for the PDF download buttons below
var piAdminNotesCache = {}; // employee_id -> {id, note, updated_by, updated_at} row from pi_admin_notes

// Per-row Actions menu — collapses the Reports column's button wall (up to 5
// buttons per row) into one "⋮" toggle, so only one row's menu is open at a
// time, and clicking anywhere outside closes it.
var piRowMenuOutsideClickBound = false;
function togglePIRowMenu(event, empId) {
    event.stopPropagation();
    closeAllPINoteEditors();
    var target = document.getElementById('piMenu_' + empId);
    var wasOpen = target && target.style.display === 'block';
    closeAllPIRowMenus();
    if (target && !wasOpen) target.style.display = 'block';

    if (!piRowMenuOutsideClickBound) {
        piRowMenuOutsideClickBound = true;
        document.addEventListener('click', closeAllPIRowMenus);
    }
}
function closeAllPIRowMenus() {
    document.querySelectorAll('.pi-menu-dropdown').forEach(function(el) { el.style.display = 'none'; });
}

// Small per-employee admin note, shown as a single dot in the PI report —
// admin-only, never surfaced to the employee in any view, email, or PDF.
// Stored in pi_admin_notes, keyed by employee_id (not a rating_id) so it
// can never collide across tables the way performance_reviews/pi_reviews
// numeric ids did.
var piNoteEditorOutsideClickBound = false;
function closeAllPINoteEditors() {
    document.querySelectorAll('.pi-note-editor').forEach(function(el) { el.style.display = 'none'; });
}
function togglePINoteEditor(event, empId) {
    event.stopPropagation();
    closeAllPIRowMenus();
    var target = document.getElementById('piNoteEditor_' + empId);
    var wasOpen = target && target.style.display === 'block';
    closeAllPINoteEditors();
    if (target && !wasOpen) {
        target.style.display = 'block';
        var ta = document.getElementById('piNoteText_' + empId);
        if (ta) ta.focus();
    }
    if (!piNoteEditorOutsideClickBound) {
        piNoteEditorOutsideClickBound = true;
        document.addEventListener('click', closeAllPINoteEditors);
    }
}
async function savePINote(empId) {
    var ta = document.getElementById('piNoteText_' + empId);
    var text = (ta ? ta.value : '').trim();
    var existing = piAdminNotesCache[empId];
    var who = currentSSOUser ? (currentSSOUser.name || currentSSOUser.email) : 'admin';
    try {
        if (!text) {
            if (existing) await sbDeleteFrom('pi_admin_notes', existing.id);
        } else if (existing) {
            await sbUpdateIn('pi_admin_notes', existing.id, { note: text, updated_by: who, updated_at: new Date().toISOString() });
        } else {
            await sbInsertInto('pi_admin_notes', { employee_id: empId, note: text, updated_by: who, updated_at: new Date().toISOString() });
        }
        toast('Note saved.', 'success');
        renderPIReport();
    } catch(err) {
        console.error('savePINote:', err);
        toast('Could not save note. Please try again.', 'error');
    }
}

// Matches getFilteredRatings()'s search box against the fixed PI-eligible
// list, so the same search field filters whichever cycle is on screen.
function getFilteredPIEmployeeIds() {
    var searchEl = document.getElementById('ratingsSearchBox');
    var query = (searchEl ? searchEl.value : '').toLowerCase().trim();
    if (!query) return PI_ELIGIBLE_EMPLOYEE_IDS;
    return PI_ELIGIBLE_EMPLOYEE_IDS.filter(function(empId) {
        var emp = findEmployeeById(empId);
        var name = emp ? emp.name : '';
        var position = emp ? emp.designation : '';
        return name.toLowerCase().indexOf(query) !== -1
            || empId.toLowerCase().indexOf(query) !== -1
            || (position || '').toLowerCase().indexOf(query) !== -1;
    });
}

async function renderPIReport() {
    var container = document.getElementById('ratingsList');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center;color:var(--gray-medium);padding:1rem;">Loading…</p>';
    try {
        var rows = await sbSelectFrom('pi_reviews', 'select=*&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD));
        piRatingsCache = rows.map(normalizePIRating);
        var byEmployee = {};
        rows.forEach(function(r) {
            if (!byEmployee[r.employee_id]) byEmployee[r.employee_id] = {};
            if (r.is_self_assessment) byEmployee[r.employee_id].self = r;
            else byEmployee[r.employee_id].mgr = r;
        });

        var noteRows = await sbSelectFrom('pi_admin_notes', 'select=*');
        piAdminNotesCache = {};
        noteRows.forEach(function(n) { piAdminNotesCache[n.employee_id] = n; });

        var html = '<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">';
        html += '<thead><tr style="background:rgba(106,76,147,0.1);">'
            + '<th style="padding:0.5rem; text-align:left; border-bottom:2px solid var(--purple-light);">Employee ID</th>'
            + '<th style="padding:0.5rem; text-align:left; border-bottom:2px solid var(--purple-light);">Name</th>'
            + '<th style="padding:0.5rem; text-align:left; border-bottom:2px solid var(--purple-light);">Self Score (OKR%)</th>'
            + '<th style="padding:0.5rem; text-align:left; border-bottom:2px solid var(--purple-light);">Manager Score</th>'
            + '<th style="padding:0.5rem; text-align:left; border-bottom:2px solid var(--purple-light);">PI Rating</th>'
            + '<th style="padding:0.5rem; text-align:center; border-bottom:2px solid var(--purple-light);">Note</th>'
            + '<th style="padding:0.5rem; text-align:left; border-bottom:2px solid var(--purple-light);">Actions</th>'
            + '</tr></thead><tbody>';

        getFilteredPIEmployeeIds().forEach(function(empId) {
            var emp = findEmployeeById(empId);
            var name = emp ? emp.name : empId;
            var position = emp ? emp.designation : '';
            var entry = byEmployee[empId] || {};
            var selfScore = entry.self ? (parseFloat(entry.self.overall_score) || 0) : null;
            var mgrScore = entry.mgr ? (parseFloat(entry.mgr.overall_score) || 0) : null;

            var statusHtml, statusCls;
            if (!entry.self) {
                statusHtml = 'Pending — Employee'; statusCls = 'pi-pending-employee';
            } else if (!entry.mgr) {
                statusHtml = 'Pending — Manager'; statusCls = 'pi-pending-manager';
            } else {
                var piPercent = computePIFinalPercent(entry.self, entry.mgr);
                statusHtml = piPercent + '%'; statusCls = 'pi-complete';
            }

            // Self Score column shows OKR % Completion, not the blended overall
            // score — OKR is what the PI/bonus decision actually hinges on, and
            // is in fact the self-assessment's only input into the PI Rating
            // formula (see computePIFinalScore()) — every other section there
            // comes from the manager's rating alone.
            var selfOkrPct = entry.self ? entry.self.ratings.okr_percent : null;
            var selfScoreDisplay = (selfOkrPct !== undefined && selfOkrPct !== null) ? selfOkrPct + '%' : '—';

            var menuItems = [];
            if (entry.self) {
                menuItems.push('<button class="menu-item" onclick="downloadPIPDF(' + entry.self.id + '); closeAllPIRowMenus();">Self PDF</button>');
                menuItems.push('<button class="menu-item" onclick="openEditRatingsModal(' + entry.self.id + ', true); closeAllPIRowMenus();">Edit Self</button>');
            } else {
                menuItems.push('<button class="menu-item add" onclick="openAddPIRatingModal(\'' + empId + '\', true); closeAllPIRowMenus();">+ Add Self Rating</button>');
            }
            if (menuItems.length) menuItems.push('<div class="menu-sep"></div>');
            if (entry.mgr) {
                menuItems.push('<button class="menu-item" onclick="downloadPIPDF(' + entry.mgr.id + '); closeAllPIRowMenus();">Manager PDF</button>');
                menuItems.push('<button class="menu-item" onclick="openEditRatingsModal(' + entry.mgr.id + ', true); closeAllPIRowMenus();">Edit Manager</button>');
            } else {
                menuItems.push('<button class="menu-item add" onclick="openAddPIRatingModal(\'' + empId + '\', false); closeAllPIRowMenus();">+ Add Manager Rating</button>');
            }
            if (entry.self && entry.mgr) {
                menuItems.push('<div class="menu-sep"></div>');
                menuItems.push('<button class="menu-item" onclick="downloadPIFinalReport(\'' + empId + '\'); closeAllPIRowMenus();">Combined PDF</button>');
            }
            var menuHtml = '<div class="pi-menu-wrap">'
                + '<button class="pi-menu-btn" onclick="togglePIRowMenu(event, \'' + empId + '\')" aria-label="Actions">⋮</button>'
                + '<div class="pi-menu-dropdown" id="piMenu_' + empId + '" style="display:none;">' + menuItems.join('') + '</div>'
                + '</div>';

            // Name is only clickable once there's at least one submission to show —
            // reuses the same View Details / Compare Self vs Manager modal as the
            // annual review's admin table, just pointed at PI data (see
            // findRatingByIdAnywhere() / findCounterpartRating()).
            var nameHtml = (entry.self || entry.mgr)
                ? '<a href="#" onclick="viewPIRating(\'' + empId + '\'); return false;" style="color:var(--purple-dark); font-weight:600; text-decoration:none; border-bottom:1px dashed var(--purple-medium); cursor:pointer;">' + name + '</a>'
                : name;

            var existingNote = piAdminNotesCache[empId];
            var noteDotCls = existingNote ? 'pi-note-dot pi-note-filled' : 'pi-note-dot pi-note-empty';
            var noteDotChar = existingNote ? '●' : '✎';
            var noteTitleAttr = existingNote ? escapeForAttr(existingNote.note) : 'Add a note';
            var noteCellHtml = '<div class="pi-note-wrap">'
                + '<button type="button" class="' + noteDotCls + '" title="' + noteTitleAttr + '" onclick="togglePINoteEditor(event, \'' + empId + '\')" aria-label="Edit note for ' + escapeForAttr(name) + '">' + noteDotChar + '</button>'
                + '<div class="pi-note-editor" id="piNoteEditor_' + empId + '" style="display:none;">'
                + '<textarea id="piNoteText_' + empId + '" placeholder="Internal note — not visible to the employee…">' + escapeForAttr(existingNote ? existingNote.note : '') + '</textarea>'
                + '<div class="pi-note-actions">'
                + '<button type="button" class="btn btn-secondary btn-sm" onclick="closeAllPINoteEditors()">Cancel</button>'
                + '<button type="button" class="btn btn-primary btn-sm" onclick="savePINote(\'' + empId + '\')">Save</button>'
                + '</div></div></div>';

            html += '<tr style="border-bottom:1px solid #eee;">'
                + '<td style="padding:0.5rem; font-weight:600; color:var(--purple-medium);">' + empId + '</td>'
                + '<td style="padding:0.5rem;">' + nameHtml + (position ? ' <span style="color:var(--gray-medium); font-size:0.78rem;">(' + position + ')</span>' : '') + '</td>'
                + '<td style="padding:0.5rem; font-weight:700; color:var(--purple-dark);">' + selfScoreDisplay + '</td>'
                + '<td style="padding:0.5rem;">' + (mgrScore !== null ? mgrScore.toFixed(2) : '—') + '</td>'
                + '<td style="padding:0.5rem;"><span class="pi-status-pill ' + statusCls + '">' + statusHtml + '</span></td>'
                + '<td style="padding:0.5rem; text-align:center;">' + noteCellHtml + '</td>'
                + '<td style="padding:0.5rem; text-align:right;">' + menuHtml + '</td>'
                + '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error('renderPIReport:', err);
        container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:1rem;">Warning: ' + (err.message || 'Failed to load PI data.') + '</p>';
    }
}

// ─── PI PDF DOWNLOADS — reuses generatePDFBlob(), same branding as the annual review ──
function downloadPIPDF(ratingId) {
    var rating = piRatingsCache.find(function(r){ return r.id === ratingId; });
    if (!rating) { toast('PI rating not found. Refresh the dashboard.', 'warn'); return; }
    var pdf = generatePDFBlob(rating, false, null);
    pdf.save('PI_' + rating.employeeName.replace(/\s+/g, '_') + '_' + rating.id + '.pdf');
}

// Combined self + manager PDF for one employee's PI cycle, same layout as downloadFinalReport().
function downloadPIFinalReport(employeeId) {
    var mgrRating = piRatingsCache.find(function(r){ return r.employeeId === employeeId && !r.isSelfAssessment; });
    var selfRating = piRatingsCache.find(function(r){ return r.employeeId === employeeId && r.isSelfAssessment; });
    if (!mgrRating) { toast('PI manager rating not found. Refresh the dashboard.', 'warn'); return; }
    var pdf = generatePDFBlob(mgrRating, !!selfRating, selfRating || null);
    pdf.save('PI_Final_Report_' + mgrRating.employeeName.replace(/\s+/g, '_') + '.pdf');
    toast('PI final report PDF downloaded.', 'success');
}

// Opens the same View Details / Compare Self vs Manager modal used elsewhere in the
// admin dashboard, but for a PI row — clicking an employee's name in the PI report.
// Prefers the manager rating (so "Compare" is available immediately), falls back to
// the self-assessment alone if that's all that exists yet.
function viewPIRating(employeeId) {
    var mgrRating = piRatingsCache.find(function(r) { return r.employeeId === employeeId && !r.isSelfAssessment; });
    var selfRating = piRatingsCache.find(function(r) { return r.employeeId === employeeId && r.isSelfAssessment; });
    var primary = mgrRating || selfRating;
    if (!primary) { toast('No PI submission yet for this employee.', 'warn'); return; }
    viewRatingDetails(primary.id, null, true);
}

async function exportAllPI() {
    try {
        var rows = await sbSelectFrom('pi_reviews', 'select=*&review_period=eq.' + encodeURIComponent(PI_REVIEW_PERIOD));
        var byEmployee = {};
        rows.forEach(function(r) {
            if (!byEmployee[r.employee_id]) byEmployee[r.employee_id] = {};
            if (r.is_self_assessment) byEmployee[r.employee_id].self = r;
            else byEmployee[r.employee_id].mgr = r;
        });

        var headers = ['Employee ID','Employee Name','Self Score (OKR%)','Manager Score','PI Status','PI %','Employee Comments','Manager Remarks'];
        var csvRows = PI_ELIGIBLE_EMPLOYEE_IDS.map(function(empId) {
            var emp = findEmployeeById(empId);
            var name = emp ? emp.name : empId;
            var entry = byEmployee[empId] || {};
            var selfScore = entry.self ? (parseFloat(entry.self.overall_score) || 0) : null;
            var mgrScore = entry.mgr ? (parseFloat(entry.mgr.overall_score) || 0) : null;
            var selfOkrPct = entry.self ? entry.self.ratings.okr_percent : null;
            var status, piPct = '';
            if (!entry.self) status = 'Pending — Employee';
            else if (!entry.mgr) status = 'Pending — Manager';
            else { piPct = computePIFinalPercent(entry.self, entry.mgr); status = piPct + '%'; }

            return [
                empId, name,
                (selfOkrPct !== undefined && selfOkrPct !== null) ? selfOkrPct + '%' : '',
                mgrScore !== null ? mgrScore.toFixed(2) : '',
                status, piPct,
                entry.self ? (entry.self.justification || '') : '',
                entry.mgr ? (entry.mgr.justification || '') : ''
            ].map(function(c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
        });

        var csv = headers.map(function(h){ return '"'+h+'"'; }).join(',') + '\n' + csvRows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'Acme_PI_Report_' + Date.now() + '.csv'; a.click();
        window.URL.revokeObjectURL(url);
        toast('PI CSV exported successfully!', 'success');
    } catch (err) {
        console.error('exportAllPI:', err);
        toast('Error exporting PI report.', 'error');
    }
}
