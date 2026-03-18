import { querySignals, getLatestPerCompany } from "../../storage.blob.js";

export default async function handler(req, res) {
  const { company, type, view } = req.query;
  try {
    const data = view === "latest"
      ? await getLatestPerCompany()
      : await querySignals({ company, filingType: type, limit: 50 });
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
