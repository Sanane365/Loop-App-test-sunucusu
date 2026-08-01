import { Router } from "express";

interface GifEntry { id: string; tags: string[] }

// Curated GIFs collected via real web search — verified Giphy IDs
// CDN access: media.giphy.com/media/{id}/giphy.gif (no API key needed)
const GIF_DB: GifEntry[] = [
  { id: "tQRqcmNZGioi0FSsSE", tags: ["güldüm"] },
  { id: "jR6093wTUVjGOyy6ky", tags: ["alkış"] },
  { id: "VbK1D3IhpQlbaTKnxM", tags: ["alkış"] },
  { id: "1bOsufbSAA2FLOcIUl", tags: ["alkış"] },
  { id: "72Wls01w3r0CQ", tags: ["alkış"] },
  { id: "ZUyWobgQuK2LC", tags: ["alkış"] },
  { id: "2Ap4K8iVUpbpmbj5oV", tags: ["şaşırdım"] },
  { id: "139jOF4Yp757QA", tags: ["şaşırdım"] },
  { id: "l3ih6qeGrTfPO", tags: ["şaşırdım"] },
  { id: "m86JBzYYVTOCDdt9NG", tags: ["şaşırdım"] },
  { id: "htdvFspxfRKZCUfnkd", tags: ["şaşırdım"] },
  { id: "xfQk67w5fRRx6", tags: ["şaşırdım"] },
  { id: "vV81KcJ9Eu15m", tags: ["şaşırdım"] },
  { id: "3rbgfDhejdvCjdwZ5z", tags: ["sinirli"] },
  { id: "qkSizynazBx8c9XBHk", tags: ["sinirli"] },
  { id: "eGmgBsEd4om2vdv1wj", tags: ["sinirli"] },
  { id: "yVAFa8MvMfttDVmueT", tags: ["sinirli"] },
  { id: "l2QDSXX9La8fefayk", tags: ["sinirli"] },
  { id: "HK5OYOd5kARVShtvOH", tags: ["sinirli"] },
  { id: "cOFCcLpvXq4wUVIS98", tags: ["sinirli"] },
  { id: "lmjH3ZuG6VzZ6CGedg", tags: ["sinirli"] },
  { id: "hoJ7PzwaNWig5CNAiB", tags: ["sinirli"] },
  { id: "KeAz2VFEfSuytSgt3X", tags: ["sinirli"] },
  { id: "je1y5TjM8mJEJZWaVK", tags: ["sinirli"] },
  { id: "h3jKokL0e34nta0Q4e", tags: ["sinirli"] },
  { id: "kQEORUrXRjhp5fBdSa", tags: ["üzgün"] },
  { id: "dTTt9Oeomo02KlfZAA", tags: ["üzgün"] },
  { id: "G6Ni6DOjzSx6VXv5tu", tags: ["evet"] },
  { id: "VDZmkSjlLuGEouluyf", tags: ["evet"] },
  { id: "tIijMNDQNOCIUzpLHX", tags: ["evet"] },
  { id: "26gR0oDUX1iiOrX8s", tags: ["evet"] },
  { id: "tU6lnCZ5ykOIfT7OnH", tags: ["evet"] },
  { id: "9kOYL9PCwGVMDlJLNB", tags: ["evet"] },
  { id: "11ZAUfeJHojWlW", tags: ["evet"] },
  { id: "L5WTptHVTYJW2VSEkY", tags: ["evet"] },
  { id: "nuc8iVsOfVKWfI5nRF", tags: ["evet"] },
  { id: "Wmixi1SxGaDa5uQHwN", tags: ["hayır"] },
  { id: "kv7WCzUhMtHrudV4Pa", tags: ["hayır"] },
  { id: "gdjyA2uDwyt1pJEbt0", tags: ["hayır"] },
  { id: "CHC4hgk4jsTwoE4rvU", tags: ["hayır"] },
  { id: "y5zbhpA0VO7G89R013", tags: ["hayır"] },
  { id: "FV6wzF5woJQ94uNBdS", tags: ["kutlama"] },
  { id: "BTc5iQtL3naeyL3ACi", tags: ["dans"] },
  { id: "xT8qBqPbxK7znjl0Wc", tags: ["dans"] },
  { id: "IUzuNP6JZG0R6dAPAV", tags: ["aşk"] },
  { id: "UiMV5c5PbrQCgr9Mf8", tags: ["aşk"] },
  { id: "LfZOb8ZQEemEEizPql", tags: ["aşk"] },
  { id: "c8DAJpgsnTzS5IlJV8", tags: ["aşk"] },
  { id: "0igHDNPGNJ7jU9xcEZ", tags: ["aşk"] },
  { id: "nQ5pf7C2GD6EmM56b3", tags: ["aşk"] },
  { id: "llJX1hxWL8IWDotJPd", tags: ["aşk"] },
  { id: "1zK2Jt0qFuWQdPTqvr", tags: ["aşk"] },
  { id: "8gjCczCKnsUMlWneLL", tags: ["aşk"] },
  { id: "c0HHGXWXIiUbMRl97y", tags: ["aşk"] },
  { id: "wTzmlLy6P2hmZvKkeY", tags: ["aşk"] },
  { id: "YPWJQyOi6WBJqXoyzw", tags: ["aşk"] },
  { id: "Z1kpfgtHmpWHS", tags: ["kedi"] },
  { id: "10U81Nx0LdUJzy", tags: ["kedi"] },
  { id: "jTnGaiuxvvDNK", tags: ["kedi"] },
  { id: "kYOBhqMoVuZLlM0EOn", tags: ["kedi"] },
  { id: "In0Lpu4FVivjISX9HT", tags: ["kedi"] },
  { id: "5wfLShGlRxsVFS1wJV", tags: ["kedi"] },
  { id: "lXCQNy6VTwmk0", tags: ["kedi"] },
  { id: "S0Nokl7V0t4mfoYkLF", tags: ["kedi"] },
  { id: "69yrZWuu7clVYvmtJi", tags: ["kedi"] },
  { id: "v3Rb7dGuvkmaRi6qei", tags: ["kedi"] },
  { id: "Qs5khBKll3CazwLauS", tags: ["kedi"] },
  { id: "xjQBgPt47ri0AwiktC", tags: ["kedi"] },
  { id: "WaugJpjO79kDm", tags: ["kedi"] },
  { id: "kqdQrMWPlNhsc", tags: ["köpek"] },
  { id: "VzLR6oO6MzybC", tags: ["köpek"] },
  { id: "S2S0ZDytY6yDm", tags: ["köpek"] },
  { id: "WhCYptDg5hgIg", tags: ["köpek"] },
  { id: "GSsTZNQjPvl1m", tags: ["köpek"] },
  { id: "TAuI4vAYY3DMs", tags: ["köpek"] },
  { id: "bswGDO7Rh1ONO", tags: ["köpek"] },
  { id: "AtwrcuevjPsys", tags: ["köpek"] },
  { id: "1qXjpdPzz3aWHlnz1t", tags: ["harika"] },
  { id: "mIyXvKYv6kC0RlNQTz", tags: ["harika"] },
  { id: "AFXocrxzQelfKknViC", tags: ["harika"] },
  { id: "l3mZgExbJ2UO5iYve", tags: ["harika"] },
  { id: "3o7TKU0L1SunX1osRa", tags: ["yüzüstü"] },
  { id: "jHtCucEdYCvoubazGV", tags: ["yüzüstü"] },
  { id: "113RhN1oBm1yCc", tags: ["yüzüstü"] },
  { id: "YmszCwM1FV7zCI8sgL", tags: ["yüzüstü"] },
  { id: "Q87R3mHsLb76hz316R", tags: ["yüzüstü"] },
  { id: "WrP4rFrWxu4IE", tags: ["yüzüstü"] },
  { id: "y1p8hsBerk4zDH6ZkP", tags: ["yüzüstü"] },
  { id: "5P08a98uUAblPogXDh", tags: ["düşünüyor"] },
  { id: "diTkQJ2u8eb9EfC1g0", tags: ["komik"] },
  { id: "6HkVXyGlEENu6jc3zl", tags: ["komik"] },
  { id: "qOdPEpFbhiDApOifkf", tags: ["komik"] },
  { id: "hTZRpd3DyAKKmagtaS", tags: ["bekliyorum"] },
  { id: "DalGUYnVH51cztejV0", tags: ["bekliyorum"] },
  { id: "HRan7Fu2qRcQY7VpEZ", tags: ["bekliyorum"] },
  { id: "GJpJJPfhcoDl0xOZXI", tags: ["bekliyorum"] },
  { id: "ROUsJFxUvhIc04idnS", tags: ["bekliyorum"] },
  { id: "sct1vVwuu5ezTCEvZM", tags: ["bekliyorum"] },
  { id: "tPLWcqyFWxsJsEwXbF", tags: ["bekliyorum"] },
  { id: "lP4jmO461gq9uLzzYc", tags: ["bekliyorum"] },
  { id: "oTTzBnha8IPzLz9LQm", tags: ["güldüm"] },
  { id: "iGMgyPBVEle2qx2WTd", tags: ["güldüm"] },
  { id: "6A7syj9zCRCNHEMCbs", tags: ["güldüm"] },
  { id: "XZg7QTxeAkX7kWaqHj", tags: ["alkış"] },
  { id: "t8qMjPqpf4cdKvIsu0", tags: ["alkış"] },
  { id: "cir6HswNwNaYGpP2h6", tags: ["alkış"] },
  { id: "1UZ7RmGtCXTAeMX3Fo", tags: ["alkış"] },
  { id: "DCVxnHlWHTW6STzjU8", tags: ["alkış"] },
  { id: "EczclbVb5DZ0ZcoBas", tags: ["alkış"] },
  { id: "migkDnDTKCLyDp9yLb", tags: ["alkış"] },
  { id: "hZ9DoF27OQVAYiUsrF", tags: ["alkış"] },
  { id: "wEyUaPkBcZ5wC6Y9Fo", tags: ["şaşırdım"] },
  { id: "xThtakjeewjf7J3T4k", tags: ["şaşırdım"] },
  { id: "RJTFOm5rmmzIuiqSBB", tags: ["şaşırdım"] },
  { id: "tLOJY4o0sbDMcT50D3", tags: ["şaşırdım"] },
  { id: "McJS9pPeiaD9aKeUOV", tags: ["şaşırdım"] },
  { id: "wpb0EGffFtjz415M11", tags: ["sinirli"] },
  { id: "egAFSxBaTdfarrVQkD", tags: ["sinirli"] },
  { id: "JHL3Afuumaoq4", tags: ["sinirli"] },
  { id: "1fmBxX0HfpTKNtpWAf", tags: ["sinirli"] },
  { id: "JEVYf4g2ePr6o", tags: ["sinirli"] },
  { id: "xUNda1PU3BKwQVo2nm", tags: ["sinirli"] },
  { id: "oz7tyUbBs5SH6", tags: ["sinirli"] },
  { id: "SwlzysgueUzei1jsHs", tags: ["sinirli"] },
  { id: "ql4LidslabKpi", tags: ["sinirli"] },
  { id: "D07KTyMvnhYf6WQF2N", tags: ["sinirli"] },
  { id: "m4L2xe2qgTVzq", tags: ["sinirli"] },
  { id: "8NKutBxqvZGOH7KWxs", tags: ["üzgün"] },
  { id: "jqfUyzcIWbRyaFLjUz", tags: ["üzgün"] },
  { id: "SrKbU4TRDgN8apkkES", tags: ["üzgün"] },
  { id: "0WdDFCMnBAo3Xqd3lf", tags: ["üzgün"] },
  { id: "F0XzwrfEd1FW4tOTmH", tags: ["üzgün"] },
  { id: "Twz9wnPu6UpRggc3SO", tags: ["üzgün"] },
  { id: "1yV9Jfn38EVkMb3PHN", tags: ["evet"] },
  { id: "xULW8jWmG3G6VyqV1K", tags: ["evet"] },
  { id: "XJM6DZn6OYqT9yXEey", tags: ["evet"] },
  { id: "71D9QSIMYPFtnc5sHD", tags: ["evet"] },
  { id: "cK5ebyhR9CE3CIIoQk", tags: ["evet"] },
  { id: "8hBZCdp3q7ITS", tags: ["evet"] },
  { id: "3o6YfWVyo3JkdrNO92", tags: ["evet"] },
  { id: "lpnC6dj4ao0WWexxFk", tags: ["evet"] },
  { id: "HzB8qHmHHZOMqQ6MzZ", tags: ["evet"] },
  { id: "9yLMFXCYadT1weY0mW", tags: ["evet"] },
  { id: "3og0IBrkUqheWkkIAU", tags: ["evet"] },
  { id: "lfoDcX49ux8f1Iirnq", tags: ["evet"] },
  { id: "vMUll1Tz90q4rOENuu", tags: ["hayır"] },
  { id: "uCOZt8ovFxKTAQ1Xud", tags: ["hayır"] },
  { id: "DYWT3dqUiLI2S2t2Oo", tags: ["hayır"] },
  { id: "1YMzXpTZv2MhlzEtao", tags: ["hayır"] },
  { id: "1xxzHNqzoL0wsXoOPU", tags: ["kutlama"] },
  { id: "GP2CCx5XjeMi3Ez9G1", tags: ["dans"] },
  { id: "Pb8Bq0KxLIxUF9rqTK", tags: ["dans"] },
  { id: "8s0W0t5grM2ZUUWf8V", tags: ["dans"] },
  { id: "aIKGmmUNGWhHePWV8N", tags: ["dans"] },
  { id: "41OcgTNj1deTwIk23O", tags: ["dans"] },
  { id: "T95LftfJLQNOGzf79x", tags: ["dans"] },
  { id: "TGGf99Y1XbYgimegdV", tags: ["dans"] },
  { id: "wdyaoDEf4RJFC", tags: ["aşk"] },
  { id: "Z9nH6xXIvhTUk4yRua", tags: ["aşk"] },
  { id: "eNGDd3a1ubFDLENJnw", tags: ["aşk"] },
  { id: "oXrffyQ6Wf9io", tags: ["aşk"] },
  { id: "ROW1kdEZ5tqEEkTfXV", tags: ["aşk"] },
  { id: "DQe4fSDM0iJ0UVE8iH", tags: ["aşk"] },
  { id: "6MG1pE9qwi1VvP7GEV", tags: ["aşk"] },
  { id: "Xf7g5BjIIMun8fR14k", tags: ["aşk"] },
  { id: "LdMWg0xQTfmcpFF5Yt", tags: ["kedi"] },
  { id: "TjSPQgowhhJdHgvnwA", tags: ["kedi"] },
  { id: "lGBecpB2dIMwt6ohfI", tags: ["kedi"] },
  { id: "901mxGLGQN2PyCQpoc", tags: ["kedi"] },
  { id: "C5UKBt10BGiEUpZ2bW", tags: ["kedi"] },
  { id: "zOowlkUroZBoUb9sAl", tags: ["kedi"] },
  { id: "1YLltfFKpiti8ePRT4", tags: ["kedi"] },
  { id: "uyfgCPQeCjYMVxt2m3", tags: ["kedi"] },
  { id: "h6knwLNqaWhrZLq14Q", tags: ["kedi"] },
  { id: "H4DjXQXamtTiIuCcRU", tags: ["kedi"] },
  { id: "kOEYOwSaKbFra", tags: ["köpek"] },
  { id: "nLkYoleEY5iJW", tags: ["köpek"] },
  { id: "z0GxIl4nsWBB39WU46", tags: ["köpek"] },
  { id: "wyxDfsIVXtjkoOjX9o", tags: ["köpek"] },
  { id: "uYV7xN7U8EbXa", tags: ["köpek"] },
  { id: "lXyIjwxAC1RPxpJXJ5", tags: ["köpek"] },
  { id: "gWkCsQZ4YlU1a", tags: ["köpek"] },
  { id: "14MjVpzfpuzqE", tags: ["köpek"] },
  { id: "jp2KXzsPtoKFG", tags: ["köpek"] },
  { id: "moMd5EntFglTG", tags: ["köpek"] },
  { id: "3o72EZy5UgQhF2hvZ6", tags: ["köpek"] },
  { id: "kudIERso2pFiE", tags: ["köpek"] },
  { id: "4tA3DsLypxtXW", tags: ["harika"] },
  { id: "fXnippRSYoS7a4F5Ef", tags: ["harika"] },
  { id: "SiEuCNPGqSdrWfs9vL", tags: ["harika"] },
  { id: "QWACOOxovwulV5vVU1", tags: ["harika"] },
  { id: "QWqBIRgUMFuW113XlL", tags: ["harika"] },
  { id: "f8znFCYP6RMw5XsOKS", tags: ["harika"] },
  { id: "ZFLa3SHo2D4WWR4hbh", tags: ["harika"] },
  { id: "TrReYjQWBXLqS7wrvp", tags: ["yüzüstü"] },
  { id: "3oEjHN6LRYhtVzo17W", tags: ["yüzüstü"] },
  { id: "uXcnuV62ZhGW8qH8a7", tags: ["yüzüstü"] },
  { id: "2zcnvuIqlyxHmWruhF", tags: ["yüzüstü"] },
  { id: "XCxccpY01wcehGuhup", tags: ["yüzüstü"] },
  { id: "AXsmKUMUD0aYceO7SE", tags: ["yüzüstü"] },
  { id: "ehy0yP0Z8h7JZAGEwR", tags: ["yüzüstü"] },
  { id: "LQv5qSTo8lXVvPammo", tags: ["yüzüstü"] },
  { id: "JR4onfOH0GRFDXOo28", tags: ["yüzüstü"] },
  { id: "LmEVAvr6gjPUvILkWv", tags: ["yüzüstü"] },
  { id: "ReUzqeRHeyeYy1B6Ea", tags: ["düşünüyor"] },
  { id: "jTSyNHoW8TnBvdUAkc", tags: ["düşünüyor"] },
  { id: "l4HnWrGUBPZqsfjkk", tags: ["düşünüyor"] },
  { id: "oHvZVsRTtxYig0EmNi", tags: ["düşünüyor"] },
  { id: "HTgCXYsA1TF6uRUlj8", tags: ["düşünüyor"] },
  { id: "l0K45fwBufXrJM2jK", tags: ["düşünüyor"] },
  { id: "CF8Lh2sE1r0zFWVCWf", tags: ["düşünüyor"] },
  { id: "ehcOA2WtivMSBmZaH2", tags: ["düşünüyor"] },
  { id: "5FoxedYWNVmO4", tags: ["düşünüyor"] },
  { id: "yxJY6QwwaNFJuZmVJ4", tags: ["ateş"] },
  { id: "IygqIaVn3ISRjPqjA3", tags: ["ateş"] },
  { id: "DSgpE3HA3rtIJHpyCp", tags: ["ateş"] },
  { id: "mjjXtyaoQJ6BlhkpWp", tags: ["ateş"] },
  { id: "LavaqctMFvQlsPSjjd", tags: ["ateş"] },
  { id: "KaBZrQq6gZFL8zZ75t", tags: ["bekliyorum"] },
  { id: "utBcMmLp056Tu", tags: ["güldüm"] },
  { id: "RJys0b93KSKYz6M7B1", tags: ["güldüm"] },
  { id: "BOXAWHi7xsrimuROAz", tags: ["güldüm"] },
  { id: "2eLQvv8uf7rtQwOMtN", tags: ["güldüm"] },
  { id: "qqY0YrEvdhK4EPeKiw", tags: ["güldüm"] },
  { id: "mpAgdemJ1pSqRWacCR", tags: ["güldüm"] },
  { id: "61FBkpCzVtv9vLETx1", tags: ["güldüm"] },
  { id: "eguqu3ZKxAvaopNMOk", tags: ["şaşırdım"] },
  { id: "G9TcxLH5McqAkWhDmZ", tags: ["şaşırdım"] },
  { id: "LqOSZWLeoPWSfmYzud", tags: ["şaşırdım"] },
  { id: "dJD4xBczSSnEIbtd7u", tags: ["şaşırdım"] },
  { id: "WT8pzD8MgX2cPgzejY", tags: ["şaşırdım"] },
  { id: "l0HUkpFVvr3yBQjFm", tags: ["şaşırdım"] },
  { id: "NFrtVQoZ6EPJ80hqbG", tags: ["evet"] },
  { id: "3RTwofMK6batOxnSKL", tags: ["evet"] }
];

const ALL_TAGS = [...new Set(GIF_DB.flatMap(g => g.tags))];

function gifUrl(id: string) { return `https://media.giphy.com/media/${id}/giphy.gif`; }
function gifPreview(id: string) { return `https://media.giphy.com/media/${id}/200.gif`; }

function formatGif(g: GifEntry) {
  return { id: g.id, url: gifUrl(g.id), preview: gifPreview(g.id), tags: g.tags };
}

// Shuffle deterministically-ish so "trending" feels fresh each server boot
const seed = Date.now();
const shuffled = [...GIF_DB].sort(() => Math.sin(seed + GIF_DB.indexOf(GIF_DB[0])) - 0.5);

const router = Router();

// GET /gif/trending?limit=24
router.get("/gif/trending", (_req, res) => {
  const limit = Math.min(Number(_req.query["limit"] ?? 24), 60);
  // Return a rotating selection of popular GIFs
  const start = Math.floor(Date.now() / 300000) % GIF_DB.length; // changes every 5 min
  const result: GifEntry[] = [];
  for (let i = 0; i < limit && result.length < limit; i++) {
    result.push(GIF_DB[(start + i) % GIF_DB.length]);
  }
  res.json(result.map(formatGif));
});

// GET /gif/search?q=...&limit=24
router.get("/gif/search", (req, res) => {
  const q = String(req.query["q"] ?? "").toLowerCase().trim();
  const limit = Math.min(Number(req.query["limit"] ?? 24), 60);

  if (!q) {
    // Return trending when no query
    const gifs = GIF_DB.slice(0, limit).map(formatGif);
    return res.json(gifs);
  }

  // Score each GIF: exact tag match = 2pts, partial match = 1pt
  const scored = GIF_DB.map(g => {
    let score = 0;
    for (const tag of g.tags) {
      if (tag === q) score += 2;
      else if (tag.includes(q) || q.includes(tag)) score += 1;
    }
    return { g, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

  let results = scored.slice(0, limit).map(x => formatGif(x.g));

  // Pad with trending if not enough results
  if (results.length < 8) {
    const usedIds = new Set(results.map(r => r.id));
    const extra = GIF_DB.filter(g => !usedIds.has(g.id)).slice(0, limit - results.length).map(formatGif);
    results = [...results, ...extra];
  }

  res.json(results);
});

// GET /gif/category/:tag?limit=24
router.get("/gif/category/:tag", (req, res) => {
  const tag = req.params["tag"].toLowerCase();
  const limit = Math.min(Number(req.query["limit"] ?? 24), 60);
  const matches = GIF_DB.filter(g => g.tags.includes(tag));
  const result = matches.length > 0 ? matches : GIF_DB.slice(0, limit);
  res.json(result.slice(0, limit).map(formatGif));
});

// GET /gif/tags — list all available tags
router.get("/gif/tags", (_req, res) => {
  res.json(ALL_TAGS);
});

export default router;
