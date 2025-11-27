import { createClient, RedisClientType } from 'redis';

export class RedisConnection {
    private publishClient!: RedisClientType;
    private subscribeClient!: RedisClientType;
    private connected: boolean = false;
    private subscriptions: Map<string, (message: string) => void> = new Map();

    async connect() {
        if (this.connected && this.publishClient && this.subscribeClient) return;

        try {
            // Create separate clients for publish and subscribe operations
            this.publishClient = createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });

            this.subscribeClient = createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });

            await this.publishClient.connect();
            await this.subscribeClient.connect();

            this.connected = true;
            console.log('Connected to Redis');
        } catch (error) {
            console.error('Redis connection error:', error);
            console.error('Not connected to Redis Server');
        }
    }

    async publish(channel: string, message: string) {
        try {
            if (!this.publishClient) {
                await this.connect();
            }

            await this.publishClient.publish(channel, message);
        } catch (error) {
            console.error('Redis publish error:', error);
            throw error;
        }
    }

    async subscribe(channel: string, callback: (message: string) => void) {
        try {
            if (!this.subscribeClient) {
                await this.connect();
            }

            // Store callback for potential unsubscription
            this.subscriptions.set(channel, callback);

            await this.subscribeClient.subscribe(channel, (message) => {
                callback(message);
            });

            console.log(`Subscribed to channel: ${channel}`);
        } catch (error) {
            console.error('Redis subscribe error:', error);
            throw error;
        }
    }

    async unsubscribe(channel: string) {
        try {
            if (!this.subscribeClient) {
                await this.connect();
            }

            await this.subscribeClient.unsubscribe(channel);
            this.subscriptions.delete(channel);
            console.log(`Unsubscribed from channel: ${channel}`);
        } catch (error) {
            console.error('Redis unsubscribe error:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.publishClient) await this.publishClient.disconnect();
            if (this.subscribeClient) await this.subscribeClient.disconnect();
            this.connected = false;
        } catch (error) {
            console.error('Redis disconnect error:', error);
        }
    }
}

export const redis = new RedisConnection();