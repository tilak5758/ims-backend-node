import { zbc, zbcRest } from '../config/camundaConfig.js';  // Import from the config
import path from 'path'
import axios from 'axios';
import { log } from '../utils/logger.js';


// Example controller function to deploy a process
export const deployProcess = async (req, res) => {
  try {
    
    const deploymentResult = await zbc.deployResource({
      processFilename: path.join(process.cwd(), 'resources', 'process_flow_test.bpmn'),
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
    const  {variables} = req.body;

    // Validate processDefinitionId
    if (!processDefinitionId) {
      return res.status(400).json({ message: 'Process Definition ID is required' });
    }

    // Call the Camunda API to start the process instance
    const response = await axios.post(
      `${process.env.CAMUNDA_API_URL}/v2/process-instances`,
      
        {processDefinitionId , variables},
      
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Return success response with process data
    res.status(201).json({
      message: 'Process instance created successfully',
      data: response.data,
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

