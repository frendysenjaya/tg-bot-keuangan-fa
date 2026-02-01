import moment from "moment";

const VALID = ["Makan", "Kebutuhan Rumah", "Hiburan"];

export function parseInput(text) {
  const p = text.split("|");
  if (p.length !== 4) return null;

  const [tgl, barang, harga, kategori] = p.map(v => v.trim());

  if (!VALID.includes(kategori)) return { error: "kategori" };
  if (isNaN(harga)) return { error: "harga" };

  const m = moment(tgl, "DD-MM-YYYY", true);
  if (!m.isValid()) return { error: "tanggal" };

  return {
    tanggal: tgl,
    barang,
    harga: Number(harga),
    kategori,
    bulan: m.format("MMMM"),
    tahun: m.format("YYYY"),
  };
}