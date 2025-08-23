export const sendMessage = async (chat_id, text, reply_markup = null) => {
  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;
  const body = { chat_id, text };
  if (reply_markup) body.reply_markup = reply_markup;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};