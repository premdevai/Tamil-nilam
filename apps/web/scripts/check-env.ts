import { getPublicEnv, getServerEnv } from '../lib/env';

getServerEnv();
getPublicEnv();

console.log('Web environment is valid');
