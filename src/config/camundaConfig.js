import { Camunda8 } from '@camunda8/sdk';
import { config } from 'dotenv';

config()

// Initialize the Camunda 8 client
const c8 = new Camunda8();
const zbc = c8.getZeebeGrpcApiClient();
const zbcRest = c8.getCamundaRestClient();

// Export the initialized clients for use in other files
export { zbc, zbcRest };
