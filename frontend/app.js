(() => {
    "use strict";

    const root = document.getElementById("app");
    const toast = document.getElementById("toast");
    const appIsInFrontendDirectory = /\/frontend(?:\/|$)/.test(window.location.pathname);
    const apiBase = new URL(appIsInFrontendDirectory ? "../api/" : "api/", window.location.href).pathname;
    const state = {
        user: null,
        profile: null,
        page: "dashboard",
        requestFilter: "pending",
        requestRecords: [],
        requestSearch: "",
        requestPageSize: 10,
        requestPage: 1,
        selectedRequestDetail: null,
        selectedAdminRequestId: null,
        cancelRequestId: null,
        selectedCertificateType: "",
        selectedRequestId: null,
        residentRecords: [],
        residentListRecords: [],
        residentQuery: "",
        residentPage: 1,
        residentPageSize: 10,
        residentSort: { key: "full_name", direction: "asc" },
        verificationQuery: "",
        verificationPageSize: 10,
        verificationPage: 1,
        verificationAccounts: [],
        officialRecords: [],
        officialFormOpen: false,
        officialEditingId: null,
        residentPasswordEditOpen: false,
        passwordResetToken: "",
        toastTimer: null
    };
    const residentManagerRoles = ["admin", "bhw", "purok_leader"];
    const residentCertificateTypes = ["Barangay Indigency", "Barangay Permit", "Barangay Residency", "Barangay Clearance"];

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);

    const api = async (path, options = {}) => {
        const response = await fetch(`${apiBase}${path}`, {
            credentials: "same-origin",
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
                ...options.headers
            }
        });
        const contentType = response.headers.get("content-type") || "";
        const result = contentType.includes("application/json")
            ? await response.json()
            : await response.text();
        if (!response.ok) {
            const message = typeof result === "object" ? result.Message || result.error : result;
            throw new Error(message || `Request failed (${response.status}).`);
        }
        if (typeof result === "object" && result !== null && result.Status === "Error") {
            throw new Error(result.Message || "The request could not be completed.");
        }
        if (typeof result === "object" && result !== null && String(result.Message || "").startsWith("Error:")) {
            throw new Error(result.Message);
        }
        return result;
    };

    const post = (path, data) => api(path, { method: "POST", body: JSON.stringify(data) });

    const showToast = (message, isError = false) => {
        clearTimeout(state.toastTimer);
        toast.textContent = message;
        toast.className = `toast show${isError ? " error" : ""}`;
        state.toastTimer = setTimeout(() => { toast.className = "toast"; }, 3800);
    };

    const showSignupNameError = (form) => {
        form.querySelectorAll("input").forEach((input) => { input.value = ""; });
        root.insertAdjacentHTML("beforeend", `
            <div class="auth-dialog-backdrop">
                <section class="auth-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signup-name-error-title" aria-describedby="signup-name-error-message">
                    <span class="auth-dialog-icon" aria-hidden="true">×</span>
                    <h2 id="signup-name-error-title">Name not found!</h2>
                    <p id="signup-name-error-message">You need to register at barangay as resident!</p>
                    <button class="button button-primary" type="button" data-action="signup-name-dismiss">OK</button>
                </section>
            </div>`);
        root.querySelector('[data-action="signup-name-dismiss"]').focus();
    };

    const showLoginWelcome = () => {
        root.insertAdjacentHTML("beforeend", `
            <div class="auth-dialog-backdrop success-dialog-backdrop">
                <section class="auth-dialog success-dialog" role="alertdialog" aria-modal="true" aria-labelledby="login-welcome-title" aria-describedby="login-welcome-message">
                    <span class="success-dialog-icon" aria-hidden="true">✓</span>
                    <h2 id="login-welcome-title">Login Successfully</h2>
                    <p id="login-welcome-message">Welcome to Barangay Polo.</p>
                    <button class="button button-primary" type="button" data-action="login-welcome-dismiss">OK</button>
                </section>
            </div>`);
        root.querySelector('[data-action="login-welcome-dismiss"]').focus();
    };

    const showSuccessDialog = (message, description = "", dismissAction = "success-dialog-dismiss") => {
        const descriptionMarkup = description
            ? `<p id="resident-success-message">${escapeHtml(description)}</p>`
            : "";
        root.insertAdjacentHTML("beforeend", `
            <div class="auth-dialog-backdrop success-dialog-backdrop">
                <section class="auth-dialog success-dialog" role="alertdialog" aria-modal="true" aria-labelledby="resident-success-title" ${description ? 'aria-describedby="resident-success-message"' : ""}>
                    <span class="success-dialog-icon" aria-hidden="true">✓</span>
                    <h2 id="resident-success-title">${escapeHtml(message)}</h2>
                    ${descriptionMarkup}
                    <button class="button button-primary" type="button" data-action="${escapeHtml(dismissAction)}">OK</button>
                </section>
            </div>`);
        root.querySelector(`[data-action="${dismissAction}"]`).focus();
    };

    const initials = (name) => String(name || "User").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
    const dateLabel = (value) => {
        if (!value) return "—";
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
            ? new Date(`${value}T00:00:00`)
            : new Date(value);
        return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
    };
    const dateTimeLabel = (value) => {
        if (!value) return "—";
        const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(value))
            ? String(value).replace(" ", "T")
            : String(value);
        const date = new Date(normalized);
        return Number.isNaN(date.getTime())
            ? dateLabel(value)
            : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
    };
    const residentPhotoUrl = (photoPath) => photoPath
        ? new URL(`../backend/${String(photoPath).replace(/^\/+/, "")}`, window.location.href).href
        : "";
    const residentPhotoPlaceholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 280 280'%3E%3Crect width='280' height='280' fill='%23bcbcbc'/%3E%3Ccircle cx='140' cy='88' r='52' fill='white'/%3E%3Cpath d='M38 280c4-70 42-112 102-112s98 42 102 112' fill='white'/%3E%3C/svg%3E";

    const openResidentForm = (residentId = null, readOnly = false) => {
        const modal = root.querySelector("#resident-modal");
        const form = modal?.querySelector('form[data-form="resident"]');
        if (!modal || !form) return;
        form.querySelectorAll("[data-legacy-purok]").forEach((option) => option.remove());
        form.reset();
        form.elements.id.value = "";
        form.elements.full_name.value = "";
        form.querySelectorAll("[name]").forEach((field) => { field.disabled = readOnly; });
        form.elements.id.disabled = false;
        form.querySelector('[data-resident-photo-preview]').src = residentPhotoPlaceholder;
        form.querySelector('[data-resident-photo-name]').textContent = "";
        form.querySelector('[data-resident-photo-name]').hidden = true;
        form.querySelector('[data-resident-added-by]').textContent = "—";
        form.querySelector('[data-resident-last-updated-by]').textContent = "—";
        form.querySelector('[data-resident-history]').hidden = true;
        const resident = residentId
            ? state.residentRecords.find((item) => String(item.id) === String(residentId))
            : null;
        if (resident) {
            form.querySelector('[data-resident-history]').hidden = false;
            form.querySelector('[data-resident-added-by]').textContent = resident.added_by || "—";
            form.querySelector('[data-resident-last-updated-by]').textContent = resident.last_updated_by || "—";
            Object.entries(resident).forEach(([key, value]) => {
                const field = form.elements[key];
                if (!field || field.type === "file") return;
                if (key === "purok_no" && value && !Array.from(field.options).some((option) => option.value === String(value))) {
                    const legacyOption = new Option(`Existing: ${value}`, value);
                    legacyOption.dataset.legacyPurok = "true";
                    field.add(legacyOption, 1);
                }
                field.value = value ?? "";
            });
            const hasStructuredName = Boolean(resident.first_name || resident.last_name);
            form.elements.last_name.required = hasStructuredName;
            form.elements.first_name.required = hasStructuredName;
            form.elements.last_name.disabled = readOnly || !hasStructuredName;
            form.elements.first_name.disabled = readOnly || !hasStructuredName;
            if (!hasStructuredName) form.elements.full_name.value = resident.full_name || "";
            form.elements.age.value = resident.birthdate ? calculateAge(resident.birthdate) : "";
            form.querySelector('[data-resident-photo-preview]').src = resident.photo_path
                ? residentPhotoUrl(resident.photo_path)
                : residentPhotoPlaceholder;
            form.querySelector('[data-resident-photo-name]').textContent = resident.photo_path ? "Resident photo" : "";
            form.querySelector('[data-resident-photo-name]').hidden = !resident.photo_path;
        } else {
            form.elements.last_name.required = true;
            form.elements.first_name.required = true;
            form.elements.last_name.disabled = false;
            form.elements.first_name.disabled = false;
            form.elements.date_of_registration.value = new Date().toISOString().slice(0, 10);
            form.elements.nationality.value = "Filipino";
        }
        form.querySelector('[data-resident-save]').hidden = readOnly;
        form.querySelector('[data-resident-edit]').hidden = !readOnly;
        modal.querySelectorAll("[data-resident-life-status]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.residentLifeStatus === form.elements.is_alive.value));
            button.classList.toggle("is-selected", button.dataset.residentLifeStatus === form.elements.is_alive.value);
        });
        modal.querySelector("[data-resident-modal-title]").textContent = readOnly ? "Resident Details" : "Manage Details";
        document.body.classList.add("resident-modal-open");
        modal.hidden = false;
        modal.querySelector(".resident-modal-close").focus();
    };

    const calculateAge = (birthdate) => {
        if (!birthdate) return "";
        const birth = new Date(`${birthdate}T00:00:00`);
        if (Number.isNaN(birth.getTime())) return "";
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
        return age < 0 ? "" : age;
    };
    const statusBadge = (status, label = null) => {
        const value = String(status || "Unknown");
        const display = label || value.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
        return `<span class="status ${escapeHtml(value.toLowerCase())}">${escapeHtml(display)}</span>`;
    };
    const verificationBadge = (status) => statusBadge(status, ({
        approved: "Verified",
        verifying: "Verifying",
        unverified: "Not verified"
    })[status] || status);
    const isVerificationApproved = (status) => ["approved", "verified"].includes(String(status || "").toLowerCase());
    const pageTitle = {
        dashboard: ["Dashboard", "A snapshot of your barangay services."],
        requests: ["Certificate requests", "Submit and keep track of your certificate requests."],
        verifications: ["Account verification", "Review submitted resident verification documents."],
        residents: ["Residents", "Register and manage resident information."],
        "resident-list": ["Generate Certificate", "Generate a printable list of residents."],
        officials: ["Barangay Officials", "Manage barangay council officials."],
        "sk-officials": ["SK Officials", "Manage Sangguniang Kabataan officials."],
        accounts: ["Staff access", "Assign BHW access to resident accounts."],
        certificate: ["Certificate generation", "Prepare and print the approved certificate."],
        report: ["Yearly report", "Completed certificate requests by year."],
        profile: ["My account", "Your account, verification status, and security settings."]
    };

    const renderAuth = (signup = false, recovery = null) => {
        document.body.classList.remove("printing-request-list", "printing-resident-list");
        const recoveryView = recovery === "request" || recovery === "sent" || recovery === "reset";
        const title = recovery === "reset" ? "Choose a new password"
            : recovery === "request" ? "Forgot password?"
                : recovery === "sent" ? "Check your email"
                    : signup ? "Sign up" : "Sign in";
        const description = recovery === "reset" ? "Enter a new password for your account."
            : recovery === "request" ? "Enter the email address linked to your account and we'll send a reset link."
                : recovery === "sent" ? "If that email is registered, a password reset link has been sent. Check your inbox."
                    : signup ? "Use your registered resident name to set up online access." : "Access your barangay services.";
        let form = "";
        if (recovery === "request") {
            form = `<form id="auth-form" data-form="password-reset-request">
                <div class="field auth-field"><label class="sr-only" for="reset-email">Email address</label><input id="reset-email" name="email" type="email" autocomplete="email" placeholder="Email address" required></div>
                <div class="form-actions"><button class="button button-primary" type="submit">Send reset link</button></div>
            </form>`;
        } else if (recovery === "reset") {
            form = `<form id="auth-form" data-form="password-reset-complete">
                <input type="hidden" name="token" value="${escapeHtml(state.passwordResetToken)}">
                <div class="field auth-field"><label class="sr-only" for="reset-new-password">New password</label><input id="reset-new-password" name="new_password" type="password" autocomplete="new-password" minlength="6" placeholder="New password (at least 6 characters)" required></div>
                <div class="field auth-field"><label class="sr-only" for="reset-confirm-password">Confirm new password</label><input id="reset-confirm-password" name="confirm_password" type="password" autocomplete="new-password" minlength="6" placeholder="Confirm new password" required></div>
                <div class="form-actions"><button class="button button-primary" type="submit">Reset password</button></div>
            </form>`;
        } else if (recovery === "sent") {
            form = `<div class="form-actions"><button class="button button-primary" type="button" data-action="password-reset-back">Back to sign in</button></div>`;
        } else {
            form = `<form id="auth-form" data-form="${signup ? "signup" : "login"}">
                ${signup ? `<div class="signup-name-grid">
                    <div class="field auth-field"><label class="sr-only" for="last-name">Last name</label><input id="last-name" name="last_name" autocomplete="family-name" placeholder="Last name" required></div>
                    <div class="field auth-field"><label class="sr-only" for="first-name">First name</label><input id="first-name" name="first_name" autocomplete="given-name" placeholder="First name" required></div>
                    <div class="field auth-field"><label class="sr-only" for="middle-name">Middle name</label><input id="middle-name" name="middle_name" autocomplete="additional-name" placeholder="Middle name"></div>
                    <div class="field auth-field"><label class="sr-only" for="suffix">Suffix</label><input id="suffix" name="suffix" autocomplete="honorific-suffix" placeholder="Suffix (optional)"></div>
                </div>` : ""}
                <div class="field auth-field"><label class="sr-only" for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" placeholder="Email address" required></div>
                <div class="field auth-field"><label class="sr-only" for="password">Password</label><input id="password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="6" placeholder="Password" required></div>
                ${signup ? `<div class="field auth-field"><label class="sr-only" for="confirm-password">Confirm password</label><input id="confirm-password" name="confirm_password" type="password" autocomplete="new-password" minlength="6" placeholder="Confirm password" required></div>
                    <p class="signup-note">Online signup is for residents already registered in the barangay. New accounts require verification before certificate requests can be submitted.</p>` : ""}
                <div class="form-actions"><button class="button button-primary" type="submit">${signup ? "Sign Up" : "Login"}</button></div>
            </form>`;
        }
        root.innerHTML = `
            <main class="auth-shell${signup ? " signup-shell" : ""}">
                <div class="auth-cityscape" aria-hidden="true"></div>
                <aside class="auth-aside">
                    <div class="auth-brand">
                        <img class="auth-logo" src="images/polog.png" alt="Barangay Polo seal">
                        <span class="auth-brand-copy"><strong>BeSCMS</strong><span>Barangay Polo</span></span>
                    </div>
                </aside>
                <section class="auth-content">
                    <div class="auth-card">
                        <h2>${title}</h2>
                        <p class="subheading">${description}</p>
                        ${form}
                        ${recoveryView
                ? recovery === "request" ? `<p class="auth-switch"><button class="text-button" type="button" data-action="password-reset-back">Back to sign in</button></p>` : ""
                : signup
                ? `<p class="auth-switch">Already have an account? <button class="text-button" type="button" data-action="auth-toggle">Sign in</button></p>`
                : `<button class="forgot-password" type="button" data-action="forgot-password">Forgot password?</button>
                            <div class="auth-divider" aria-hidden="true"></div>
                            <button class="create-account-button" type="button" data-action="auth-toggle">Create new account</button>`}
                    </div>
                </section>
            </main>`;
    };

    const navigation = () => {
        if (state.user.role === "admin") {
            const items = [
                ["dashboard", "⌂", "Dashboard"],
                ["residents", "♙", "Residents"],
                ["verifications", "◉", "To Verify Accounts"],
                ["officials", "♟", "Barangay Officials"],
                ["sk-officials", "☆", "SK Officials"],
                ["requests", "▤", "Online requests"],
                ["accounts", "◌", "Accounts"],
                ["report", "▥", "Reports"]
            ];
            return items.map(([page, icon, label]) => `
                <button class="nav-button${state.page === page ? " active" : ""}" type="button" data-page="${page}" aria-current="${state.page === page ? "page" : "false"}">
                    <span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-text">${label}</span>
                </button>`).join("");
        }
        if (state.user.role === "purok_leader") {
            const items = [
                ["dashboard", "⌂", "Dashboard"],
                ["residents", "♙", "Residents"],
                ["profile", "◉", "My account"]
            ];
            return items.map(([page, icon, label]) => `
                <button class="nav-button${state.page === page ? " active" : ""}" type="button" data-page="${page}" aria-current="${state.page === page ? "page" : "false"}">
                    <span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-text">${label}</span>
                </button>`).join("");
        }
        const staff = ["admin", "bhw"].includes(state.user.role);
        if (state.user.role === "resident") {
            const items = [["requests", "▢", "My Request"]];
            return items.map(([page, icon, label]) => `
                <button class="nav-button${state.page === page ? " active" : ""}" type="button" data-page="${page}" aria-current="${state.page === page ? "page" : "false"}">
                    <span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-text">${label}</span>
                </button>`).join("");
        }
        const items = [
            ["dashboard", "⌂", "Overview"],
            ["requests", "▤", staff ? "Requests queue" : "My requests"]
        ];
        if (staff) items.push(["verifications", "◉", "To Verify Accounts"]);
        if (staff) items.push(["residents", "♙", "Residents"]);
        if (state.user.role === "admin") items.push(["accounts", "◌", "Staff access"]);
        if (staff) items.push(["report", "▥", "Yearly report"]);
        items.push(["profile", "◉", "My account"]);
        const uniqueItems = items.filter((item, index) => items.findIndex((candidate) => candidate[0] === item[0] && candidate[2] === item[2]) === index);
        return uniqueItems.map(([page, icon, label]) => `
            <button class="nav-button${state.page === page ? " active" : ""}" type="button" data-page="${page}" aria-current="${state.page === page ? "page" : "false"}">
                <span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-text">${label}</span>
            </button>`).join("");
    };

    const renderShell = (content) => {
        const name = state.profile?.full_name || state.user?.email || "Account";
        const currentTitle = pageTitle[state.page]?.[0] || "Overview";
        const admin = state.user.role === "admin";
        const resident = state.user.role === "resident";
        document.body.classList.toggle("printing-request-list", state.page === "report");
        document.body.classList.toggle("printing-resident-list", state.page === "resident-list");
        root.innerHTML = `
            <div class="workspace${admin ? " admin-workspace" : resident ? " resident-workspace" : ""}">
                ${admin ? `<header class="topbar admin-topbar">
                    <div class="admin-topbar-brand"><img class="sidebar-logo" src="images/polog.png" alt="Barangay Polo seal"><span><strong>Barangay Polo</strong><small>Dapitan City, Zamboanga del Norte</small></span><button class="admin-menu-toggle" type="button" data-action="toggle-admin-sidebar" aria-label="Toggle navigation">☰</button></div>
                    <button class="admin-profile-shortcut" type="button" data-page="profile" aria-label="Open administrator account">${escapeHtml(initials(name))}<span aria-hidden="true">⌄</span></button>
                </header>` : resident ? `<header class="topbar resident-topbar">
                    <div class="resident-topbar-brand"><img class="resident-topbar-logo" src="images/polog.png" alt="Barangay Polo seal"><span><strong>Barangay Polo</strong><small>Dapitan City, Zamboanga del Norte</small></span></div>
                    <div class="resident-account-menu-wrap"><button class="resident-profile-shortcut" type="button" data-action="toggle-resident-account" aria-label="Open account menu" aria-expanded="false">♟ <span aria-hidden="true">⌄</span></button><div class="resident-account-menu" hidden><button type="button" data-page="profile">My account</button><button type="button" data-action="logout">Sign out</button></div></div>
                </header>` : ""}
                <aside class="sidebar">
                    ${admin ? "" : resident ? `<div class="resident-sidebar-account"><button type="button" data-page="profile">${escapeHtml(name)}</button></div>` : `<div class="brand"><span class="brand-mark">B</span><span class="brand-copy"><strong>BeSCMS</strong></span></div>`}
                    ${resident ? "" : `<p class="nav-label">${admin ? "General" : "Workspace"}</p>`}
                    <nav class="nav-list" aria-label="Main navigation">${navigation()}</nav>
                    ${admin ? `<p class="nav-label admin-settings-label">Settings</p><button class="nav-button admin-settings-button${state.page === "profile" ? " active" : ""}" type="button" data-page="profile" aria-current="${state.page === "profile" ? "page" : "false"}"><span class="nav-icon" aria-hidden="true">⚙</span><span class="nav-text">My account</span></button>` : ""}
                    <div class="sidebar-bottom${resident ? " resident-sidebar-bottom" : ""}">
                        <div class="account-mini">
                            <span class="avatar">${escapeHtml(initials(name))}</span>
                            <div class="account-mini-copy"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(state.user.role)}</span></div>
                            <button class="logout-button" type="button" data-action="logout" aria-label="Sign out" title="Sign out">↪</button>
                        </div>
                    </div>
                </aside>
                <main class="main-area">
                    ${admin || resident ? "" : `<header class="topbar"><span class="topbar-user">${escapeHtml(currentTitle)}</span><span class="topbar-date">${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())}</span></header>`}
                    <section class="page-content">${content}</section>
                </main>
            </div>`;
    };

    const heading = (title, description, action = "") => `
        <div class="page-heading"><div><p class="eyebrow">Barangay services</p><h1>${title}</h1><p>${description}</p></div>${action}</div>`;

    const statCard = (icon, label, value, note) => `
        <article class="stat-card"><div class="stat-label"><span class="stat-icon">${icon}</span>${label}</div><p class="stat-value">${escapeHtml(value)}</p><p class="stat-note">${note}</p></article>`;

    const table = (headers, rows, emptyMessage, className = "") => `
        <div class="table-wrap${className ? ` ${className}` : ""}"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${headers.length}" class="empty-state">${emptyMessage}</td></tr>`}</tbody></table></div>`;

    const requestRows = (requests, admin = false) => requests.map((request) => `
        <tr>
            <td><strong>#${escapeHtml(request.id)}</strong></td>
            ${admin ? `<td>${escapeHtml(request.full_name || "Resident")}</td>` : ""}
            <td>${escapeHtml(request.certificate_type || "—")}</td>
            <td>${escapeHtml(request.purpose || "—")}</td>
            <td>${escapeHtml(request.contact_number || "—")}</td>
            <td>${escapeHtml(request.quantity ?? "—")}</td>
            <td>${statusBadge(request.status)}</td>
            <td>${dateLabel(request.requested_at)}</td>
            <td>${escapeHtml(request.admin_notes || "—")}</td>
            ${admin ? `<td><div class="row-actions">${request.status === "pending" ? `<button class="button button-secondary button-small" type="button" data-action="approve-request" data-id="${escapeHtml(request.id)}">Approve</button><button class="button button-danger button-small" type="button" data-action="reject-request" data-id="${escapeHtml(request.id)}">Reject</button>` : request.status === "approved" ? `<button class="button button-secondary button-small" type="button" data-action="print-request" data-id="${escapeHtml(request.id)}">Print</button><button class="button button-primary button-small" type="button" data-action="complete-request" data-id="${escapeHtml(request.id)}">Complete</button>` : ""}</div></td>` : `<td><div class="row-actions">${request.status === "pending" ? `<button class="button button-secondary button-small" type="button" data-action="edit-request" data-id="${escapeHtml(request.id)}" data-quantity="${escapeHtml(request.quantity)}">Edit</button><button class="button button-danger button-small" type="button" data-action="cancel-request" data-id="${escapeHtml(request.id)}">Cancel</button>` : request.status === "cancelled" ? `<button class="button button-secondary button-small" type="button" data-action="edit-request" data-id="${escapeHtml(request.id)}" data-quantity="${escapeHtml(request.quantity)}">Resubmit</button>` : "—"}</div></td>`}
        </tr>`).join("");

    const dashboardPage = async () => {
        if (state.user.role === "purok_leader") {
            const response = await api("auth/profile");
            state.profile = Array.isArray(response.Data) ? response.Data[0] || null : response.Data || null;
            const firstName = (state.profile?.full_name || state.user.email).split(" ")[0];
            renderShell(`${heading(`Good day, ${escapeHtml(firstName)}`, "Help keep barangay resident records up to date.", `<button class="button button-primary" type="button" data-page="residents">＋ Add Resident</button>`)}
                <section class="panel"><div class="panel-header"><h2>Resident records</h2></div><div class="panel-body"><p class="panel-intro">You can register new residents and search existing records for your barangay.</p><button class="button button-secondary" type="button" data-page="residents">Open Residents →</button></div></section>`);
            return;
        }
        const admin = ["admin", "bhw"].includes(state.user.role);
        const adminDashboard = state.user.role === "admin";
        const [profileResponse, requestResponse, dashboardResponse, verificationResponse, residentResponse] = await Promise.all([
            api("auth/profile"),
            api(admin ? "certificate-processing/pending" : "certificate-request/my-requests"),
            admin ? api("certificate-processing/dashboard") : Promise.resolve(null),
            admin ? api("auth/verify/pending") : Promise.resolve(null),
            adminDashboard ? api("resident/list") : Promise.resolve(null)
        ]);
        state.profile = Array.isArray(profileResponse.Data) ? profileResponse.Data[0] || null : profileResponse.Data || null;
        const requests = requestResponse.Data || [];
        const counts = dashboardResponse?.Data || {};
        const verifications = verificationResponse?.Data || [];
        const verification = state.profile?.verification_status || state.user.verification_status || "pending";
        const residentCount = residentResponse?.Data?.filter((resident) => resident && resident.id).length ?? "—";
        const residentList = (residentResponse?.Data || []).filter((resident) => resident && resident.id);
        const residentGroups = [
            { label: "Vaccinated", color: "#1684e5", count: residentList.filter((resident) => resident.vaccinated === "yes").length },
            { label: "Solo Parent", color: "#ca3452", count: residentList.filter((resident) => resident.is_solo_parent === "yes").length },
            { label: "Voters", color: "#efb82f", count: residentList.filter((resident) => resident.registered_voter === "yes").length },
            { label: "Senior Citizen", color: "#36a35b", count: residentList.filter((resident) => calculateAge(resident.birthdate) !== "" && Number(calculateAge(resident.birthdate)) >= 60).length }
        ];
        const chartTotal = residentGroups.reduce((total, item) => total + item.count, 0);
        const chartSegments = residentGroups.reduce((segments, item) => {
            const start = segments.length ? segments[segments.length - 1].end : 0;
            const end = start + (chartTotal ? item.count / chartTotal * 100 : 0);
            segments.push({ color: item.color, end });
            return segments;
        }, []);
        const chartBackground = chartTotal
            ? `conic-gradient(${chartSegments.map((segment, index) => `${segment.color} ${index ? chartSegments[index - 1].end : 0}% ${segment.end}%`).join(", ")})`
            : "conic-gradient(#e8ece9 0% 100%)";
        const overview = adminDashboard
            ? `<div class="admin-overview">
                <section class="panel admin-chart-panel"><div class="panel-header"><h2><span aria-hidden="true">◉</span> Residents Data</h2></div><div class="panel-body admin-chart-body">
                    <div class="verification-legend">${residentGroups.map((item, index) => `<span><i class="legend-dot resident-legend-${index}" aria-hidden="true"></i>${item.label}</span>`).join("")}</div>
                    <div class="verification-donut resident-data-donut" style="--verification-chart:${chartBackground}" role="img" aria-label="Residents data: ${residentGroups.map((item) => `${item.count} ${item.label}`).join(", ")}"></div>
                </div></section>
                <div class="admin-summary-cards">
                    <button class="admin-summary-card admin-summary-pending" type="button" data-page="requests"><span><strong>Pending<br>request</strong><i>View</i></span><b>${escapeHtml(counts.pending_requests ?? 0)}</b></button>
                    <button class="admin-summary-card admin-summary-verify" type="button" data-page="verifications"><span><strong>To verify<br>accounts</strong><i>View</i></span><b>${escapeHtml(counts.pending_verifications ?? 0)}</b></button>
                    <button class="admin-summary-card admin-summary-residents" type="button" data-page="residents"><span><strong>Total<br>residents</strong><i>View</i></span><b>${escapeHtml(residentCount)}</b></button>
                </div>
            </div>`
            : admin
                ? `<div class="cards">${statCard("▤", "Pending requests", counts.pending_requests ?? 0, "Waiting for staff review")}${statCard("◉", "To verify", counts.pending_verifications ?? 0, "Accounts awaiting document review")}${statCard("♙", "Total residents", residentCount, "Registered in the barangay")}</div>`
            : `<div class="cards">${statCard("▤", "Your requests", requests.length, "Requests on your account")}${statCard("◉", "Verification", verification, "Account verification status")}${statCard("♙", "Account type", "Resident", "Barangay online services")}</div>`;
        const notice = !admin && !isVerificationApproved(verification)
            ? `<div class="notice"><span>i</span><span>Your account verification is <strong>${escapeHtml(verification)}</strong>. You can submit certificate requests once your account has been approved. Upload your verification document in My account.</span></div>`
            : "";
        const columns = admin ? ["Request", "Resident", "Certificate", "Purpose", "Contact number", "Qty", "Status", "Submitted", "Staff notes", "Actions"] : ["Request", "Certificate", "Purpose", "Contact number", "Qty", "Status", "Submitted", "Staff notes", "Actions"];
        const rows = requestRows(requests.slice(0, 6), admin);
        const residentDashboard = state.user.role === "resident";
        const approvedRequest = requests.find((request) => String(request.status || "").toLowerCase() === "approved");
        const residentSteps = [
            ["01", "♙", "Create an account and log in"],
            ["02", "▣", "Choose the certificate you need and click Request"],
            ["03", "ℹ", "Fill in the required information"],
            ["04", "✓", "Wait for approval from the Barangay Secretary"],
            ["05", "✔", "Your certificate is ready for pick-up"]
        ];
        const residentPortal = residentDashboard
            ? `<div class="resident-portal-grid">
                <div class="resident-portal-main">
                    <section class="panel resident-request-banner">
                        <div><h1>Certification Request</h1><p>To request for a Certificate, click the Request button.</p></div>
                        <button class="button button-primary" type="button" data-action="open-certificate-picker">Request</button>
                    </section>
                    ${!isVerificationApproved(verification) ? `<div class="resident-verification-note"><span>Your account is ${escapeHtml(verification)}. Account verification is required before you can request a certificate.</span><button class="button-link" type="button" data-page="profile">Verify account →</button></div>` : ""}
                    <section class="panel resident-steps-panel">
                        <h2>Five Step in Requesting Barangay Certificates</h2>
                        <ol class="resident-request-steps">${residentSteps.map(([number, icon, label]) => `<li><span class="resident-step-icon" aria-hidden="true">${icon}</span><strong>Step ${Number(number)}</strong><span>${label}</span></li>`).join("")}</ol>
                    </section>
                </div>
                <aside class="resident-portal-aside">
                    ${approvedRequest ? `<section class="panel resident-approved-status"><h2>${escapeHtml(approvedRequest.certificate_type || "Certificate")}</h2><p>Status: <strong>Approved</strong></p></section>` : ""}
                    <section class="panel resident-hotline-panel" aria-labelledby="resident-hotline-title">
                        <div class="resident-hotline-poster">
                            <span class="resident-hotline-symbol" aria-hidden="true">✚</span>
                            <h2 id="resident-hotline-title">Emergency Hotlines</h2>
                            <p>For urgent assistance, contact your Barangay Hall or local emergency services.</p>
                            <span class="resident-hotline-footer">Keep emergency contacts close</span>
                        </div>
                    </section>
                </aside>
            </div>
            <section class="panel resident-recent-requests"><div class="panel-header"><h2>My recent requests</h2><button class="button-link" type="button" data-page="requests">My Request →</button></div>
                ${table(columns, rows, "You haven’t submitted any certificate requests yet.")}</section>
            <div class="certificate-picker-backdrop" data-action="close-certificate-picker" data-certificate-picker hidden>
                <section class="certificate-picker" role="dialog" aria-modal="true" aria-labelledby="certificate-picker-title">
                    <header class="certificate-picker-header"><h2 id="certificate-picker-title">Select a Certificate</h2><button type="button" data-action="close-certificate-picker" aria-label="Close">×</button></header>
                    <div class="certificate-picker-grid">${residentCertificateTypes.map((type, index) => `<article class="certificate-option certificate-option-${index + 1}">
                        <span class="certificate-option-icon" aria-hidden="true">${["●", "▣", "⌂", "✓"][index]}</span>
                        <h3>${escapeHtml(type)}</h3>
                        <button type="button" data-action="select-certificate-type" data-certificate-type="${escapeHtml(type)}">Select</button>
                    </article>`).join("")}</div>
                </section>
            </div>`
            + `<div class="verification-warning-backdrop" data-verification-warning hidden>
                <section class="verification-warning" role="alertdialog" aria-modal="true" aria-labelledby="verification-warning-title" aria-describedby="verification-warning-message">
                    <span class="verification-warning-icon" aria-hidden="true">!</span>
                    <h2 id="verification-warning-title">Account not verified</h2>
                    <p id="verification-warning-message">Verify your account first to request certificate!</p>
                    <button class="button button-primary" type="button" data-action="dismiss-verification-warning">Ok</button>
                </section>
            </div>`
            : `${heading(admin ? "Dashboard" : "Good day, " + escapeHtml((state.profile?.full_name || state.user.email).split(" ")[0]), admin ? "Dashboard" : "Here’s what’s happening with your barangay services today.", admin ? "" : `<button class="button button-primary" type="button" data-page="requests">＋ New request</button>`)}
            ${overview}${notice}
            ${admin ? `<section class="panel"><div class="panel-header"><h2>Accounts to verify</h2><span class="status">${verifications.length} awaiting review</span><button class="button-link" type="button" data-page="verifications">View all →</button></div>${table(["Resident", "Email", "Submitted", "ID document", "Actions"], verifications.map((account) => `<tr><td><strong>${escapeHtml(account.full_name)}</strong></td><td>${escapeHtml(account.email)}</td><td>${dateLabel(account.created_at)}</td><td>${account.verification_doc ? `<a class="button-link" href="${apiBase}auth/verify/document?user_id=${encodeURIComponent(account.id)}" target="_blank" rel="noopener">Details ↗</a>` : "Not uploaded"}</td><td><div class="row-actions"><button class="button button-primary button-small" type="button" data-action="approve-verification" data-id="${escapeHtml(account.id)}" ${account.verification_doc ? "" : "disabled"}>Accept</button><button class="button button-danger button-small" type="button" data-action="reject-verification" data-id="${escapeHtml(account.id)}">Reject</button></div></td></tr>`).join(""), "No accounts are waiting for verification.")}</section>` : ""}
            <section class="panel"><div class="panel-header"><h2>${admin ? "Requests awaiting review" : "Recent requests"}</h2><button class="button-link" type="button" data-page="requests">View all →</button></div>
            ${table(columns, rows, admin ? "There are no requests waiting for review." : "You haven’t submitted any certificate requests yet.")}</section>`;
        renderShell(residentPortal);
    };

    const requestsPage = async () => {
        const admin = ["admin", "bhw"].includes(state.user.role);
        if (!admin) {
            const profileResponse = await api("auth/profile");
            state.profile = Array.isArray(profileResponse.Data) ? profileResponse.Data[0] || null : profileResponse.Data || null;
            state.user.verification_status = state.profile?.verification_status;
        }
        if (!admin && state.selectedCertificateType) {
            const profile = state.profile || {};
            const parts = [
                ["Last Name", profile.last_name],
                ["First Name", profile.first_name],
                ["Middle Name", profile.middle_name],
                ["Suffix", profile.suffix]
            ];
            const nameFields = parts.map(([label, value]) => `<div class="field"><label>${label}</label><input type="text" value="${escapeHtml(value || "")}" readonly></div>`).join("");
            renderShell(`<div class="certificate-request-stage"><section class="certificate-request-form-card panel">
                <header class="certificate-request-form-header"><button type="button" data-action="back-from-certificate-request" aria-label="Back to home">←</button><h1>${escapeHtml(state.selectedCertificateType)}</h1></header>
                <form data-form="request"><input type="hidden" name="certificate_type" value="${escapeHtml(state.selectedCertificateType)}"><div class="certificate-request-fields">
                    ${nameFields}
                    <div class="field"><label for="request-contact-number">Contact Number</label><input id="request-contact-number" name="contact_number" type="tel" autocomplete="tel" maxlength="30" value="${escapeHtml(profile.contact_number || "")}" required></div>
                    <div class="field"><label for="certificate-type-display">Type of Certificate</label><input id="certificate-type-display" type="text" value="${escapeHtml(state.selectedCertificateType)}" readonly></div>
                    <div class="field"><label for="purpose">Purpose</label><input id="purpose" name="purpose" type="text" maxlength="500" required></div>
                    <div class="field"><label for="quantity">Quantity</label><input id="quantity" name="quantity" type="number" min="1" max="20" value="1" required></div>
                </div><div class="certificate-request-submit"><button class="button button-primary" type="submit">Submit</button></div></form>
            </section></div>`);
            return;
        }
        const filter = state.requestFilter ? `?status=${encodeURIComponent(state.requestFilter)}` : "";
        const response = await api(admin
            ? `certificate-processing/requests${filter}`
            : `certificate-request/my-requests${filter}`);
        const requests = response.Data || [];
        state.requestRecords = requests;
        if (admin) {
            const rows = requests.map((request) => {
                const rowActions = request.status === "approved"
                    ? `<div class="admin-approved-actions"><button class="admin-request-view admin-request-generate-button" type="button" data-action="print-request" data-id="${escapeHtml(request.id)}">Generate</button><button class="admin-request-complete-button" type="button" data-action="complete-request" data-id="${escapeHtml(request.id)}">Complete</button></div>`
                    : request.status === "completed"
                        ? "Completed"
                        : `<button class="admin-request-view" type="button" data-action="view-admin-request" data-id="${escapeHtml(request.id)}">View</button>`;
                return `<tr data-admin-request-row data-search-text="${escapeHtml([request.full_name, request.certificate_type, request.purpose, request.status].join(" ").toLowerCase())}">
                <td>${escapeHtml(request.full_name || "Resident")}</td>
                <td><span class="admin-request-type">${escapeHtml(request.certificate_type || "—")}</span></td>
                <td>${escapeHtml(request.purpose || "—")}</td>
                <td>${escapeHtml(dateTimeLabel(request.requested_at))}</td>
                <td>${escapeHtml(request.quantity ?? "—")}</td>
                <td>${rowActions}</td>
            </tr>`;
            }).join("");
            const actionColumn = state.requestFilter === "completed" ? "Status" : "Action";
            const tabStatuses = [
                ["pending", "Request"],
                ["approved", "Approved"],
                ["rejected", "Disapproved"],
                ["completed", "Completed"]
            ];
            const statusTabs = `<div class="admin-request-tabs" role="tablist" aria-label="Request status">${tabStatuses.map(([status, label]) => `<button class="admin-request-tab${state.requestFilter === status ? " active" : ""}" type="button" role="tab" aria-selected="${state.requestFilter === status}" data-action="filter-requests" data-status="${status}">${label}</button>`).join("")}</div>`;
            const reviewRequest = requests.find((request) => String(request.id) === String(state.selectedAdminRequestId));
            const reviewNameParts = (() => {
                const parts = {
                    first_name: reviewRequest?.first_name || "",
                    middle_name: reviewRequest?.middle_name || "",
                    last_name: reviewRequest?.last_name || "",
                    suffix: reviewRequest?.suffix || ""
                };
                const tokens = String(reviewRequest?.full_name || "").trim().split(/\s+/).filter(Boolean);
                const fallback = { first_name: "", middle_name: "", last_name: "" };
                if (tokens.length === 1) fallback.first_name = tokens[0];
                else if (tokens.length === 2) [fallback.first_name, fallback.last_name] = tokens;
                else if (tokens.length > 2) {
                    fallback.first_name = tokens[0];
                    fallback.middle_name = tokens.slice(1, -1).join(" ");
                    fallback.last_name = tokens[tokens.length - 1];
                }
                if (!parts.first_name) parts.first_name = fallback.first_name;
                if (!parts.middle_name) parts.middle_name = fallback.middle_name;
                if (!parts.last_name) parts.last_name = fallback.last_name;
                return parts;
            })();
            const reviewModal = reviewRequest ? `<div class="admin-request-review-backdrop" data-admin-request-review-backdrop>
                <section class="admin-request-review-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-request-review-title">
                    <header class="admin-request-review-header"><h2 id="admin-request-review-title">Manage Details</h2><button type="button" data-action="close-admin-request" aria-label="Close">×</button></header>
                    <div class="admin-request-review-body">
                        <div class="admin-request-review-grid">
                            <div><span>Last Name</span><strong>${escapeHtml(reviewNameParts.last_name || "—")}</strong></div>
                            <div><span>First Name</span><strong>${escapeHtml(reviewNameParts.first_name || "—")}</strong></div>
                            <div><span>Middle Name</span><strong>${escapeHtml(reviewNameParts.middle_name || "—")}</strong></div>
                            <div><span>Suffix</span><strong>${escapeHtml(reviewNameParts.suffix || "—")}</strong></div>
                            <div><span>Contact Number</span><strong>${escapeHtml(reviewRequest.contact_number || "—")}</strong></div>
                            <div><span>Type of Certificate</span><strong>${escapeHtml(reviewRequest.certificate_type || "—")}</strong></div>
                            <div><span>Purpose</span><strong>${escapeHtml(reviewRequest.purpose || "—")}</strong></div>
                            <div><span>Quantity</span><strong>${escapeHtml(reviewRequest.quantity ?? "—")}</strong></div>
                        </div>
                        <label class="admin-request-response-label" for="admin-request-response">Response Message</label>
                        <textarea id="admin-request-response" maxlength="1000" placeholder="Enter a response for the resident...">${escapeHtml(reviewRequest.admin_notes || "")}</textarea>
                    </div>
                    ${reviewRequest.status === "pending" ? `<footer class="admin-request-review-actions"><button class="button button-primary" type="button" data-action="approve-request" data-id="${escapeHtml(reviewRequest.id)}">Approve ✓</button><button class="button button-danger" type="button" data-action="reject-request" data-id="${escapeHtml(reviewRequest.id)}">Disapprove ×</button></footer>` : reviewRequest.status === "approved" ? `<footer class="admin-request-review-actions"><button class="button button-secondary" type="button" data-action="print-request" data-id="${escapeHtml(reviewRequest.id)}">Print</button><button class="button button-primary" type="button" data-action="complete-request" data-id="${escapeHtml(reviewRequest.id)}">Complete</button></footer>` : ""}
                </section>
            </div>` : "";
            renderShell(`${heading("Online Request", "Online Request")}
                <section class="panel admin-online-requests">
                    <div class="admin-online-requests-toolbar">${statusTabs}
                        <div class="admin-request-report-controls"><button class="admin-request-year-now" type="button" data-action="set-current-report-year" aria-label="Use current year">Now</button><input type="number" min="2000" max="${new Date().getFullYear()}" value="${escapeHtml(state.reportYear || new Date().getFullYear())}" data-admin-request-year aria-label="Report year"><button class="button button-primary admin-request-generate" type="button" data-action="generate-request-report">▣ Generate List</button></div>
                    </div>
                    <div class="admin-request-table-tools"><label>Show <select data-admin-request-page-size aria-label="Entries per page"><option value="10" ${state.requestPageSize === 10 ? "selected" : ""}>10</option><option value="25" ${state.requestPageSize === 25 ? "selected" : ""}>25</option><option value="50" ${state.requestPageSize === 50 ? "selected" : ""}>50</option></select> entries per page</label><label class="admin-request-search"><span class="sr-only">Search requests</span><input type="search" data-admin-request-search placeholder="Search..." value="${escapeHtml(state.requestSearch)}"></label></div>
                    <div class="table-wrap admin-online-request-table"><table><thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Date</th><th>Qty</th><th>${actionColumn}</th></tr></thead><tbody>${rows || ""}<tr data-admin-request-empty ${rows ? "hidden" : ""}><td colspan="6" class="empty-state">No requests found.</td></tr></tbody></table></div>
                    <footer class="admin-request-table-footer"><span data-admin-request-count></span><div class="admin-request-pagination" data-admin-request-pagination hidden><button type="button" data-action="admin-request-page-previous">Previous</button><span data-admin-request-page-label></span><button type="button" data-action="admin-request-page-next">Next</button></div></footer>
                </section>${reviewModal}`);
            updateAdminRequestTable();
            return;
        }
        const form = !admin
            ? `<section class="panel"><div class="panel-header"><h2>New certificate request</h2></div><div class="panel-body">
                ${!isVerificationApproved(state.profile?.verification_status) ? `<p class="panel-intro">Certificate requests are available after your account verification is approved. You can upload your verification document from My account.</p>` : `
                <p class="panel-intro">Tell us what certificate you need and why. Your request will be sent to barangay staff for review.</p>
                <form data-form="request"><div class="form-grid">
                    <div class="field"><label for="certificate-type">Certificate type</label><select id="certificate-type" name="certificate_type" required><option value="">Choose a certificate</option>${residentCertificateTypes.map((type) => `<option value="${escapeHtml(type)}" ${state.selectedCertificateType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></div>
                    <div class="field"><label for="request-contact-number">Contact number</label><input id="request-contact-number" name="contact_number" type="tel" autocomplete="tel" maxlength="30" required></div>
                    <div class="field"><label for="quantity">Number of copies</label><input id="quantity" name="quantity" type="number" min="1" max="20" value="1" required></div>
                    <div class="field full"><label for="purpose">Purpose</label><textarea id="purpose" name="purpose" maxlength="500" placeholder="What will the certificate be used for?" required></textarea></div>
                </div><div class="form-actions"><button class="button button-primary" type="submit">Submit request <span aria-hidden="true">→</span></button></div></form>`}
                </div></section>`
            : `<div class="notice success"><span>i</span><span>Review incoming requests, add an optional note, and process approved certificates when residents claim them.</span></div>`;
        const columns = admin
            ? ["Request", "Resident", "Certificate", "Purpose", "Contact number", "Qty", "Status", "Submitted", "Staff notes", "Actions"]
            : ["Request", "Certificate", "Purpose", "Contact number", "Qty", "Status", "Submitted", "Staff notes", "Actions"];
        const statuses = admin ? ["", "pending", "approved", "completed", "cancelled", "rejected"] : ["pending", "approved", "rejected", "completed", "cancelled"];
        const filterControl = `<div class="status-tabs" role="tablist" aria-label="Filter requests">${statuses.map((status) => {
            const label = status ? status[0].toUpperCase() + status.slice(1) : "All";
            return `<button class="status-tab${state.requestFilter === status ? " active" : ""}" type="button" role="tab" aria-selected="${state.requestFilter === status}" data-action="filter-requests" data-status="${status}">${label}</button>`;
        }).join("")}</div>`;
        const residentRequestCards = !admin ? requests.map((request) => `<article class="resident-request-card">
            <div class="resident-request-card-copy">
                <h2>${escapeHtml(request.certificate_type || "Certificate")}</h2>
                <p><strong>Name:</strong> ${escapeHtml(state.profile?.full_name || "Resident")}</p>
                <p><strong>Date Request:</strong> ${escapeHtml(dateTimeLabel(request.requested_at))}</p>
                <p><strong>Status:</strong> ${escapeHtml(request.status === "pending" ? "wait for approval" : String(request.status || "").replace(/_/g, " "))}</p>
                ${request.admin_notes ? `<p><strong>Notes:</strong> ${escapeHtml(request.admin_notes)}</p>` : ""}
            </div>
            <div class="resident-request-card-actions"><button class="button button-primary button-small" type="button" data-action="view-request-details" data-id="${escapeHtml(request.id)}">Details</button>${request.status === "pending" ? `<button class="button button-danger button-small" type="button" data-action="cancel-request" data-id="${escapeHtml(request.id)}">Cancel</button>` : request.status === "cancelled" ? `<button class="button button-secondary button-small" type="button" data-action="edit-request" data-id="${escapeHtml(request.id)}" data-quantity="${escapeHtml(request.quantity)}">Resubmit</button>` : ""}</div>
        </article>`).join("") : "";
        const requestDetails = !admin && state.selectedRequestDetail
            ? (() => {
                const request = state.requestRecords.find((item) => String(item.id) === String(state.selectedRequestDetail));
                if (!request) return "";
                const editable = request.status === "pending" || request.status === "cancelled";
                return `<div class="request-detail-backdrop" data-request-detail-backdrop>
                    <section class="request-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="request-detail-title">
                        <header class="request-detail-header"><h2 id="request-detail-title">${editable ? "Manage Details" : "Request Details"}</h2><button type="button" data-action="close-request-details" aria-label="Close">×</button></header>
                        <form data-form="request-resubmit" data-id="${escapeHtml(request.id)}">
                            <div class="request-detail-fields">
                                <div class="field"><label>Last Name</label><input value="${escapeHtml(state.profile?.last_name || "")}" readonly></div>
                                <div class="field"><label>First Name</label><input value="${escapeHtml(state.profile?.first_name || "")}" readonly></div>
                                <div class="field"><label>Middle Name</label><input value="${escapeHtml(state.profile?.middle_name || "")}" readonly></div>
                                <div class="field"><label>Suffix</label><input value="${escapeHtml(state.profile?.suffix || "")}" readonly></div>
                                <div class="field"><label>Contact Number</label><input value="${escapeHtml(request.contact_number || state.profile?.contact_number || "")}" readonly></div>
                                <div class="field"><label>Type of Certificate</label><input value="${escapeHtml(request.certificate_type || "")}" readonly></div>
                                <div class="field"><label>Purpose</label><input value="${escapeHtml(request.purpose || "")}" readonly></div>
                                <div class="field"><label>Quantity</label><input name="quantity" type="number" min="1" max="20" value="${escapeHtml(request.quantity || 1)}" ${editable ? "required" : "readonly"}></div>
                            </div>
                            <div class="request-detail-message"><label for="request-response-message">Response Message</label><textarea id="request-response-message" readonly>${escapeHtml(request.admin_notes || "")}</textarea></div>
                            <footer class="request-detail-actions">${editable ? `<button class="button request-resubmit-button" type="submit">Re: Submit</button>` : ""}<button class="button button-danger request-detail-back" type="button" data-action="close-request-details">${editable ? "Back" : "Close"}</button></footer>
                        </form>
                    </section>
                </div>`;
            })()
            : "";
        const cancelConfirmation = !admin && state.cancelRequestId
            ? `<div class="request-cancel-backdrop" data-cancel-request-dialog><section class="request-cancel-dialog" role="alertdialog" aria-modal="true" aria-labelledby="request-cancel-title" aria-describedby="request-cancel-message">
                <span class="request-cancel-icon" aria-hidden="true">!</span><h2 id="request-cancel-title">Are you sure?</h2><p id="request-cancel-message">Once cancelled, your request will not be processed anymore!</p>
                <div class="request-cancel-actions"><button class="button button-secondary" type="button" data-action="dismiss-cancel-request">Close</button><button class="button button-danger" type="button" data-action="confirm-cancel-request" data-id="${escapeHtml(state.cancelRequestId)}">Yes</button></div>
            </section></div>`
            : "";
        renderShell(admin
            ? `${heading("Requests queue", "Review certificate requests from residents.", filterControl)}
                ${form}<section class="panel"><div class="panel-header"><h2>${(state.requestFilter || "All") + " requests"}</h2><span class="status">${requests.length} ${requests.length === 1 ? "request" : "requests"}</span></div>${table(columns, requestRows(requests, true), "No requests found for this status.")}</section>`
            : `<div class="resident-requests-page">${filterControl}<section class="resident-request-list">${residentRequestCards || `<p class="empty-state">No requests found for this status.</p>`}</section></div>${requestDetails}${cancelConfirmation}`);
    };

    const residentsPage = async () => {
        const isAdmin = state.user.role === "admin";
        const canManageResidents = residentManagerRoles.includes(state.user.role);
        const canEditResidents = ["admin", "bhw"].includes(state.user.role);
        const response = isAdmin
            ? await api("resident/list")
            : state.residentQuery
                ? await api(`resident/search?search=${encodeURIComponent(state.residentQuery)}`)
                : { Data: [] };
        const residents = (response.Data || []).filter((resident) => resident && typeof resident === "object" && resident.id);
        state.residentRecords = residents;
        const query = String(state.residentQuery || "").trim().toLowerCase();
        const filteredResidents = residents.filter((resident) => [
            resident.full_name, resident.gender, resident.civil_status, resident.purok_no, resident.contact_number
        ].some((value) => String(value || "").toLowerCase().includes(query)));
        const sortedResidents = filteredResidents.slice().sort((left, right) => {
            const leftValue = left[state.residentSort.key] ?? "";
            const rightValue = right[state.residentSort.key] ?? "";
            const leftDate = Date.parse(leftValue);
            const rightDate = Date.parse(rightValue);
            const comparison = !Number.isNaN(leftDate) && !Number.isNaN(rightDate)
                ? leftDate - rightDate
                : String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: "base", numeric: true });
            return state.residentSort.direction === "asc" ? comparison : -comparison;
        });
        const pageSize = state.residentPageSize;
        const pageCount = Math.max(1, Math.ceil(filteredResidents.length / pageSize));
        state.residentPage = Math.min(state.residentPage, pageCount);
        const pageResidents = sortedResidents.slice((state.residentPage - 1) * pageSize, state.residentPage * pageSize);
        const rows = pageResidents.map((resident) => `<tr>
            <td><strong>${escapeHtml(resident.full_name || "—")}</strong></td>
            <td><span class="resident-gender-badge${String(resident.gender || "").toLowerCase() === "female" ? " female" : String(resident.gender || "").toLowerCase() === "male" ? " male" : ""}">${escapeHtml(resident.gender ? String(resident.gender).replace(/^./, (letter) => letter.toUpperCase()) : "—")}</span></td>
            <td>${escapeHtml(resident.civil_status || "—")}</td>
            <td>${escapeHtml(resident.purok_no || "—")}</td>
            <td>${escapeHtml(resident.contact_number || "—")}</td>
            <td>${dateTimeLabel(resident.created_at || resident.date_of_registration)}</td>
            ${canEditResidents ? `<td><div class="row-actions resident-row-actions"><button class="resident-icon-button resident-view-button" type="button" data-action="view-resident" data-id="${escapeHtml(resident.id)}" aria-label="View ${escapeHtml(resident.full_name)}" title="View details">▤</button><button class="resident-icon-button resident-edit-button" type="button" data-action="edit-resident" data-id="${escapeHtml(resident.id)}" aria-label="Edit ${escapeHtml(resident.full_name)}" title="Edit resident">✎</button></div></td>` : ""}
        </tr>`).join("");
        const pagination = `<div class="resident-table-footer"><span>Showing ${filteredResidents.length ? (state.residentPage - 1) * pageSize + 1 : 0} to ${Math.min(state.residentPage * pageSize, filteredResidents.length)} of ${filteredResidents.length} entries</span><div class="resident-pagination"><button type="button" data-action="resident-page" data-page-number="${Math.max(1, state.residentPage - 1)}" ${state.residentPage === 1 ? "disabled" : ""}>Previous</button><span>Page ${state.residentPage} of ${pageCount}</span><button type="button" data-action="resident-page" data-page-number="${Math.min(pageCount, state.residentPage + 1)}" ${state.residentPage === pageCount ? "disabled" : ""}>Next</button></div></div>`;
        const sortableHeader = (label, key) => `<button class="resident-sort-button" type="button" data-action="sort-residents" data-sort-key="${key}" aria-label="Sort by ${label}${state.residentSort.key === key ? `, currently ${state.residentSort.direction}` : ""}" aria-pressed="${state.residentSort.key === key}"><span>${label}</span><i aria-hidden="true">${state.residentSort.key === key ? state.residentSort.direction === "asc" ? "↑" : "↓" : "↕"}</i></button>`;
        const residentHeaders = [
            sortableHeader("Name", "full_name"),
            sortableHeader("Gender", "gender"),
            sortableHeader("Civil Status", "civil_status"),
            sortableHeader("Purok", "purok_no"),
            sortableHeader("Contact Number", "contact_number"),
            sortableHeader("Date Registered", "created_at"),
            ...(canEditResidents ? ["Action"] : [])
        ];
        const input = (label, name, type = "text", required = false, extra = "") => `<div class="field"><label for="resident-${name}">${label}</label><input id="resident-${name}" name="${name}" type="${type}" ${required ? "required" : ""} ${extra}></div>`;
        const select = (label, name, options) => `<div class="field"><label for="resident-${name}">${label}</label><select id="resident-${name}" name="${name}">${options.map(([value, title]) => `<option value="${value}">${title}</option>`).join("")}</select></div>`;
        const yesNo = (label, name) => select(label, name, [["no", "No"], ["yes", "Yes"]]);
        const modal = canManageResidents ? `<div class="resident-modal-backdrop" id="resident-modal" hidden>
            <section class="resident-modal" role="dialog" aria-modal="true" aria-labelledby="resident-modal-heading">
                <header class="resident-modal-header"><h2 data-resident-modal-title id="resident-modal-heading">Add Resident</h2><button class="resident-modal-close" type="button" data-action="close-resident-modal" aria-label="Close">×</button></header>
                <form data-form="resident" enctype="multipart/form-data"><input type="hidden" name="id"><input type="hidden" name="full_name">
                    <div class="resident-modal-layout">
                        <aside class="resident-photo-column">
                            <section class="resident-form-section"><h3>Photo</h3><img class="resident-photo-preview" data-resident-photo-preview src="${residentPhotoPlaceholder}" alt="Resident photo preview"><p data-resident-photo-name></p><label class="button button-secondary resident-photo-browse" for="resident-photo">▣ Browse<input id="resident-photo" name="photo" type="file" accept="image/jpeg,image/png" hidden></label></section>
                            <section class="resident-form-section"><h3>In Case of Emergency</h3><div class="resident-form-grid resident-emergency-grid">
                                ${input("Full Name", "emergency_contact_name")}${input("Relationship", "emergency_contact_relationship")}${input("Contact No.", "emergency_contact_number", "tel")}${input("Address", "emergency_contact_address")}
                            </div></section>
                        </aside>
                        <div class="resident-modal-main">
                            <section class="resident-form-section"><h3>Personal Information</h3><div class="resident-form-grid">
                                ${input("Last Name", "last_name", "text", true)}${input("First Name", "first_name", "text", true)}${input("Middle Name", "middle_name")}${select("Suffix", "suffix", [["", "None"], ["Jr.", "Jr."], ["Sr.", "Sr."], ["II", "II"], ["III", "III"], ["IV", "IV"]])}
                                ${select("Gender", "gender", [["", "Select"], ["male", "Male"], ["female", "Female"]])}${input("Birth Date", "birthdate", "date")}${input("Birth Place", "birth_place")}${input("Age", "age", "text", false, "readonly")}
                                ${select("Civil Status", "civil_status", [["", "Select"], ["Single", "Single"], ["Married", "Married"], ["Widowed", "Widowed"], ["Separated", "Separated"]])}${input("Nationality", "nationality")}${input("Religion", "religion")}${input("Occupation", "occupation")}
                                ${input("Contact Number", "contact_number", "tel")}${yesNo("PWD?", "is_pwd")}${input("PWD ID No.", "pwd_id_no")}${input("Family Monthly Income", "family_monthly_income", "number", false, 'min="0" step="0.01"')}
                                ${yesNo("Indigent?", "is_indigent")}${yesNo("Solo Parent?", "is_solo_parent")}${input("Solo Parent ID No.", "solo_parent_id_no")}${yesNo("4Ps Member?", "is_4ps_member")}
                                ${yesNo("Register Voter?", "registered_voter")}${select("Purok", "purok_no", [["", "Select"], ...["Anduhaw", "Pasayan", "Bangus", "Lukon", "Alimango", "Tangigue"].map((name) => [name, name])])}${input("House No.", "house_no")}${input("Street", "street")}
                            </div></section>
                            <section class="resident-form-section"><h3>Other Details</h3><div class="resident-form-grid">
                                ${input("National ID No.", "national_id_no")}${input("Philhealth No.", "philhealth_no")}${select("Covid Status", "covid_status", [["", "Mark as:"], ["Recovered", "Recovered"], ["Positive", "Positive"], ["Never infected", "Never infected"]])}${yesNo("Vaccinated", "vaccinated")}
                                ${input("SSS No.", "sss_no")}${input("Pagibig No.", "pagibig_no")}${input("Date of Registration", "date_of_registration", "date")}${input("Date of Death", "date_of_death", "date")}
                                ${input("TIN No.", "tin_no")}${input("Voters ID No.", "voters_id_no")}
                                <div class="field resident-alive-field"><label>Alive or Deceased</label><div class="resident-life-status" role="group" aria-label="Alive or deceased"><button type="button" data-action="set-resident-life-status" data-resident-life-status="yes" aria-label="Alive" aria-pressed="true">♥</button><button type="button" data-action="set-resident-life-status" data-resident-life-status="no" aria-label="Deceased" aria-pressed="false">♟</button></div><select class="resident-life-status-value" name="is_alive" aria-label="Alive or deceased"><option value="yes">Alive</option><option value="no">Deceased</option></select></div>
                            </div></section>
                            <section class="resident-form-section" data-resident-history hidden><h3>Record History</h3><div class="resident-form-grid">
                                <div class="profile-item"><span>Added by</span><strong data-resident-added-by>—</strong></div>
                                <div class="profile-item"><span>Last updated by</span><strong data-resident-last-updated-by>—</strong></div>
                            </div></section>
                        </div>
                    </div>
                    <footer class="resident-modal-footer"><button class="button button-secondary" type="button" data-action="close-resident-modal">Cancel</button><button class="button button-secondary" type="button" data-resident-edit data-action="edit-resident-from-view" hidden>Edit</button><button class="button button-primary" type="submit" data-resident-save>Save</button></footer>
                </form>
            </section>
        </div>` : "";
        renderShell(`${heading("Residents", canManageResidents ? "Register and manage resident information." : "Search existing resident records.")}
            <section class="panel resident-directory"><div class="panel-header resident-directory-header">
                    <h2><span aria-hidden="true">♟</span> Residents Section</h2>
                    <div class="resident-directory-add">${canManageResidents ? `<button class="button button-primary" type="button" data-action="open-resident-modal">♟ Add Resident</button>` : ""}</div>
                    <div class="resident-directory-export">${isAdmin ? `<button class="button button-primary" type="button" data-action="export-residents">▣ Generate List</button>` : ""}</div>
                </div>
                <div class="resident-table-tools"><label class="resident-page-size">Show <select data-resident-page-size><option value="10" ${pageSize === 10 ? "selected" : ""}>10</option><option value="25" ${pageSize === 25 ? "selected" : ""}>25</option><option value="50" ${pageSize === 50 ? "selected" : ""}>50</option></select> entries</label><label class="toolbar resident-search"><span class="sr-only">Search residents</span><input type="search" data-resident-search placeholder="Search..." value="${escapeHtml(state.residentQuery)}"></label></div>
                ${table(residentHeaders, rows, isAdmin ? "No resident records found." : "Enter a resident's name or address to search.", "resident-table-wrap")}
                ${pagination}</section>${modal}`);
    };

    const reportPage = async () => {
        const year = state.reportYear || new Date().getFullYear();
        const response = await api(`certificate-processing/report/yearly?year=${encodeURIComponent(year)}`);
        const reports = (response.Data || []).filter((item) => item && typeof item === "object" && Object.keys(item).length > 1);
        const rows = reports.map((item) => `<tr>
            <td>${escapeHtml(item.resident_name || item.full_name || "—")}</td>
            <td>${escapeHtml(item.certificate_type || "—")}</td>
            <td>${escapeHtml(item.purpose || "—")}</td>
        </tr>`).join("");
        renderShell(`<div class="page-heading report-page-heading"><div><h1>Generate Online Request</h1><p>Generate Online Request</p></div></div>
            <section class="panel generated-request-list">
                <header class="generated-request-list-header"><h2>Online Request</h2><button class="button button-primary" type="button" data-action="print-request-list">▣ Print List</button></header>
                <div class="generated-request-list-body">
                    <div class="generated-request-letterhead">
                        <img src="images/polog.png" alt="Barangay Polo seal">
                        <div><p>Republic of the Philippines</p><p>Province of Zamboanga del Norte</p><p>City of Dapitan</p><strong>Barangay Polo</strong></div>
                        <span aria-hidden="true"></span>
                    </div>
                    <div class="generated-request-summary"><p>Online Request<br>Issued of Year: ${escapeHtml(year)}</p><p>Total: ${reports.length}</p></div>
                    <div class="table-wrap generated-request-table"><table><thead><tr><th>Name</th><th>Type</th><th>Purpose</th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="empty-state">No completed transactions were found for ${escapeHtml(year)}.</td></tr>`}</tbody></table></div>
                </div>
            </section>`);
    };

    const residentListPage = async () => {
        const residents = state.residentListRecords;
        const maleCount = residents.filter((resident) => String(resident.gender || "").toLowerCase() === "male").length;
        const femaleCount = residents.filter((resident) => String(resident.gender || "").toLowerCase() === "female").length;
        const rows = residents.map((resident) => `<tr>
            <td>${escapeHtml(resident.full_name || "—")}</td>
            <td>${escapeHtml(resident.gender || "—")}</td>
            <td>${escapeHtml(resident.purok_no || "—")}</td>
            <td>${escapeHtml(resident.birthdate || "—")}</td>
        </tr>`).join("");
        renderShell(`<div class="page-heading report-page-heading"><div><h1>Generate Certificate</h1><p>Generate Certificate</p></div></div>
            <section class="panel generated-request-list">
                <header class="generated-request-list-header"><h2>Barangay Indigency</h2><button class="button button-primary" type="button" data-action="print-resident-list">▣ Print List</button></header>
                <div class="generated-request-list-body generated-resident-list-body">
                    <div class="generated-request-letterhead">
                        <img src="images/polog.png" alt="Barangay Polo seal">
                        <div><p>Republic of the Philippines</p><p>Province of Zamboanga del Norte</p><p>City of Dapitan</p><strong>Barangay Polo</strong></div>
                        <img src="images/polog.png" alt="Barangay Polo seal">
                    </div>
                    <div class="generated-request-summary"><p>List of Residents</p><p>Male: ${maleCount}</p><p>Female: ${femaleCount}</p></div>
                    <div class="table-wrap generated-request-table generated-resident-table"><table><thead><tr><th>Name</th><th>Gender</th><th>Purok</th><th>Birth Date</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="empty-state">No residents found.</td></tr>`}</tbody></table></div>
                </div>
            </section>`);
    };

    const accountsPage = async () => {
        const response = await api("auth/accounts");
        const accounts = (response.Data || []).filter((account) => account && account.id);
        const rows = accounts.map((account) => `<tr>
            <td><strong>${escapeHtml(account.full_name)}</strong></td>
            <td>${escapeHtml(account.email)}</td>
            <td>${verificationBadge(account.verification_status)}</td>
            <td>${account.role === "admin" ? `<span class="status">Administrator</span>` : `<form class="toolbar" data-form="account-role"><input type="hidden" name="user_id" value="${escapeHtml(account.id)}">
                <select name="role" aria-label="Role for ${escapeHtml(account.full_name)}"><option value="resident" ${account.role === "resident" ? "selected" : ""}>Resident</option><option value="bhw" ${account.role === "bhw" ? "selected" : ""}>BHW</option><option value="purok_leader" ${account.role === "purok_leader" ? "selected" : ""}>Purok leader</option></select>
                <button class="button button-secondary button-small" type="submit">Save role</button></form>`}</td>
        </tr>`).join("");
        renderShell(`${heading("Staff access", "Assign BHW or Purok leader access to resident accounts.")}
            <div class="notice" style="margin-bottom:20px"><span>i</span><span>Residents need an account before they can be assigned as BHWs. BHWs can register and update resident records and review requests. Administrator access cannot be changed here.</span></div>
            <section class="panel"><div class="panel-header"><h2>Resident accounts</h2><span class="status">${accounts.length} accounts</span></div>
            ${table(["Resident", "Email", "Verification", "Access role"], rows, "No resident accounts found.")}</section>`);
    };

    const updateVerificationTable = () => {
        const rows = [...root.querySelectorAll("[data-verification-row]")];
        const query = state.verificationQuery.toLowerCase();
        const matches = rows.filter((row) => row.dataset.verificationSearchText.includes(query));
        const pageCount = Math.max(1, Math.ceil(matches.length / state.verificationPageSize));
        state.verificationPage = Math.min(state.verificationPage, pageCount);
        const startIndex = (state.verificationPage - 1) * state.verificationPageSize;
        const visibleRows = new Set(matches.slice(startIndex, startIndex + state.verificationPageSize));
        rows.forEach((row) => { row.hidden = !visibleRows.has(row); });
        const empty = root.querySelector("[data-verification-empty]");
        if (empty) empty.hidden = matches.length !== 0;
        const from = matches.length ? startIndex + 1 : 0;
        const to = Math.min(startIndex + state.verificationPageSize, matches.length);
        const count = root.querySelector("[data-verification-count]");
        if (count) count.textContent = `Showing ${from} to ${to} of ${matches.length} entries`;
        const pagination = root.querySelector("[data-verification-pagination]");
        if (pagination) {
            pagination.hidden = pageCount <= 1;
            pagination.querySelector("[data-action='verification-page-previous']").disabled = state.verificationPage === 1;
            pagination.querySelector("[data-action='verification-page-next']").disabled = state.verificationPage === pageCount;
            pagination.querySelector("[data-verification-page-label]").textContent = `Page ${state.verificationPage} of ${pageCount}`;
        }
    };

    const updateAdminRequestTable = () => {
        const rows = [...root.querySelectorAll("[data-admin-request-row]")];
        const matches = rows.filter((row) => row.dataset.searchText.includes(state.requestSearch.toLowerCase()));
        const pageCount = Math.max(1, Math.ceil(matches.length / state.requestPageSize));
        state.requestPage = Math.min(state.requestPage, pageCount);
        const startIndex = (state.requestPage - 1) * state.requestPageSize;
        const visibleRows = new Set(matches.slice(startIndex, startIndex + state.requestPageSize));
        rows.forEach((row) => { row.hidden = !visibleRows.has(row); });
        const empty = root.querySelector("[data-admin-request-empty]");
        if (empty) empty.hidden = matches.length > 0;
        const count = root.querySelector("[data-admin-request-count]");
        if (count) count.textContent = `Showing ${matches.length ? startIndex + 1 : 0} to ${Math.min(startIndex + state.requestPageSize, matches.length)} of ${matches.length} entries`;
        const pagination = root.querySelector("[data-admin-request-pagination]");
        if (pagination) {
            pagination.hidden = pageCount <= 1;
            pagination.querySelector("[data-action='admin-request-page-previous']").disabled = state.requestPage === 1;
            pagination.querySelector("[data-action='admin-request-page-next']").disabled = state.requestPage === pageCount;
            pagination.querySelector("[data-admin-request-page-label]").textContent = `Page ${state.requestPage} of ${pageCount}`;
        }
    };

    const verificationsPage = async () => {
        const response = await api("auth/verify/pending");
        const accounts = (response.Data || []).filter((account) => account && account.id);
        state.verificationAccounts = accounts;
        const rows = accounts.map((account) => `<tr data-verification-row data-verification-search-text="${escapeHtml([account.full_name, account.email, account.verification_status].join(" ").toLowerCase())}">
            <td>${escapeHtml(account.full_name || "—")}</td>
            <td><span class="status pending">To verify ◉</span></td>
            <td><button class="verification-document-action" type="button" data-action="view-verification" data-id="${escapeHtml(account.id)}" aria-label="View ${escapeHtml(account.full_name || "resident")} verification document" title="View verification document"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5l3 3V14a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 14z"/><path d="M9 1.5v3h3M6 8h4M6 10h4M6 12h3"/></svg></button></td>
        </tr>`).join("");
        renderShell(`${heading("To verify Accounts", "To verify Accounts")}
            <section class="panel verification-queue-panel">
                <div class="panel-header"><h2><span aria-hidden="true">♟</span> To verify Accounts Section</h2></div>
                <div class="verification-table-tools">
                    <label>Show <select data-verification-page-size aria-label="Entries per page"><option value="10" ${state.verificationPageSize === 10 ? "selected" : ""}>10</option><option value="25" ${state.verificationPageSize === 25 ? "selected" : ""}>25</option><option value="50" ${state.verificationPageSize === 50 ? "selected" : ""}>50</option></select> entries per page</label>
                    <label class="verification-search"><span class="sr-only">Search verification requests</span><input type="search" data-verification-search placeholder="Search..." value="${escapeHtml(state.verificationQuery)}"></label>
                </div>
                <div class="table-wrap verification-table-wrap"><table><thead><tr><th>Name</th><th>Status</th><th>Action</th></tr></thead><tbody>
                    ${rows || `<tr data-verification-empty><td colspan="3" class="empty-state">No accounts are waiting for verification.</td></tr>`}
                    ${rows ? `<tr data-verification-empty hidden><td colspan="3" class="empty-state">No matching accounts found.</td></tr>` : ""}
                </tbody></table></div>
                <div class="verification-table-footer"><span data-verification-count></span><div class="resident-pagination" data-verification-pagination hidden><button type="button" data-action="verification-page-previous">Previous</button><span data-verification-page-label></span><button type="button" data-action="verification-page-next">Next</button></div></div>
            </section>`);
        updateVerificationTable();
    };

    const openVerificationReview = async (userId) => {
        const account = state.verificationAccounts.find((item) => String(item.id) === String(userId));
        if (!account) {
            showToast("The verification request could not be found. Refresh the list and try again.", true);
            return;
        }
        const documentUrl = `${apiBase}auth/verify/document?user_id=${encodeURIComponent(userId)}`;
        const response = await fetch(documentUrl, { credentials: "same-origin", headers: { Accept: "image/jpeg, image/png, application/pdf" } });
        if (!response.ok) {
            let message = `Could not load the verification document (${response.status}).`;
            if ((response.headers.get("content-type") || "").includes("application/json")) {
                const result = await response.json();
                message = result.Message || message;
            }
            throw new Error(message);
        }
        const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (!["image/jpeg", "image/png", "application/pdf"].includes(contentType)) {
            throw new Error("The uploaded document format is not supported for preview.");
        }
        const nameParts = [
            ["Last Name", account.last_name],
            ["First Name", account.first_name],
            ["Middle Name", account.middle_name],
            ["Suffix", account.suffix]
        ];
        const details = nameParts.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("");
        const documentPreview = contentType === "application/pdf"
            ? `<iframe src="${documentUrl}" title="Uploaded verification document"></iframe>`
            : `<img src="${documentUrl}" alt="Uploaded verification document">`;
        root.insertAdjacentHTML("beforeend", `<div class="verification-review-backdrop" data-verification-review>
            <section class="verification-review-dialog" role="dialog" aria-modal="true" aria-labelledby="verification-review-title">
                <header class="verification-review-header"><h2 id="verification-review-title">Verify Account</h2><button type="button" data-action="close-verification-review" aria-label="Close">×</button></header>
                <div class="verification-review-body">
                    <div class="verification-review-document">${documentPreview}</div>
                    <section class="verification-review-details" aria-labelledby="verification-review-details-title">
                        <h3 id="verification-review-details-title">Details</h3>
                        <div class="verification-review-details-grid">${details}
                            <div class="verification-review-resident-photo">${account.photo_path
                                ? `<img src="${escapeHtml(residentPhotoUrl(account.photo_path))}" alt="Resident photo">`
                                : `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="49"/><circle cx="50" cy="37" r="17"/><path d="M17 91c2-20 15-32 33-32s31 12 33 32a49 49 0 0 1-66 0Z"/></svg>`}</div>
                        </div>
                    </section>
                </div>
                <footer class="verification-review-actions">
                    <button class="button button-primary" type="button" data-action="approve-verification" data-id="${escapeHtml(account.id)}">Accept ✓</button>
                    <button class="button button-danger" type="button" data-action="reject-verification" data-id="${escapeHtml(account.id)}">Reject ×</button>
                </footer>
            </section>
        </div>`);
        root.querySelector('[data-action="close-verification-review"]').focus();
    };

    const officialsPage = async (councilType) => {
        const isSk = councilType === "sk";
        const title = isSk ? "SK Officials" : "Barangay Officials";
        const response = await api(`officials/list?type=${councilType}`);
        const records = (response.Data || []).filter((official) => official && official.id);
        state.officialRecords = records;
        const editing = state.officialFormOpen
            ? records.find((official) => String(official.id) === String(state.officialEditingId))
            : null;
        const form = state.officialFormOpen ? `<section class="panel official-form-panel">
            <div class="panel-header"><h2>${editing ? "Edit official" : "Add official"}</h2></div>
            <div class="panel-body"><form data-form="official">
                <input type="hidden" name="id" value="${escapeHtml(editing?.id || "")}">
                <div class="resident-form-grid official-form-grid">
                    <div class="field"><label for="official-full-name">Full name</label><input id="official-full-name" name="full_name" value="${escapeHtml(editing?.full_name || "")}" required></div>
                    <div class="field"><label for="official-position">Position</label><input id="official-position" name="position" value="${escapeHtml(editing?.position || "")}" required></div>
                    <div class="field"><label for="official-contact-number">Contact number</label><input id="official-contact-number" name="contact_number" type="tel" value="${escapeHtml(editing?.contact_number || "")}"></div>
                    <div class="field"><label for="official-term-start">Term start</label><input id="official-term-start" name="term_start" type="date" value="${escapeHtml(editing?.term_start || "")}"></div>
                    <div class="field"><label for="official-term-end">Term end</label><input id="official-term-end" name="term_end" type="date" value="${escapeHtml(editing?.term_end || "")}"></div>
                </div>
                <div class="form-actions"><button class="button button-secondary" type="button" data-action="cancel-official-form">Cancel</button><button class="button button-primary" type="submit">${editing ? "Save changes" : "Add official"}</button></div>
            </form></div>
        </section>` : "";
        const rows = records.map((official) => `<tr>
            <td><strong>${escapeHtml(official.full_name)}</strong></td>
            <td>${escapeHtml(official.position)}</td>
            <td>${escapeHtml(official.contact_number || "—")}</td>
            <td>${dateLabel(official.term_start)}</td>
            <td>${dateLabel(official.term_end)}</td>
            <td><div class="row-actions"><button class="button button-secondary button-small" type="button" data-action="edit-official" data-id="${escapeHtml(official.id)}">Edit</button><button class="button button-danger button-small" type="button" data-action="delete-official" data-id="${escapeHtml(official.id)}">Delete</button></div></td>
        </tr>`).join("");
        const addButton = `<button class="button button-primary" type="button" data-action="open-official-form">＋ Add official</button>`;
        renderShell(`${heading(title, isSk ? "Manage Sangguniang Kabataan representatives and term details." : "Manage barangay council representatives and term details.", addButton)}
            ${form}<section class="panel"><div class="panel-header"><h2>${title} directory</h2><span class="status">${records.length} ${records.length === 1 ? "official" : "officials"}</span></div>
                ${table(["Full name", "Position", "Contact number", "Term start", "Term end", "Actions"], rows, `No ${isSk ? "SK" : "barangay"} officials have been added yet.`)}
            </section>`);
    };

    const profilePage = async () => {
        const response = await api("auth/profile");
        state.profile = Array.isArray(response.Data) ? response.Data[0] || null : response.Data || null;
        state.user.verification_status = state.profile?.verification_status;
        const profile = state.profile || {};
        const verification = profile.verification_status || state.user.verification_status || "pending";
        if (state.user.role === "resident") {
            if (state.residentPasswordEditOpen) {
                renderShell(`<div class="resident-password-stage">
                    <section class="resident-password-card">
                        <form data-form="change-password">
                            <input class="resident-password-input" name="old_password" type="password" autocomplete="current-password" placeholder="Current password" aria-label="Current password" required>
                            <input class="resident-password-input" name="new_password" type="password" minlength="6" autocomplete="new-password" placeholder="New password" aria-label="New password" required>
                            <input class="resident-password-input" name="confirm_new_password" type="password" minlength="6" autocomplete="new-password" placeholder="Re-type new password" aria-label="Re-type new password" required>
                            <button class="resident-password-save" type="submit">Save Changes</button>
                            <button class="resident-password-cancel" type="button" data-action="cancel-resident-password-edit">Cancel</button>
                        </form>
                    </section>
                </div>`);
                return;
            }
            const normalizedVerification = String(verification).toLowerCase();
            const verificationLabel = isVerificationApproved(normalizedVerification)
                ? "Verified"
                : normalizedVerification === "verifying"
                    ? "Verifying..."
                    : "Verify";
            const canSubmitVerification = !isVerificationApproved(normalizedVerification) && normalizedVerification !== "verifying";
            const residentName = [
                profile.first_name,
                profile.middle_name,
                profile.last_name,
                profile.suffix
            ].filter((part) => String(part || "").trim()).join(" ") || profile.full_name || "Resident";
            const residentAvatar = profile.photo_path
                ? `<img src="${escapeHtml(residentPhotoUrl(profile.photo_path))}" alt="">`
                : `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="49"/><circle class="resident-profile-avatar-person" cx="50" cy="37" r="17"/><path class="resident-profile-avatar-person" d="M17 91c2-20 15-32 33-32s31 12 33 32a49 49 0 0 1-66 0Z"/></svg>`;
            renderShell(`<div class="resident-profile-stage"><section class="resident-profile-card panel">
                <header class="resident-profile-card-header"><button type="button" data-page="dashboard" aria-label="Back to home">←</button></header>
                <div class="resident-profile-summary">
                    <div class="resident-profile-avatar">${residentAvatar}</div>
                    <h1>${escapeHtml(residentName)}</h1>
                    ${isVerificationApproved(normalizedVerification)
                        ? `<span class="resident-verification-status is-verified">Verified <span aria-hidden="true">✓</span></span>`
                        : `<button class="resident-verification-status${normalizedVerification === "verifying" ? " is-verifying" : ""}" type="button" data-action="open-verification-upload" ${!canSubmitVerification ? "disabled" : ""}>${escapeHtml(verificationLabel)}${canSubmitVerification ? `<span aria-hidden="true"> ●</span>` : ""}</button>`}
                    <button class="button button-primary resident-edit-details" type="button" data-action="resident-edit-details">Edit details</button>
                </div>
                <div class="resident-profile-username"><strong>♟ Username:</strong> ${escapeHtml(profile.username || profile.email || state.user.email || "—")}</div>
            </section>
            ${canSubmitVerification ? `<div class="verification-upload-backdrop" data-verification-upload hidden>
                <section class="verification-upload-dialog" role="dialog" aria-modal="true" aria-labelledby="verification-upload-title">
                    <header class="verification-upload-header"><h2 id="verification-upload-title">Verify account</h2><button type="button" data-action="close-verification-upload" aria-label="Close">×</button></header>
                    <form data-form="upload-id" enctype="multipart/form-data">
                        <div class="verification-upload-body">
                            <strong>Upload any supporting document:</strong>
                            <p>Any valid ID, Birth Certificate, Marriage Contract, Business Permit</p>
                            <div class="verification-document-preview" data-verification-preview>
                                <svg data-verification-placeholder viewBox="0 0 120 90" aria-hidden="true"><rect x="5" y="5" width="110" height="80" rx="4"/><circle cx="39" cy="34" r="10"/><path d="M15 75 42 49l18 16 15-19 30 29Z"/></svg>
                                <img data-verification-image alt="Selected supporting document preview" hidden>
                                <span data-verification-filename hidden></span>
                            </div>
                            <input class="sr-only verification-file-input" id="verification-doc" name="verification_doc" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" required>
                            <label class="button verification-upload-button" for="verification-doc">▰ Upload</label>
                            <button class="button button-primary verification-submit-button" type="submit">Submit</button>
                        </div>
                    </form>
                </section>
            </div>` : ""}</div>`);
            return;
        }
        const details = [
            ["Full name", profile.full_name], ["Email address", profile.email],
            ["Contact number", profile.contact_number], ["Address", profile.address],
            ["Birth date", profile.birthdate], ["Gender", profile.gender],
            ["Registered", dateLabel(profile.created_at)]
        ].map(([label, value]) => `<div class="profile-item"><span>${label}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("");
        renderShell(`${heading("My account", "Manage your profile and account security.")}
            <div class="profile-grid">
                <section class="panel"><div class="panel-header"><h2>Personal details</h2>${verificationBadge(verification)}</div><div class="panel-body"><div class="profile-list">${details}</div></div></section>
                <div>
                    <section class="panel"><div class="panel-header"><h2>Change password</h2></div><div class="panel-body">
                        <form data-form="change-password"><div class="field"><label for="old-password">Current password</label><input id="old-password" name="old_password" type="password" autocomplete="current-password" required></div>
                            <div class="field"><label for="new-password">New password</label><input id="new-password" name="new_password" type="password" minlength="6" autocomplete="new-password" required></div>
                            <div class="form-actions"><button class="button button-secondary" type="submit">Update password</button></div></form>
                    </div></section>
                </div>
            </div>`);
    };

    const certificatePage = async () => {
        const requestId = state.selectedRequestId;
        if (!requestId) throw new Error("Select an approved request to generate its certificate.");
        const certificateUrl = `${apiBase}certificate-processing/print?request_id=${encodeURIComponent(requestId)}`;
        const request = state.requestRecords.find((record) => String(record.id) === String(requestId));
        const certificateType = request?.certificate_type || "Barangay Certification";
        renderShell(`<div class="page-heading"><div><h1>Generate Certificate</h1><p>Generate Certificate</p></div></div>
            <section class="panel certificate-preview-panel">
                <header class="certificate-preview-header"><h2>${escapeHtml(certificateType)}</h2><button class="button button-primary certificate-print-button" type="button" data-action="print-certificate" disabled>▣ Print Certificate</button></header>
                <iframe id="certificate-preview" class="certificate-preview-frame" src="${escapeHtml(certificateUrl)}" title="${escapeHtml(certificateType)} certificate preview"></iframe>
            </section>`);
        const preview = root.querySelector("#certificate-preview");
        const printButton = root.querySelector('[data-action="print-certificate"]');
        preview?.addEventListener("load", () => {
            if (printButton) printButton.disabled = false;
        }, { once: true });
    };

    const pageLoaders = { dashboard: dashboardPage, requests: requestsPage, residents: residentsPage, "resident-list": residentListPage, verifications: verificationsPage, officials: () => officialsPage("barangay"), "sk-officials": () => officialsPage("sk"), accounts: accountsPage, report: reportPage, profile: profilePage, certificate: certificatePage };
    const navigate = async (page) => {
        if (!pageLoaders[page]) return;
        if ((page === "accounts" && state.user.role !== "admin") ||
        (page === "verifications" && !["admin", "bhw"].includes(state.user.role)) ||
        (page === "requests" && state.user.role === "purok_leader") ||
            (page === "residents" && !residentManagerRoles.includes(state.user.role)) ||
        (page === "resident-list" && !["admin", "bhw"].includes(state.user.role)) ||
            (page === "report" && !["admin", "bhw"].includes(state.user.role)) ||
            (["officials", "sk-officials"].includes(page) && state.user.role !== "admin")) {
            showToast("Your account does not have access to that page.", true);
            return;
        }
        state.page = page;
        root.innerHTML = `<div class="loading-screen"><span class="spinner"></span><span>Loading ${escapeHtml(pageTitle[page][0].toLowerCase())}...</span></div>`;
        try {
            await pageLoaders[page]();
        } catch (error) {
            renderShell(`${heading(pageTitle[page][0], pageTitle[page][1])}<div class="notice error"><span>!</span><span>${escapeHtml(error.message)}</span></div>`);
            showToast(error.message, true);
        }
    };

    const setBusy = (form, busy) => {
        const button = form.querySelector('button[type="submit"]');
        if (button) {
            button.disabled = busy;
            if (busy) {
                button.dataset.label = button.textContent;
                button.textContent = "Please wait...";
            } else if (button.dataset.label) {
                button.textContent = button.dataset.label;
                delete button.dataset.label;
            }
        }
    };

    root.addEventListener("submit", async (event) => {
        const form = event.target.closest("form[data-form]");
        if (!form) return;
        event.preventDefault();
        const kind = form.dataset.form;
        const values = Object.fromEntries(new FormData(form).entries());
        setBusy(form, true);
        try {
            if (kind === "login") {
                const result = await post("auth/login", { email: values.email, password: values.password });
                state.user = result.Data;
                state.page = "dashboard";
                await navigate(state.page);
                showLoginWelcome();
            } else if (kind === "signup") {
                if (values.password !== values.confirm_password) {
                    throw new Error("Passwords do not match.");
                }
                const fullName = [values.first_name, values.middle_name, values.last_name, values.suffix]
                    .map((part) => String(part || "").trim())
                    .filter(Boolean)
                    .join(" ");
                const result = await post("auth/signup", { full_name: fullName, email: values.email, password: values.password });
                if (String(result.Message || "").startsWith("Error:")) {
                    throw new Error(result.Message);
                }
                renderAuth(false);
                showSuccessDialog("Account Created Successfully!", result.Message || "You may now log in.");
            } else if (kind === "password-reset-request") {
                await post("auth/password-reset/request", { email: values.email });
                renderAuth(false, "sent");
            } else if (kind === "password-reset-complete") {
                if (values.new_password !== values.confirm_password) {
                    throw new Error("Passwords do not match.");
                }
                const result = await post("auth/password-reset/complete", {
                    token: values.token,
                    new_password: values.new_password
                });
                state.passwordResetToken = "";
                window.history.replaceState({}, document.title, window.location.pathname);
                renderAuth(false);
                showToast(result.Message || "Password reset successfully. You may now log in.");
            } else if (kind === "request") {
                await post("certificate-request/submit", {
                    certificate_type: values.certificate_type,
                    contact_number: values.contact_number,
                    purpose: values.purpose,
                    quantity: Number(values.quantity)
                });
                state.selectedCertificateType = "";
                state.requestFilter = "pending";
                await navigate("requests");
            } else if (kind === "request-resubmit") {
                const result = await post("certificate-request/resubmit", {
                    id: form.dataset.id,
                    quantity: Number(values.quantity)
                });
                state.selectedRequestDetail = null;
                await navigate("requests");
                showToast(result.Message || "Request updated.");
            } else if (kind === "upload-id") {
                if (!form.elements.verification_doc.files?.length) {
                    throw new Error("Choose a supporting document before submitting.");
                }
                const data = new FormData(form);
                const result = await api("auth/upload-id", { method: "POST", body: data });
                state.user.verification_status = "verifying";
                root.querySelector("[data-verification-upload]").hidden = true;
                showSuccessDialog("Verification Request Submitted!", result.Message || "Please wait for verification approval.", "verification-success-dismiss");
            } else if (kind === "change-password") {
                if (values.confirm_new_password !== undefined && values.new_password !== values.confirm_new_password) {
                    throw new Error("New passwords do not match.");
                }
                const result = await post("auth/change-password", {
                    old_password: values.old_password,
                    new_password: values.new_password
                });
                if (values.confirm_new_password !== undefined) {
                    state.residentPasswordEditOpen = false;
                    await navigate("profile");
                }
                showToast(result.Message || "Password changed.");
                form.reset();
            } else if (kind === "resident") {
                const editing = Boolean(values.id);
                const payload = new FormData(form);
                payload.set(editing ? "updated_by" : "added_by", state.user.role === "admin" ? "Admin" : state.user.role === "purok_leader" ? "Purok Leader" : "BHW");
                const result = await api(editing ? "resident/edit" : "resident/add", { method: "POST", body: payload });
                state.residentQuery = "";
                state.residentPage = 1;
                await navigate("residents");
                showSuccessDialog(editing ? result.Message || "Resident updated successfully!" : "Resident added Successfully!");
            } else if (kind === "official") {
                if (values.term_start && values.term_end && values.term_end < values.term_start) {
                    throw new Error("Term end cannot be earlier than term start.");
                }
                const councilType = state.page === "sk-officials" ? "sk" : "barangay";
                const editing = Boolean(values.id);
                const result = await post(`officials/${editing ? "edit" : "add"}`, {
                    ...values,
                    council_type: councilType
                });
                showToast(result.Message || (editing ? "Official updated." : "Official added."));
                state.officialFormOpen = false;
                state.officialEditingId = null;
                await navigate(state.page);
            } else if (kind === "resident-search") {
                state.residentQuery = String(values.search || "").trim();
                state.residentPage = 1;
                await navigate("residents");
            } else if (kind === "report") {
                state.reportYear = Number(values.year);
                await navigate("report");
            } else if (kind === "account-role") {
                const result = await post("auth/accounts/role", {
                    user_id: values.user_id,
                    role: values.role
                });
                showToast(result.Message || "Account role updated.");
                await navigate("accounts");
            }
        } catch (error) {
            if (kind === "signup" && /name not found/i.test(error.message)) {
                showSignupNameError(form);
            } else {
                showToast(error.message, true);
            }
        } finally {
            if (form.isConnected) setBusy(form, false);
        }
    });

    root.addEventListener("change", async (event) => {
        const target = event.target;
        if (target.matches("[data-resident-page-size]")) {
            state.residentPageSize = Number(target.value);
            state.residentPage = 1;
            await navigate("residents");
        } else if (target.matches("[data-resident-search]")) {
            state.residentQuery = target.value.trim();
            state.residentPage = 1;
            await navigate("residents");
        } else if (target.matches("[data-verification-page-size]")) {
            state.verificationPageSize = Number(target.value);
            state.verificationPage = 1;
            await navigate("verifications");
        } else if (target.matches("[data-admin-request-page-size]")) {
            state.requestPageSize = Number(target.value);
            state.requestPage = 1;
            updateAdminRequestTable();
        } else if (target.matches("[data-admin-request-year]")) {
            state.reportYear = Number(target.value);
        } else if (target.matches("#resident-birthdate")) {
            const form = target.closest("form");
            form.elements.age.value = calculateAge(target.value);
        } else if (target.matches("#resident-photo")) {
            const file = target.files?.[0];
            if (!file) return;
            const form = target.closest("form");
            form.querySelector("[data-resident-photo-name]").textContent = file.name;
            form.querySelector("[data-resident-photo-name]").hidden = false;
            form.querySelector("[data-resident-photo-preview]").src = URL.createObjectURL(file);
        } else if (target.matches("#verification-doc")) {
            const file = target.files?.[0];
            const preview = root.querySelector("[data-verification-preview]");
            if (!file || !preview) return;
            const image = preview.querySelector("[data-verification-image]");
            const placeholder = preview.querySelector("[data-verification-placeholder]");
            const filename = preview.querySelector("[data-verification-filename]");
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.addEventListener("load", () => {
                    image.src = String(reader.result);
                    image.hidden = false;
                    placeholder.hidden = true;
                    filename.hidden = true;
                });
                reader.addEventListener("error", () => showToast("Could not preview the selected image.", true));
                reader.readAsDataURL(file);
            } else {
                image.hidden = true;
                placeholder.hidden = true;
                filename.textContent = file.name;
                filename.hidden = false;
            }
        }
    });

    root.addEventListener("input", (event) => {
        const target = event.target;
        if (target.matches("[data-verification-search]")) {
            state.verificationQuery = target.value.trim().toLowerCase();
            state.verificationPage = 1;
            updateVerificationTable();
        } else if (target.matches("[data-admin-request-search]")) {
            state.requestSearch = target.value.trim().toLowerCase();
            state.requestPage = 1;
            updateAdminRequestTable();
        }
    });

    root.addEventListener("click", async (event) => {
        if (event.target.matches(".verification-review-backdrop")) {
            root.querySelector("[data-verification-review]")?.remove();
            root.querySelector(".verification-document-action")?.focus();
            return;
        }
        if (event.target.matches("[data-request-detail-backdrop]")) {
            state.selectedRequestDetail = null;
            await navigate("requests");
            return;
        }
        if (event.target.matches("[data-cancel-request-dialog]")) {
            state.cancelRequestId = null;
            await navigate("requests");
            return;
        }
        if (event.target.matches("[data-admin-request-review-backdrop]")) {
            state.selectedAdminRequestId = null;
            await navigate("requests");
            return;
        }
        if (event.target.matches(".verification-upload-backdrop")) {
            root.querySelector("[data-verification-upload]").hidden = true;
            root.querySelector('[data-action="open-verification-upload"]')?.focus();
            return;
        }
        const target = event.target.closest("[data-action], [data-page]");
        if (!target) return;
        if (target.dataset.page) {
            const accountMenu = root.querySelector(".resident-account-menu");
            if (accountMenu) {
                accountMenu.hidden = true;
                root.querySelector('[data-action="toggle-resident-account"]')?.setAttribute("aria-expanded", "false");
            }
            await navigate(target.dataset.page);
            return;
        }
        const action = target.dataset.action;
        if (action === "open-certificate-picker") {
            const picker = root.querySelector("[data-certificate-picker]");
            picker.hidden = false;
            picker.querySelector(".certificate-picker-header button").focus();
            return;
        }
        if (action === "close-certificate-picker" || target.matches(".certificate-picker-backdrop")) {
            root.querySelector("[data-certificate-picker]").hidden = true;
            root.querySelector('[data-action="open-certificate-picker"]')?.focus();
            return;
        }
        if (action === "open-verification-upload") {
            const dialog = root.querySelector("[data-verification-upload]");
            if (dialog) {
                dialog.hidden = false;
                dialog.querySelector(".verification-upload-button").focus();
            }
            return;
        }
        if (action === "resident-edit-details") {
            state.residentPasswordEditOpen = true;
            await navigate("profile");
            root.querySelector('[name="old_password"]')?.focus();
            return;
        }
        if (action === "cancel-resident-password-edit") {
            state.residentPasswordEditOpen = false;
            await navigate("profile");
            return;
        }
        if (action === "close-verification-upload" || target.matches(".verification-upload-backdrop")) {
            const dialog = root.querySelector("[data-verification-upload]");
            if (dialog) dialog.hidden = true;
            root.querySelector('[data-action="open-verification-upload"]')?.focus();
            return;
        }
        if (action === "select-certificate-type") {
            if (!isVerificationApproved(state.profile?.verification_status || state.user.verification_status)) {
                root.querySelector("[data-certificate-picker]").hidden = true;
                const warning = root.querySelector("[data-verification-warning]");
                warning.hidden = false;
                warning.querySelector("button").focus();
                return;
            }
            state.selectedCertificateType = target.dataset.certificateType || "";
            if (!state.selectedCertificateType) return;
            await navigate("requests");
            return;
        }
        if (action === "dismiss-verification-warning") {
            root.querySelector("[data-verification-warning]").hidden = true;
            root.querySelector('[data-action="open-certificate-picker"]')?.focus();
            return;
        }
        if (action === "toggle-resident-account") {
            const menu = root.querySelector(".resident-account-menu");
            menu.hidden = !menu.hidden;
            target.setAttribute("aria-expanded", String(!menu.hidden));
            return;
        }
        if (action === "filter-requests") {
            state.requestFilter = target.dataset.status || "";
            state.selectedRequestDetail = null;
            state.selectedAdminRequestId = null;
            state.requestPage = 1;
            await navigate("requests");
            return;
        }
        if (action === "view-admin-request") {
            state.selectedAdminRequestId = target.dataset.id;
            await navigate("requests");
            root.querySelector('[data-action="close-admin-request"]')?.focus();
            return;
        }
        if (action === "close-admin-request") {
            state.selectedAdminRequestId = null;
            await navigate("requests");
            return;
        }
        if (action === "admin-request-page-previous" || action === "admin-request-page-next") {
            state.requestPage += action === "admin-request-page-next" ? 1 : -1;
            updateAdminRequestTable();
            return;
        }
        if (action === "set-current-report-year") {
            state.reportYear = new Date().getFullYear();
            const yearInput = root.querySelector("[data-admin-request-year]");
            if (yearInput) yearInput.value = String(state.reportYear);
            return;
        }
        if (action === "generate-request-report") {
            const yearInput = root.querySelector("[data-admin-request-year]");
            const year = Number(yearInput?.value);
            if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear()) {
                showToast(`Enter a year between 2000 and ${new Date().getFullYear()}.`, true);
                yearInput?.focus();
                return;
            }
            state.reportYear = year;
            await navigate("report");
            return;
        }
        if (action === "toggle-admin-sidebar") {
            root.querySelector(".admin-workspace")?.classList.toggle("sidebar-collapsed");
            return;
        }
        if (action === "print-certificate") {
            const preview = root.querySelector("#certificate-preview");
            if (!preview?.contentWindow) {
                showToast("The certificate preview is not available yet.", true);
                return;
            }
            preview.contentWindow.focus();
            preview.contentWindow.print();
            return;
        }
        if (action === "print-request-list") {
            window.print();
            return;
        }
        if (action === "print-resident-list") {
            window.print();
            return;
        }
        if (action === "view-verification") {
            target.disabled = true;
            try {
                await openVerificationReview(target.dataset.id);
            } catch (error) {
                showToast(error.message, true);
            } finally {
                target.disabled = false;
            }
            return;
        }
        if (action === "close-verification-review") {
            root.querySelector("[data-verification-review]")?.remove();
            root.querySelector(".verification-document-action")?.focus();
            return;
        }
        if (action === "back-from-certificate-request") {
            state.selectedCertificateType = "";
            await navigate("dashboard");
            const picker = root.querySelector("[data-certificate-picker]");
            if (picker) {
                picker.hidden = false;
                picker.querySelector(".certificate-picker-header button")?.focus();
            }
            return;
        }
        if (action === "view-request-details") {
            state.selectedRequestDetail = target.dataset.id;
            await navigate("requests");
            root.querySelector("[data-action='close-request-details']")?.focus();
            return;
        }
        if (action === "close-request-details" || event.target.matches("[data-request-detail-backdrop]")) {
            state.selectedRequestDetail = null;
            await navigate("requests");
            return;
        }
        if (action === "cancel-request") {
            state.cancelRequestId = target.dataset.id;
            await navigate("requests");
            root.querySelector('[data-action="confirm-cancel-request"]')?.focus();
            return;
        }
        if (action === "dismiss-cancel-request" || event.target.matches("[data-cancel-request-dialog]")) {
            state.cancelRequestId = null;
            await navigate("requests");
            return;
        }
        if (action === "confirm-cancel-request") {
            const requestId = target.dataset.id;
            target.disabled = true;
            try {
                const result = await post("certificate-request/cancel", { id: requestId });
                state.cancelRequestId = null;
                showToast(result.Message || "Request cancelled.");
                await navigate("requests");
            } catch (error) {
                showToast(error.message, true);
                target.disabled = false;
            }
            return;
        }
        if (action === "verification-page-previous" || action === "verification-page-next") {
            state.verificationPage += action === "verification-page-next" ? 1 : -1;
            updateVerificationTable();
            return;
        }
        if (action === "auth-toggle") {
            renderAuth(!document.querySelector('[data-form="signup"]'));
            return;
        }
        if (action === "password-reset-back") {
            state.passwordResetToken = "";
            window.history.replaceState({}, document.title, window.location.pathname);
            renderAuth(false);
            return;
        }
        if (action === "signup-name-dismiss") {
            target.closest(".auth-dialog-backdrop").remove();
            root.querySelector("#last-name")?.focus();
            return;
        }
        if (action === "login-welcome-dismiss" || action === "success-dialog-dismiss" || action === "verification-success-dismiss") {
            target.closest(".auth-dialog-backdrop").remove();
            if (action === "login-welcome-dismiss") root.querySelector(".nav-button.active")?.focus();
            else if (action === "verification-success-dismiss") await navigate("profile");
            else (root.querySelector('[data-action="open-resident-modal"]') || root.querySelector('#auth-form input[name="email"]'))?.focus();
            return;
        }
        if (action === "verification-approval-dismiss") {
            target.closest(".auth-dialog-backdrop").remove();
            await navigate("verifications");
            return;
        }
        if (action === "forgot-password") {
            renderAuth(false, "request");
            return;
        }
        if (action === "logout") {
            try {
                await post("auth/logout", {});
                state.user = null;
                state.profile = null;
                state.page = "dashboard";
                renderAuth(false);
                showToast("You have signed out.");
            } catch (error) {
                showToast(error.message, true);
            }
            return;
        }
        if (action === "open-resident-modal") {
            openResidentForm();
            return;
        }
        if (action === "open-official-form") {
            state.officialFormOpen = true;
            state.officialEditingId = null;
            await navigate(state.page);
            return;
        }
        if (action === "cancel-official-form") {
            state.officialFormOpen = false;
            state.officialEditingId = null;
            await navigate(state.page);
            return;
        }
        if (action === "edit-official") {
            state.officialFormOpen = true;
            state.officialEditingId = target.dataset.id;
            await navigate(state.page);
            return;
        }
        if (action === "delete-official") {
            const official = state.officialRecords.find((record) => String(record.id) === target.dataset.id);
            if (!official || !window.confirm(`Delete ${official.full_name} from this directory?`)) return;
            target.disabled = true;
            try {
                const councilType = state.page === "sk-officials" ? "sk" : "barangay";
                const result = await post("officials/delete", { id: official.id, council_type: councilType });
                showToast(result.Message || "Official deleted.");
                await navigate(state.page);
            } catch (error) {
                showToast(error.message, true);
                target.disabled = false;
            }
            return;
        }
        if (action === "close-resident-modal") {
            root.querySelector("#resident-modal").hidden = true;
            document.body.classList.remove("resident-modal-open");
            return;
        }
        if (action === "set-resident-life-status") {
            const form = target.closest("form");
            form.elements.is_alive.value = target.dataset.residentLifeStatus;
            form.querySelectorAll("[data-resident-life-status]").forEach((button) => {
                const selected = button === target;
                button.setAttribute("aria-pressed", String(selected));
                button.classList.toggle("is-selected", selected);
            });
            return;
        }
        if (action === "view-resident" || action === "edit-resident") {
            openResidentForm(target.dataset.id, action === "view-resident");
            return;
        }
        if (action === "edit-resident-from-view") {
            const residentId = root.querySelector("#resident-modal [name='id']").value;
            openResidentForm(residentId);
            return;
        }
        if (action === "resident-page") {
            state.residentPage = Number(target.dataset.pageNumber);
            await navigate("residents");
            return;
        }
        if (action === "sort-residents") {
            const key = target.dataset.sortKey;
            if (!key) return;
            state.residentSort = {
                key,
                direction: state.residentSort.key === key && state.residentSort.direction === "asc" ? "desc" : "asc"
            };
            state.residentPage = 1;
            await navigate("residents");
            return;
        }
        if (action === "export-residents") {
            target.disabled = true;
            try {
                const result = await api("resident/export");
                state.residentListRecords = (result.Data || []).slice().sort((left, right) =>
                    String(left.full_name || "").localeCompare(String(right.full_name || ""), undefined, { sensitivity: "base" })
                );
                await navigate("resident-list");
            } catch (error) {
                showToast(error.message, true);
            } finally {
                target.disabled = false;
            }
            return;
        }
        const id = target.dataset.id;
        if (!id) return;
        if (action === "edit-request") {
            state.selectedRequestDetail = id;
            await navigate("requests");
            root.querySelector("[data-action='close-request-details']")?.focus();
            return;
        }
        if (action === "approve-verification" || action === "reject-verification") {
            const isApprove = action === "approve-verification";
            let reason = "";
            if (!isApprove) {
                reason = window.prompt("Enter a reason for rejecting this verification:");
                if (reason === null) return;
                if (!reason.trim()) {
                    showToast("Please provide a rejection reason.", true);
                    return;
                }
            }
            target.disabled = true;
            try {
                const result = await post(isApprove ? "auth/verify/approve" : "auth/verify/reject",
                    isApprove ? { user_id: id } : { user_id: id, reason });
                root.querySelector("[data-verification-review]")?.remove();
                if (isApprove) {
                    showSuccessDialog("Account Approved!", "", "verification-approval-dismiss");
                } else {
                    showToast(result.Message || "Verification rejected.");
                    await navigate("verifications");
                }
            } catch (error) {
                showToast(error.message, true);
                target.disabled = false;
            }
            return;
        }
        if (action === "print-request") {
            if (state.selectedAdminRequestId && String(state.selectedAdminRequestId) === String(id)) {
                state.selectedAdminRequestId = null;
            }
            state.selectedRequestId = id;
            await navigate("certificate");
            return;
        }
        let endpoint;
        let payload;
        let confirmation;
        const isRequestReview = state.selectedAdminRequestId && String(state.selectedAdminRequestId) === String(id);
        const adminNotes = isRequestReview ? root.querySelector("#admin-request-response")?.value || "" : "";
        if (action === "cancel-request") {
            endpoint = "certificate-request/cancel";
            payload = { id };
            confirmation = "Cancel this pending request?";
        } else if (action === "approve-request") {
            if (!isRequestReview) {
                if (!window.confirm("Approve this request and continue to certificate generation?")) return;
                const responseMessage = window.prompt("Optional message for the resident:", "");
                if (responseMessage === null) return;
                endpoint = "certificate-processing/approve";
                payload = { request_id: id, admin_notes: responseMessage };
            } else {
                endpoint = "certificate-processing/approve";
                payload = { request_id: id, admin_notes: adminNotes };
            }
        } else if (action === "reject-request") {
            if (!isRequestReview) {
                if (!window.confirm("Reject this certificate request?")) return;
                const responseMessage = window.prompt("Optional rejection note for the resident:", "");
                if (responseMessage === null) return;
                endpoint = "certificate-processing/reject";
                payload = { request_id: id, admin_notes: responseMessage };
            } else {
                endpoint = "certificate-processing/reject";
                payload = { request_id: id, admin_notes: adminNotes };
            }
        } else if (action === "complete-request") {
            endpoint = "certificate-processing/complete";
            payload = { request_id: id };
        } else {
            return;
        }
        if (confirmation && !window.confirm(confirmation)) return;
        target.disabled = true;
        try {
            const result = await post(endpoint, payload);
            if (isRequestReview) state.selectedAdminRequestId = null;
            if (action === "approve-request") {
                state.selectedRequestId = id;
                await navigate("certificate");
            } else {
                if (action !== "complete-request") showToast(result.Message || "Request updated.");
                if (isRequestReview && action === "reject-request") state.requestFilter = "rejected";
                if (action === "complete-request") state.requestFilter = "pending";
                await navigate("requests");
            }
        } catch (error) {
            showToast(error.message, true);
            target.disabled = false;
        }
    });

    const restoreSession = async () => {
        const resetToken = new URLSearchParams(window.location.search).get("reset_token");
        if (resetToken) {
            state.passwordResetToken = resetToken;
            window.history.replaceState({}, document.title, window.location.pathname);
            renderAuth(false, "reset");
            return;
        }
        renderAuth(false);
        try {
            const response = await api("auth/profile");
            const profile = Array.isArray(response.Data) ? response.Data[0] || {} : response.Data || {};
            if (!profile.id) return;
            state.user = {
                user_id: profile.id,
                role: profile.role || "resident",
                verification_status: profile.verification_status,
                email: profile.email
            };
            state.profile = profile;
            await navigate("dashboard");
        } catch (error) {
            renderAuth(false);
            if (error.message !== "Not logged in.") {
                showToast(error.message, true);
            }
        }
    };

    restoreSession();
})();
