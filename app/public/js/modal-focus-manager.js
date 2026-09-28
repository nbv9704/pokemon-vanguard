// The modal is a sibling of #app. Keep the game inert while it is open so
// keyboard and assistive-technology users cannot reach controls behind it.
const FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export class ModalFocusManager {
 constructor({documentRef = document, modalSelector = '#modal', backgroundSelector = '#app'} = {}) {
  this.document = documentRef;
  this.modalSelector = modalSelector;
  this.backgroundSelector = backgroundSelector;
  this.returnFocus = null;
  this.backgroundWasInert = null;
  this.opened = false;
 }
 get modal() { return this.document.querySelector(this.modalSelector); }
 get background() { return this.document.querySelector(this.backgroundSelector); }
 focusable() {
  const modal = this.modal;
  if (!modal) return [];
  return [...modal.querySelectorAll(FOCUSABLE)].filter(element => !element.hidden &&
   element.getAttribute('aria-hidden') !== 'true' &&
   (typeof element.getClientRects !== 'function' || element.getClientRects().length > 0));
 }
 focusFirst() {
  const target = this.focusable()[0] || this.modal?.querySelector('[role="dialog"],[role="alertdialog"]');
  if (target) {
   if (!target.hasAttribute('tabindex') && !this.focusable().length) target.setAttribute('tabindex', '-1');
   target.focus({preventScroll:true});
  }
 }
 open() {
  if (!this.modal?.children.length) return;
  if (!this.opened) {
   this.opened = true;
   this.returnFocus = this.document.activeElement;
   const background = this.background;
   if (background) { this.backgroundWasInert = background.inert; background.inert = true; }
  }
  queueMicrotask(() => { if (this.opened && this.modal?.children.length) this.focusFirst(); });
 }
 close() {
  if (!this.opened) return;
  this.opened = false;
  const background = this.background;
  if (background && this.backgroundWasInert !== null) background.inert = this.backgroundWasInert;
  this.backgroundWasInert = null;
  const previous = this.returnFocus;
  this.returnFocus = null;
  queueMicrotask(() => {
   if (this.opened) return;
   if (previous?.isConnected && !previous.closest?.('[inert]')) previous.focus({preventScroll:true});
   else {
    const fallback = this.document.querySelector('[aria-current="page"], [data-action="account-menu"], #app button, #app a[href]');
    if (fallback && !fallback.closest?.('[inert]')) fallback.focus({preventScroll:true});
   }
  });
 }
 // Returns true when the key belongs to the modal; caller handles Escape.
 handleTab(event) {
  if (!this.opened || event.key !== 'Tab') return false;
  const elements = this.focusable();
  if (!elements.length) { event.preventDefault(); this.focusFirst(); return true; }
  const first = elements[0], last = elements.at(-1), current = this.document.activeElement;
  if (!elements.includes(current) || (event.shiftKey && current === first) || (!event.shiftKey && current === last)) {
   event.preventDefault();
   (event.shiftKey ? last : first).focus({preventScroll:true});
  }
  return true;
 }
}
