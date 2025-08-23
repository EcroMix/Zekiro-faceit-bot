import { createLobby, getLobbies } from "../models/database.js";

export async function handleLobby(bot, msg) {
  const chatId = msg.chat.id;

  const { data: lobbies } = await getLobbies();
  if (lobbies && lobbies.length > 0) {
    bot.sendMessage(chatId, `📋 Лобби:\n${lobbies.map(l => `• ${l.name}`).join("\n")}`);
  } else {
    bot.sendMessage(chatId, "❌ Лобби пока нет.");
  }
}