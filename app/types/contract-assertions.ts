import type {CommandOutcome, ReviewedMutation, StoragePort, SaveState} from './runtime-contracts.js';
import type {ServerActionAck, ServerEnvelope, ConnectionOptions} from '../public/js/types/browser-contracts.js';
import {assertStoragePort} from '../server/storage-port.mjs';

// This module is compile-only. It must never construct storage or touch a save.
declare const port: StoragePort;
const checked: StoragePort = assertStoragePort(port);
void checked;
// @ts-expect-error a storage port must provide atomic pair save
const invalidPort: StoragePort={load:async()=>null,save:async()=>{}};
// @ts-expect-error writing a string is not writing a JSON save state
port.save('test','not-a-save');
void invalidPort;

const ok:CommandOutcome<SaveState>={ok:true,state:{schemaVersion:3,revision:0}};
if(ok.ok){const state:SaveState=ok.state;void state;}
// @ts-expect-error successful commits require a state
const missingState:CommandOutcome<SaveState>={ok:true};
// @ts-expect-error failed outcomes must provide a code
const missingFailureCode:CommandOutcome<SaveState>={ok:false};
void missingState;void missingFailureCode;
const buy:ReviewedMutation={type:'shopV3.buy',actionId:'a',itemId:'focus-sash',payment:'ticket'};
// @ts-expect-error a reviewed purchase cannot spend an arbitrary payment method
const invalidPayment:ReviewedMutation={type:'shopV3.buy',actionId:'a',itemId:'focus-sash',payment:'free'};
// @ts-expect-error a social message must carry accountId
const invalidChat:ReviewedMutation={type:'socialV1.chat.send',actionId:'a',text:'hi'};
// @ts-expect-error rankProtection.enabled must be boolean, not a string
const invalidRankProtection:ReviewedMutation={type:'bagV1.rankProtection',actionId:'a',enabled:'yes'};
void buy;void invalidPayment;void invalidChat;void invalidRankProtection;
const ack:ServerActionAck={type:'action-ack',actionId:'abc',actionType:'shopV3.buy',committedRevision:1};
const message:ServerEnvelope=ack;
// @ts-expect-error ACK must carry a durable action ID
const invalidAck:ServerActionAck={type:'action-ack',actionType:'shopV3.buy'};
const options:ConnectionOptions={url:'ws://example.test/ws/room',playerId:'room',WebSocketImpl: WebSocket};
void message;void invalidAck;void options;
