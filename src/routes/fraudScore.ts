import { Router } from "express";
import normalizeRequest from "../vectorSearch.js";

const router = Router();

router.post('/', async (req, res) => {
    try {
        const requestPayload = req.body;
        const normalizedVector = await normalizeRequest(requestPayload);
        res.json({ fraud_score: normalizedVector });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;