export function isAdmin(userId) {
  const admins = [123456789]; // тут вставь свои ID админов
  return admins.includes(userId);
}