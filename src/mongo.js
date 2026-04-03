const { MongoClient } = require('mongodb');

let client = null;

async function connectToMongo() {
  if (client) return client;

  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client;
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    throw error;
  }
}

function getMongoClient() {
  if (!client) {
    throw new Error('Database not connected. Call connectToMongo first.');
  }
  return client;
}

module.exports = {
  connectToMongo,
  getMongoClient,
};
