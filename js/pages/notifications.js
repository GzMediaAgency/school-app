// js/pages/notifications.js — مركز الإشعارات لكل الأدوار (Async — Supabase)

(async function () {
  const user = await mountLayout("notifications.html", ["admin", "teacher", "student", "parent"], "الإشعارات");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;

  async function myNotifications() {
    const all = await getAll("Notification");
    return all
      .filter(n => n.targetRole === user.role && (!n.targetId || n.targetId === user.linkedId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async function render() {
    const notifs = await myNotifications();
    document.getElementById("notifList").innerHTML = notifs.map(n => `
      <div class="notif-item ${n.isRead ? 'read' : ''}" data-id="${n.id}">
        <div class="notif-dot"></div>
        <div class="notif-msg">
          ${n.message}
          <div class="notif-meta">${n.type} — ${new Date(n.createdAt).toLocaleString('ar-MA')}</div>
        </div>
        ${!n.isRead ? `<button class="btn btn-outline btn-sm" onclick="markRead('${n.id}')">تعليم كمقروء</button>` : ""}
      </div>
    `).join("") || `<p style="padding:20px;text-align:center;color:var(--color-text-muted);">لا يوجد إشعارات حاليًا</p>`;
  }

  window.markRead = async function (id) {
    await updateRecord("Notification", id, { isRead: true });
    render();
  };

  document.getElementById("markAllReadBtn").addEventListener("click", async () => {
    const notifs = await myNotifications();
    for (const n of notifs) {
      if (!n.isRead) await updateRecord("Notification", n.id, { isRead: true });
    }
    render();
  });

  render();
})();
