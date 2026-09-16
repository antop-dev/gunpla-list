/* 제품 등록/수정 요청의 내용 표시 — 요청 현황(사용자)의 읽기 전용 상세에서 사용하고,
 * 어드민 요청 검토 팝업(product-modal.js 의 review 모드)은 항목별 표시 문자열(textOf)만 빌려 쓴다
 *
 * render(container, { current, requested })
 *   - current 가 있으면 '기존' 열을 함께 그려 FROM -> TO 비교가 된다 (수정 요청)
 *   - 값이 달라진 항목은 달라진 글자만 형광으로 표시하고, 같은 항목은 '기존' 열과 같은 흐린 글자로 둔다
 * 아래쪽 PRODUCT_REQUEST_LABELS / productRequestStatusHtml / formatRequestDateTime 은
 * 요청 목록 그리드와 검토 팝업이 공용으로 쓰는 표시 헬퍼
 */
const ProductRequestFields = (function () {
    // diff: 'chars' 달라진 글자만 형광 / 'price' 화폐 단위는 통째로 + 금액은 글자 비교 / 'none' 비교 표시 없음
    // compare: false 면 값이 달라도 '변경됨' 으로 보지 않는다 (박스아트는 요청에 첨부하지 않는 쪽이 기본이라)
    const FIELDS = [
        { key: 'boxArt',      label: '박스아트', diff: 'none',  compare: false },
        { key: 'grade',       label: '등급',     diff: 'chars' },
        { key: 'modelNumber', label: '형식번호', diff: 'chars' },
        { key: 'name',        label: '제품명',   diff: 'chars' },
        { key: 'release',     label: '발매년월', diff: 'chars' },
        { key: 'price',       label: '출시가격', diff: 'price' },
        { key: 'series',      label: '출연작',   diff: 'chars' },
        { key: 'sourceUrl',   label: '출처 URL', diff: 'chars' },
        { key: 'manualUrls',  label: '매뉴얼 URL', diff: 'none' },
        { key: 'category',    label: '구분',     diff: 'none' },
    ];

    const EMPTY_HTML = '<span class="req-empty">-</span>';

    // 비교와 표시를 같은 문자열로 처리해 '변경됨' 판정이 화면과 어긋나지 않게 한다
    function textOf(fields, key) {
        if (!fields) return '';
        switch (key) {
            case 'boxArt':     return fields.boxArtThumbUrl || '';
            case 'release':    return formatReleaseDate(fields.releaseYear, fields.releaseMonth);
            case 'price':      return (fields.currency && fields.price != null) ? formatPrice(fields.currency, fields.price) : '';
            case 'manualUrls': return (fields.manualUrls || []).join('\n');
            case 'category':   return fields.category ? fields.category.name : '';
            default:           return fields[key] == null ? '' : String(fields[key]);
        }
    }

    // segs 가 있으면 달라진 글자를 형광으로 감싸 보여주고, 없으면 값을 그대로 보여준다
    function displayHtml(fields, key, segs) {
        const text = textOf(fields, key);
        if (!text) return EMPTY_HTML;
        if (key === 'boxArt') {
            const full = fields.boxArtUrl || text;
            return `<a href="${escHtml(full)}" target="_blank" rel="noopener noreferrer">
                <img class="req-boxart-img" src="${escHtml(text)}" alt="박스아트"></a>`;
        }
        if (key === 'category') {
            const c = fields.category;
            return `<span class="chip" style="background:${hexToRgba(c.color, 0.2)};border-color:${c.color};color:${c.color}">${escHtml(c.name)}</span>`;
        }
        if (key === 'manualUrls') {
            return text.split('\n')
                .map(url => `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${escHtml(url)}</a>`)
                .join('<br>');
        }
        const inner = segs ? segmentsHtml(segs) : escHtml(text);
        if (key === 'sourceUrl') {
            return `<a href="${escHtml(text)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
        }
        return inner;
    }

    function segmentsHtml(segs) {
        return segs.map(s => s.changed
            ? `<mark class="req-diff">${escHtml(s.text)}</mark>`
            : escHtml(s.text)).join('');
    }

    // ---- 글자 단위 비교 ----

    // 같은 종류(같음/달라짐)의 글자가 이어지면 한 덩어리로 묶어 마크업을 줄인다
    function pushChar(segs, ch, changed) {
        const last = segs[segs.length - 1];
        if (last && last.changed === changed) last.text += ch;
        else segs.push({ text: ch, changed });
    }

    // 최장 공통 부분 수열로 공통 글자를 찾고, 그 밖의 글자만 '달라짐' 으로 표시한다
    // 반환: { from: [{text, changed}], to: [...] } — 같은 문자열이면 null
    function diffSegments(from, to) {
        if (from === to) return null;
        // 두 값이 길면 표(길이 x 길이)를 만드는 비용이 커지므로 통째로 달라진 것으로 본다
        if (from.length * to.length > 40000) {
            return { from: [{ text: from, changed: true }], to: [{ text: to, changed: true }] };
        }
        // 이모지 같은 서러게이트 쌍이 반 토막 나지 않게 코드 포인트 단위로 자른다
        const a = Array.from(from);
        const b = Array.from(to);
        const n = a.length;
        const m = b.length;
        // lcs[i][j] = a[i..], b[j..] 의 최장 공통 부분 수열 길이
        const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                lcs[i][j] = a[i] === b[j]
                    ? lcs[i + 1][j + 1] + 1
                    : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }
        const fromSegs = [];
        const toSegs = [];
        let i = 0;
        let j = 0;
        while (i < n && j < m) {
            if (a[i] === b[j]) {
                pushChar(fromSegs, a[i], false);
                pushChar(toSegs, b[j], false);
                i++;
                j++;
            } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
                pushChar(fromSegs, a[i], true);
                i++;
            } else {
                pushChar(toSegs, b[j], true);
                j++;
            }
        }
        while (i < n) pushChar(fromSegs, a[i++], true);
        while (j < m) pushChar(toSegs, b[j++], true);
        return { from: fromSegs, to: toSegs };
    }

    // 출시가격은 "¥ 12,345" 꼴 — 화폐 단위는 글자를 쪼개 비교해도 의미가 없어 통째로 보고,
    // 금액만 글자 단위로 비교한다
    function priceDiffSegments(current, requested) {
        const from = splitPrice(textOf(current, 'price'));
        const to = splitPrice(textOf(requested, 'price'));
        const unitChanged = from.unit !== to.unit;
        const amount = diffSegments(from.amount, to.amount) || {
            from: [{ text: from.amount, changed: false }],
            to: [{ text: to.amount, changed: false }],
        };
        return {
            from: priceSegments(from, unitChanged, amount.from),
            to: priceSegments(to, unitChanged, amount.to),
        };
    }

    function priceSegments(parts, unitChanged, amountSegs) {
        if (!parts.unit) return null;
        return [{ text: parts.unit, changed: unitChanged }, { text: ' ', changed: false }, ...amountSegs];
    }

    function splitPrice(text) {
        const i = text.indexOf(' ');
        return i === -1 ? { unit: text, amount: '' } : { unit: text.slice(0, i), amount: text.slice(i + 1) };
    }

    // ---- 표 그리기 ----

    function render(container, options) {
        const current = options.current || null;
        const requested = options.requested || null;
        const showCurrent = !!current;

        // 헤더 셀에도 같은 클래스를 붙인다 — table-layout:fixed 는 첫 행의 셀 너비로 열 폭을 정하므로
        const head = showCurrent
            ? '<tr><th class="req-label"></th><th class="req-from">기존</th><th>요청</th></tr>'
            : '';

        const rows = FIELDS.map(f => {
            const label = `<td class="req-label">${f.label}</td>`;
            if (!showCurrent) {
                return `<tr>${label}<td class="req-to">${displayHtml(requested, f.key)}</td></tr>`;
            }

            const same = textOf(current, f.key) === textOf(requested, f.key);
            const changed = !same && f.compare !== false;
            let diff = null;
            if (!same && f.diff === 'chars') diff = diffSegments(textOf(current, f.key), textOf(requested, f.key));
            if (!same && f.diff === 'price') diff = priceDiffSegments(current, requested);

            const from = `<td class="req-from">${displayHtml(current, f.key, diff && diff.from)}</td>`;
            // 값이 같으면 '기존' 열과 같은 흐린 글자로 보여 바뀐 게 없음을 한눈에 알 수 있게 한다
            const to = `<td class="req-to${same ? ' req-same' : ''}">${displayHtml(requested, f.key, diff && diff.to)}</td>`;
            return `<tr class="${changed ? 'req-row-changed' : ''}">${label}${from}${to}</tr>`;
        }).join('');

        container.innerHTML = `<table class="req-table">${head ? `<thead>${head}</thead>` : ''}<tbody>${rows}</tbody></table>`;
    }

    return { render, textOf };
})();

// ---- 요청 상태/종류 표시 공용 ----

const PRODUCT_REQUEST_LABELS = {
    type: { REGISTER: '등록', MODIFY: '수정' },
    status: { PENDING: '대기', APPROVED: '승인', REJECTED: '반려', CANCELED: '취소' },
};

function productRequestStatusHtml(status) {
    const label = PRODUCT_REQUEST_LABELS.status[status] || status;
    return `<span class="req-status req-status-${String(status).toLowerCase()}">${label}</span>`;
}

// 서버는 UTC 기준 LocalDateTime 문자열을 내려주므로 Z 를 붙여 로컬 시간으로 표시한다
function formatRequestDateTime(value) {
    if (!value) return '';
    const date = new Date(value.endsWith('Z') ? value : value + 'Z');
    if (isNaN(date.getTime())) return value;
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
