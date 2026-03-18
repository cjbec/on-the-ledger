import { getLatestRollup } from "../../storage.blob.js";

export default async function handler(req, res) {
  try {
    const data = await getLatestRollup();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(data ?? { text: null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
