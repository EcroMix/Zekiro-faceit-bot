import { addLog, getLogs } from "../models/database.js";

export async function handleAdmin(bot, msg) {
  const chatId = msg.chat.id;

  if (msg.from.id.toString() !== process.env.ADMIN_TG_ID) {
    bot.sendMessage(chatId, "❌ Ты не админ.");
    return;
  }

  await addLog("Админ зашел в панель", msg.from.id);

  const { data: logs } = await getLogs(5);
  let text = "🛠 Последние действия:\n";
  if (logs) {
    text += logs.map(l => `• ${l.action} (${l.created_at})`).join("\n");
  }
  bot.sendMessage(chatId, text);
}