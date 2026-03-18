import { queryFeed } from "../../storage.blob.js";

export default async function handler(req, res) {
  const { company, type, limit } = req.query;
  try {
    const data = await queryFeed({ company, type, limit: limit ? parseInt(limit) : 20 });
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
