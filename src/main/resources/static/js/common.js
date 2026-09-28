const GRADE_COLORS = {
    HG:   '#2563EB',
    RG:   '#4B5563',
    MG:   '#059669',
    MGSD: '#7C3AED',
    MGEX: '#D4AF37',
    PG:   '#991B1B',
};

// 팝업(모달/라이트박스/확인창)을 브라우저 뒤로가기 또는 ESC 키로 닫을 수 있게 해주는 공용 히스토리 스택
// - 팝업을 열 때: PopupNav.open(closeFn) 호출 — 히스토리를 한 칸 쌓고 뒤로가기/ESC 시 실행할 closeFn 을 등록
// - 팝업을 (뒤로가기/ESC 가 아닌) 버튼/배경클릭 등으로 직접 닫을 때: 그 close 함수 안에서 PopupNav.close() 호출
//   — 쌓아둔 히스토리를 정리한다(popstate 를 한 번 더 발생시키지만 closingViaPopstate 플래그로 무시됨)
// 팝업 위에 팝업이 겹쳐 뜬 경우 뒤로가기/ESC 를 누르면 가장 위에 있는 팝업부터 순서대로 닫힌다
const PopupNav = (function () {
    const stack = [];
    // popstate 로 인해 이미 브라우저가 히스토리를 정리한 상태에서 closeFn 이 실행 중임을 표시
    // — 이 동안에는 close() 가 다시 history.back() 을 호출하지 않아야 한다(이중 이동 방지)
    let closingViaPopstate = false;
    // close() 자신이 history.back() 을 호출해 발생시킨 popstate 인지 표시
    // — 이미 close() 쪽에서 스택 정리와 closeFn 실행을 마쳤으므로, 뒤따라오는 이 popstate 는
    //   또 한 번 스택을 pop 해 그 아래 팝업까지 닫아버리지 않도록 그냥 소비만 하고 무시해야 한다
    let skipNextPopstate = false;

    window.addEventListener('popstate', () => {
        if (skipNextPopstate) {
            skipNextPopstate = false;
            return;
        }
        const closeFn = stack.pop();
        if (!closeFn) return;
        closingViaPopstate = true;
        closeFn();
        closingViaPopstate = false;
    });

    // ESC 는 가장 위 팝업의 close 버튼을 누른 것과 동일하게 동작한다 (그 closeFn 이 알아서 PopupNav.close() 를 호출한다)
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || stack.length === 0) return;
        stack[stack.length - 1]();
    });

    return {
        open(closeFn) {
            stack.push(closeFn);
            history.pushState({ popup: true }, '');
        },
        close() {
            if (closingViaPopstate) return;
            if (stack.length === 0) return;
            stack.pop();
            skipNextPopstate = true;
            history.back();
        },
    };
})();

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
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); }
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
                PopupNav.close();
                resolve(result);
            };
            // 뒤로가기를 누르면 취소로 간주
            PopupNav.open(() => cleanup(false));
            ok.onclick = () => cleanup(true);
            cancel.onclick = () => cleanup(false);
        });
    }
};

// API helper
// nginx 하위 경로(context-path) 배포 지원: Thymeleaf 에서 window.CONTEXT_PATH 에 주입된 값을 사용
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

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 검색어를 공백 기준으로 토큰화 (다중 단어 AND 매칭에 사용)
function tokenizeSearchQuery(query) {
    return String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

// text 안에 query 의 모든 토큰이 (순서 무관) 부분 문자열로 포함되면 true
function matchesAllTokens(text, query) {
    const tokens = tokenizeSearchQuery(query);
    if (tokens.length === 0) return true;
    const lowerText = String(text || '').toLowerCase();
    return tokens.every(t => lowerText.includes(t));
}

function highlightText(text, keyword) {
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    if (!text) return '';
    const str = String(text);
    const tokens = tokenizeSearchQuery(keyword);
    if (tokens.length === 0) return esc(str);
    const lowerStr = str.toLowerCase();
    // 여러 토큰을 하이라이트할 때 겹치는 구간은 가장 긴 매칭을 우선 적용
    let result = '', i = 0;
    while (i < str.length) {
        let bestLen = 0;
        for (const t of tokens) {
            if (t.length > bestLen && lowerStr.startsWith(t, i)) bestLen = t.length;
        }
        if (bestLen > 0) {
            result += `<mark class="search-highlight">${esc(str.slice(i, i + bestLen))}</mark>`;
            i += bestLen;
        } else {
            result += esc(str[i]);
            i += 1;
        }
    }
    return result;
}

// 가격 표시는 JPY/KRW 만 지원 — CNY/USD 는 DB 에 저장은 되지만 화면에 표시하지 않음
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

// 년월 선택 팝업 피커
// options.months: 12개 월 레이블 배열 (기본값 영문 약어, 한국어는 KO_MONTHS 전달)
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

// 그리드 컬럼 표시/숨김 체크박스 드롭다운 — 관리자 목록 화면 공용 (마크업은 .check-dropdown, 스타일은 admin.css)
// 헤더 이름이 있는 컬럼만 대상 — 여백 채우기용 빈 컬럼이나 고정한 작업 버튼 열은 늘 보여야 한다
function createColumnDropdown(root, gridApi) {
    const toggle = root.querySelector('.check-dropdown-toggle');
    const menu = root.querySelector('.check-dropdown-menu');

    menu.innerHTML = gridApi.getColumns()
        .filter(c => c.getColDef().headerName)
        .map(c => `<label class="check-dropdown-item">
            <input type="checkbox" value="${c.getColId()}" checked>${escHtml(c.getColDef().headerName)}
        </label>`)
        .join('');
    const boxes = [...menu.querySelectorAll('input')];

    function applyColumns() {
        gridApi.setColumnsVisible(boxes.filter(b => b.checked).map(b => b.value), true);
        gridApi.setColumnsVisible(boxes.filter(b => !b.checked).map(b => b.value), false);
    }

    function setOpen(open) {
        menu.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
    }

    toggle.addEventListener('click', () => setOpen(menu.hidden));
    menu.addEventListener('change', applyColumns);
    // 바깥을 클릭하거나 ESC 를 누르면 닫는다
    document.addEventListener('click', e => { if (!root.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
}

// 그리드 매뉴얼 컬럼 — 앞의 2개까지만 아이콘으로 보여준다 (나머지는 상세/수정 팝업에서 확인, admin/user 공용)
const MANUAL_LIMIT = 2;

// 2개를 나란히 보여줄 때만 아래첨자로 번호를 붙인다 — 1개뿐이면 번호로 구분할 대상이 없다
function manualIndexHtml(shown, index) {
    return shown > 1 ? `<sub class="manual-index">${index + 1}</sub>` : '';
}

// 마지막으로 클릭한 행의 배경을 바꿔 어느 행을 보고 있었는지 남긴다 — 다른 행을 클릭하면 이전 행은 원래대로 돌아간다
// createGrid 의 옵션에 펼쳐 넣어 쓴다: agGrid.createGrid(el, { ...lastClickedRowHighlight(), columnDefs, ... })
function lastClickedRowHighlight() {
    let markedId = null;
    return {
        // 스크롤로 행이 다시 그려질 때도 표시가 유지되도록 클래스 규칙으로 건다
        rowClassRules: { 'row-last-clicked': params => params.node.id === markedId },
        onRowClicked: params => {
            if (params.node.id === markedId) return;
            const previous = markedId == null ? null : params.api.getRowNode(markedId);
            markedId = params.node.id;
            // 클래스 규칙은 행을 다시 그릴 때 평가되므로, 표시가 바뀌는 두 행만 다시 그린다
            params.api.redrawRows({ rowNodes: previous ? [previous, params.node] : [params.node] });
        },
    };
}
