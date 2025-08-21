const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { Pool } = require("pg");

// ====== CONFIG ======
const token = process.env.BOT_TOKEN; // токен бота
const bot = new TelegramBot(token, { polling: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // строка подключения Supabase
  ssl: { rejectUnauthorized: false }
});

const ADMIN_ID = 6005466815; // твой Telegram ID (главный админ)

// ====== EXPRESS KEEPALIVE ======
const app = express();
app.get("/", (req, res) => res.send("Bot is running..."));
app.listen(process.env.PORT || 3000);

// ====== УТИЛИТЫ ======
async function deleteMessage(chatId, messageId) {
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (e) {
    console.log("Ошибка удаления:", e.message);
  }
}

// ====== РЕГИСТРАЦИЯ ======
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const tgId = msg.from.id;
  const nickname = msg.from.username || msg.from.first_name;

  try {
    const user = await pool.query("SELECT * FROM users WHERE tg_id = $1", [tgId]);

    if (user.rows.length === 0) {
      await pool.query(
        "INSERT INTO users (tg_id, nickname, reg_date) VALUES ($1,$2,NOW())",
        [tgId, nickname]
      );
      bot.sendMessage(chatId, `✅ Вы успешно зарегистрированы как *${nickname}*`, {
        parse_mode: "Markdown"
      });
    }

    sendMainMenu(chatId, tgId);
  } catch (e) {
    console.error("Ошибка регистрации:", e.message);
    bot.sendMessage(chatId, "❌ Ошибка регистрации. Попробуйте позже.");
  }
});

// ====== ГЛАВНОЕ МЕНЮ ======
function sendMainMenu(chatId, tgId) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "🎮 Найти матч", callback_data: "find_match" }],
      [
        { text: "👤 Профиль", callback_data: "profile" },
        { text: "🏆 Рейтинг игроков", callback_data: "rating" }
      ],
      [
        { text: "👥 Команды", callback_data: "teams" },
        { text: "📩 Создать тикет", callback_data: "ticket" }
      ]
    ]
  };

  if (tgId == ADMIN_ID) {
    keyboard.inline_keyboard.push([
      { text: "⚙️ Панель администратора", callback_data: "admin_panel" }
    ]);
  }

  bot.sendMessage(chatId, "🔽 Выберите действие:", {
    reply_markup: keyboard
  });
}

// ====== CALLBACKS ======
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const tgId = query.from.id;
  const msgId = query.message.message_id;

  switch (query.data) {
    case "find_match":
      await deleteMessage(chatId, msgId);

      // создаём новое лобби (если нет) и показываем список
      bot.sendMessage(chatId, "🔎 Выберите лобби:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Лобби №1 (0/10)", callback_data: "lobby_1" }],
            [{ text: "Лобби №2 (0/10)", callback_data: "lobby_2" }],
            [{ text: "Лобби №3 (0/10)", callback_data: "lobby_3" }],
            [{ text: "Лобби №4 (0/10)", callback_data: "lobby_4" }],
            [{ text: "Лобби №5 (0/10)", callback_data: "lobby_5" }]
          ]
        }
      });
      break;

    case "profile":
      await deleteMessage(chatId, msgId);

      try {
        const user = await pool.query("SELECT * FROM users WHERE tg_id = $1", [tgId]);
        const u = user.rows[0];

        const profileText = `
📌 *Профиль игрока*
━━━━━━━━━━━━━━
🆔 TG: ${u.tg_id}
👤 Ник: ${u.nickname}
⭐ ZF: ${u.zf || 0}
🎮 Матчей: ${u.matches || 0}
🏆 Побед: ${u.wins || 0}
💔 Поражений: ${u.losses || 0}
📈 W/R: ${u.wr || 0}%
⚔️ K/D: ${u.kd || 0}
🎯 AVG: ${u.avg || 0}
⌛️ Регистрация: ${new Date(u.reg_date).toLocaleString("ru-RU")}
`;

        bot.sendMessage(chatId, profileText, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📜 Прошлые игры", callback_data: "last_games" }],
              [{ text: "🏠 Главное меню", callback_data: "main_menu" }]
            ]
          }
        });
      } catch (e) {
        console.error("Ошибка профиля:", e.message);
        bot.sendMessage(chatId, "❌ Ошибка загрузки профиля.");
      }
      break;

    case "main_menu":
      await deleteMessage(chatId, msgId);
      sendMainMenu(chatId, tgId);
      break;

    case "admin_panel":
      if (tgId != ADMIN_ID) {
        return bot.answerCallbackQuery(query.id, { text: "⛔ Недоступно" });
      }
      await deleteMessage(chatId, msgId);
      bot.sendMessage(chatId, "⚙️ *Админ панель*\nВыберите действие:", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚫 Управление блокировкой", callback_data: "ban_manage" }],
            [{ text: "🎮 Управление матчами", callback_data: "match_manage" }],
            [{ text: "📑 Логи", callback_data: "logs" }],
            [{ text: "👥 Информация о пользователях", callback_data: "users_info" }],
            [{ text: "⬅️ Назад", callback_data: "main_menu" }]
          ]
        }
      });
      break;

    default:
      bot.answerCallbackQuery(query.id, { text: "В разработке 🚧" });
  }
});