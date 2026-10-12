/* 사용자 사이트 공통 헤더 동작 (fragments/user-header.html) — common.js 다음에 로드한다
 * 제품 목록(/)과 판매제품 모아보기(/on-sale)가 같이 쓴다
 * - 프로필 버튼: 로그아웃 확인
 * - 설정 팝업(보유상품 공유 / 신규 판매제품 알림)과 설정 버튼 알림 배지
 * - 공유 버튼/공유 팝업 (설정에서 공유를 허용한 경우에만 활성화)
 * 로그인하지 않았으면 헤더에 해당 버튼/팝업이 없으므로 아무 것도 하지 않는다
 */
(function () {
    // ---- Logout ----

    async function confirmLogout() {
        const ok = await Confirm.show('로그아웃 하시겠습니까?');
        if (ok) document.getElementById('form-logout').submit();
    }

    // ---- Settings (보유상품 공유 / 신규 판매제품 알림) ----

    // 공유를 허용한 경우의 공유 URL — 공유 버튼 활성화 여부와 공유 팝업에서 쓴다 (허용 안 하면 null)
    let shareUrl = null;

    // 헤더 공유 버튼 — 공유를 허용한 경우에만 활성화
    function updateShareButton(share) {
        shareUrl = share?.enabled ? share.shareUrl : null;
        const btn = document.getElementById('btn-share');
        if (!btn) return;
        btn.disabled = !shareUrl;
        btn.title = shareUrl ? '보유상품 공유' : '설정에서 보유상품 공유를 허용하세요';
    }

    // 설정 버튼 오른쪽 위 배지 — 신규 판매제품 알림 수신 동의 여부를 켜짐(초록)/꺼짐(빨강) 색으로 표시
    function updateNotifyBadge(notifyOnSale) {
        const badge = document.getElementById('notify-badge');
        if (!badge) return;
        const on = notifyOnSale === true;
        badge.classList.toggle('notify-badge-on', on);
        badge.classList.toggle('notify-badge-off', !on);
    }

    // 설정 상태를 헤더(공유 버튼, 알림 배지)에 반영
    function applySettingsToHeader(settings) {
        updateShareButton(settings.share);
        updateNotifyBadge(settings.notification.notifyOnSale);
    }

    // 페이지 진입 시 설정을 가져와 헤더에 반영 (팝업을 열지 않고 조용히 갱신)
    async function refreshHeaderSettings() {
        try {
            applySettingsToHeader(await Api.get('/api/user/settings'));
        } catch (e) {
            // 조회 실패 시 공유 버튼은 비활성, 배지는 꺼짐 표시인 기본 상태로 둔다
        }
    }

    // 알림 받을 등급 멀티 셀렉트(Tom Select) — 판매제품 페이지 필터처럼 체크박스 옵션에 입력칸은 없고,
    // 선택한 등급은 회색 태그(× 로 제거 가능)로 보여준다
    // 팝업 본문(.modal-body)이 overflow 스크롤이라 드롭다운이 잘리지 않도록 body 에 붙인다
    let notifyGradesSelect = null;

    function getNotifyGradesSelect() {
        if (notifyGradesSelect) return notifyGradesSelect;
        const el = document.getElementById('field-notify-grades');
        if (!el || typeof TomSelect === 'undefined') return null;
        notifyGradesSelect = new TomSelect(el, {
            plugins: ['checkbox_options', 'remove_button'],
            controlInput: null,
            closeAfterSelect: false,
            hideSelected: false,
            dropdownParent: 'body',
            render: {
                item: (data, escape) => `<div class="notify-grade-tag">${escape(data.text)}</div>`,
            },
            onChange: values => renderNotifyGradesSummary(values),
        });
        notifyGradesSelect.dropdown.classList.add('notify-grades-dropdown');
        return notifyGradesSelect;
    }

    // 선택이 없을 때만 컨트롤에 안내 문구("등급 선택")를 표시 — 선택이 있으면 태그만 보인다(user.css)
    function renderNotifyGradesSummary(values) {
        const ts = notifyGradesSelect;
        if (!ts) return;
        const selected = Array.isArray(values) ? values : [values].filter(Boolean);
        ts.control.dataset.summary = ts.input.dataset.placeholder;
        ts.control.dataset.empty = String(selected.length === 0);
    }

    // 저장된 순서가 아닌 옵션 순서(HG → PG)로 보이도록 정렬해서 채운다
    function setNotifyGrades(grades) {
        const ts = getNotifyGradesSelect();
        if (!ts) return;
        const order = Object.keys(ts.options);
        const sorted = (grades || []).filter(g => order.includes(g))
            .sort((a, b) => order.indexOf(a) - order.indexOf(b));
        ts.setValue(sorted, true);
        renderNotifyGradesSummary(sorted);
    }

    function getNotifyGrades() {
        const value = notifyGradesSelect?.getValue() || [];
        return Array.isArray(value) ? value : [value].filter(Boolean);
    }

    async function openSettings() {
        try {
            const settings = await Api.get('/api/user/settings');
            const notification = settings.notification;
            document.getElementById('field-share-enabled').checked = settings.share.enabled;
            document.getElementById('field-notify-on-sale').checked = notification.notifyOnSale;
            document.getElementById('field-notify-email').value = notification.notifyEmail || '';
            setNotifyGrades(notification.notifyGrades);
            applySettingsToHeader(settings);
            document.getElementById('modal-settings')?.classList.add('active');
            PopupNav.open(closeSettings);
        } catch (e) {
            Toast.error('설정을 불러오지 못했습니다.');
        }
    }

    function closeSettings() {
        notifyGradesSelect?.close();
        document.getElementById('modal-settings')?.classList.remove('active');
        PopupNav.close();
    }

    async function saveSettings() {
        const shareEnabled = document.getElementById('field-share-enabled').checked;
        const notifyOnSale = document.getElementById('field-notify-on-sale').checked;
        const notifyEmail = document.getElementById('field-notify-email').value.trim();
        const notifyGrades = getNotifyGrades();
        if (notifyOnSale && !notifyEmail) {
            Toast.error('이메일 주소를 입력하세요.');
            return;
        }
        if (notifyOnSale && notifyGrades.length === 0) {
            Toast.error('알림 받을 등급을 하나 이상 선택하세요.');
            return;
        }
        try {
            const settings = await Api.put('/api/user/settings', {
                share: { enabled: shareEnabled },
                notification: { notifyOnSale, notifyEmail, notifyGrades },
            });
            applySettingsToHeader(settings);
            Toast.success('설정이 저장되었습니다.');
            closeSettings();
        } catch (e) {
            Toast.error(e.message || '저장에 실패했습니다.');
        }
    }

    // ---- Share ----

    function openShare() {
        if (!shareUrl) return;
        document.getElementById('field-share-url').value = shareUrl;
        document.getElementById('modal-share')?.classList.add('active');
        PopupNav.open(closeShare);
    }

    function closeShare() {
        document.getElementById('modal-share')?.classList.remove('active');
        PopupNav.close();
    }

    // 클립보드 API 를 못 쓰는 환경(비보안 컨텍스트 등)에서는 URL 을 선택해 두어 직접 복사할 수 있게 한다
    async function copyShareUrl() {
        const input = document.getElementById('field-share-url');
        try {
            await navigator.clipboard.writeText(input.value);
            Toast.success('공유 링크를 복사했습니다.');
        } catch (e) {
            input.select();
            Toast.error('복사하지 못했습니다. 링크를 직접 복사하세요.');
        }
    }

    // ---- Init ----

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('btn-profile')) return;

        document.getElementById('btn-profile').addEventListener('click', confirmLogout);
        document.getElementById('btn-settings')?.addEventListener('click', openSettings);
        refreshHeaderSettings();
        document.getElementById('modal-settings-close')?.addEventListener('click', closeSettings);
        document.getElementById('btn-settings-cancel')?.addEventListener('click', closeSettings);
        document.getElementById('btn-settings-save')?.addEventListener('click', saveSettings);
        document.getElementById('modal-settings')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeSettings();
        });

        document.getElementById('btn-share')?.addEventListener('click', openShare);
        document.getElementById('modal-share-close')?.addEventListener('click', closeShare);
        document.getElementById('btn-share-copy')?.addEventListener('click', copyShareUrl);
        document.getElementById('modal-share')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeShare();
        });
    });
})();
