// ─── MICROSOFT SSO via Supabase Auth (Azure OAuth) ──────────────
// Uses the same Supabase project — Azure provider must be enabled in
// Supabase Dashboard > Authentication > Providers > Azure.

var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
var currentSSOUser = null; // { email, name, id }

// ─── INIT: Check session on page load ────────────────────────────
(function() {
    document.addEventListener('DOMContentLoaded', async function() {
        // Check for existing session
        try {
            var { data: { session }, error } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                handleAuthSuccess(session.user);
            } else {
                showSSOGate();
            }
        } catch(e) {
            console.error('Auth init error:', e);
            showSSOGate();
        }

        // Listen for auth state changes (handles OAuth callback redirect)
        supabaseClient.auth.onAuthStateChange(function(event, session) {
            if (event === 'SIGNED_IN' && session && session.user) {
                handleAuthSuccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                showSSOGate();
            }
        });
    });
})();

// ─── Sign In with Microsoft ──────────────────────────────────────
async function ssoSignIn() {
    var btn = document.getElementById('ssoLoginBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    document.getElementById('ssoError').style.display = 'none';

    try {
        var origin = window.location.origin;
        var { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'azure',
            options: {
                scopes: 'email profile openid',
                redirectTo: origin   // Redirect back to the same page
            }
        });
        if (error) throw error;
        // Browser will redirect to Microsoft login — no code after this runs
    } catch(err) {
        console.error('SSO sign-in error:', err);
        document.getElementById('ssoError').textContent = 'Sign-in failed: ' + (err.message || 'Unknown error');
        document.getElementById('ssoError').style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<svg class="sso-ms-icon" fill="currentColor" viewBox="0 0 21 21" width="20" height="20"><path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z"/></svg> Sign in with Microsoft';
    }
}

// ─── Sign Out ────────────────────────────────────────────────────
async function ssoSignOut() {
    try {
        await supabaseClient.auth.signOut();
    } catch(e) {
        console.error('Sign-out error:', e);
    }
    currentSSOUser = null;
    showSSOGate();
}

// ─── Handle successful authentication ────────────────────────────
function handleAuthSuccess(user) {
    var email = user.email || '';
    var domain = email.split('@')[1] || '';
    var allowedDomains = ['example.com']; // restrict sign-in to your own company domain(s)

    // Domain restriction
    if (!allowedDomains.includes(domain)) {
        document.getElementById('ssoError').textContent =
            'Access denied. Only @example.com accounts are allowed. You signed in with: ' + email;
        document.getElementById('ssoError').style.display = 'block';
        // Sign them out
        supabaseClient.auth.signOut();
        return;
    }

    currentSSOUser = {
        id: user.id,
        email: email,
        name: user.user_metadata && user.user_metadata.full_name
            ? user.user_metadata.full_name
            : email.split('@')[0]
    };

    // Hide SSO gate, show app
    document.getElementById('ssoGate').style.display = 'none';
    document.getElementById('ssoUserBar').style.display = 'flex';
    document.getElementById('ssoUserEmail').textContent = currentSSOUser.name + ' (' + currentSSOUser.email + ')';

    // Try to auto-match employee from email
    var matchedEmp = findEmployeeByEmail(currentSSOUser.email);
    if (matchedEmp) {
        currentSSOUser.employeeId = matchedEmp.id;
        currentSSOUser.employeeName = matchedEmp.name;
    }

    // Hide Methodology and Manager Guidelines tabs for users without direct reports
    var hasReportees = matchedEmp && getDirectReports(matchedEmp.name).length > 0;
    var navMethodology = document.getElementById('navMethodology');
    if (navMethodology) {
        navMethodology.parentElement.style.display = hasReportees ? '' : 'none';
    }
    var navManagerGuidelines = document.getElementById('navManagerGuidelines');
    if (navManagerGuidelines) {
        navManagerGuidelines.parentElement.style.display = hasReportees ? '' : 'none';
    }

    // Welcome page's "Manager Rating" card is irrelevant for individual contributors
    // (matchedEmp === null means we couldn't resolve them at all — leave both options
    // visible in that case rather than guessing).
    var welcomeManagerBtn = document.getElementById('welcomeManagerBtn');
    if (welcomeManagerBtn) {
        welcomeManagerBtn.style.display = (matchedEmp && !hasReportees) ? 'none' : '';
        var roleSelector = welcomeManagerBtn.closest('.role-selector');
        if (roleSelector) roleSelector.classList.toggle('role-selector-single', matchedEmp && !hasReportees);
    }

    // Team Ratings needs downline at ANY depth (skip-level managers included),
    // not just direct reports — a manager whose reports are themselves
    // managers still has ratings worth seeing further down the chain.
    var hasDownline = matchedEmp && getAllDownline(matchedEmp.id).length > 0;
    var navTeamRatings = document.getElementById('navTeamRatings');
    if (navTeamRatings) {
        navTeamRatings.parentElement.style.display = hasDownline ? '' : 'none';
    }

    // Performance Incentive (PI) — separate September-cycle, fixed eligibility list.
    // Self nav shows only if the logged-in employee is on that list; the team-ratings
    // nav shows only if at least one PI-eligible employee is anywhere in their downline.
    var navPISelfAssessment = document.getElementById('navPISelfAssessment');
    if (navPISelfAssessment) {
        navPISelfAssessment.style.display = (matchedEmp && isPIEligible(matchedEmp.id)) ? 'inline-block' : 'none';
    }
    var navPIManagerRating = document.getElementById('navPIManagerRating');
    if (navPIManagerRating) {
        var hasPIDownline = matchedEmp && getAllDownline(matchedEmp.id).some(function(e) { return isPIEligible(e.id); });
        navPIManagerRating.style.display = hasPIDownline ? 'inline-block' : 'none';
    }

    // Welcome page side panel — the PI card is the only thing left in it, so
    // whether it shows also decides whether the grid keeps its two-column layout
    // or collapses to a single centered column (see .welcome-grid-solo in CSS —
    // without this the grid still reserves the aside's column even when it's empty).
    var isPI = matchedEmp && isPIEligible(matchedEmp.id);
    var welcomeSidePI = document.getElementById('welcomeSidePI');
    if (welcomeSidePI) {
        welcomeSidePI.style.display = isPI ? 'block' : 'none';
    }
    var welcomeGrid = document.getElementById('welcomeGrid');
    if (welcomeGrid) {
        welcomeGrid.classList.toggle('welcome-grid-solo', !isPI);
    }
}

// ─── Show the SSO gate (hide the app) ───────────────────────────
function showSSOGate() {
    // 'block', not 'flex' — .sso-split (the two-column grid) needs to be a normal
    // block-level child to stretch to 100% width. As a flex child it only sizes to
    // its own content and stops, leaving the rest of a wide viewport blank — this
    // was leftover from the old single-centered-card design, before the split-screen
    // layout replaced it.
    document.getElementById('ssoGate').style.display = 'block';
    document.getElementById('ssoUserBar').style.display = 'none';
    var btn = document.getElementById('ssoLoginBtn');
    btn.disabled = false;
    btn.innerHTML = '<svg class="sso-ms-icon" fill="currentColor" viewBox="0 0 21 21" width="20" height="20"><path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z"/></svg> Sign in with Microsoft';
}

// ─── Helper: find employee by email ──────────────────────────────
function findEmployeeByEmail(email) {
    if (!email) return null;
    var lowerEmail = email.toLowerCase();
    for (var i = 0; i < EMPLOYEES.length; i++) {
        if (EMPLOYEES[i].status !== 'inactive' && EMPLOYEES[i].email && EMPLOYEES[i].email.toLowerCase() === lowerEmail) {
            return EMPLOYEES[i];
        }
    }
    return null;
}

// ─── Get SSO user info for tracking submissions ─────────────────
function getSSOSubmitterInfo() {
    if (!currentSSOUser) return { submitted_by_email: 'unknown', submitted_by_name: 'unknown' };
    return {
        submitted_by_email: currentSSOUser.email,
        submitted_by_name: currentSSOUser.name
    };
}
