import { JWK } from "node-jose";
import { decode, verify } from 'jsonwebtoken';

export const validateToken = async (token: string): Promise<string> => {
    const jwksURL = process.env.JWKS_URL;

    if (!jwksURL) {
        throw new Error("JWKS_URL is not defined");
    }

    // Fetch the JWKS from the URL
    const response = await fetch(jwksURL);
    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
    }
    const jwks = await response.json();

    const keystore = await JWK.asKeyStore(jwks);

    const decodedToken = decode(token, { complete: true });
    if (!decodedToken) {
        throw new Error("Invalid token");
    }

    const kid = decodedToken?.header.kid;
    if (!kid) {
        throw new Error("Token does not contain a kid");
    }

    const key = keystore.get({ kid });
    if (!key) {
        throw new Error(`Key with kid ${kid} not found in JWKS`);
    }

    // Verify the token
    const payload = verify(token, key.toPEM(false), {
        complete: true
    });
    if (!payload) {
        throw new Error("Token verification failed");
    }

    // Check if the token is expired
    return payload.payload.sub as string;
}