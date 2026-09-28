// UI owns its transport import boundary; authored action contracts have one
// source of truth in the neutral runtime type declarations.
export type {ReviewedMutation} from '../../../types/runtime-contracts.js';
export type ShopPurchase = Extract<import('../../../types/runtime-contracts.js').ReviewedMutation,{type:'shopV3.buy'}>;
