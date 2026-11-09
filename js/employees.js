// ─── EMPLOYEE DATA (sample) ────────────────────────────────────────────
// Replace this with your own org's data. A multi-level tree is included
// (CEO -> managers -> ICs, across two "company" sub-brands) so the
// org-chart / downline / skip-level features are demoable out of the box.
const EMPLOYEES = [
  { id:"E001", name:"Jordan Avery",  email:"jordan.avery@example.com",  company:"acme",  designation:"Chief Executive Officer", manager:"", managerId:"", dateJoined:"2018-01-10" },
  { id:"E002", name:"Sam Rivera",    email:"sam.rivera@example.com",    company:"acme",  designation:"VP - Engineering",        manager:"Jordan Avery", managerId:"E001", dateJoined:"2019-03-05" },
  { id:"E003", name:"Priya Nair",    email:"priya.nair@example.com",    company:"acme",  designation:"VP - Marketing",          manager:"Jordan Avery", managerId:"E001", dateJoined:"2019-06-12" },
  { id:"E004", name:"Alex Kim",      email:"alex.kim@example.com",      company:"acme",  designation:"Engineering Manager",     manager:"Sam Rivera",   managerId:"E002", dateJoined:"2020-02-01" },
  { id:"E005", name:"Taylor Chen",   email:"taylor.chen@example.com",   company:"acme",  designation:"Senior Engineer",         manager:"Alex Kim",     managerId:"E004", dateJoined:"2021-04-19" },
  { id:"E006", name:"Morgan Blake",  email:"morgan.blake@example.com",  company:"acme",  designation:"Software Engineer",       manager:"Alex Kim",     managerId:"E004", dateJoined:"2022-07-01" },
  { id:"E007", name:"Casey Morgan",  email:"casey.morgan@example.com",  company:"acme",  designation:"Marketing Manager",       manager:"Priya Nair",   managerId:"E003", dateJoined:"2020-09-15" },
  { id:"E008", name:"Riley Patel",   email:"riley.patel@example.com",   company:"acme",  designation:"Content Marketer",        manager:"Casey Morgan", managerId:"E007", dateJoined:"2021-11-03" },
  { id:"E009", name:"Jamie Ortiz",   email:"jamie.ortiz@example.com",   company:"nova",  designation:"Head - Nova Studio",      manager:"Jordan Avery", managerId:"E001", dateJoined:"2023-01-08" },
  { id:"E010", name:"Drew Fischer",  email:"drew.fischer@example.com",  company:"nova",  designation:"Creative Lead",           manager:"Jamie Ortiz",  managerId:"E009", dateJoined:"2023-05-22" },
  { id:"E011", name:"Hayden Cross",  email:"hayden.cross@example.com",  company:"nova",  designation:"Associate - Content",     manager:"Drew Fischer", managerId:"E010", dateJoined:"2024-02-14", status:"inactive" },
  { id:"E012", name:"Quinn Avery",   email:"quinn.avery@example.com",   company:"acme",  designation:"Software Engineer",       manager:"Alex Kim",     managerId:"E004", dateJoined:"2024-06-10" }
];

// ─── TENURE CALCULATION (cutoff set in js/config.js) ─────────────────
// Pass a cutoff explicitly (e.g. SEPT_CYCLE_TENURE_CUTOFF_DATE) for a cycle
// other than the annual one; defaults to the annual cutoff.
function calculateTenure(dateJoinedStr, cutoffDate) {
    var endDate = cutoffDate || TENURE_CUTOFF_DATE;
    var startDate = new Date(dateJoinedStr);

    // Guard: if join date is after the cutoff date
    if (startDate > endDate) return 'Not yet joined';

    var years = endDate.getFullYear() - startDate.getFullYear();
    var months = endDate.getMonth() - startDate.getMonth();
    var days = endDate.getDate() - startDate.getDate();

    if (days < 0) {
        months--;
        // Get days in the previous month of the end date
        var prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
        days += prevMonth.getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    var parts = [];
    if (years > 0) parts.push(years + (years === 1 ? ' year' : ' years'));
    if (months > 0) parts.push(months + (months === 1 ? ' month' : ' months'));
    if (days > 0 || parts.length === 0) parts.push(days + (days === 1 ? ' day' : ' days'));

    return parts.join(', ');
}

// ─── LOOKUP HELPERS ─────────────────────────────────────────────────
function findEmployeeById(empId) {
    if (!empId) return null;
    var upper = empId.toUpperCase();
    return EMPLOYEES.find(function(e) { return e.id === upper; }) || null;
}

function findEmployeeByName(name) {
    if (!name) return null;
    var lower = name.toLowerCase();
    return EMPLOYEES.find(function(e) { return e.name.toLowerCase() === lower; }) || null;
}

function searchEmployees(query) {
    if (!query || query.trim().length < 1) return [];
    var q = query.trim().toLowerCase();
    return EMPLOYEES.filter(function(e) {
        return e.status !== 'inactive' && (
               e.id.toLowerCase().indexOf(q) !== -1 ||
               e.name.toLowerCase().indexOf(q) !== -1 ||
               e.email.toLowerCase().indexOf(q) !== -1);
    }).slice(0, 15); // Limit to 15 results
}

// Get unique manager names (those who have direct reports)
var MANAGERS = [...new Set(EMPLOYEES.map(function(e) { return e.manager; }))].filter(function(m) {
    // Only include managers who are also in the EMPLOYEES list
    return EMPLOYEES.some(function(e) { return e.name === m; });
}).sort();

// Get employees reporting to a specific manager (by name or ID)
// Excludes inactive (exited) employees — they won't appear for new ratings,
// but their past reviews still resolve fine via findEmployeeById/ByName.
function getDirectReports(managerNameOrId) {
    return EMPLOYEES.filter(function(emp) {
        return emp.status !== 'inactive' &&
               (emp.manager === managerNameOrId || emp.managerId === managerNameOrId);
    }).sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
}

// Every employee under managerNameOrId at ANY depth — direct reports, their
// reports, and so on — for skip-level visibility. Depth-first, de-duplicated
// against reporting-line cycles (shouldn't exist per the QA sweep, but a
// visited-set costs nothing and makes this safe regardless).
function getAllDownline(managerNameOrId, _visited) {
    _visited = _visited || {};
    var result = [];
    getDirectReports(managerNameOrId).forEach(function(emp) {
        if (_visited[emp.id]) return;
        _visited[emp.id] = true;
        result.push(emp);
        result = result.concat(getAllDownline(emp.id, _visited));
    });
    return result;
}

// Get manager employee record by name
function findManagerByName(name) {
    if (!name) return null;
    var lower = name.toLowerCase();
    return EMPLOYEES.find(function(e) { return e.name.toLowerCase() === lower; }) || null;
}
