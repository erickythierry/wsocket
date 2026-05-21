"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTcTokenExpired = isTcTokenExpired;
exports.shouldSendNewTcToken = shouldSendNewTcToken;
exports.buildTcTokenFromJid = buildTcTokenFromJid;
exports.storeTcTokensFromIqResult = storeTcTokensFromIqResult;
const WABinary_1 = require("../WABinary");
/** 7 days in seconds — matches WA Web AB prop tctoken_duration */
const TC_TOKEN_BUCKET_DURATION = 604800;
/** 4 buckets → ~28-day rolling window — matches WA Web AB prop tctoken_num_buckets */
const TC_TOKEN_NUM_BUCKETS = 4;
/**
 * Check if a stored token is past the rolling cutoff and must not be sent again.
 * Mirrors WAWebTrustedContactsUtils.isTokenExpired.
 */
function isTcTokenExpired(timestamp) {
    if (timestamp === null || timestamp === undefined)
        return true;
    const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    if (isNaN(ts))
        return true;
    const now = Math.floor(Date.now() / 1000);
    const currentBucket = Math.floor(now / TC_TOKEN_BUCKET_DURATION);
    const cutoffBucket = currentBucket - (TC_TOKEN_NUM_BUCKETS - 1);
    const cutoffTimestamp = cutoffBucket * TC_TOKEN_BUCKET_DURATION;
    return ts < cutoffTimestamp;
}
/**
 * Returns true when we should fire a fresh privacy_token IQ for this contact:
 * never issued yet, or last issuance is in a previous bucket.
 */
function shouldSendNewTcToken(senderTimestamp) {
    if (senderTimestamp === undefined)
        return true;
    const now = Math.floor(Date.now() / 1000);
    const currentBucket = Math.floor(now / TC_TOKEN_BUCKET_DURATION);
    const senderBucket = Math.floor(senderTimestamp / TC_TOKEN_BUCKET_DURATION);
    return currentBucket > senderBucket;
}
/**
 * Resolves the stored tctoken for `jid` and pushes a `<tctoken>` node into
 * `baseContent`. Returns the (possibly mutated) array, or undefined when there
 * is nothing to send and the caller passed no other nodes.
 *
 * Expired entries are cleared opportunistically. We KEEP `senderTimestamp`
 * when wiping the token so `shouldSendNewTcToken` doesn't think we need to
 * issue again right away — the dedupe window must survive token expiry.
 */
async function buildTcTokenFromJid({ keys, jid, baseContent = [] }) {
    try {
        const storageJid = (0, WABinary_1.jidNormalizedUser)(jid);
        const data = await keys.get('contacts-tc-token', [storageJid]);
        const entry = data === null || data === void 0 ? void 0 : data[storageJid];
        const tcTokenBuffer = entry === null || entry === void 0 ? void 0 : entry.token;
        if (!(tcTokenBuffer === null || tcTokenBuffer === void 0 ? void 0 : tcTokenBuffer.length) || isTcTokenExpired(entry === null || entry === void 0 ? void 0 : entry.timestamp)) {
            if (tcTokenBuffer) {
                const cleared = (entry === null || entry === void 0 ? void 0 : entry.senderTimestamp) !== undefined
                    ? { token: Buffer.alloc(0), senderTimestamp: entry.senderTimestamp }
                    : null;
                await keys.set({ 'contacts-tc-token': { [storageJid]: cleared } });
            }
            return baseContent.length > 0 ? baseContent : undefined;
        }
        baseContent.push({
            tag: 'tctoken',
            attrs: {},
            content: tcTokenBuffer
        });
        return baseContent;
    }
    catch (_a) {
        return baseContent.length > 0 ? baseContent : undefined;
    }
}
/**
 * Walk the `<tokens><token .../></tokens>` block of an IQ result / notification
 * and persist each `trusted_contact` token under `contacts-tc-token`.
 *
 * - `fallbackJid` is used when the token node omits `jid` (typical for the IQ
 *   response path; in `privacy_token` notifications, attrs.jid is your own
 *   device JID and must NOT be used).
 * - Timestamp monotonicity guard prevents downgrading a fresh token with a
 *   stale one.
 * - Tokens without `t` are dropped — without a timestamp they'd be treated
 *   as immediately expired on the next read.
 */
async function storeTcTokensFromIqResult({ result, fallbackJid, keys }) {
    const tokensNode = (0, WABinary_1.getBinaryNodeChild)(result, 'tokens');
    if (!tokensNode)
        return;
    const tokenNodes = (0, WABinary_1.getBinaryNodeChildren)(tokensNode, 'token');
    for (const tokenNode of tokenNodes) {
        if (tokenNode.attrs.type !== 'trusted_contact' || !(tokenNode.content instanceof Uint8Array)) {
            continue;
        }
        const storageJid = (0, WABinary_1.jidNormalizedUser)(fallbackJid || tokenNode.attrs.jid);
        if (!storageJid)
            continue;
        const incomingTs = tokenNode.attrs.t ? Number(tokenNode.attrs.t) : 0;
        if (!incomingTs)
            continue;
        const existing = await keys.get('contacts-tc-token', [storageJid]);
        const existingEntry = existing[storageJid];
        const existingTs = (existingEntry === null || existingEntry === void 0 ? void 0 : existingEntry.timestamp) ? Number(existingEntry.timestamp) : 0;
        if (existingTs > 0 && existingTs > incomingTs)
            continue;
        await keys.set({
            'contacts-tc-token': {
                [storageJid]: {
                    ...existingEntry,
                    token: Buffer.from(tokenNode.content),
                    timestamp: tokenNode.attrs.t
                }
            }
        });
    }
}
