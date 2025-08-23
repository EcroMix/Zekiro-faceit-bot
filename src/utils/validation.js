export function validateUsername(username) {
  return typeof username === "string" && username.trim().length >= 3;
}

export function validateLobbyName(name) {
  return typeof name === "string" && name.trim().length >= 3;
}

export function validateTicketSubject(subject) {
  return typeof subject === "string" && subject.trim().length > 0;
}