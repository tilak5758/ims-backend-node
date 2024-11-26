import { zbc } from '../config/camundaConfig.js';  // Assuming the zbc client is configured in this file
import axios from 'axios';
import { config } from 'dotenv';
import { esClient } from '../config/elasticConfig.js';

config()

export const getActiveTasks = async (req, res) => {
    try {
        // Activating jobs from the Zeebe broker
        const tasks = await zbc.activateJobs({
            maxJobsToActivate: 5,
            requestTimeout: 6000,
            timeout: 5 * 60 * 1000,
            type: 'io.camunda.zeebe:userTask',
            worker: 'my-worker-uuid',
        });

        console.log(`Activated ${tasks.length} tasks`);

        // Return tasks data in the response
        res.status(200).json({
            tasks: tasks.map(task => ({
                taskId: task.key,
                processInstanceKey: task.processInstanceKey,
                name: task.type,
                assignee: task.worker,
            })),
        });
    } catch (error) {
        console.error('Error activating tasks:', error);
        res.status(500).json({
            error: 'Error activating tasks',
        });
    }
};

export const getTaskDetails = async (req, res) => {
  const { taskId } = req.params; // Extract taskId from URL

  try {
    const response = await axios({
      method: 'get',
      url: `${process.env.CAMUNDA_API_URL}/v1/tasks/${taskId}`,
      headers: {
        Accept: 'application/json',
      },
      maxBodyLength: Infinity,
    });
    console.log(response.url)

    // Send the response data to the client
    res.status(response.status).json(response.data);
  } catch (error) {
    // Handle errors
    if (error.response) {
      console.error('Error response:', error.response.data);
      res.status(error.response.status).json({
        message: 'Error fetching task details',
        details: error.response.data,
      });
    } else {
      console.error('Error:', error.message);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};

export const completeUserTask = async (req, res) => {
  const { userTaskKey } = req.query; // Extract userTaskKey from the request parameters
  const { variables } = req.body; // Extract variables and action from the request body

  if (!userTaskKey) {
    return res.status(400).json({ message: 'User Task Key is required.' });
  }

  try {
    const response = await axios.post(
      `${process.env.CAMUNDA_API_URL}/v2/user-tasks/${userTaskKey}/completion`,
      { variables},
      { headers: { 'Content-Type': 'application/json' } }
    );

    res.status(200).json({
      message: 'User task completed successfully.',
    });
  } catch (error) {
    console.error('Error completing user task:', error.message);
    res.status(error.response?.status || 500).json({
      message: 'Failed to complete user task.',
      error: error.response?.data || error.message,
    });
  }
};

export const assignTask = async (req, res) => {
  const { userTaskKey } = req.query;
  const { assignee } = req.body;

  if (!userTaskKey || !assignee) {
    return res.status(400).json({
      message: 'User Task Key, Assignee, and Action are required.',
    });
  }

  const data = {
    assignee,
    allowOverride: true,
  };

  try {
    const response = await axios.post(
      `${process.env.CAMUNDA_API_URL}/v2/user-tasks/${userTaskKey}/assignment`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    res.status(200).json({
      message: 'Task assigned successfully.'
    });
  } catch (error) {
    console.error('Error assigning task:', error.message);
    res.status(error.response?.status || 500).json({
      message: 'Failed to assign task.',
      error: error.response?.data || error.message,
    });
  }
};

export const removeAssigneeFromTask = async (req, res) => {
  const { userTaskKey } = req.query;

  if (!userTaskKey) {
    return res.status(400).json({ message: 'User Task Key is required.' });
  }

  try {
    const response = await axios.delete(
      `${process.env.CAMUNDA_API_URL}/v2/user-tasks/${userTaskKey}/assignee`,
    );

    res.status(200).json({
      message: 'Assignee removed successfully.'
    });
  } catch (error) {
    console.error('Error removing assignee:', error.message);
    res.status(error.response?.status || 500).json({
      message: 'Failed to remove assignee.',
      error: error.response?.data || error.message,
    });
  }
};

export const getTasksByAssignee = async (req, res) => {
  const { assignee } = req.query;
  if (!assignee) {
    return res.status(400).json({ error: 'Assignee is required' });
  }
  try {
    const result = await esClient.search({
      index: 'tasks',
      body: { query: { term: { assignee } } },
    });
    const tasks = result.hits.hits.map(hit => hit._source);
    res.status(200).json({ tasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
  }
};

export const getTaskById = async (req, res) => {
  const { id } = req.query;
  try {
    const result = await esClient.get({ index: 'tasks', id });
    res.status(200).json({ task: result._source });
  } catch (error) {
    res.status(404).json({ error: 'Task not found', details: error.message });
  }
};

export const getCompletedTasksByAssignee = async (req, res) => {
  const { assignee } = req.query;
  if (!assignee) {
    return res.status(400).json({ error: 'Assignee is required' });
  }
  try {
    const result = await esClient.search({
      index: 'tasks',
      body: {
        query: {
          bool: {
            must: [{ term: { assignee } }, { term: { status: 'completed' } }],
          },
        },
      },
    });
    const tasks = result.hits.hits.map(hit => hit._source);
    res.status(200).json({ tasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch completed tasks', details: error.message });
  }
};
