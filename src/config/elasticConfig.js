import { Client } from '@elastic/elasticsearch';
import { config } from 'dotenv';

config();

// Initialize Elasticsearch client
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',  // Fallback URL if env variable is not set
});

// Example: To verify the connection
async function verifyConnection() {
  try {
    const response = await esClient.info();
    console.log('Connected to Elasticsearch:', response.body);
  } catch (error) {
    console.error('Error connecting to Elasticsearch:', error);
  }
}

verifyConnection();

export { esClient };