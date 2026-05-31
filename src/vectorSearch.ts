import type { PayloadRequest, NormalizedVector } from "./interfaces.js";
import type { normalizedConstants } from "./interfaces.js";
import { client } from "./redis.js";
import { normalizationConstants } from "./resources.js";
import { gunzip } from 'zlib';
import { promisify } from "util";

const asyncGunzip = promisify(gunzip);

/**
 * Preprocessing of request data to normalize values and transform it into
 * a normalized vector for vector search
 * @param request incoming request data
 * @returns normalized vector 
 */
async function normalizeRequest(request: PayloadRequest): Promise<NormalizedVector> {
    const normalizationConfig = await getNormalizationConfig();
    const mccRisk = await getMccRisk();
    const transaction = request.transaction;
    const merchant = request.merchant;
    const customer = request.customer;
    const terminal = request.terminal;
    const last_transaction = request.last_transaction;

    const normalizedVector: NormalizedVector = [
        limit(transaction.amount, normalizationConfig.maxAmount),
        limit(transaction.installments, normalizationConfig.maxInstallments),
        limit((transaction.amount/customer.avg_amount), normalizationConfig.amountVsAvgRatio),
        getHour(transaction.requested_at)/23,
        getWeekDay(transaction.requested_at)/6,
        last_transaction ? limit(getMinutes(last_transaction.timestamp), normalizationConfig.maxMinutes) : -1,
        last_transaction ? limit(last_transaction.km_from_current, normalizationConfig.maxKm) : -1,
        limit(terminal.km_from_home, normalizationConfig.maxKm),
        limit(customer.tx_count_24h, normalizationConfig.maxTxCount24h),
        terminal.is_online ? 1 : 0,
        terminal.card_present ? 1 : 0,
        customer.known_merchants.includes(merchant.id) ? 0 : 1,
        mccRisk ? (mccRisk[merchant.mcc] ?? 0.5) : 0.5,
        limit(merchant.avg_amount, normalizationConfig.maxMerchantAvgAmount),
    ]

    return normalizedVector;
}

/**
 * gets cached normalization constants
 * @returns normalization constant configuration data as JSON
 */
async function getNormalizationConfig(): Promise<normalizedConstants> {
    const cachedData = await client.get('normalizationConstants');
    if (cachedData) {
        return JSON.parse(cachedData) satisfies typeof normalizationConstants;
    }
    throw new Error('Normalization config not found in cache');
}

/**
 * gets cached mcc risk constants
 * @returns merchant risk configuration data as JSON
 */
async function getMccRisk(): Promise<Record<string, number>> {
    const cachedData = await client.get('mccRisk');
    if (cachedData) return JSON.parse(cachedData);

    throw new Error('Mcc risk not found in cache');
}

// cache data retrieval
let referencesCache: Array<{ vector: number[]; label: string}> | null = null;

async function getReferencesFromRedis() {
    const references = await client.get('references');

    if (references) {
        const compressedBuffer = Buffer.from(references, 'base64');
        const decompress = await (await asyncGunzip(compressedBuffer)).toString();

        return JSON.parse(decompress);
    }

    throw new Error('No references found in redis');
}

export async function initReferencesCache() {
    if (!referencesCache) referencesCache = await getReferencesFromRedis();
    return referencesCache;
}

async function getReferences() {
    if (referencesCache) return referencesCache;
    return await initReferencesCache();
}
/** Helpers */

/** 
* Normalizes value based on max amount, keeping the value inside
* of limit interval [0.0, 0.1] 
* @param initialValue - value to normalize
* @param maxValue - normalization constant
* @returns normalized value based on normalization constant definition
**/
function limit(initialValue: number, maxValue: number): number {
    let normalizedValue = initialValue / maxValue;

    if (normalizedValue < 0) normalizedValue = 0;
    if (normalizedValue > 1) normalizedValue = 1;

    return normalizedValue;
}

/**
 * Extracts hour from string in UTC format
 * @param dateTime timestamp in UTC
 * @returns hour range from 0-23 UTC
 */
function getHour(dateTime: string): number {
    const date = new Date(dateTime);
    const hour = date.getHours();

    return hour;
}

/**
 * Gets the day of the week based on timestamp
 * @param dateTime timestamp in UTC
 * @returns day of the week ranging from 0-6 (monday-sunday)
 */
function getWeekDay(dateTime: string): number {
    const date = new Date(dateTime);
    const dayOfWeek = date.getDay();

    return dayOfWeek;
}

/**
 * Gets the minutes based on timestamp
 * @param dateTime timestamp in UTC
 * @returns minutes, from 0-60
 */
function getMinutes(dateTime: string): number {
    const date = new Date(dateTime);
    const minutes = date.getMinutes();

    return minutes;
}

/**Vector search */
function calculateEuclidianDistance(referenceTransaction: number[], newTransaction: number[]) {
    let totalDiffs = 0;
    for (let i=0; i < newTransaction.length; i++) {
        const diff = referenceTransaction[i]! - newTransaction[i]!;
        totalDiffs += Math.pow(diff, 2);
    }

    return Math.sqrt(totalDiffs);
}

async function calculateDistances(newTransaction: NormalizedVector): Promise<Array<{ dist: number; label: string}>> {
    const refs = await getReferences();

    return refs!.map((ref: { vector: number[]; label: string }) => ({
        dist: calculateEuclidianDistance(ref.vector, newTransaction),
        label: ref.label,
    }));
}

function selectKNN(K: number, neighbors: Array<{ dist: number; label: string }>) {
    return [...neighbors]
        .sort((a, b) => a.dist - b.dist)
        .slice(0, K);
}

function countFraud(neighbors: Array<{ dist: number; label: string }>) {
    return neighbors.reduce((count, neighbor) => count + (neighbor.label === 'fraud' ? 1 : 0), 0);
}

function defineFraudScore(neighbors: Array<{ dist: number; label: string }>) {
    const fraudCount = countFraud(neighbors);
    const total = neighbors.length;

    return { fraudRate: total > 0 ? fraudCount / total : 0 };
}

async function classifyTransaction(request: PayloadRequest) {
    const normalizedVector = await normalizeRequest(request);
    // get all euclidian distances
    const euclidianDistances = await calculateDistances(normalizedVector);

    // select number of neighbours 
    const knn = selectKNN(3, euclidianDistances);

    const fraudScore = defineFraudScore(knn);

    return {
        approve: fraudScore.fraudRate < 0.6,
        fraud_score: fraudScore.fraudRate
    };
}

export default classifyTransaction;