export function formatDate(date) {
  return new Date(date).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

export function isAdmin(userId) {
  return userId.toString() === process.env.ADMIN_TG_ID;
}