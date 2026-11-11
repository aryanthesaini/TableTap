package com.platform.payment.provider;

/** A restaurant's own merchant account credentials, passed to the provider per call. */
public record MerchantCredentials(String keyId, String keySecret, String webhookSecret, boolean liveMode) {

    @Override
    public String toString() {
        return "MerchantCredentials[keyId=" + keyId + ", liveMode=" + liveMode + "]";
    }
}
