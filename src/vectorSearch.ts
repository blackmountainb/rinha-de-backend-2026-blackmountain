import type { PayloadRequest, NormalizedVector } from "./interfaces.js";
import type { normalizedConstants } from "./interfaces.js";
import { client } from "./redis.js";
import { normalizationConstants } from "./resources.js";
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

export default normalizeRequest;