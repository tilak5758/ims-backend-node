import { zbc, zbcRest } from '../config/camundaConfig.js';  // Import from the config
import path from 'path'
import axios from 'axios';
import { log } from '../utils/logger.js';
import { esClient } from '../config/elasticConfig.js';
import { constructOAuthProvider } from '@camunda8/sdk/dist/lib/ConstructOAuthProvider.js';


// Example controller function to deploy a process
export const deployProcess = async (req, res) => {
  try {

    const deploymentResult = await zbc.deployResource({
      processFilename: path.join(process.cwd(), 'resources', 'incident_management_workflow.bpmn'),
    });
    const deployedProcessId = deploymentResult.deployments[0].process.bpmnProcessId;
    console.log(`Deployed process ${deployedProcessId}`);
    res.status(200).json({ message: `Deployed process ${deployedProcessId}` });

  } catch (error) {
    console.error("Error deploying process:", error);
    res.status(500).json({ error: "Error deploying process" });
  }
};
export const startProcessByKey = async (req, res) => {
  try {
    const { processDefinitionId } = req.query;
    const variables = req.body; // Expecting key-value pairs in the body

    // Validate processDefinitionId
    if (!processDefinitionId) {
      return res.status(400).json({ message: 'Process Definition ID is required' });
    }

    // Convert key-value pairs into the Camunda variables format
    const formattedVariables = Object.entries(variables).reduce((acc, [key, value]) => {
      acc[key] = {
        value: value, // Assign the value
        type: typeof value === 'number' ? 'Integer' : typeof value === 'boolean' ? 'Boolean' : 'String', // Infer type
      };
      return acc;
    }, {});

    // Call the Camunda API to start the process instance
    const response = await axios.post(
      `${process.env.CAMUNDA_API_URL}/v2/process-instances`,
      { processDefinitionId, variables: variables },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Return success response with process data and passed variables
    res.status(201).json({
      message: 'Process instance created successfully',
      data: {
        processDefinitionKey: response.data.processDefinitionKey,
        processDefinitionId: response.data.processDefinitionId,
        processDefinitionVersion: response.data.processDefinitionVersion,
        processInstanceKey: response.data.processInstanceKey,
        tenantId: response.data.tenantId,
        variables: variables, // Include the original variables here
      },
    });
  } catch (error) {
    // Log the error and return the response with error details
    console.error('Error creating process instance:', error.message);
    res.status(error.response?.status || 500).json({
      message: 'Failed to create process instance',
      error: error.response?.data || error.message,
    });
  }
};


export const getProcessInstances = async (req, res) => {
  const { requester } = req.query;
  if (!requester) {
    return res.status(400).json({ error: 'Requester is required' });
  }
  try {
    const result = await esClient.search({
      index: 'zeebe-record-process-instance-creation',
      body: { query: { term: { requester } } },
    });
    console.log(result)
    const instances = result.hits.hits.map(hit => hit._source);
    res.status(200).json({ instances });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch process instances', details: error.message });
  }
};

export const AllgetProcessInstances = async (req, res) => {
  try {
    const result = await esClient.search({
      index: 'zeebe-record-process-instance',
      body: {
        query: {
          match_all: {}  // This will fetch all documents from the 'process_instances' index
        },
      },
    });

    const instances = result.hits.hits.map(hit => hit._source);
    res.status(200).json({ instances });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch process instances', details: error.message });
  }
};

export const getProcessInstanceById = async (req, res) => {
  const { id } = req.query;
  try {
    const result = await esClient.get({ index: 'zeebe-record-process-instance-creation', id });
    res.status(200).json({ instance: result._source });
  } catch (error) {
    res.status(404).json({ error: 'Process instance not found', details: error.message });
  }
};

export const listCompletedProcessInstances = async (req, res) => {
  const { requester } = req.query;
  if (!requester) {
    return res.status(400).json({ error: 'Requester is required' });
  }
  try {
    const result = await esClient.search({
      index: 'zeebe-record-process-instance-creation',
      body: {
        query: {
          bool: {
            must: [{ term: { requester } }, { term: { status: 'completed' } }],
          },
        },
      },
    });
    const instances = result.hits.hits.map(hit => hit._source);
    res.status(200).json({ instances });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch completed process instances', details: error.message });
  }
};

export const getProcessInstanceVariables = async (req, res) => {
  const { processInstanceKey } = req.query; // Get processInstanceKey from query

  if (!processInstanceKey) {
    return res.status(400).json({ error: 'processInstanceKey is required' });
  }

  try {
    // Elasticsearch query to search by processInstanceKey using term query for exact match
    const result = await esClient.search({
      index: 'zeebe-record-variable', // Your index name
      body: {
        query: {
          term: { 'value.processInstanceKey': processInstanceKey } // Match processInstanceKey in the value object
        },
        size: 100, // Adjust number of results as needed
        _source: ['value.name', 'value.value'], // Only return relevant fields
      },
    });

    // Check if any hits were found
    if (result.hits.total.value === 0) {
      return res.status(200).json({ instances: [] }); // No instances found
    }

    // Map the result to a custom structure
    const variables = result.hits.hits.map(hit => ({
      name: hit._source.value.name,
      value: hit._source.value.value,
    }));

    res.status(200).json({ processInstanceKey, variables }); // Send the variables as response
  } catch (error) {
    console.error('Error fetching process instance variables:', error);
    res.status(500).json({ error: 'Failed to fetch process instance variables', details: error.message });
  }
};

export const getProcessInstancesByRequester = async (req, res) => {
  // const { requester } = req.query; // Get 'requester' from query parameters

  // if (!requester) {
  //   return res.status(400).json({ error: "'requester' is required" });
  // }

  try {
    // Fetch process instances with the given requester variable
    const variablesResult = await esClient.search({
      index: 'zeebe-record-variable', // Your index name
      body: {
        query: {
          term: { 'value.name': 'location' }
        },
        size: 100, // Adjust number of results as needed
        _source: ['value.processInstanceKey'], // Only return the processInstanceKey field
      },
    });

    // Check if no variables are found
    if (variablesResult.hits.total.value === 0) {
      return res.status(200).json({ processInstances: [] }); // No matching variables found
    }

    // Extract the processInstanceKeys from the variables result
    const processInstanceKeys = variablesResult.hits.hits.map(hit => hit._source.value.processInstanceKey);

    // Fetch process instance details using the processInstanceKeys
    const processInstancesResult = await esClient.search({
      index: 'zeebe-record-process-instance', // Process instance index
      body: {
        query: {
          terms: { 'value.processInstanceKey': processInstanceKeys }, // Filter process instances by keys
        },
        size: processInstanceKeys.length, // Only return relevant process instances
        _source: true, // Fetch all fields for the process instance
      },
    });

    // Check if no process instances are found
    if (processInstancesResult.hits.total.value === 0) {
      return res.status(404).json({ error: 'No process instances found' });
    }

    // Map the process instance details
    const processInstances = processInstancesResult.hits.hits.map(hit => hit._source.value);

    // For each process instance, fetch its associated variables
    const processInstancesWithVariables = await Promise.all(
      processInstances.map(async (processInstance) => {
        // Fetch variables for each process instance
        const variablesForInstanceResult = await esClient.search({
          index: 'zeebe-record-variable', // Variables index
          body: {
            query: {
              term: { 'value.processInstanceKey': processInstance.processInstanceKey }, // Match the processInstanceKey
            },
            size: 100, // Adjust the number of results as needed
            _source: ['value.name', 'value.value'], // Fetch variable name and value
          },
        });

        // Map variables for the current process instance
        const variables = variablesForInstanceResult.hits.hits.map(hit => ({
          name: hit._source.value.name,
          value: hit._source.value.value,
        }));

        return {
          processInstance,
          variables,
        };
      })
    );

    // Send the response with process instances and their variables
    res.status(200).json({
      processInstances: processInstancesWithVariables,
    });
  } catch (error) {
    console.error('Error fetching process instances by requester:', error);
    res.status(500).json({
      error: 'Failed to fetch process instances by requester',
      details: error.message,
    });
  }
};

export const getProcessInstanceDetails = async (req, res) => {
  const { processInstanceKey } = req.query; // Get processInstanceKey from query params

  if (!processInstanceKey) {
    return res.status(400).json({ error: 'processInstanceKey is required' });
  }

  try {
    // Fetch process instance details
    const processInstanceResult = await esClient.search({
      index: 'zeebe-record-process-instance', // Process instance index
      body: {
        query: {
          term: { 'value.processInstanceKey': processInstanceKey },
          term: { "value.intent": "value.ELEMENT_ACTIVATED" }
        },
        _source: true, // Adjust fields as needed
        size: 1000, // One process instance expected
      },
    });

    if (processInstanceResult.hits.total.value === 0) {
      return res.status(404).json({ error: 'Process instance not found' });
    }

    const processInstance = processInstanceResult.hits.hits.map(value => value._source);

    // Fetch associated variables
    const variablesResult = await esClient.search({
      index: 'zeebe-record-variable', // Variables index
      body: {
        query: {
          term: { 'value.processInstanceKey': processInstanceKey }, // Match processInstanceKey in variables
        },
        _source: ['value.name', 'value.value'], // Fetch variable name and value
        size: 100, // Adjust number of results as needed
      },
    });



    const variables = variablesResult.hits.hits.map((hit) => ({
      name: hit._source.value.name,
      value: hit._source.value.value,
    }));

    // Combine process instance details with variables
    res.status(200).json({
      processInstanceKey,
      ...processInstance,  // Include all process instance fields
      variables,           // Add associated variables here

    });
  } catch (error) {
    console.error('Error fetching process instance details:', error);
    res.status(500).json({
      error: 'Failed to fetch process instance details',
      details: error.message,
    });
  }
};

