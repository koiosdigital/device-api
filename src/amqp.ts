import client, { Connection, Channel, ConsumeMessage, ChannelModel } from "amqplib";

export class AMQPConnection {
    channelModel!: ChannelModel;
    channel!: Channel;
    private connected!: Boolean;

    private consumerTags: string[] = [];

    async connect() {
        if (this.connected && this.channel) return;
        else this.connected = true;

        try {
            console.log(`⌛️ Connecting to RabbitMQ Server`);
            this.channelModel = await client.connect(
                process.env.RABBITMQ_URL || ''
            );

            console.log(`✅ Rabbit MQ Connection is ready`);

            this.channel = await this.channelModel.createChannel();

            console.log(`🛸 Created RabbitMQ Channel successfully`);
        } catch (error) {
            console.error(error);
            console.error(`Not connected to MQ Server`);
        }
    }

    async sendToQueue(queue: string, message: string) {
        try {
            if (!this.channel) {
                await this.connect();
            }

            console.log(`🛸 Sending message to queue ${queue}: ${message}`);
            this.channel.sendToQueue(queue, Buffer.from(message));
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async registerQueueCallback(
        queue: string,
        callback: (msg: ConsumeMessage | null) => void
    ) {
        try {
            if (!this.channel) {
                await this.connect();
            }

            if (this.consumerTags.includes(queue)) {
                await this.channel.cancel(queue);
                this.consumerTags = this.consumerTags.filter(
                    (tag) => tag !== queue
                );
            }

            await this.channel.assertQueue(queue, { durable: false, autoDelete: true });
            this.channel.consume(queue, callback, { noAck: false, consumerTag: queue });
            this.consumerTags.push(queue);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async deregisterQueueCallback(queue: string) {
        try {
            if (!this.channel) {
                await this.connect();
            }

            await this.channel.cancel(queue);
            this.consumerTags = this.consumerTags.filter((tag) => tag !== queue);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export const amqp = new AMQPConnection();