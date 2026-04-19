const SenderChainKey = require('./sender_chain_key');
const SenderMessageKey = require('./sender_message_key');

const protobufs = require('./protobufs');

class SenderKeyState {
    MAX_MESSAGE_KEYS = 2000;

    constructor(
        id = null,
        iteration = null,
        chainKey = null,
        signatureKeyPair = null,
        signatureKeyPublic = null,
        signatureKeyPrivate = null,
        senderKeyStateStructure = null
    ) {
        if (senderKeyStateStructure) {
            this.senderKeyStateStructure = senderKeyStateStructure;
        } else {
            if (signatureKeyPair) {
                signatureKeyPublic = signatureKeyPair.public;
                signatureKeyPrivate = signatureKeyPair.private;
            }

            chainKey = typeof chainKey === 'string' ? Buffer.from(chainKey, 'base64') : chainKey;
            this.senderKeyStateStructure = protobufs.SenderKeyStateStructure.create();
            const senderChainKeyStructure = protobufs.SenderChainKey.create();
            senderChainKeyStructure.iteration = iteration;
            senderChainKeyStructure.seed = chainKey;
            this.senderKeyStateStructure.senderChainKey = senderChainKeyStructure;

            const signingKeyStructure = protobufs.SenderSigningKey.create();
            signingKeyStructure.public =
                typeof signatureKeyPublic === 'string' ?
                Buffer.from(signatureKeyPublic, 'base64') :
                signatureKeyPublic;
            if (signatureKeyPrivate) {
                signingKeyStructure.private =
                    typeof signatureKeyPrivate === 'string' ?
                    Buffer.from(signatureKeyPrivate, 'base64') :
                    signatureKeyPrivate;
            }
            this.senderKeyStateStructure.senderKeyId = id;
            this.senderChainKey = senderChainKeyStructure;
            this.senderKeyStateStructure.senderSigningKey = signingKeyStructure;
        }
        this.senderKeyStateStructure.senderMessageKeys =
            this.senderKeyStateStructure.senderMessageKeys || [];
    }

    SenderKeyState(senderKeyStateStructure) {
        this.senderKeyStateStructure = senderKeyStateStructure;
    }

    getKeyId() {
        return this.senderKeyStateStructure.senderKeyId;
    }

    getSenderChainKey() {
        return new SenderChainKey(
            this.senderKeyStateStructure.senderChainKey.iteration,
            this.senderKeyStateStructure.senderChainKey.seed
        );
    }

    setSenderChainKey(chainKey) {
        const senderChainKeyStructure = protobufs.SenderChainKey.create({
            iteration: chainKey.getIteration(),
            seed: chainKey.getSeed(),
        });
        this.senderKeyStateStructure.senderChainKey = senderChainKeyStructure;
    }

    getSigningKeyPublic() {
        return typeof this.senderKeyStateStructure.senderSigningKey.public === 'string' ?
            Buffer.from(this.senderKeyStateStructure.senderSigningKey.public, 'base64') :
            this.senderKeyStateStructure.senderSigningKey.public;
    }

    getSigningKeyPrivate() {
        return typeof this.senderKeyStateStructure.senderSigningKey.private === 'string' ?
            Buffer.from(this.senderKeyStateStructure.senderSigningKey.private, 'base64') :
            this.senderKeyStateStructure.senderSigningKey.private;
    }

    hasSenderMessageKey(iteration) {
        return this.senderKeyStateStructure.senderMessageKeys.some(
            key => key.iteration === iteration
        );
    }

    addSenderMessageKey(senderMessageKey) {
        const iteration = senderMessageKey.getIteration();
        const seed = senderMessageKey.getSeed();

        if (iteration !== undefined && seed !== undefined) {
            this.senderKeyStateStructure.senderMessageKeys.push({ iteration, seed });
        }

        if (this.senderKeyStateStructure.senderMessageKeys.length > this.MAX_MESSAGE_KEYS) {
            this.senderKeyStateStructure.senderMessageKeys.shift();
        }
    }

    removeSenderMessageKey(iteration) {
        const index = this.senderKeyStateStructure.senderMessageKeys.findIndex(
            key => key.iteration === iteration
        );
        if (index !== -1) {
            const messageKey = this.senderKeyStateStructure.senderMessageKeys[index];
            this.senderKeyStateStructure.senderMessageKeys.splice(index, 1);
            return new SenderMessageKey(messageKey.iteration, messageKey.seed);
        }
        return null;
    }

    getStructure() {
        return this.senderKeyStateStructure;
    }
}

module.exports = SenderKeyState;