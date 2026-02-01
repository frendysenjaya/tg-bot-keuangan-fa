import { google } from "googleapis";
import fs from "fs";
import moment from "moment";

// const auth = new google.auth.GoogleAuth({
//   credentials: JSON.parse(fs.readFileSync("credentials.json")),
//   scopes: ["https://www.googleapis.com/auth/spreadsheets"],
// });

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

export async function getAllData() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "Data!A:F",
  });

  const rows = res.data.values?.slice(1) || [];

  return rows.map((r, index) => ({
    rowNumber: index + 2, // karena header di baris 1
    tanggal: r[0],
    kategori: (r[1] || ""),
    barang: r[2],
    harga: parseInt(String(r[3]).replace(/\D/g, "")) || 0,
  }));
}

export async function insertRow({ tanggal, kategori, barang, harga }) {
  const m = moment(tanggal, [
    "DD-MM-YYYY",
    "DD/MM/YYYY",
    "DDMMYYYY",
    "YYYY-MM-DD",
  ]);

  if (!m.isValid()) {
    throw new Error("Format tanggal tidak valid");
  }

  const bulan = m.locale("id").format("MMMM");
  const tahun = m.format("YYYY");

  const cleanHarga = parseInt(String(harga).replace(/\D/g, "")) || 0;

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "Data!A:F", // ✅ NAMA SHEET BENAR
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        m.format("DD-MM-YYYY"), // Tanggal
        kategori,              // Kategori
        barang,                // Nama Barang
        cleanHarga,            // Harga
        bulan,                 // Bulan
        tahun,                 // Tahun
      ]],
    },
  });
}

export async function updateRow(rowNumber, { tanggal, kategori, barang, harga }) {
  const m = moment(tanggal, [
    "DD-MM-YYYY",
    "DD/MM/YYYY",
    "DDMMYYYY",
    "YYYY-MM-DD",
  ]);

  if (!m.isValid()) {
    throw new Error("Format tanggal tidak valid");
  }

  const bulan = m.locale("id").format("MMMM");
  const tahun = m.format("YYYY");

  const cleanHarga = parseInt(String(harga).replace(/\D/g, "")) || 0;
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: `Data!A${rowNumber}:F${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[tanggal, kategori, barang, cleanHarga, bulan, tahun]],
    },
  });
}

export async function deleteRow(rowNumber) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0, // ⬅️ ganti kalau sheet bukan pertama
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}