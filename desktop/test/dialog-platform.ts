/** jsdom has no native modal top layer. This shim records calls/open state only;
 * it does not certify Chromium inertness or Windows focus behavior. */
if(typeof HTMLDialogElement!=='undefined') {
 if(!HTMLDialogElement.prototype.showModal)HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 if(!HTMLDialogElement.prototype.close)HTMLDialogElement.prototype.close=function(){this.open=false;};
}
