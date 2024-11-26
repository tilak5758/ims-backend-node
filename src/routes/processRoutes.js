import express from 'express';
import { AllgetProcessInstances, deployProcess, getProcessInstanceById, getProcessInstanceDetails, getProcessInstances, getProcessInstancesByRequester, getProcessInstanceVariables, listCompletedProcessInstances, startProcessByKey } from '../controllers/processController.js';


const router = express();

router.post('/deploy',deployProcess)
router.post('/start-by-key',startProcessByKey)

// New api created
router.get('/',AllgetProcessInstances)
// router.get('/process-instances', getProcessInstances);
router.get('/process-instance', getProcessInstanceById);
router.get('/process-instances/completed', listCompletedProcessInstances);
router.get('/process-variables',getProcessInstanceVariables)
router.get('/processInstances-requester',getProcessInstancesByRequester)
router.get('/process-instances',getProcessInstanceDetails)
export default router;