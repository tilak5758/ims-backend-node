import express from 'express';
import { assignTask, completeUserTask, getActiveTasks, getCompletedTasksByAssignee, getTaskById, getTaskDetails, getTasksByAssignee, removeAssigneeFromTask } from '../controllers/taskController.js';

const router = express();

router.get('/active',getActiveTasks);
router.get('/:taskId', getTaskDetails);

// New api created
router.get('/',getTasksByAssignee)
router.get('/id',getTaskById)
router.get('/completed', getCompletedTasksByAssignee);


router.post('/completion',completeUserTask)
router.post('/assignment', assignTask);
router.delete('/assignee', removeAssigneeFromTask);

export default router;