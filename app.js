import express from 'express';
import { Camunda8 } from '@camunda8/sdk';
import chalk from 'chalk';
import { Client } from '@elastic/elasticsearch';
import { config } from 'dotenv';
import axios from 'axios';
import cors from 'cors';
import processRoutes from './src/routes/processRoutes.js'
import taskRoutes from './src/routes/taskRoutes.js'

config();

// Polyfill for `atob` if needed in Node.js
if (typeof atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

// Initialize Camunda 8 client
const c8 = new Camunda8();
const zbc = c8.getZeebeGrpcApiClient();
const zbcRest = c8.getCamundaRestClient();



// Initialize Express server
const app = express();
app.use(express.json());

app.use(cors());

// Optional: Configure CORS for specific origins or methods
// app.use(cors({
//   origin: 'http://example.com', // Replace with your frontend URL
//   methods: ['GET', 'POST'], // Allowed methods
//   allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
// }));


const esClient = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });

app.use('/api/process', processRoutes);
app.use('/api/task',taskRoutes)

// Endpoint to complete a job
app.post('api/complete-job', async (req, res) => {
  const { jobKey, variables } = req.body;

  try {
    await zbc.completeJob({
      jobKey,
      variables: variables || {},
    });

    res.status(200).json({
      message: `Job ${jobKey} completed successfully.`,
    });
  } catch (error) {
    console.error("Error completing job:", error);
    res.status(500).json({
      error: "Error completing job",
    });
  }
});

// Endpoint to get data from Elasticsearch
app.get('api/es/completed-tasks', async (req, res) => {
  const alias = req.query.alias;

  if (!alias) {
    return res.status(400).json({ error: 'Alias query parameter is required' });
  }

  try {
    const result = await esClient.search({
      index: alias,
      body: {
        size: 100,
        query: {
          match: {
            intent: 'COMPLETED',
          },
        },
      },
    });

    if (!result.hits || !result.hits.hits) {
      return res.status(404).json({ error: 'No completed tasks found' });
    }

    const tasks = result.hits.hits.map(hit => ({
      id: hit._id,
      index: hit._index,
      source: {
        partitionId: hit._source?.partitionId,
        jobKind: hit._source?.value?.jobKind,
        jobListenerEventType: hit._source?.value?.jobListenerEventType,
        variables: hit._source?.value?.variables,
        type: hit._source?.value?.type,
        errorMessage: hit._source?.value?.errorMessage,
        errorCode: hit._source?.value?.errorCode,
        tenantId: hit._source?.value?.tenantId,
        timeout: hit._source?.value?.timeout,
        worker: hit._source?.value?.worker,
        elementInstanceKey: hit._source?.value?.elementInstanceKey,
        bpmnProcessId: hit._source?.value?.bpmnProcessId,
        processInstanceKey: hit._source?.value?.processInstanceKey,
        processDefinitionKey: hit._source?.value?.processDefinitionKey,
        elementId: hit._source?.value?.elementId,
        processDefinitionVersion: hit._source?.value?.processDefinitionVersion,
        retries: hit._source?.value?.retries,
      },
      timestamp: hit._source?.timestamp,
      intent: hit._source?.intent,
      rejectionType: hit._source?.rejectionType,
      rejectionReason: hit._source?.rejectionReason,
      recordType: hit._source?.recordType,
    }));

    res.status(200).json({
      message: `Completed tasks retrieved from alias: ${alias}`,
      total: `${alias.length}`,
      tasks,
    });
  } catch (error) {
    console.error('Error retrieving completed tasks:', error);
    res.status(500).json({
      error: 'Error retrieving completed tasks',
      details: error.message,
    });
  }
});

app.post('/api/tasks/search', async (req, res) => {
  try {
    // Get data from request body
    const requestData = req.body;

    // Configure Axios request
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.CAMUNDA_API_URL}/v1/tasks/search`, // Use URL from environment variable
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      data: requestData,
    };

    // Make the request
    const response = await axios(config);

    // Send response back to the client
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error searching tasks:', error.message);

    // Send error response
    res.status(error.response?.status || 500).json({
      message: 'Failed to search tasks',
      error: error.response?.data || error.message,
    });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
