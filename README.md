# rinha-de-backend-2026-blackmountain

A small TypeScript API for fraud-score classification using normalized transaction features and a nearest-neighbor style search over cached reference examples. This was my first attempted trial to participate in [Rinha de Backend](https://github.com/zanfranceschi/rinha-de-backend-2026/tree/main#rinha-de-backend-2026--fraud-detection), a competition of backend with proposed architecture and constraints of performance. I did not submited my trial due to not reaching speed/memory constraints rules, the first approach described below had a performance of 3500-4500ms/request, while the second could not run due to memory constrains - using HNSW costs more memory than the challenge proposes, even though the speed improved massively and was around 10-20ms/request. 

## What this project does

- Receives a transaction payload through the `/api/fraud-score` endpoint.
- Normalizes the request into a fixed-size vector.
- Uses the cached reference dataset and a vector-search strategy to estimate a fraud score.
- Returns a simple decision (`approved`) and a fraud score.

## Stack

- TypeScript + Express
- Redis for cached normalization and reference data
- Docker / Docker Compose for local orchestration
- Nginx in front of the API instances

## Run locally

```bash
make up
```

The API will be available on port `9999` through the Nginx entrypoint.

## Vector search history

This project went through two main experiments in the `src/vectorSearch.ts` path:

1. Euclidean-distance baseline
   - Commit: `eb278d1` — "Create euclidian distance vector search"
   - Approach: compute pairwise Euclidean distances between the normalized request and all cached references, then keep the top 3 neighbors.
   - Purpose: simple and easy to reason about; this was the first practical baseline for the fraud-score heuristic.

2. HNSW trial
   - Commit: `37ee933` — "Vector search updates for using hnsw"
   - Approach: introduce `hnswlib-node` and an HNSW index path for nearest-neighbor lookup.
   - Intended goal: make the KNN stage faster by replacing the full-distance scan with an approximate search structure.
   - Outcome: this trial was meant to be a performance experiment, but it did not behave as expected in practice for this project - the memory constaints cause OOM with docker usage. The HNSW path remained an experimental attempt rather than a proven speed-up over the simpler baseline.

## Notes about the HNSW experiment

- The HNSW trial was added as a performance-oriented experiment in the vector-search path.
- The project keeps this code as part of the history, but the outcome was not satisfactory enough to treat it as a reliable improvement for this setup.
- In other words: the HNSW work was an interesting trial, but it did not deliver the expected practical benefit in this repository.

## Current status

The service currently uses the vector-search logic in `src/vectorSearch.ts` and the fraud-score route in `src/routes/fraudScore.ts` to return a fraud score for incoming transactions.
