const fs = require('fs');
const s = fs.readFileSync('bookmarklet-by-day-and-task.js', 'utf8');
const marker = "a.href = 'javascript:";
const codeStart = s.indexOf(marker) + marker.length;
const end = s.indexOf("';", codeStart);
const code = s.slice(codeStart, end);
fs.writeFileSync('_bookmarklet-check.js', code);

function Element(tag) {
  this.tag = tag;
  this.style = {};
  this.children = [];
  this.listeners = {};
  this._text = '';
  this._html = '';
  this._value = '';
}
Element.prototype.appendChild = function (child) {
  this.children.push(child);
  return child;
};
Element.prototype.addEventListener = function (type, fn) {
  (this.listeners[type] || (this.listeners[type] = [])).push(fn);
};
Element.prototype.dispatch = function (type) {
  (this.listeners[type] || []).forEach(function (fn) { fn(); });
};
Object.defineProperty(Element.prototype, 'textContent', {
  get: function () { return this._text; },
  set: function (value) { this._text = value; }
});
Object.defineProperty(Element.prototype, 'innerHTML', {
  get: function () { return this._html; },
  set: function (value) { this._html = value; }
});
Object.defineProperty(Element.prototype, 'value', {
  get: function () { return this._value; },
  set: function (value) { this._value = value; }
});

global.document = {
  getElementById: function () { return null; },
  createElement: function (tag) { return new Element(tag); },
  body: new Element('body')
};

function worklog(date, seconds, author) {
  return {
    author: { accountId: author || 'me' },
    timeSpentSeconds: seconds,
    started: date + 'T09:00:00.000+0100'
  };
}
function issue(key, project, logs) {
  return {
    key: key,
    fields: {
      summary: key + ' summary',
      project: { name: project },
      worklog: { total: logs.length, worklogs: logs }
    }
  };
}

const calls = [];
global.fetch = async function (url) {
  calls.push(url);
  if (url.indexOf('/myself') >= 0) {
    return { json: async function () { return { accountId: 'me' }; } };
  }
  if (url.indexOf('/search/jql') >= 0) {
    return {
      json: async function () {
        return {
          isLast: true,
          issues: [
            issue('ALPHA-1', 'Alpha', [
              worklog('2026-11-13', 8 * 3600),
              worklog('2026-10-22', 3 * 3600),
              worklog('2026-11-13', 3600, 'someone-else')
            ]),
            issue('BETA-1', 'Beta', [worklog('2026-11-12', 2 * 3600)]),
            issue('OLD-1', 'Old Project', [worklog('2026-10-01', 8 * 3600)]),
            issue('ZERO-1', 'Zero Project', [worklog('2026-11-13', 0)])
          ]
        };
      }
    };
  }
  throw new Error('unexpected fetch ' + url);
};

function fail(message) {
  console.error('FAIL', message);
  process.exitCode = 1;
}
function assert(condition, message) {
  if (!condition) fail(message);
}

(async function () {
  await eval(code);
  const panel = document.body.children[0];
  const tabs = panel.children[1];
  const filterBar = panel.children[2];
  const content = panel.children[3];
  const inputs = filterBar.children.filter(function (child) { return child.tag === 'input'; });
  const reset = filterBar.children.filter(function (child) { return child.tag === 'button'; })[0];
  const fromInput = inputs[0];
  const toInput = inputs[1];
  const tabTask = tabs.children[1];
  const tabDetail = tabs.children[2];
  const tabDay = tabs.children[0];

  assert(panel && content && fromInput && toInput && reset, 'panel structure');
  assert(content.innerHTML.indexOf('Alpha') >= 0, 'initial alpha');
  assert(content.innerHTML.indexOf('Old Project') >= 0, 'initial old project');
  assert(content.innerHTML.indexOf('01.10.2026') >= 0, 'initial october date');
  assert(content.innerHTML.indexOf('Zero Project') < 0, 'zero project hidden');
  assert(calls.every(function (url) { return url.indexOf('/worklog') < 0; }), 'no extra worklog fetch');

  fromInput.value = '2026-11-01';
  toInput.value = '2026-11-30';
  fromInput.dispatch('change');
  const november = content.innerHTML;
  assert(november.indexOf('Alpha') >= 0, 'november keeps alpha');
  assert(november.indexOf('Beta') >= 0, 'november keeps beta');
  assert(november.indexOf('Old Project') < 0, 'november drops old project');
  assert(november.indexOf('22.10.2026') < 0, 'november drops october row');
  assert(november.indexOf('13.11.2026') >= 0, 'november keeps 13.11');
  assert(november.indexOf('8h ') >= 0 && november.indexOf('9h ') < 0, 'alpha day is 8h without the other author');

  tabTask.dispatch('click');
  const tasks = content.innerHTML;
  assert(tasks.indexOf('ALPHA-1') >= 0, 'task alpha');
  assert(tasks.indexOf('BETA-1') >= 0, 'task beta');
  assert(tasks.indexOf('OLD-1') < 0, 'task old hidden');
  assert(tasks.indexOf('10h ') >= 0, 'task total is november only');
  assert(tasks.indexOf('11h ') < 0, 'october hours stayed out of alpha');

  tabDetail.dispatch('click');
  const detail = content.innerHTML;
  assert(detail.indexOf('ALPHA-1') >= 0 && detail.indexOf('13.11.2026') >= 0, 'detail november entry');
  assert(detail.indexOf('22.10.2026') < 0 && detail.indexOf('OLD-1') < 0, 'detail hides outside range');

  reset.dispatch('click');
  assert(fromInput.value === '' && toInput.value === '', 'reset clears fields');
  assert(content.innerHTML.indexOf('Old Project') >= 0, 'reset restores old project');

  tabDay.dispatch('click');
  fromInput.value = '2026-11-13';
  toInput.value = '2026-11-13';
  toInput.dispatch('change');
  assert(content.innerHTML.indexOf('13.11.2026') >= 0, 'single day included');
  assert(content.innerHTML.indexOf('12.11.2026') < 0, 'single day excludes neighbour');
  assert(content.innerHTML.indexOf('Beta') < 0, 'single day drops beta');

  fromInput.value = '2026-11-30';
  toInput.value = '2026-11-01';
  fromInput.dispatch('change');
  assert(content.innerHTML.indexOf('Alpha') < 0, 'inverted range is empty');

  if (!process.exitCode) console.log('OK');
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
