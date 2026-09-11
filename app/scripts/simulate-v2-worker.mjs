import {parentPort,workerData} from 'node:worker_threads';
import {v2Catalog} from '../server/v2-catalog.mjs';
import {simulateV2Match,simulationScheduleSlice} from '../server/v2-simulation.mjs';

const rows=[];for(const entry of simulationScheduleSlice(v2Catalog.aiTeams.exhibition,workerData.start,workerData.count,workerData.seed)){rows.push(simulateV2Match({...entry,catalog:v2Catalog,difficulty:workerData.difficulty}));if(rows.length%500===0)parentPort.postMessage({progress:500});}parentPort.postMessage({rows});
