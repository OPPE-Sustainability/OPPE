// js/auth.js
(function () {
  // จำลองสิทธิ์เพื่อพัฒนาฟังก์ชันหลักให้เสร็จก่อน
  window.currentUser = {
    email: "inspector.ehs@mahidol.ac.th",
    name: "เจ้าหน้าที่ตรวจประเมิน (EHS Inspector)",
    role: "INSPECTOR",
    idToken: "mock-dev-token"
  };

  window.initGoogleAuth = function () {
    // ปิดการทำงานของ Login Gate Modal
    const modal = document.getElementById("loginGateModal");
    if (modal) modal.style.display = "none";

    // อัปเดตข้อมูลบน Header ทันที
    const userBadge = document.getElementById("userProfileBadge");
    if (userBadge) {
      userBadge.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="status-tag pass">INSPECTOR (DEV)</span>
          <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${window.currentUser.email}</span>
        </div>
      `;
    }
  };

  window.logoutUser = function () {
    location.reload();
  };
})();