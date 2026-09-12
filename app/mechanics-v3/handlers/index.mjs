import {applyStatStagesHandler} from './apply-stat-stages.mjs';
import {checkAccuracyHandler} from './check-accuracy.mjs';
import {applyMajorStatusHandler} from './apply-major-status.mjs';
import {applyVolatileStatusHandler} from './apply-volatile-status.mjs';
import {directDamageHandler} from './direct-damage.mjs';
import {spendPpHandler} from './spend-pp.mjs';
import {multiHitDamageHandler} from './multi-hit-damage.mjs';
import {applyRecoilHandler} from './apply-recoil.mjs';
import {applyDrainHandler} from './apply-drain.mjs';
import {fixedDamageHandler} from './fixed-damage.mjs';
import {variablePowerDamageHandler} from './variable-power-damage.mjs';
import {applyProtectionHandler} from './apply-protection.mjs';
import {applySideProtectionHandler} from './apply-side-protection.mjs';
import {breakProtectionHandler} from './break-protection.mjs';
import {applyRedirectionHandler} from './apply-redirection.mjs';

export const HANDLER_DEFINITIONS=[spendPpHandler,breakProtectionHandler,checkAccuracyHandler,directDamageHandler,multiHitDamageHandler,fixedDamageHandler,variablePowerDamageHandler,applyStatStagesHandler,applyMajorStatusHandler,applyVolatileStatusHandler,applyProtectionHandler,applySideProtectionHandler,applyRedirectionHandler,applyRecoilHandler,applyDrainHandler];
