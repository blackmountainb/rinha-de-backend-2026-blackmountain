import express from "express";
import { client } from "./redis.js";
import { normalizationConstants, mccRisk } from "./resources.js";
import fraudScore from "./routes/fraudScore.js";
import ready from "./routes/ready.js";
import { initReferencesCache } from "./vectorSearch.js";
import * as fs from "fs";
import hnswlib from "hnswlib-node";
import { promisify } from "util";
import { gunzip } from "zlib";

const app = express();
const PORT = 9999;
const { HierarchicalNSW } = hnswlib;

type ReferenceRecord = {
  vector: number[];
  label: string;
};

export const state = {
  isReady: false,
};
const asyncGunzip = promisify(gunzip);

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;
  const timestamp = new Date().toISOString();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      `[${timestamp}] ${method} ${path} - ${res.statusCode} - ${duration}ms`,
    );
  });

  next();
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log("API started");
  startServer();
});

app.use("/api/fraud-score", fraudScore);
app.use("/api/ready", ready);

async function startServer() {
  try {
    await initializeCache();
    const data = await getReferencesFromRedis();
    await createHNSW(data);
    console.log("API is ready for usage!");
    state.isReady = true;
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

async function acquireInitLock(client: any): Promise<boolean> {
  const result = await client.set("init_lock", "1", {
    NX: true, // only set if not exists
    EX: 120, // expires in 2 minutes (safety)
  });

  return result === "OK";
}

async function waitForReady(client: any) {
  while (true) {
    const ready = await client.get("ready");
    if (ready === "true") return;

    await new Promise((r) => setTimeout(r, 1000));
  }
}

export async function initializeCache() {
  try {
    await client.connect();

    const isLeader = await acquireInitLock(client);

    if (isLeader) {
      console.log("This instance is initializing Redis cache...");

      await bootstrapAsLeader();
    } else {
      console.log("Waiting for leader to finish initialization...");
      await waitForReady(client);
    }

    state.isReady = true;
    console.log("API is ready for usage!");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

async function seedRedisCache() {
  try {
    await client.set(
      "normalizationConstants",
      JSON.stringify(normalizationConstants),
      { EX: 86400 * 7 },
    );

    await client.set("mccRisk", JSON.stringify(mccRisk), { EX: 86400 * 7 });

    await loadGzipFile("./src/resources/references.json.gz");
    await initReferencesCache();

    console.log("Redis cache seeded");
  } catch (error) {
    console.error("Error seeding Redis cache", error);
    throw error;
  }
}

async function bootstrapAsLeader() {
  // 1. seed Redis
  await seedRedisCache();

  // 2. load data
  const data = await getReferencesFromRedis();

  // 3. build index
  await createHNSW(data);

  // 4. mark ready
  await client.set("ready", "true", { EX: 300 });

  console.log("Leader initialization complete");
}

async function loadGzipFile(filePath: string) {
  const compressedData = fs.readFileSync(filePath);
  // Redis stores strings by default; encode the gzip Buffer as base64
  await client.set("references", compressedData.toString("base64"));
  console.log("Data stored (base64) in Redis successfully");
}

async function createHNSW(data: ReferenceRecord[]) {
  console.log("Creating NHSW");
  const index = new HierarchicalNSW("l2", 14);
  const itemCount = data.length;
  let counter = 0;

  index.initIndex(itemCount);

  data.forEach((each) => {
    (index.addPoint(each.vector, counter),
      counter++,
      console.log(`Adding ${counter}# point to HNSW`));
  });
  index.writeIndex("references.dat");
  console.log("Created NHSW successfully");
}

async function getReferencesFromRedis(): Promise<ReferenceRecord[]> {
  const references = await client.get("references");

  if (references) {
    const compressedBuffer = Buffer.from(references, "base64");
    const decompress = await (await asyncGunzip(compressedBuffer)).toString();
    console.log("Returning references loaded");
    return JSON.parse(decompress) as ReferenceRecord[];
  }

  throw new Error("No references found in redis");
}
