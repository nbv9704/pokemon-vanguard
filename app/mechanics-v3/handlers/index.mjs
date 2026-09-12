import {applyStatStagesHandler} from './apply-stat-stages.mjs';
import {directDamageHandler} from './direct-damage.mjs';
import {spendPpHandler} from './spend-pp.mjs';

export const HANDLER_DEFINITIONS=[spendPpHandler,directDamageHandler,applyStatStagesHandler];
