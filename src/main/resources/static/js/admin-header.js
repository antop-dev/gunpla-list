/* 어드민 공통 헤더 동작 (fragments/admin-header.html) — common.js 다음에 로드한다
 * - '제품 요청' 메뉴의 미처리 건수 뱃지
 * - 비밀번호 변경 팝업
 * 요청을 승인/반려한 페이지는 AdminHeader.refreshPendingCount() 로 뱃지를 갱신한다
 */
const AdminHeader = (function () {
    // 처리할 요청이 있을 때만 뱃지를 띄운다
    async function refreshPendingCount() {
        try {
            const { count } = await Api.get('/api/admin/product-requests/pending-count');
            const badge = document.getElementById('product-request-badge');
            if (!badge) return;
            badge.textContent = count;
            badge.style.display = count > 0 ? '' : 'none';
        } catch (e) {
            // 뱃지는 부가 정보이므로 실패해도 화면 동작에는 영향을 주지 않는다
        }
    }

    // ---- Password change modal ----

    function openPasswordModal() {
        document.getElementById('form-password').reset();
        document.getElementById('modal-password').classList.add('active');
        document.getElementById('field-current-password').focus();
        PopupNav.open(closePasswordModal);
    }

    function closePasswordModal() {
        document.getElementById('modal-password').classList.remove('active');
        PopupNav.close();
    }

    async function changePassword() {
        const currentPassword = document.getElementById('field-current-password').value;
        const newPassword = document.getElementById('field-new-password').value;
        const confirmPassword = document.getElementById('field-confirm-password').value;

        if (!currentPassword) { Toast.error('현재 비밀번호를 입력하세요.'); return; }
        if (!newPassword) { Toast.error('새 비밀번호를 입력하세요.'); return; }
        if (newPassword !== confirmPassword) { Toast.error('새 비밀번호가 일치하지 않습니다.'); return; }

        const btnSave = document.getElementById('btn-password-save');
        const btnCancel = document.getElementById('btn-password-cancel');
        const btnClose = document.getElementById('modal-password-close');
        btnSave.disabled = btnCancel.disabled = btnClose.disabled = true;
        btnSave.querySelector('i').className = 'fa-solid fa-spinner fa-spin';

        try {
            await Api.put('/api/admin/password', { currentPassword, newPassword });
            Toast.success('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
            closePasswordModal();
            setTimeout(() => document.getElementById('form-logout').submit(), 1500);
        } catch (e) {
            Toast.error(e.message);
            btnSave.disabled = btnCancel.disabled = btnClose.disabled = false;
            btnSave.querySelector('i').className = 'fa-solid fa-floppy-disk';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btn-change-password').addEventListener('click', openPasswordModal);
        document.getElementById('btn-password-save').addEventListener('click', changePassword);
        document.getElementById('btn-password-cancel').addEventListener('click', closePasswordModal);
        document.getElementById('modal-password-close').addEventListener('click', closePasswordModal);
        document.getElementById('field-confirm-password').addEventListener('keypress', e => {
            if (e.key === 'Enter') changePassword();
        });
        refreshPendingCount();
    });

    return { refreshPendingCount };
})();
