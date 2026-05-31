import { Router } from "express";
import { isReady } from "../index.js";

const router = Router();

router.get('/', (req, res) => {
    if (isReady) {
        res.status(200).json({ status: 'ready' });
    } else {
        res.status(503).json({ status: 'initializing' });
    }
})

export default router;