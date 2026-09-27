// Keep the Social retry policy separate from the main game client.
export function createSocialRetryController({outbox,sendAction,isBusy,isConnected,notify=()=>{},onChange=()=>{}}){
 const canRetry=()=>isConnected()&&!isBusy();
 const send=action=>{
  if(isBusy()){notify('Wait for your current action to finish.');return false;}
  if(!outbox.begin(action)){notify('Resolve the pending Social action before sending another.');return false;}
  if(!outbox.persistent)notify('Browser session storage is unavailable; your pending Social action may not survive a reload.');
  const sent=sendAction(action);if(!sent)onChange();return sent;
 };
 const retry=()=>{
  if(!canRetry()){notify('Wait until your connection is ready.');return false;}
  const sent=outbox.retry(sendAction);if(!sent)onChange();return sent;
 };
 return {send,retry,canRetry};
}
