export function formatDate(date) {
  return new Date(date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
}