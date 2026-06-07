import { Router } from "express";
import { state } from "../index.js";

const router = Router();

router.get("/", (req, res) => {
  if (state.isReady) {
    res.status(200).json({ status: "ready" });
  } else {
    res.status(503).json({ status: "initializing" });
  }
});

export default router;
