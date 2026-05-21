import type { SignalKeyStore } from '../Types';
import type { BinaryNode } from '../WABinary';
/**
 * Check if a stored token is past the rolling cutoff and must not be sent again.
 * Mirrors WAWebTrustedContactsUtils.isTokenExpired.
 */
export declare function isTcTokenExpired(timestamp: number | string | null | undefined): boolean;
/**
 * Returns true when we should fire a fresh privacy_token IQ for this contact:
 * never issued yet, or last issuance is in a previous bucket.
 */
export declare function shouldSendNewTcToken(senderTimestamp: number | undefined): boolean;
type BuildParams = {
    jid: string;
    baseContent?: BinaryNode[];
    keys: SignalKeyStore;
};
/**
 * Resolves the stored tctoken for `jid` and pushes a `<tctoken>` node into
 * `baseContent`. Returns the (possibly mutated) array, or undefined when there
 * is nothing to send and the caller passed no other nodes.
 *
 * Expired entries are cleared opportunistically. We KEEP `senderTimestamp`
 * when wiping the token so `shouldSendNewTcToken` doesn't think we need to
 * issue again right away — the dedupe window must survive token expiry.
 */
export declare function buildTcTokenFromJid({ keys, jid, baseContent }: BuildParams): Promise<BinaryNode[] | undefined>;
type StoreParams = {
    result: BinaryNode;
    fallbackJid: string;
    keys: SignalKeyStore;
};
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
export declare function storeTcTokensFromIqResult({ result, fallbackJid, keys }: StoreParams): Promise<void>;
export {};
