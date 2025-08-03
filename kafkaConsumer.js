import { Kafka } from 'kafkajs';
import Message from './modals/Message.js'; // Adjust the path as necessary
import client from "./redisClient.js";

const kafka = new Kafka({
  clientId: 'harborchat-consumer',
  brokers: ['192.168.1.4:9092'], // Use 'kafka:9092' if inside Docker network
});

const consumer = kafka.consumer({ groupId: 'chat-group' });

let buffer = [];
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 60000; // 5 seconds

const flushToMongo = async () => {
  if (buffer.length === 0) return;

  const toInsert = [...buffer]; // copy buffer
  const enrichedMessages = [];

  for (const msg of toInsert) {
    const { _id, senderId, receiverId } = msg;
    const exists = await Message.exists({ _id });
    if (exists) {
      console.log(`⚠️ Skipping duplicate message already in DB: ${_id}`);
      continue;
    }
    const deletedFor = [];

    // const deletedFlag = await client.get(`deletedPendingDB:${msg._id}`);
    // const pinnedKey = `pinnedPendingDB:${_id}`;
    const senderDeletedKey = `deletedPendingDB:${_id}:${senderId}`;
    const receiverDeletedKey = `deletedPendingDB:${_id}:${receiverId}`;
    const deletedForAllKey = `deleteForAll:${_id}`;

   const [senderDeleted, receiverDeleted, deletedForAll] = await Promise.all([
      client.get(senderDeletedKey),
      client.get(receiverDeletedKey),
      client.get(deletedForAllKey),
      // client.get(pinnedKey),
    ]);

    if (deletedForAll === "true") {
      console.log(`🗑️ Skipping deleted message: ${msg._id}`);
      continue; // Skip deleted message
    }

    if (senderDeleted === 'true') deletedFor.push(senderId);
    if (receiverDeleted === 'true') deletedFor.push(receiverId);

        // Default status is 'sent'
    // let status = 'sent';

    // enrichedMessages.push({ ...msg, deletedFor });

    let status = 'sent'; // Default status


    try {
      const ids = [msg.senderId, msg.receiverId].sort();
      const cacheKey = `chat:${ids[0]}:${ids[1]}:${msg.isSecretChat ? 'secret' : 'normal'}`;
      const cached = await client.get(cacheKey);
      // let status = 'sent';

      if (cached) {
        const cachedMessages = JSON.parse(cached);
        const match = cachedMessages.find((m) => m._id === msg._id);
        if (match && match.status === 'read') {
          status = 'read';
        }
        console.log("match",match)
      }

      // enrichedMessages.push({ ...msg, status }); // status updated based on Redis
    } catch (err) {
      console.warn(`⚠️ Redis read failed for message ${msg._id}: ${err.message}`);
      enrichedMessages.push({ ...msg, status: 'sent' }); // fallback
    }
     enrichedMessages.push({ ...msg, deletedFor, status });
  }

  try {
    await Message.insertMany(enrichedMessages, { ordered: false });
        // ✅ Clean up Redis keys
    for (const msg of enrichedMessages) {
      const { _id, senderId, receiverId } = msg;

      await Promise.all([
        client.del(`deletedPendingDB:${_id}:${senderId}`),
        client.del(`deletedPendingDB:${_id}:${receiverId}`),
        client.del(`deleteForAll:${_id}`),
        // client.del(`pinnedPendingDB:${_id}`),
      ]);
    }

    console.log(`✅ Inserted ${enrichedMessages.length} messages into MongoDB`);
  } catch (err) {
    console.error('❌ insertMany failed:', err.message);
  } finally {
    buffer = [];
  }
};


export const startConsumer = async () => {
  await consumer.connect();
  console.log('✅ Kafka Consumer Connected');

  await consumer.subscribe({ topic: 'chat-messages', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        buffer.push(data);

        if (buffer.length >= BATCH_SIZE) {
          await flushToMongo();
        }
      } catch (err) {
        console.error('❌ Failed to parse Kafka message:', err.message);
      }
    },
  });

  // Flush every few seconds if buffer isn't full
  setInterval(flushToMongo, FLUSH_INTERVAL);
};