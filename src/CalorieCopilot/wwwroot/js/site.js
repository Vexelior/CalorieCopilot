// Theme toggle (light/dark), persisted per browser.
(function () {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const icon = btn.querySelector('i');
    const sync = () => {
        const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        icon.className = dark ? 'bi bi-sun' : 'bi bi-moon-stars';
    };
    sync();
    btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', next);
        try { localStorage.setItem('cc-theme', next); } catch (e) { }
        sync();
        document.dispatchEvent(new CustomEvent('cc:themechange', { detail: next }));
    });
})();

// Confirm dialogs for destructive forms: <form data-confirm="Are you sure?">
document.addEventListener('submit', (e) => {
    const msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !confirm(msg)) e.preventDefault();
});

// Fill a timezone hidden input with the browser's IANA time zone.
document.querySelectorAll('input[data-browser-timezone]').forEach((el) => {
    try { el.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { el.value = 'UTC'; }
});
