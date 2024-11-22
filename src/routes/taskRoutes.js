import express from 'express';
import { assignTask, completeUserTask, getActiveTasks, getTaskDetails, removeAssigneeFromTask } from '../controllers/taskController.js';

const router = express();

router.get('/active',getActiveTasks);
router.get('/:taskId', getTaskDetails);


router.post('/completion',completeUserTask)
router.post('/assignment', assignTask);
router.delete('/assignee', removeAssigneeFromTask);

export default router;