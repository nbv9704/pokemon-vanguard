import {MAJOR_STATUS_IDS} from './manifest-contract.mjs';

export const MAJOR_STATUSES=MAJOR_STATUS_IDS;
export {applyMajorStatus,majorStatusBlockReason} from './major-status-state.mjs';
export {majorStatusTurnOptions,speedWithMajorStatus,tryMajorStatusAction} from './major-status-action.mjs';
export {majorStatusEndTurnGroup,prepareMajorStatusEndTurn,resolveMajorStatusEndTurn} from './major-status-residual.mjs';
