import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { deleteRow } from "./sheets.js";
import { handleText } from "./handler.js";
import { lastRekap, pendingDelete, editState } from "./state.js";
import { rupiah } from "./utils.js";

console.log("🤖 Telegram bot is running & polling...");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("message", msg => {
  handleText(bot, msg);
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // BATAL
  if (data === "hapus_batal") {
    return bot.editMessageText("❎ Penghapusan dibatalkan", {
      chat_id: chatId,
      message_id: query.message.message_id
    });
  }

  // PILIH DATA
  if (data.startsWith("hapus_pilih_")) {
    const index = parseInt(data.replace("hapus_pilih_", ""));
    const list = lastRekap.get(chatId);

    if (!list || !list[index]) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Data tidak ditemukan"
      });
    }

    const target = list[index];

    // simpan pending delete
    pendingDelete.set(chatId, target);

    return bot.editMessageText(
      `⚠️ KONFIRMASI HAPUS\n\n` +
      `📅 ${target.tanggal}\n` +
      `🏷 ${target.kategori}\n` +
      `📦 ${target.barang}\n` +
      `💰 ${rupiah(target.harga)}\n\n` +
      `Pilih konfirmasi:`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ YA, Hapus", callback_data: "hapus_yes" },
              { text: "❌ Batal", callback_data: "hapus_batal" }
            ]
          ]
        }
      }
    );
  }

  // KONFIRMASI YA
  if (data === "hapus_yes") {
    const target = pendingDelete.get(chatId);
    if (!target) return;

    await deleteRow(target.rowNumber);

    pendingDelete.delete(chatId);
    lastRekap.delete(chatId);

    return bot.editMessageText(
      `🗑 DATA DIHAPUS\n\n` +
      `📅 ${target.tanggal}\n` +
      `🏷 ${target.kategori}\n` +
      `📦 ${target.barang}\n` +
      `💰 ${rupiah(target.harga)}`,
      {
        chat_id: chatId,
        message_id: query.message.message_id
      }
    );
  }
});

bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;

  // PILIH DATA
  if (data.startsWith("edit_")) {
    const rowNumber  = parseInt(data.replace("edit_", ""), 10);
    const list = lastRekap.get(chatId);

    if (!list) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Data tidak ditemukan"
      });
    }

    const target = list.find(d => d.rowNumber === rowNumber);
    if (!target) {
      return bot.sendMessage(chatId, "❌ Data tidak ditemukan");
    }

    editState.set(chatId, rowNumber);

    await bot.sendMessage(
      chatId,
      `✏️ Edit Data\n\n` +
      `📅 ${target.tanggal}\n` +
      `🏷 ${target.kategori}\n` +
      `📦 ${target.barang}\n` +
      `💰 ${rupiah(target.harga)}\n\n` +
      `Kirim format baru:\n` +
      `DD-MM-YYYY | Kategori | Barang | Harga`
    );

    bot.answerCallbackQuery(q.id);
  }
});