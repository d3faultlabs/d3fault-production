import { Router, type IRouter } from "express";
import healthRouter from "./health";
import relayRouter from "./relay";
import programInfoRouter from "./program-info";
import meRouter from "./me";
import v1Router from "./v1/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(relayRouter);
router.use(programInfoRouter);
router.use(meRouter);

// Versioned public API
router.use("/v1", v1Router);

export default router;
