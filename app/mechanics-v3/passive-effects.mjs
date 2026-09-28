import {roomActive} from './rooms.mjs';
import {heldItemEffectActive} from './item-hooks/state.mjs';
import {effectiveWeatherId} from './ability-field.mjs';
import {transientAbilityProfile} from './transient-ability-profiles.mjs';


export function compilePassiveEffects({abilityId=null,itemId=null,manifests}){
 const effects=[];for(const [sourceKind,sourceId] of [['ability',abilityId],['item',itemId]]){
  if(!sourceId||sourceId==='none')continue;const manifest=manifests?.[sourceKind==='ability'?'abilities':'items']?.[sourceId]||(sourceKind==='ability'?transientAbilityProfile(sourceId):null);
  if(!manifest)throw new Error(`unsupported ${sourceKind}: ${sourceId}`);
  if(sourceKind==='item'&&manifest.reviewState==='fail-closed')throw new Error(`unsupported item: ${sourceId} (${manifest.reviewReason||'fail-closed'})`);
  for(const handler of manifest.handlers||[])if(['low-hp-type-boost','held-damage-boost','received-type-damage-reduction','weather-speed','weather-duration','weather-heal','screen-duration','terrain-duration','weather-stat-boost','weather-residual-damage','weather-status-immunity','weather-type-damage-boost','field-type-damage-aura','weather-residual-immunity','weather-incoming-accuracy-modifier','volatile-incoming-accuracy-modifier','type-immunity-boost','type-immunity-response','status-type-immunity-bypass','priority-move-immunity-aura','ally-major-status-immunity','ally-volatile-immunity','ally-stat-drop-immunity','held-item-suppression','grounding-immunity','move-type-conversion','effective-weather-override','outgoing-secondary-effect','turn-order-modifier','opponent-berry-suppression','type-immunity-bypass','end-turn-berry-restore','end-turn-ally-status-cure','item-loss-speed-boost','late-move-power-boost','berry-consumption-heal','weather-suppression','damage-response-disable','sleep-counter-rate','damage-charge-type','entry-item-reveal','stat-drop-reflect','end-turn-random-stat-shift','redirection-immunity','target-pp-pressure','pre-move-type-change','redirection-bypass','entry-fainted-ally-power-boost','stat-change-inversion','stat-change-multiplier','global-move-block','type-redirection','side-condition-bypass','opponent-stat-gain-copy','berry-effect-multiplier','opponent-stage-ignore','berry-replay','berry-threshold-modifier','item-steal-on-hit','item-steal-on-contact','end-turn-item-pickup','held-item-removal-immunity','ally-item-pass','entry-ability-copy','ally-faint-ability-copy','contact-ability-replace','contact-ability-swap','indirect-damage-immunity','entry-danger-sense','opponent-ability-bypass','status-move-reflect','field-type-change','disguise-shield','stance-form-change','entry-transform','entry-illusion','end-turn-form-toggle','switch-out-form-change','received-type-damage-modifier','contact-response','damage-response','ko-stat-boost','end-turn-stat-boost','lethal-hit-survival','stat-drop-response','volatile-immunity','critical-vs-status','status-residual-heal','status-reflect','flinch-stat-boost','critical-damage-boost','base-power-threshold-boost','move-tag-power-boost','move-tag-immunity','remove-contact','move-type-by-tag','secondary-effect-power-boost','stat-multiplier','gender-damage-modifier','weight-modifier','outgoing-accuracy-modifier','contact-power-boost','recoil-power-boost','major-status-immunity','critical-ratio','critical-immunity','stab-modifier','recoil-immunity','received-damage-modifier','contact-protection-pierce','parental-bond','opponent-switch-trap','always-hit','burn-attack-penalty-immunity','stat-drop-immunity','ally-damage-immunity','ally-damage-reduction','ally-ability-stat-multiplier','secondary-effect-immunity','multi-hit-max','weather-status-cure','paralysis-speed-penalty-immunity','switch-out-status-cure','switch-out-heal','random-status-cure','entry-weather','entry-terrain','entry-stat-drop','entry-screen-cleaner','entry-ally-stage-reset','entry-ally-heal','item-end-turn-heal','item-threshold-heal','item-survive-lethal-hit','item-resist-hit','item-status-cure','item-post-move-recoil','item-contact-retaliation','item-damage-heal','item-speed-boost','item-speed-modifier','item-accuracy-boost','item-accuracy-after-target','item-incoming-accuracy-modifier','item-critical-ratio','item-choice-lock','item-negative-stage-reset','item-healing-boost','item-terrain-seed','item-pp-restore','item-airborne','item-grounding','item-force-attacker-switch','item-holder-switch','item-one-shot-damage-boost','item-species-stat-modifier','item-species-critical-ratio','item-consecutive-move-power','item-flinch-chance','item-volatile-cure','item-quick-order','item-binding-damage-boost','item-switch-escape'].includes(handler.id))effects.push({sourceKind,sourceId,kind:handler.id,order:handler.order,...handler.params});
 }
 return effects.sort((a,b)=>a.order-b.order||a.sourceKind.localeCompare(b.sourceKind)||a.sourceId.localeCompare(b.sourceId));
}

export function passiveEffectActive(effect,battle,unit=null){
 if(effect?.sourceKind!=='item')return true;
 if(unit)return heldItemEffectActive(unit,effect,battle);
 return !roomActive(battle,'magic-room');
}

export function receivedDamageModifiers(unit,move,battle,{effectiveness=1,ignoreAbility=false,mechanics=null}={}){
 const applied=(unit?.passiveEffects||[]).filter(effect=>{
  if(ignoreAbility&&effect?.sourceKind==='ability')return false;
  if(!passiveEffectActive(effect,battle,unit))return false;
  if(effect.kind==='received-type-damage-reduction'||effect.kind==='received-type-damage-modifier')return effect.types.includes(move.type);
  if(effect.kind==='received-damage-modifier')return (!effect.requireFullHp||unit.hp===(unit.maxHp??unit.stats?.hp))&&(!effect.superEffective||effectiveness>1)&&(!effect.requireContact||mechanics?.contact===true);
  return false;
 });
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(({sourceKind,sourceId,kind,multiplier})=>({sourceKind,sourceId,kind,multiplier}))};
}

function activeAbilityAura(battle,kind,predicate){
 for(const side of ['A','B'])for(const actorId of battle?.sides?.[side]?.active||[]){const unit=battle.sides[side].roster?.find(entry=>entry.actorId===actorId);if(!unit||unit.hp<=0)continue;const effect=(unit.passiveEffects||[]).find(entry=>entry?.sourceKind==='ability'&&entry.kind===kind&&predicate(entry,unit));if(effect)return {...effect,holderId:unit.actorId};}
 return null;
}

export function passiveDamageModifiers(unit,move,battle,{critical=false,effectiveness=1}={}){
 const applied=[];for(const effect of unit?.passiveEffects||[]){
  if(!passiveEffectActive(effect,battle,unit))continue;
  if(effect.kind==='low-hp-type-boost'&&move.type===effect.type&&unit.hp*effect.hpDenominator<=unit.maxHp)applied.push(effect);
  if(effect.kind==='held-damage-boost'&&((effect.allDamaging===true&&move.category!=='status')||(effect.type&&move.type===effect.type)||(effect.category&&move.category===effect.category)||(effect.superEffective===true&&move.category!=='status'&&effectiveness>1)))applied.push(effect);
  if(effect.kind==='critical-damage-boost'&&critical)applied.push(effect);
  if(effect.kind==='weather-type-damage-boost'&&effect.weather===effectiveWeatherId(battle)&&Array.isArray(effect.types)&&effect.types.includes(move.type))applied.push(effect);
 }
 const aura=move.category!=='status'?activeAbilityAura(battle,'field-type-damage-aura',effect=>effect.type===move.type):null;if(aura)applied.push(aura);
 return {values:applied.map(effect=>effect.multiplier),applied:applied.map(({sourceKind,sourceId,kind,multiplier,holderId})=>({sourceKind,sourceId,kind,multiplier,...(holderId?{holderId}:{})}))};
}
