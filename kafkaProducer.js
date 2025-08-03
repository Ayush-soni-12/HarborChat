// backend/kafka/producer.js
import { Kafka }  from 'kafkajs';

const kafka = new Kafka({
  clientId: 'harborchat',
  brokers: ['192.168.1.4:9092'],  // If you're running inside Docker network, use 'kafka:9092'
});

const producer = kafka.producer();

export const connectProducer = async () => {
  try {
    await producer.connect();
    console.log('Kafka Producer connected');
  } catch (err) {
    console.error('Error connecting Kafka producer:', err);
  }
};

export const sendMessageToKafka = async (message) => {
  try {
    const key =  message.senderId || 'default';
    await producer.send({
      topic: 'chat-messages',
      messages: [
        {
          key: key.toString(), // ensures all messages of the same key go to same partition
          value: JSON.stringify(message),
        },
      ],
    });
  } catch (err) {
    console.error('Error sending message to Kafka:', err);
  }
};

