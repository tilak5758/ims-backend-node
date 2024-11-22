import express from 'express';
import { deployProcess, startProcessByKey } from '../controllers/processController.js';


const router = express();

router.post('/deploy',deployProcess)
router.post('/start-by-key',startProcessByKey)


export default router;