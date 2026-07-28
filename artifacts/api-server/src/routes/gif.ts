import { Router } from "express";
import https from "https";

const router = Router();
const TENOR_KEY = "LIVDSRZULELA";

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

// GET /gif/trending
router.get("/gif/trending", async (req, res) => {
  try {
    const limit = req.query["limit"] ?? "20";
    const data = await fetchJson(
      `https://api.tenor.com/v1/trending?key=${TENOR_KEY}&limit=${limit}&media_filter=minimal&contentfilter=off`
    );
    const results = (data.results ?? []).map((r: any) => ({
      id: r.id,
      url: r.media?.[0]?.gif?.url ?? r.media?.[0]?.tinygif?.url ?? "",
      preview: r.media?.[0]?.tinygif?.url ?? r.media?.[0]?.gif?.url ?? "",
      title: r.title ?? "",
    })).filter((g: any) => g.url);
    res.json(results);
  } catch (err) {
    console.error("GIF trending error:", err);
    res.status(500).json({ error: "GIF yüklenemedi" });
  }
});

// GET /gif/search?q=...
router.get("/gif/search", async (req, res) => {
  try {
    const q = encodeURIComponent(req.query["q"] as string || "");
    const limit = req.query["limit"] ?? "20";
    const data = await fetchJson(
      `https://api.tenor.com/v1/search?q=${q}&key=${TENOR_KEY}&limit=${limit}&media_filter=minimal&contentfilter=off`
    );
    const results = (data.results ?? []).map((r: any) => ({
      id: r.id,
      url: r.media?.[0]?.gif?.url ?? r.media?.[0]?.tinygif?.url ?? "",
      preview: r.media?.[0]?.tinygif?.url ?? r.media?.[0]?.gif?.url ?? "",
      title: r.title ?? "",
    })).filter((g: any) => g.url);
    res.json(results);
  } catch (err) {
    console.error("GIF search error:", err);
    res.status(500).json({ error: "GIF arama başarısız" });
  }
});

export default router;
