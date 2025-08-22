module.exports = {
  isValidNickname: (nickname) => typeof nickname === "string" && nickname.length >= 3,
  isValidGameId: (id) => !isNaN(Number(id)) && id.length >= 5,
};