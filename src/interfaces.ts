export interface PayloadRequest {
    id: string,
    transaction: Transaction,
    customer: Customer,
    merchant: Merchant,
    terminal: Terminal,
    last_transaction: LastTransaction | null
}

interface Transaction {
    amount: number,
    installments: number,
    requested_at: string
}

interface Customer {
    avg_amount: number,
    tx_count_24h: number,
    known_merchants: string[]
}

interface Merchant {
    id: string,
    mcc: string,
    avg_amount: number
}

interface Terminal {
    is_online: boolean,
    card_present: boolean,
    km_from_home: number
}

interface LastTransaction {
    timestamp: string,
    km_from_current: number
}

interface APIResponse {
    approved: boolean,
    fraud_score: number
}

export type NormalizedVector = [
    amount: number,
    installments: number,
    amountVsAvg: number,
    hourOfDay: number,
    weekDay: number,
    minutesSinceLastTx: number,
    kmFromLastTx: number,
    kmFromHome: number,
    txCount24h: number,
    isOnline: number,
    cardPresent: number,
    uknownMerchant: number,
    mccRisk: number,
    merchantAvgAmount: number
]

export interface normalizedConstants {
    maxAmount: number;
    maxInstallments: number;
    amountVsAvgRatio: number;
    maxMinutes: number;
    maxKm: number;
    maxTxCount24h: number;
    maxMerchantAvgAmount: number;
}