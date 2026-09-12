import {applyStatStagesHandler} from './apply-stat-stages.mjs';
import {checkAccuracyHandler} from './check-accuracy.mjs';
import {applyMajorStatusHandler} from './apply-major-status.mjs';
import {applyVolatileStatusHandler} from './apply-volatile-status.mjs';
import {directDamageHandler} from './direct-damage.mjs';
import {spendPpHandler} from './spend-pp.mjs';
import {multiHitDamageHandler} from './multi-hit-damage.mjs';
import {applyRecoilHandler} from './apply-recoil.mjs';
import {applyDrainHandler} from './apply-drain.mjs';

export const HANDLER_DEFINITIONS=[spendPpHandler,checkAccuracyHandler,directDamageHandler,multiHitDamageHandler,applyStatStagesHandler,applyMajorStatusHandler,applyVolatileStatusHandler,applyRecoilHandler,applyDrainHandler];
