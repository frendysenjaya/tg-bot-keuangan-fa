import moment from "moment";
import { getAllData, insertRow, updateRow, deleteRow } from "./sheets.js";
import { lastRekap, pendingDelete, editState} from "./state.js";
import { rupiah } from "./utils.js";

moment.locale("id");

export async function handleText(bot, msg) {
  const chatId = msg.chat.id;
  if (!msg.text) return;

  const text = msg.text.trim();
  const lower = text.toLowerCase();

  // =========================
  // /ADD COMMAND
  // =========================
  if (lower.startsWith("/add")) {
    const payload = lower.replace("/add", "").trim();

    if (!payload.includes("|")) {
      return bot.sendMessage(
        chatId,
        "❌ Format salah\n\nGunakan:\n/add 31-01-2026 | Makan | Martabak | 50000"
      );
    }

    const parts = payload.split("|").map(v => v.trim());

    if (parts.length !== 4) {
      return bot.sendMessage(
        chatId,
        "❌ Format salah\n\nGunakan:\n/add 31-01-2026 | Makan | Martabak | 50000"
      );
    }

    const [tanggal, kategori, barang, harga] = parts;

    try {
      await insertRow({
        tanggal,
        kategori: kategori,
        barang,
        harga,
      });

      return bot.sendMessage(
        chatId,
        `✅ *Data tersimpan*\n\n` +
        `🏷 ${kategori}\n` +
        `📅 ${tanggal}\n` +
        `📦 ${barang}\n` +
        `💰 Rp ${Number(harga).toLocaleString("id-ID")}`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error(err);
      return bot.sendMessage(chatId, "❌ Gagal menyimpan data\n" + err.message);
    }
  }

  // =========================
  // AMBIL DATA
  // =========================
  const data = await getAllData();

  data.sort((a, b) => {
    return moment(a.tanggal, "DD-MM-YYYY") - moment(b.tanggal, "DD-MM-YYYY");
  });

  if (!data.length) {
    return bot.sendMessage(chatId, "📭 Belum ada data");
  }

  // =========================
  // EDIT DATA PILIH
  // /
  // =========================
  if (editState.has(chatId) && lower.includes("|")) {
    const row = editState.get(chatId);
    const [tanggal, kategori, barang, harga] =
      msg.lower.split("|").map(v => v.trim());

    await updateRow(row, { tanggal, kategori, barang, harga});

    editState.delete(chatId);

    return bot.sendMessage(chatId, "✅ Data berhasil diperbarui");
  }

  if (lower === "/edit") {
    const data = lastRekap.get(chatId);

    if (!data || !data.length) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada data.\nGunakan /rekap dulu"
      );
    }

    const buttons = data.map((d, i) => ([
      {
        // text: `${i + 1}️⃣ ${d.barang} - ${rupiah(d.harga)}`,shuzheng
        text: `[${i + 1}️]📅 ${d.tanggal} | 🏷 ${d.kategori} | 📦 ${d.barang}  | 💰 ${rupiah(d.harga)}`,
        callback_data: `edit_${d.rowNumber}`
      }
    ]));

    buttons.push([
      { text: "❌ Batal", callback_data: "hapus_batal" }
    ]);

    return bot.sendMessage(chatId, "🗑 Pilih data yang ingin diubah:", {
      reply_markup: {
        inline_keyboard: buttons
      }
    });
  }

  // =========================
  // HAPUS DATA PILIH
  // /hapus
  // =========================
  if (lower === "/delete") {
    const data = lastRekap.get(chatId);

    if (!data || !data.length) {
      return bot.sendMessage(
        chatId,
        "❌ Tidak ada data.\nGunakan /rekap dulu"
      );
    }

    const buttons = data.map((d, i) => ([
      {
        // text: `${i + 1}️⃣ ${d.barang} - ${rupiah(d.harga)}`,shuzheng
        text: `[${i + 1}️]📅 ${d.tanggal} | 🏷 ${d.kategori} | 📦 ${d.barang}  | 💰 ${rupiah(d.harga)}`,
        callback_data: `hapus_pilih_${i}`
      }
    ]));

    buttons.push([
      { text: "❌ Batal", callback_data: "hapus_batal" }
    ]);

    return bot.sendMessage(chatId, "🗑 Pilih data yang ingin dihapus:", {
      reply_markup: {
        inline_keyboard: buttons
      }
    });
  }

  // =========================
  // REKAP HARI INI
  // /rekap hari ini
  // =========================
  if (lower === "rekap hari ini" || lower === "rekap hari ini") {
    const today = moment().format("DD-MM-YYYY");

    const filtered = data.filter(d =>
      moment(d.tanggal, ["DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD"])
        .format("DD-MM-YYYY") === today
    );

    lastRekap.set(chatId, filtered); // 🔥 PENTING

    return kirimRekap(
      bot,
      chatId,
      filtered,
      `📊 Rekap Hari Ini (${today})`
    );
  }

  // =========================
  // REKAP 7 HARI TERAKHIR
  // /rekap 7 hari terakhir
  // =========================
  if (lower === "rekap 7 hari terakhir" || lower === "rekap 7 hari terakhir") {
    const today = moment().startOf("day");
    const start = moment().subtract(6, "days").startOf("day");

    const filtered = data.filter(d => {
      const m = moment(d.tanggal, [
        "DD-MM-YYYY",
        "DD/MM/YYYY",
        "YYYY-MM-DD"
      ]);
      return m.isValid() && m.isBetween(start, today, null, "[]");
    });

    lastRekap.set(chatId, filtered); // 🔥 PENTING

    return kirimRekap(
      bot,
      chatId,
      filtered,
      `📊 Rekap 7 Hari Terakhir`
    );
  }

  // =========================
  // REKAP TANGGAL TERTENTU
  // /rekap tanggal 31-01-2026
  // =========================
  if (lower.startsWith("rekap tanggal")) {
    const tanggalInput = lower.replace("rekap tanggal", "").trim();

    const target = moment(tanggalInput, [
      "DD-MM-YYYY",
      "DD/MM/YYYY",
      "YYYY-MM-DD"
    ]);

    if (!target.isValid()) {
      return bot.sendMessage(
        chatId,
        "❌ Format tanggal salah\nContoh:\n/rekaP 31-01-2026"
      );
    }

    const targetDate = target.format("DD-MM-YYYY");

    const filtered = data.filter(d =>
      moment(d.tanggal, [
        "DD-MM-YYYY",
        "DD/MM/YYYY",
        "YYYY-MM-DD"
      ]).format("DD-MM-YYYY") === targetDate
    );

    lastRekap.set(chatId, filtered); // 🔥 PENTING

    return kirimRekap(
      bot,
      chatId,
      filtered,
      `📊 Rekap Tanggal ${targetDate}`
    );
  }

  // =========================
  // REKAP BULAN
  // rekap bulan januari tahun 2026
  // =========================
  if (lower.startsWith("rekap bulan")) {
    const match = lower.match(/rekap bulan (.+) tahun (.+)/);

    if (!match) {
      return bot.sendMessage(
        chatId,
        "❌ Format salah\nContoh:\nrekap bulan januari tahun 2026"
      );
    }

    const bulan = match[1].trim();
    const tahun = match[2].trim();

    const filtered = data.filter(d => {
      const m = moment(d.tanggal, [
        "DD-MM-YYYY",
        "DD/MM/YYYY",
        "YYYY-MM-DD",
      ]);

      return (
        m.isValid() &&
        m.locale("id").format("MMMM").toLowerCase() === bulan &&
        m.locale("id").format("yyyy") === tahun
      );
    });

    lastRekap.set(chatId, filtered); // 🔥 PENTING

    return kirimRekap(bot, chatId, filtered, `📊 Rekap Bulan ${bulan} Tahun ${tahun}`);
  }

  // =========================
  // REKAP KATEGORI RANGE TANGGAL
  // rekap kategori makan 01-01-2026 ke 31-01-2026
  // =========================
  if (lower.startsWith("rekap kategori") && lower.includes(" ke ")) {
    const match = lower.match(
      /rekap kategori (.+) (\d{2}[-/]\d{2}[-/]\d{4}) ke (\d{2}[-/]\d{2}[-/]\d{4})/
    );

    if (!match) {
      return bot.sendMessage(
        chatId,
        "❌ Format salah\nContoh:\nrekap kategori makan 01-01-2026 ke 31-01-2026"
      );
    }

    const kategori = match[1].trim();
    const fromInput = match[2];
    const toInput = match[3];

    const from = moment(fromInput, ["DD-MM-YYYY", "DD/MM/YYYY"]).startOf("day");
    const to = moment(toInput, ["DD-MM-YYYY", "DD/MM/YYYY"]).endOf("day");

    if (!from.isValid() || !to.isValid()) {
      return bot.sendMessage(chatId, "❌ Tanggal tidak valid");
    }

    if (from.isAfter(to)) {
      return bot.sendMessage(chatId, "❌ Tanggal awal tidak boleh lebih besar");
    }

    const filtered = data.filter(d => {
      const m = moment(d.tanggal, [
        "DD-MM-YYYY",
        "DD/MM/YYYY",
        "YYYY-MM-DD",
      ]);

      return (
        d.kategori.toLowerCase() === kategori.toLowerCase() &&
        m.isValid() &&
        m.isBetween(from, to, null, "[]")
      );
    });

    lastRekap.set(chatId, filtered);

    return kirimRekap(
      bot,
      chatId,
      filtered,
      `📊 Rekap ${kategori}\n📅 ${from.format("DD-MM-YYYY")} ➜ ${to.format("DD-MM-YYYY")}`
    );
  }

  // =========================
  // REKAP KATEGORI BULAN
  // rekap kategori makan bulan januari tahun 2026
  // =========================
  if (lower.startsWith("rekap kategori")) {
    const match = lower.match(/rekap kategori (.+) bulan (.+) tahun (.+)/);

    if (!match) {
      return bot.sendMessage(
        chatId,
        "❌ Format salah\nContoh:\nrekap kategori makan bulan januari tahun 2026"
      );
    }

    const kategori = match[1].trim();
    const bulan = match[2].trim();
    const tahun = match[3].trim();

    const filtered = data.filter(d => {
      const m = moment(d.tanggal, [
        "DD-MM-YYYY",
        "DD/MM/YYYY",
        "YYYY-MM-DD",
      ]);

      return (
        d.kategori.toLowerCase() === kategori.toLowerCase() &&
        m.isValid() &&
        m.locale("id").format("MMMM").toLowerCase() === bulan &&
        m.locale("id").format("yyyy") === tahun
      );
    });

    lastRekap.set(chatId, filtered); // 🔥 PENTING

    return kirimRekap(
      bot,
      chatId,
      filtered,
      `📊 Rekap ${kategori} Bulan ${bulan}`
    );
  }

  // =========================
  // REKAP TAHUN
  // rekap tahun 2026
  // =========================
  if (lower.startsWith("rekap tahun")) {
    const tahun = lower.replace("rekap tahun", "").trim();

    const filtered = data.filter(d =>
      moment(d.tanggal, [
        "DD-MM-YYYY",
        "DD/MM/YYYY",
        "YYYY-MM-DD",
      ]).format("YYYY") === tahun
    );

    lastRekap.set(chatId, filtered); // 🔥 PENTING

    return kirimRekap(bot, chatId, filtered, `📊 Rekap Tahun ${tahun}`);
  }

  // =========================
  // KONFIRMASI HAPUS
  // =========================
  if (pendingDelete.has(chatId)) {
    if (lower === "ya") {
      const target = pendingDelete.get(chatId);

      try {
        await deleteRow(target.rowNumber);

        pendingDelete.delete(chatId);
        lastRekap.delete(chatId); // reset cache rekap

        return bot.sendMessage(
          chatId,
          `🗑 DATA DIHAPUS\n\n` +
          `📅 ${target.tanggal}\n` +
          `📦 ${target.barang}\n` +
          `💰 ${rupiah(target.harga)}`
        );
      } catch (err) {
        console.error(err);
        return bot.sendMessage(chatId, "❌ Gagal menghapus data");
      }
    } else {
      pendingDelete.delete(chatId);
      return bot.sendMessage(chatId, "❎ Penghapusan dibatalkan");
    }
  }

  // =========================================
  // REKAP RANGE TANGGAL
  // /rekap tanggal 01-01-2026 ke 31-01-2026
  // =========================================
  if (lower.startsWith("rekap tanggal") && lower.includes(" ke ")) {
    const match = lower.match(/rekap tanggal\s+(.+)\s+ke\s+(.+)/);

    if (!match) {
      return bot.sendMessage(
        chatId,
        "❌ Format salah\nContoh:\nrekap tanggal 01-01-2026 ke 31-01-2026"
      );
    }

    const from = parseTanggal(match[1]);
    const to = parseTanggal(match[2]);

    if (!from.isValid() || !to.isValid()) {
      return bot.sendMessage(chatId, "❌ Format tanggal tidak valid");
    }

    const filtered = data
      .filter(d => {
        const t = parseTanggal(d.tanggal);
        return t.isValid() && t.isBetween(from, to, "day", "[]");
      })
      .sort((a, b) => parseTanggal(a.tanggal) - parseTanggal(b.tanggal));

    return kirimRekap(
      bot,
      chatId,
      filtered,
      `📊 Rekap ${from.format("DD-MM-YYYY")} s/d ${to.format("DD-MM-YYYY")}`
    );
  }

  // =========================
  // DEFAULT HELP
  // =========================
   return bot.sendMessage(
    chatId,
    `🤖 *Bot Keuangan*\n\n` +
    `➕ *Tambah data:*\n` +
    `/add 01-01-2026 | Makan | Martabak | 50000\n\n` +

    `📝 *Edit & Delete data:*\n` +
    `Rekap data terlebih dahulu, lalu ketik :\n` +
    `/edit --> lalu pilih data yang akan diubah sesuai nomor\n` +
    `/delete --> lalu pilih data yang akan dihapus sesuai nomor\n\n` +
    
    `📊 *Rekap:*\n` +
    `- rekap hari ini\n` +
    `- rekap tanggal 01-01-2026\n` +
    `- rekap tanggal 01-01-2026 ke 31-01-2026\n` +
    `- rekap kategori makan 01-01-2026 ke 31-01-2026\n` +
    `- rekap 7 hari terakhir\n` +
    `- rekap bulan januari tahun 2026\n` +
    `- rekap kategori Makan bulan Januari tahun 2026\n` +
    `- rekap tahun 2026`,
    { parse_mode: "Markdown" }
  );
}

// =========================
// HELPER REKAP
// =========================
function kirimRekap(bot, chatId, data, title) {
  if (!data.length) {
    return bot.sendMessage(chatId, "📭 Tidak ada data");
  }

  // =========================
  // SORT BY TANGGAL (ASC)
  // =========================
  data.sort((a, b) => {
    const da = moment(a.tanggal, ["DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]);
    const db = moment(b.tanggal, ["DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]);
    return da.valueOf() - db.valueOf(); // lama → baru
  });

  lastRekap.set(chatId, data); // ⬅️ SIMPAN LIST

  let total = 0;

   const lines = data.map((d, i) => {
    total += d.harga;
    return `[${i + 1}️]📅 ${d.tanggal} | 🏷 ${d.kategori} | 📦 ${d.barang}  | 💰 ${rupiah(d.harga)}`;
  });

  lines.push("\n💵 TOTAL: " + rupiah(total));

  return bot.sendMessage(chatId, `${title}\n\n${lines.join("\n")}`);
}

function parseTanggal(tgl) {
  return moment(tgl, [
    "DD-MM-YYYY",
    "DD/MM/YYYY",
    "YYYY-MM-DD",
  ], true);
}