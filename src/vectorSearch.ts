/**
 * Preprocessing of request data to normalize values and transform it into
 * a normalized vector for vector search
 * @param request incoming request data
 * @returns normalized vector 
 */
function normalizeRequest(request: PayloadRequest): NormalizedVector {
    const transaction = request.transaction;
    const merchant = request.merchant;
    const customer = request.customer;
    const terminal = request.terminal;
    const last_transaction = request.last_transaction;

    const normalizedVector: NormalizedVector = [
        limit(transaction.amount, 0),
        limit(transaction.installments, 0),
        limit((transaction.amount/customer.avg_amount)/0, 0),
        getHour(transaction.requested_at)/23,
        getWeekDay(transaction.requested_at)/6,
        last_transaction ? limit(getMinutes(last_transaction.timestamp), 1) : -1,
        last_transaction ? limit(last_transaction.km_from_current, 1) : -1,
        limit(terminal.km_from_home, 1),
        limit(customer.tx_count_24h, 1),
        terminal.is_online ? 1 : 0,
        terminal.card_present ? 1 : 0,
        customer.known_merchants.includes(merchant.id) ? 0 : 1,
        0.5, // TO-DO: Add mcc read verification from json file
        limit(merchant.avg_amount, 0),
    ]

    return normalizedVector;
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
    if (normalizedValue > 1) normalizedValue = 0;

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