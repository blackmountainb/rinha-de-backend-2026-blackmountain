import { Router } from "express";
import normalizeRequest from "../vectorSearch.js";
import classifyTransaction from "../vectorSearch.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const requestPayload = req.body;
    const classification = await classifyTransaction(requestPayload);
    res.json({
      approved: classification.approve,
      fraud_score: classification.fraud_score,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
