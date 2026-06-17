// Toast notifications
const Toast = {
    show(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    },
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); }
};

// Confirm dialog
const Confirm = {
    show(message) {
        return new Promise(resolve => {
            let overlay = document.getElementById('confirm-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'confirm-overlay';
                overlay.className = 'confirm-overlay';
                overlay.innerHTML = `
                    <div class="confirm-box">
                        <p class="confirm-text" id="confirm-text"></p>
                        <div class="confirm-actions">
                            <button class="btn btn-danger" id="confirm-ok">확인</button>
                            <button class="btn btn-secondary" id="confirm-cancel">취소</button>
                        </div>
                    </div>`;
                document.body.appendChild(overlay);
            }
            document.getElementById('confirm-text').textContent = message;
            overlay.classList.add('active');
            const ok = document.getElementById('confirm-ok');
            const cancel = document.getElementById('confirm-cancel');
            const cleanup = (result) => {
                overlay.classList.remove('active');
                ok.onclick = null;
                cancel.onclick = null;
                resolve(result);
            };
            ok.onclick = () => cleanup(true);
            cancel.onclick = () => cleanup(false);
        });
    }
};

// API helper
const _ctxPath = (window.CONTEXT_PATH || '/').replace(/\/$/, '');
function _url(path) { return path.startsWith('/') ? _ctxPath + path : path; }

const Api = {
    async request(url, options = {}) {
        const resp = await fetch(_url(url), {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ message: 'Error' }));
            throw new Error(err.message || `HTTP ${resp.status}`);
        }
        if (resp.status === 204) return null;
        return resp.json();
    },
    get(url) { return this.request(url); },
    post(url, body) { return this.request(url, { method: 'POST', body: JSON.stringify(body) }); },
    put(url, body) { return this.request(url, { method: 'PUT', body: JSON.stringify(body) }); },
    delete(url) { return this.request(url, { method: 'DELETE' }); },
    async upload(url, file) {
        const fd = new FormData();
        fd.append('file', file);
        const resp = await fetch(_url(url), { method: 'POST', body: fd });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ message: 'Error' }));
            throw new Error(err.message || `HTTP ${resp.status}`);
        }
        return resp.json();
    }
};

// Price formatter — JPY/KRW only; CNY/USD hidden
function formatPrice(currency, price) {
    if (!currency || price == null || price === '') return '';
    const n = Number(price).toLocaleString();
    if (currency === 'JPY') return `¥ ${n}`;
    if (currency === 'KRW') return `₩ ${n}`;
    return '';
}

// Release date formatter: yyyy.MM
function formatReleaseDate(year, month) {
    if (!year) return '';
    if (!month) return String(year);
    return `${year}.${String(month).padStart(2, '0')}`;
}

// Month-Year picker
// options.months: array of 12 month labels (default English short names)
function createMonthYearPicker(inputEl, options = {}) {
    let popup = null;
    let currentYear = new Date().getFullYear();

    const MONTHS = options.months || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function parseValue() {
        const v = inputEl.value;
        if (!v) return { year: null, month: null };
        // Support both "YYYY-MM" and "YYYY.MM"
        const m = v.match(/^(\d{4})[-.](\d{1,2})$/);
        if (m) return { year: parseInt(m[1]), month: parseInt(m[2]) };
        return { year: null, month: null };
    }

    function openPicker() {
        if (popup) popup.remove();
        const { year } = parseValue();
        currentYear = year || new Date().getFullYear();
        popup = document.createElement('div');
        popup.className = 'date-picker-popup';
        renderPicker();
        const rect = inputEl.getBoundingClientRect();
        popup.style.top = (rect.bottom + window.scrollY + 4) + 'px';
        popup.style.left = rect.left + 'px';
        document.body.appendChild(popup);
    }

    function renderPicker() {
        const { year: selYear, month: selMonth } = parseValue();
        popup.innerHTML = `
            <div class="date-picker-header">
                <button class="date-picker-nav" data-action="prev">&#8249;</button>
                <span class="date-picker-year">${currentYear}</span>
                <button class="date-picker-nav" data-action="next">&#8250;</button>
            </div>
            <div class="date-picker-months">
                ${MONTHS.map((m, i) => {
                    const mo = i + 1;
                    const sel = selYear === currentYear && selMonth === mo ? ' selected' : '';
                    return `<button class="date-picker-month${sel}" data-month="${mo}">${m}</button>`;
                }).join('')}
            </div>
        `;
        popup.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (btn.dataset.action === 'prev') currentYear--;
                else currentYear++;
                renderPicker();
            });
        });
        popup.querySelectorAll('[data-month]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const month = parseInt(btn.dataset.month);
                inputEl.value = `${currentYear}.${String(month).padStart(2, '0')}`;
                closePicker();
                inputEl.dispatchEvent(new Event('change'));
            });
        });
    }

    function closePicker() {
        if (popup) { popup.remove(); popup = null; }
    }

    inputEl.addEventListener('click', e => { e.stopPropagation(); openPicker(); });
    document.addEventListener('click', e => {
        if (popup && !popup.contains(e.target)) closePicker();
    });
}

// Full date picker (YYYY-MM-DD)
function createDatePicker(inputEl) {
    inputEl.setAttribute('placeholder', 'YYYY-MM-DD');
    inputEl.addEventListener('blur', () => {
        const v = inputEl.value;
        if (!v) return;
        const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!m) inputEl.setCustomValidity('Format: YYYY-MM-DD');
        else inputEl.setCustomValidity('');
    });
}
