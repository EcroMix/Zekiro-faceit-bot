export function isValidTelegramId(id) {
  return typeof id === 'number' && id > 0;
}