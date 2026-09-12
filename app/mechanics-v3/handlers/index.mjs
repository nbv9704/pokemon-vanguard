import {applyStatStagesHandler} from './apply-stat-stages.mjs';
import {checkAccuracyHandler} from './check-accuracy.mjs';
import {applyMajorStatusHandler} from './apply-major-status.mjs';
import {applyVolatileStatusHandler} from './apply-volatile-status.mjs';
import {directDamageHandler} from './direct-damage.mjs';
import {spendPpHandler} from './spend-pp.mjs';

export const HANDLER_DEFINITIONS=[spendPpHandler,checkAccuracyHandler,directDamageHandler,applyStatStagesHandler,applyMajorStatusHandler,applyVolatileStatusHandler];
