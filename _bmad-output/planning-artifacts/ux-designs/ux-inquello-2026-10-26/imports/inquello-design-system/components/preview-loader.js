/* Preview loader for cards and UI kits. Uses the compiled design-system bundle when it is already on the page;
   otherwise evaluates the component sources directly. Exposes window.IQ.ready (resolves to the component namespace). */
(function () {
  var root = new URL('../', document.currentScript.src).href;
  var files = ['core/icon-paths.js','core/Icon.jsx','core/Button.jsx','core/IconButton.jsx','core/Avatar.jsx','core/Badge.jsx','forms/TextField.jsx','forms/Switch.jsx','forms/Choice.jsx','forms/SegmentedControl.jsx','navigation/Tabs.jsx','navigation/Menu.jsx','status/StatusChip.jsx','status/JudgmentTag.jsx','status/FileChip.jsx','workflow/PlanStep.jsx','workflow/ApprovalCard.jsx','workflow/DiffLine.jsx','workflow/Toast.jsx'];
  var names = ['ICONS','Icon','Button','IconButton','Avatar','Badge','TextField','Switch','Choice','SegmentedControl','Tabs','Menu','StatusChip','JudgmentTag','FileChip','PlanStep','ApprovalCard','DiffLine','Toast'];
  function findNS() { for (var k in window) { try { var v = window[k]; if (v && typeof v === 'object' && typeof v.Button === 'function' && typeof v.StatusChip === 'function') return v; } catch (e) {} } return null; }
  function fromSource() {
    return Promise.all(files.map(function (f) { return fetch(new URL('components/' + f, root)).then(function (r) { return r.text(); }); })).then(function (srcs) {
      var ns = {};
      srcs.forEach(function (src) {
        var exp = [];
        var body = src.replace(/^\s*import[^\n]*\n/gm, '').replace(/^export (function|const) (\w+)/gm, function (m, kw, n) { exp.push(n); return kw + ' ' + n; });
        var out = new Function('React', 'NS', 'with (NS) { ' + body + '\nreturn {' + exp.join(',') + '}; }')(window.React, ns);
        Object.assign(ns, out);
      });
      return ns;
    });
  }
  window.INQUELLO_ASSET_BASE = window.INQUELLO_ASSET_BASE || root;
  window.IQ = { root: root, ready: Promise.resolve().then(function () { return findNS() || fromSource(); }) };
})();
