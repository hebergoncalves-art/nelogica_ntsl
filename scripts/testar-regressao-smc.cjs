'use strict';

// Executa o subconjunto de NTSL usado pelo indicador, com séries, arrays e
// chamadas de desenho simuladas. O Editor do Profit é o teste da plataforma.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { performance } = require('node:perf_hooks');

const root = join(__dirname, '..');
const path = 'src/indicadores/smc.ntsl';
const commit = '53f8560259735e7cbf537636a3bd438b519f8ca3';
const baseline = execFileSync('git', ['show', `${commit}:${path}`], { cwd: root });
const foundationCommit = 'acc5ffb6df32353b3fbc3d29b8b0e99c1ceb0291';
const foundation = execFileSync('git', ['show', `${foundationCommit}:${path}`], { cwd: root });
const flipCommit = 'cbcf1d71ffd014f7908030f25c81f1d3f2c3de5e';
const structuralFlip = execFileSync('git', ['show', `${flipCommit}:${path}`], { cwd: root });
const poiCommit = '938ebaa';
const poiFlip = execFileSync('git', ['show', `${poiCommit}:${path}`], { cwd: root });
const advancedFlipCommit = '8671dedac34e76d737849f3830da40b4e77e87dd';
const advancedFlip = execFileSync('git', ['show', `${advancedFlipCommit}:${path}`], { cwd: root });
const idmCommit = '20426dcaedbe529032950559484a2fbbea23c8e5';
const acceptedIDMSource = execFileSync('git', ['show', `${idmCommit}:${path}`], { cwd: root });
const liquidityCommit = '11b5e1b';
const acceptedLiquiditySource = execFileSync('git', ['show', `${liquidityCommit}:${path}`], { cwd: root });
const recoveryCommit = '1337ca4';
const acceptedRecoverySource = execFileSync('git', ['show', `${recoveryCommit}:${path}`], { cwd: root });
const acceptedAdvancedLiquiditySource = execFileSync('git', ['show', `6fad88b:${path}`], { cwd: root });
const candidate = readFileSync(join(root, path));
const sha = (data) => createHash('sha256').update(data).digest('hex');

const binary = {
  or: [1, '||'], and: [2, '&&'], '=': [3, '==='], '<>': [3, '!=='],
  '<': [3, '<'], '>': [3, '>'], '<=': [3, '<='], '>=': [3, '>='],
  '+': [4, '+'], '-': [4, '-'], '*': [5, '*'], '/': [5, '/'],
};

function compile(source) {
  const tokens = source.toString().match(/\/\/[^\r\n]*|"[^"]*"|\d+(?:\.\d+)?|[A-Za-z_]\w*|:=|<>|<=|>=|\.\.|[^\s]/g)
    .filter((token) => !token.startsWith('//'))
    .map((token) => token.startsWith('"') ? token : token.toLowerCase());
  const constants = { true: true, false: false };
  const inputs = {};
  const variables = new Map();
  const series = new Set();
  let at = 0;
  let loops = 0;
  const peek = () => tokens[at];
  const take = () => tokens[at++];
  const eat = (token) => peek() === token && Boolean(take());
  function want(token) {
    assert.equal(take(), token, `token ${at}: ${tokens.slice(at - 4, at + 4).join(' ')}`);
  }
  function value(token) {
    if (Object.hasOwn(constants, token)) return constants[token];
    if (/^cl\w+$/.test(token)) return token;
    assert.match(token, /^\d+(?:\.\d+)?$/);
    return Number(token);
  }
  want('const');
  while (!eat('input')) {
    const name = take();
    want('=');
    constants[name] = value(take());
    want(';');
  }
  while (!eat('var')) {
    const name = take();
    want('(');
    inputs[name] = value(take());
    want(')');
    want(';');
  }
  function bound() {
    const first = value(take());
    return eat('-') ? first - value(take()) : first;
  }
  while (peek() !== 'begin') {
    const names = [take()];
    while (eat(',')) names.push(take());
    want(':');
    let range;
    if (eat('array')) {
      want('[');
      const first = bound();
      want('..');
      range = [first, bound()];
      want(']');
      want('of');
    }
    const type = take();
    assert.ok(['integer', 'float', 'boolean', 'string'].includes(type));
    want(';');
    for (const name of names) {
      assert.ok(!variables.has(name) && !Object.hasOwn(inputs, name) && !Object.hasOwn(constants, name), name);
      variables.set(name, { type, range });
    }
  }

  const quoted = JSON.stringify;
  function call(name) {
    const args = [];
    if (!eat(')')) {
      do {
        if ((name === 'highest' || name === 'lowest') && args.length === 0) {
          args.push(quoted(take()));
        } else {
          args.push(expr());
        }
      } while (eat(','));
      want(')');
    }
    return `m.call(${quoted(name)},[${args.join(',')}])`;
  }
  function expr(minimum = 1) {
    let lhs;
    const token = take();
    if (token === 'not' || token === '-' || token === '+') {
      lhs = `(${token === 'not' ? '!' : token}${expr(6)})`;
    } else if (token === '(') {
      lhs = expr();
      want(')');
    } else if (/^\d|^"/.test(token)) {
      lhs = token;
    } else {
      assert.match(token, /^\w+$/);
      if (eat('(')) {
        lhs = call(token);
      } else if (eat('[')) {
        const offset = expr();
        want(']');
        const array = variables.get(token)?.range;
        if (!array) series.add(token);
        lhs = `m.${array ? 'element' : 'get'}(${quoted(token)},${offset})`;
      } else {
        lhs = `m.get(${quoted(token)})`;
      }
    }
    while (binary[peek()]?.[0] >= minimum) {
      const [precedence, operator] = binary[take()];
      lhs = `(${lhs}${operator}${expr(precedence + 1)})`;
    }
    return lhs;
  }
  function statement() {
    if (eat('begin')) {
      const body = [];
      while (!eat('end')) {
        body.push(statement());
        if (peek() !== 'end') want(';');
      }
      return `{${body.join('')}}`;
    }
    if (eat('if')) {
      const test = expr();
      want('then');
      const positive = statement();
      const negative = eat('else') ? `else{${statement()}}` : '';
      return `if(${test}){${positive}}${negative}`;
    }
    if (eat('while')) {
      const test = expr();
      want('do');
      return `while(${test}){${statement()}}`;
    }
    if (eat('for')) {
      const name = take();
      want(':=');
      const first = expr();
      const direction = take();
      assert.ok(['to', 'downto'].includes(direction));
      const last = expr();
      // Min and Max return Float in NTSL even when both arguments are integers.
      for (const bound of [first, last]) {
        assert.doesNotMatch(bound, /^m\.call\("(min|max)",/, `Limite de FOR deve ser Integer (${name})`);
      }
      want('do');
      const body = statement();
      const id = loops++;
      const ascending = direction === 'to';
      return `{const first=${first},limit=${last};for(let i${id}=first;i${id}${ascending ? '<=' : '>='}limit;i${id}${ascending ? '++' : '--'}){m.set(${quoted(name)},i${id});${body}}}`;
    }
    const name = take();
    if (eat('(')) return `${call(name)};`;
    let offset;
    if (eat('[')) {
      offset = expr();
      want(']');
      assert.ok(variables.get(name)?.range, name);
    }
    want(':=');
    assert.ok(variables.has(name), name);
    return `m.set(${quoted(name)},${expr()}${offset ? `,${offset}` : ''});`;
  }
  const code = statement();
  assert.ok(eat(';') || eat('.'));
  assert.equal(at, tokens.length);
  return { execute: new Function('m', code), constants, inputs, variables, series };
}

function defaultValue(type) {
  if (type === 'string') return '';
  return type === 'boolean' ? false : 0;
}

function calcDate(date, days) {
  const value = new Date(Date.UTC(1900 + Math.trunc(date / 10000), Math.trunc(date / 100) % 100 - 1, date % 100));
  value.setUTCDate(value.getUTCDate() + days);
  return (value.getUTCFullYear() - 1900) * 10000 + (value.getUTCMonth() + 1) * 100 + value.getUTCDate();
}

function runtime(program, bars, overrides = {}, tick = 1) {
  const { variables, constants, series, execute } = program;
  const inputs = { ...program.inputs, ...Object.fromEntries(Object.entries(overrides).map(([key, value]) => [key.toLowerCase(), value])) };
  const values = new Map();
  const arrays = new Map();
  for (const [name, entry] of variables) {
    const { range, type } = entry;
    if (range) arrays.set(name, Array(range[1] - range[0] + 1).fill(defaultValue(type)));
    else if (series.has(name)) values.set(name, []);
    else values.set(name, defaultValue(type));
  }
  const candleFields = { open: 0, high: 1, low: 2, close: 3, date: 4, time: 5, volume: 6 };
  let index = 0;
  let last = false;
  let drawing;
  function arrayOffset(name, position) {
    const [start, end] = variables.get(name).range;
    if (!(Number.isInteger(position) && position >= start && position <= end)) {
      throw new Error(`barra ${index}, ${name}[${position}] fora de [${start}..${end}]`);
    }
    return position - start;
  }
  const model = {
    get(name, lag = 0) {
      if (name === 'currentbar') return index;
      if (name === 'lastbaronchart') return last;
      if (name === 'minpriceincrement') return tick;
      if (Object.hasOwn(candleFields, name)) return bars[index - lag]?.[candleFields[name]] ?? 0;
      if (Object.hasOwn(inputs, name)) return inputs[name];
      if (Object.hasOwn(constants, name)) return constants[name];
      if (/^cl\w+$/.test(name)) return name;
      assert.ok(values.has(name), name);
      if (series.has(name)) return values.get(name)[index - lag] ?? defaultValue(variables.get(name).type);
      return values.get(name);
    },
    element(name, position) {
      return arrays.get(name)[arrayOffset(name, position)];
    },
    set(name, value, position) {
      const { type } = variables.get(name);
      if (type === 'integer') value = Math.trunc(value);
      if (type === 'boolean') value = Boolean(value);
      if (position !== undefined) arrays.get(name)[arrayOffset(name, position)] = value;
      else if (series.has(name)) values.get(name)[index] = value;
      else values.set(name, value);
    },
    call(name, args) {
      if (name === 'abs') return Math.abs(...args);
      if (name === 'mod') return args[0] % args[1];
      if (name === 'max') return Math.max(...args);
      if (name === 'min') return Math.min(...args);
      if (name === 'round') return Math.sign(args[0]) * Math.round(Math.abs(args[0]));
      if (name === 'floattostring') return args[0].toFixed(args[1]);
      if (name === 'calcdate') return calcDate(...args);
      if (name === 'rgb') return args[0] + 256 * args[1] + 65536 * args[2];
      if (name === 'highest' || name === 'lowest') {
        const [field, count] = args;
        let result = model.get(field);
        const select = name === 'highest' ? Math.max : Math.min;
        for (let lag = 1; lag < count; lag++) result = select(result, model.get(field, lag));
        return result;
      }
      assert.match(name, /^(plot[234]?|plottext|noplot|setplotcolor|setplotwidth|horizontallinecustom|linesegment)$/);
      drawing.push([name, ...args]);
      return 0;
    },
    step(bar, isLast = true) {
      index = bar;
      last = isLast;
      drawing = [];
      execute(model);
      return drawing;
    },
  };
  return model;
}

const original = compile(baseline);
const accepted = compile(foundation);
const acceptedFlip = compile(structuralFlip);
const acceptedPOI = compile(poiFlip);
const acceptedAdvanced = compile(advancedFlip);
const acceptedIDM = compile(acceptedIDMSource);
const acceptedLiquidity = compile(acceptedLiquiditySource);
const acceptedRecovery = compile(acceptedRecoverySource);
const acceptedAdvancedLiquidity = compile(acceptedAdvancedLiquiditySource);
const updated = compile(candidate);

function dated(rows) {
  return rows.map(([open, high, low, close, volume = 0], index) => {
    const minutes = 570 + (index % 16) * 5;
    return [open, high, low, close, calcDate(1261102, Math.floor(index / 16)), Math.floor(minutes / 60) * 100 + minutes % 60, volume];
  });
}

function swingBars() {
  const hlc = [
    [110, 80, 95], [120, 90, 95], ...Array(10).fill([110, 90, 95]),
    [123, 90, 121], [124, 90, 122], [100, 70, 80], [100, 74, 75],
    ...Array(9).fill([100, 90, 95]), [100, 68, 69], [110, 67, 90],
    ...Array(10).fill([100, 90, 95]), [112, 90, 111], [113, 90, 112],
    [110, 90, 109], [113, 90, 111],
  ];
  return dated(hlc.map(([high, low, close]) => [close, high, low, close]));
}

function generated(count) {
  let seed = 26;
  let price = 10000;
  function random(limit) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return (seed >>> 8) % limit;
  }
  return dated(Array.from({ length: count }, () => {
    const open = price + random(29) - 14;
    price = open + random(31) - 15;
    return [open, Math.max(open, price) + random(10), Math.min(open, price) - random(10), price];
  }));
}

function archived(model, lane) {
  const count = model.element('smcusados', lane);
  const start = model.get('smcbasehistorico') + (lane - 1) * model.get('smccapacidade');
  return Array.from({ length: count }, (_, offset) => {
    const index = start + offset;
    return Object.fromEntries([
      'nascimento', 'origem', 'ref', 'lo', 'hi', 'brutolo', 'brutohi', 'estado', 'terminal',
      'qualificacao', 'barraqualificacao', 'confirmacao', 'publicacao', 'data', 'hora', 'dataorigem', 'horaorigem',
      'dataterminal', 'horaterminal', 'atr', 'atrvalido', 'dadosvalidos',
    ].map((field) => [field, model.element('smcevento' + field, index)]));
  }).sort((left, right) => left.nascimento - right.nascimento);
}

function compare(bars, overrides = {}, configure = () => {}, inspect = () => {}) {
  const reference = runtime(original, bars, overrides);
  const quiet = runtime(updated, bars, { ...overrides, DebugSMC: false });
  const debug = runtime(updated, bars, { ...overrides, DebugSMC: true });
  const trace = [];
  bars.forEach((_, index) => {
    [reference, quiet, debug].forEach((model, variant) => configure(model, index, variant));
    const expected = reference.step(index);
    assert.deepEqual(quiet.step(index), expected, `desenho com debug OFF na barra ${index}`);
    assert.deepEqual(debug.step(index), expected, `desenho com debug ON na barra ${index}`);
    inspect(reference, quiet, debug, index);
    trace.push(expected);
  });
  return { trace, debug };
}

function blockList(model, bar, group) {
  const list = bar % 3 * 2 + group;
  const start = list * 100 + 1;
  const size = model.element('quantidadesblocos', list);
  return Array.from({ length: size }, (_, offset) => [
    'direcoes', 'inferioresblocos', 'superioresblocos', 'datasblocos', 'horasblocos', 'criacoesblocos',
  ].map((field) => model.element(field, start + offset)));
}

function seedBlocks(model, bar, group, blocks, debug) {
  const list = bar % 3 * 2 + group;
  const start = list * 100 + 1;
  model.set('carimbosblocos', bar + 1, bar % 3);
  model.set('quantidadesblocos', blocks.length, list);
  blocks.forEach(({ side = 1, low, high, date = 1261102, time = 930, birth = 0 }, offset) => {
    const slot = start + offset;
    model.set('direcoes', side, slot);
    model.set('inferioresblocos', low, slot);
    model.set('superioresblocos', high, slot);
    model.set('datasblocos', date, slot);
    model.set('horasblocos', time, slot);
    model.set('criacoesblocos', birth, slot);
    if (debug) {
      model.set('smcorigemob', 0, slot);
      model.set('smcpivoob', 0, slot);
    }
  });
}

function fact(lane, origin, price, previousBias = 0) {
  return { lane, origin, price, previousBias };
}

function stageFacts(model, bar, rows) {
  const frame = bar % 2;
  model.set('smclotes', rows.length, frame);
  rows.forEach(({ lane, origin, price, previousBias, ref = -1, hi = price, state = 1, birth = bar }, offset) => {
    const slot = frame * model.get('smclote') + offset;
    const values = { faixa: lane, origem: origin, ref, nascimento: birth, estado: state, lo: price,
      hi, brutolo: previousBias, brutohi: lane % 2 === 1 ? 1 : -1 };
    for (const [field, value] of Object.entries(values)) model.set('smcevento' + field, value, slot);
  });
}

function breakerCandidateFixture({ side = 1, scale = 0, source = 0, mode = 1, debug = true,
  historical = false, repeat = false, removal = 8, lateTarget = false, replace = {}, config = {} } = {}) {
  const rows = [[104, 106, 103, 104], [104, 115, 103, 104], [104, 106, 102, 104],
    [105, 109, 104, 105], [106, 107, 100, 102], [104, 110, 103, 108], [108, 124, 107, 123],
    [123, 124, 119, 122], [122, 123, 99, 121], [121, 122, 116, 120], [120, 121, 116, 118]];
  Object.entries(replace).forEach(([index, row]) => { rows[index] = row; });
  const mirror = (price) => side === 1 ? price : 240 - price;
  const bars = dated(side === 1 ? rows : rows.map(([o, h, l, c]) => [mirror(o), mirror(l), mirror(h), mirror(c)]));
  const lane = scale * 2 + (side === 1 ? 1 : 2);
  const middle = side === 1 ? lane + 1 : lane - 1;
  const facts = {};
  const publish = (bar, item) => { (facts[bar] ??= []).push(item); };
  publish(lateTarget ? 6 : 2, fact(lane, 1, mirror(115)));
  if (scale === 1) publish(2, fact(lane - 2, 1, mirror(115)));
  publish(6, fact(lane + 4, 1, mirror(115)));
  publish(7, fact(middle, 4, mirror(100)));
  if (source === 1) {
    const snapshot = { lane: lane + 8, origin: 4, ref: 1,
      price: Math.min(mirror(101), mirror(106)), hi: Math.max(mirror(101), mirror(106)) };
    publish(6, { ...snapshot, state: 0 });
    if (removal >= 0) publish(removal, { ...snapshot, state: 2, birth: 6 });
  }
  const model = runtime(updated, bars, { ModoBB: mode, PeriodoSwing: 500, PeriodoATRSMC: 2,
    EscalaBB: scale, FonteOBBB: source, DebugSMC: debug, MostrarEstruturaInterna: false, ...config });
  const markers = bars.flatMap((_, index) => {
    if (index > 0) stageFacts(model, index - 1, facts[index - 1] ?? []);
    const last = !historical || index === bars.length - 1;
    const drawing = model.step(index, last);
    if (repeat) assert.deepEqual(model.step(index, last), drawing);
    return drawing.filter(([name, label]) => name === 'plottext' && label.startsWith('OB BB'))
      .map(([, label, , , , price]) => [index, label, price]);
  });
  return { model, markers, slot: (lane - 1) * 100 };
}

function scripted(closes, entries, overrides = {}, tick = 1) {
  const bars = dated(closes.map((close) => [close, Math.max(130, close), Math.min(70, close), close]));
  const model = runtime(updated, bars, { DebugSMC: true, PeriodoSwing: 500, ...overrides }, tick);
  bars.forEach((_, index) => {
    if (index > 0) stageFacts(model, index - 1, entries[index - 1] ?? []);
    model.step(index);
  });
  return model;
}

function liquidityFixture(rows, entries, { config = {}, historical = false, repeat = false,
  program = updated, before = () => {}, tick = 1, clock = {} } = {}) {
  const bars = dated(rows);
  for (const [index, [date, time]] of Object.entries(clock)) {
    bars[index][4] = date;
    bars[index][5] = time;
  }
  const model = runtime(program, bars, { PeriodoSwing: 500, HabilitarCapturasLiquidez: true,
    MostrarCapturasLiquidez: true, ...config }, tick);
  const trace = bars.map((_, index) => {
    if (index > 0 && model.get('smccalcula')) stageFacts(model, index - 1, entries[index - 1] ?? []);
    before(model, index);
    const last = !historical || index === bars.length - 1;
    const drawing = model.step(index, last);
    if (repeat) assert.deepEqual(model.step(index, last), drawing);
    return drawing;
  });
  return { bars, model, trace };
}

function liquidityArchive(model) {
  return [1, 2].flatMap((side) => Array.from({ length: model.element('lqtotalniveis', side) }, (_, index) => {
    const slot = (side - 1) * 100 + index;
    const state = model.element('lqestado', slot);
    if (!state) return null;
    const fields = (prefix, names, position) => Object.fromEntries(names.map((name) =>
      [name, model.element(prefix + name, position)]));
    const sources = [];
    for (let link = model.element('lqprimeirafonte', slot); link >= 0; link = model.element('lqfonteproxima', link)) {
      assert.ok(sources.length < 600, 'capacidade ou ciclo de fontes');
      sources.push(fields('lqfonte', ['tipo', 'ref', 'origem', 'ativacao', 'fim', 'tomada'], link));
    }
    return { side, ...fields('lq', ['id', 'estado', 'origemnivel', 'ticks', 'ativacao', 'fim',
      'publicacao', 'extremotomada', 'penetracaoticks', 'desfecho', 'barradesfecho',
      'publicacaodesfecho', 'extremocaptura', 'confirmacao', 'confirmacaoem', 'confirmacaopublicacao'], slot), sources };
  }).filter(Boolean));
}

const prices = generated(850);
const labels = (trace) => trace.flat().filter(([name]) => name === 'plottext').map(([, text]) => text);
const horizontal = (calls, label) => calls.filter(([name, , , , , title]) =>
  name === 'horizontallinecustom' && (label === undefined || title === label));

function flipArchive(model, lane) {
  const size = model.element('flipusados', lane);
  return Array.from({ length: size }, (_, offset) => Object.fromEntries([
    'extremo', 'meio', 'reacao', 'origemextremo', 'origemmeio', 'origemreacao', 'cruzamento',
    'confirmacao', 'publicacao', 'data', 'hora', 'datameio', 'horameio',
    'contexto', 'legado', 'tipolegado', 'continuacao', 'falha', 'reversao', 'nivel', 'extremopreco', 'reacaopreco', 'atrmeio',
  ].map((field) => [field, model.element('flipevento' + field, (lane - 1) * 100 + offset)])));
}

const flipCloses = [92, 92, 94, 90, 92, 98, 100, 95, 100, 109, 106, 104, 105, 110, 108, 99];
const poiLeg = { 13: [109, 112, 107, 110], 14: [110, 111, 105, 108], 15: [108, 109, 95, 99] };

function poiArchive(model, lane) {
  return Array.from({ length: model.element('poiusados', lane) }, (_, offset) =>
    Object.fromEntries([
      'id', 'origemzona', 'lozona', 'hizona', 'ativacao', 'publicacao', 'estado', 'pre', 'toque',
      'visitas', 'profundidade', 'intersecaoinvalidacao', 'alvoref', 'reteste', 'statusreteste', 'fimzona',
    ].map((field) => [field, model.element('poi' + field, (lane - 1) * 100 + offset)])));
}

function flipFixture(scale = 1, side = -1, { closes = flipCloses, events = {}, envelope, config = {},
  before = () => {}, after = () => {}, repeat = false, historical = false, program = updated } = {}) {
  const first = 2 * scale + 1;
  const script = {
    2: [[1, 1, 95]],
    4: [[2, 3, 80]],
    6: [[1, 5, 105]],
    8: [[2, 7, 90]],
    9: [[5, 5, 105, 1]],
    10: [[1, 9, 120]],
    12: [[2, 11, 100]],
    14: [[1, 13, 112]],
    ...events,
  };
  const rows = closes.map((close, index) => envelope?.[index] ?? [close, close + 4, close - 4, close]);
  const bars = dated(side === -1 ? rows : rows.map(([o, h, l, c, volume]) => [200 - o, 200 - l, 200 - h, 200 - c, volume]));
  bars.push(dated([[100, 101, 99, 100]])[0]);
  const model = runtime(program, bars, {
    PeriodoSwing: 500, PeriodoATRSMC: 3, HabilitarFlip: true, EscalaFlip: scale, MostrarFlip: true, ...config,
  });
  const lane = first + (side === -1 ? 1 : 0);
  const trace = [];
  const progress = [];
  for (let index = 0; index < bars.length; index++) {
    if (index > 0 && model.get('smccalcula')) {
      const bar = index - 1;
      const peaks = (script[bar] ?? []).map(([rawLane, origin, price, previousBias = 0]) => {
        const remapped = side === -1 ? rawLane : rawLane % 2 === 0 ? rawLane - 1 : rawLane + 1;
        return fact(remapped + 2 * scale, origin, side === -1 ? price : 200 - price, -side * previousBias);
      });
      stageFacts(model, bar, peaks);
    }
    before(model, index, lane);
    const isLast = !historical || index === bars.length - 1;
    const drawing = model.step(index, isLast);
    trace.push(drawing);
    if (repeat) {
      const total = model.get('fliptotal');
      const beforeTick = flipArchive(model, lane);
      const zonesBeforeTick = poiArchive(model, lane);
      assert.deepEqual(model.step(index, isLast), drawing);
      assert.equal(model.get('fliptotal'), total);
      assert.deepEqual(flipArchive(model, lane), beforeTick);
      assert.deepEqual(poiArchive(model, lane), zonesBeforeTick);
    }
    progress.push([model.element('flipfase', lane), model.element('flipmotivo', lane)]);
    after(model, index, lane);
  }
  return { model, events: flipArchive(model, lane), trace, progress, bars, lane };
}

function poiFixture({ tail = [], envelope = {}, config = {}, ...options } = {}) {
  const tailRows = Object.fromEntries(tail.map((row, index) => [16 + index, row]));
  const fixture = flipFixture(options.scale ?? 1, options.side ?? -1, {
    ...options, closes: [...flipCloses, ...tail.map((row) => row[3])],
    envelope: { ...poiLeg, ...envelope, ...tailRows }, config: { MostrarFaixasFlip: true, ...config },
  });
  const { model, lane } = fixture;
  return { ...fixture, zones: poiArchive(model, lane),
    zoneId: model.element('flipeventozonaid', (lane - 1) * 100),
    reason: model.element('flipeventozonamotivo', (lane - 1) * 100) };
}

function segments(calls) {
  return calls.filter(([name]) => name === 'linesegment');
}

function qualification({ model, lane }) {
  const slot = (lane - 1) * 100;
  return Object.fromEntries(['modofalha', 'qualestado', 'qualbarra', 'qualpublicacao', 'nota', 'fvgem',
    'dispem', 'volumeem', 'fiblo', 'fibhi', 'extremeid', 'extrememotivo', 'continuationid',
  ].map((field) => [field, model.element('flipevento' + field, slot)]));
}

const idmFacts = {
  2: [[3, 1, 110]], 4: [[4, 3, 80]], 6: [[3, 5, 120]], 8: [[4, 7, 90]],
  9: [[1, 8, 111]], 11: [[2, 10, 100]], 13: [[1, 12, 115]], 16: [[7, 5, 120, 1]],
};

function idmFixture({ side = 1, events = {}, envelope = {}, length = 18, config = {},
  before = () => {}, repeat = false, historical = false, program = updated } = {}) {
  const facts = { ...idmFacts, ...events };
  const defaultRows = { 10: [105, 111, 100, 106], 15: [115, 119, 105, 117], 16: [117, 123, 104, 121] };
  const rows = Array.from({ length }, (_, bar) => envelope[bar] ?? defaultRows[bar] ?? [106, 112, 101, 108]);
  const bars = dated(side === 1 ? rows : rows.map(([o, h, l, c, volume]) => [220 - o, 220 - l, 220 - h, 220 - c, volume]));
  const model = runtime(program, bars, { PeriodoSwing: 500, PeriodoATRSMC: 3, HabilitarIDM: true, MostrarIDM: true, ...config });
  const label = side === 1 ? 'IDM LOW' : 'IDM HIGH';
  const trace = [];
  for (let index = 0; index < length; index++) {
    if (index > 0 && model.get('smccalcula')) {
      stageFacts(model, index - 1, (facts[index - 1] ?? []).map(([lane, origin, price, bias = 0]) =>
        fact(side === 1 ? lane : lane % 2 === 0 ? lane - 1 : lane + 1, origin, side === 1 ? price : 220 - price, side * bias)));
    }
    before(model, index);
    const last = !historical || index === length - 1;
    trace.push(model.step(index, last));
    if (repeat) assert.deepEqual(model.step(index, last), trace.at(-1));
  }
  return { model, trace, bars, label, lines: trace.map((calls) => segments(calls).filter((line) => line[6].startsWith(label))) };
}

function idmArchive(model, side = 1) {
  const lane = side === 1 ? 1 : 2;
  return Array.from({ length: model.element('idmusados', lane) }, (_, offset) =>
    Object.fromEntries(['id', 'estado', 'origem', 'pivo', 'nivelticks', 'protecaoorigem', 'protecaoref',
      'bosref', 'alvoref', 'ativacao', 'publicacao', 'fim', 'atr',
    ].map((field) => [field, model.element('idm' + field, (lane - 1) * 100 + offset)])));
}

function idmModelArchive(model, kind, side) {
  const lane = kind * 2 + (side === 1 ? 1 : 2);
  return Array.from({ length: model.element('idmusados', lane) }, (_, offset) =>
    Object.fromEntries(['id', 'origem', 'pivo', 'nivelticks', 'bosref', 'ativacao', 'publicacao',
      'fim', 'estado', 'resultado', 'barraresultado', 'flipref', 'evidencias',
    ].map((field) => [field, model.element('idm' + field, (lane - 1) * 100 + offset)])));
}

function idmPostOptions() {
  return {
    length: 26,
    events: { 18: [[1, 17, 122]], 20: [[2, 19, 105]], 22: [[1, 21, 125]] },
    envelope: { 17: [116, 122, 109, 116], 18: [116, 119, 110, 114], 19: [114, 118, 105, 109],
      20: [109, 118, 106, 114], 21: [114, 125, 108, 117], 22: [117, 125, 107, 118],
      23: [116, 120, 104, 111], 24: [111, 120, 107, 111] },
  };
}

function idmLocalFixture(side, { config = {}, firstSweep = 15, confirmPivot = 14, lower = {}, before = () => {}, ...options } = {}) {
  const closes = [...flipCloses.slice(0, 15), 105, 99, 96, 99];
  const envelope = { 13: [109, 112, 107, 110], 14: [110, 111, 105, 108],
    15: [109, firstSweep === 15 ? 113 : 112, 103, 105],
    16: [108, firstSweep === 16 ? 113 : 110, 95, 99], 17: [99, 100, 95, 96], ...lower };
  const price = (value) => side === -1 ? value : 200 - value;
  const lane = (base) => side === -1 ? base : base % 2 === 0 ? base - 1 : base + 1;
  return flipFixture(1, side, {
    closes, envelope, ...options,
    config: { HabilitarFlip: false, HabilitarIDM: true, MostrarIDM: true, ModoIDM: 1,
      ModoConfirmacaoIDM: 1, ...config },
    before(model, index, flipLane) {
      const closed = index - 1;
      if (closed === 14 || closed === confirmPivot) {
        const facts = [];
        if (closed === 14) facts.push(fact(lane(3), 13, price(112)));
        if (closed === confirmPivot) facts.push(fact(lane(1), 13, price(112)));
        stageFacts(model, closed, facts);
      }
      before(model, index, flipLane);
    },
  });
}

function idmSecondBOS(level = 110) {
  return {
    length: 32,
    events: { 18: [[1, 17, 123]], 19: [[3, 18, 130]], 21: [[4, 20, 95]], 23: [[2, 22, level]],
      25: [[1, 24, 125]], 30: [[7, 18, 130, 1]] },
    envelope: {
      ...Object.fromEntries(Array.from({ length: 8 }, (_, offset) => [22 + offset, [117, 126, level, 120]])),
      30: [125, 133, level, 131],
    },
  };
}

const cases = {
  B01() {
    assert.equal(sha(baseline), 'adb3ce8479a06291df0eb32ce4bddd15dc2ee3919d296cdd54be5ce45ec6ab94');
    assert.deepEqual(Object.entries(updated.inputs).slice(0, 26), Object.entries(original.inputs));
    assert.deepEqual(Object.entries(updated.inputs).slice(26, 30), [
      ['periodoatrsmc', 14], ['toleranciasmcticks', 1], ['bufferrupturasmcticks', 1], ['debugsmc', false],
    ]);
    assert.equal(sha(foundation), '37b2bd0f549b2073a811141725aabc369a78d75da5775d5bbb434493858b7e51');
    assert.deepEqual(Object.entries(updated.inputs).slice(0, 30), Object.entries(accepted.inputs));
    assert.deepEqual(Object.entries(updated.inputs).slice(30, 37), [
      ['habilitarflip', false], ['mostrarflip', false], ['escalaflip', 2], ['reacaominflipatr', 0.5],
      ['maxbarrasflip', 100], ['permitirgapflip', true], ['mostrarcandidatosflip', false],
    ]);
    assert.equal(sha(structuralFlip), '47120dbc93447d109d7e13446b6321b1075febb2a18be36532bcf5a566714247');
    assert.deepEqual(Object.entries(updated.inputs).slice(0, 37), Object.entries(acceptedFlip.inputs));
    assert.deepEqual(Object.entries(updated.inputs).slice(37, 61), [
      ['mostrarfaixasflip', false], ['tipozonaflip', 0], ['maxbuscaorigemflip', 30], ['fallbackpivoflip', true],
      ['maxbasecandlesflip', 3], ['baserangeflipatr', 1], ['maxlarguraflipatr', 0], ['exigirfreshflip', false],
      ['meiozonaflip', true], ['maxflipvisiveis', 10], ['modoinvalidacaoflip', 0], ['bufferinvalidacaoticksflip', 1],
      ['mostrarinvalidadasflip', 1], ['ocultarmitigadasflip', 0], ['encerraraposmitigacaoflip', 0],
      ['maxidadeflip', 0], ['maxvisitasflip', 0], ['modoretesteflip', 0], ['reacaoretesteatrflip', 0.5],
      ['maxbarrasretesteflip', 20], ['corfaixaflipalta', 'clgreen'], ['corfaixaflipbaixa', 'clred'],
      ['corinvalidadaflip', 'clgray'], ['mostrarorigemflip', false],
    ]);
    assert.equal(sha(poiFlip), '2e009a4711a6995d2fca378ff9efce8f3f5bea551d8614f7171ed084f8f8e676');
    assert.deepEqual(Object.entries(updated.inputs).slice(0, 61), Object.entries(acceptedPOI.inputs));
    assert.deepEqual(Object.entries(updated.inputs).slice(61, 81), [
      ['modofalhaflip', 0], ['filtrodispflip', 0], ['filtrofvgflip', 0], ['filtrovolumeflip', 0],
      ['dispatrflip', 1], ['corpominflip', 0.65], ['maxcandlesdispflip', 3], ['maxbarrasfvgflip', 2],
      ['fatorvolumeflip', 1.5], ['periodovolumeflip', 20], ['filtrofibflip', 0], ['fibpreferencialflip', 61.8],
      ['fibextremoflip', 81.8], ['fibcustommin', 50], ['fibcustommax', 100], ['modolocalizacaoflip', 0],
      ['modorangeflip', 0], ['mostrarfibflip', false], ['mostrarextremeflip', false], ['mostrarcontinuationflip', false],
    ]);
    assert.equal(sha(advancedFlip), 'be082bb10c7ba9be248710e194e15e07b987af03a160a166829ba64a7e72b415');
    assert.deepEqual(Object.entries(updated.inputs).slice(0, 81), Object.entries(acceptedAdvanced.inputs));
    assert.deepEqual(Object.entries(updated.inputs).slice(81, Object.keys(acceptedIDM.inputs).length), [
      ['habilitaridm', false], ['mostraridm', false], ['modoidm', 0], ['minpullbackidmatr', 0.5],
      ['minreacaoidmatr', 0.5], ['mindistprotegidoticks', 2], ['maxbuscapullback', 100],
      ['politicanovobos', 0], ['mostraridmlow', true], ['mostraridmhigh', true],
      ['sweepidmticks', 1], ['maxidadeidm', 100], ['modoconfirmacaoidm', 2],
      ['reacaoposidmatr', 0.5], ['maxbarrasconfirmacaoidm', 30], ['mostraridmcapturados', true],
      ['mostraridmrompidos', true], ['mostraridmexpirados', false],
      ['mostraridmconfirmacao', true], ['mostrarprecoidm', true], ['maxidmsvisiveis', 10],
      ['mostraridmcandidatos', false], ['filtropoiidm', 0], ['filtrofibidm', 0],
      ['filtrofvgidm', 0], ['filtrodispidm', 0], ['filtrovolumeidm', 0],
    ]);
    assert.deepEqual(Object.entries(updated.inputs).slice(Object.keys(acceptedIDM.inputs).length,
      Object.keys(acceptedLiquidity.inputs).length), [
      ['habilitarcapturasliquidez', false], ['mostrarcapturasliquidez', false], ['fonteidm', true],
      ['fonteswinginterno', true], ['fonteswingexterno', true], ['mostrarbsl', true], ['mostrarssl', true],
      ['mostrarliquiditygrab', true], ['mincapturaticks', 1], ['bufferrecuperacaoticks', 0], ['minpaviograb', 0],
      ['mostrarniveisliquidez', false], ['mostrarlinhacaptura', true], ['mostrarrotulolq', true],
      ['mostrarfontelq', true], ['maxcapturaslqvisiveis', 20],
    ]);
    assert.deepEqual(Object.entries(updated.inputs).slice(Object.keys(acceptedLiquidity.inputs).length,
      Object.keys(acceptedRecovery.inputs).length), [
      ['mostrarsweep', true], ['mostrarstophunt', true], ['maxbarrasstophunt', 5], ['permitirgappadraolq', false],
      ['mostrarrupturapendente', false], ['mostrarbreaksemrecuperacao', false],
    ]);
    assert.deepEqual(Object.entries(updated.inputs).slice(Object.keys(acceptedRecovery.inputs).length,
      Object.keys(acceptedAdvancedLiquidity.inputs).length), [
      ['fonteeqh_eql', false], ['fontesessaoanterior', false], ['iniciosessaolq', 0], ['fimsessaolq', 0],
      ['intervalosessaolq', 0], ['modoconfirmacaolq', 0], ['reacaoposcapturaatr', 0.5],
      ['maxbarrasconfirmacaolq', 30], ['filtroidmflip', 0], ['filtrosweepflip', 0], ['modocapturaflip', 0],
    ]);
    assert.deepEqual(Object.entries(updated.inputs).slice(0, Object.keys(acceptedAdvancedLiquidity.inputs).length),
      Object.entries(acceptedAdvancedLiquidity.inputs));
    assert.deepEqual(Object.entries(updated.inputs).slice(Object.keys(acceptedAdvancedLiquidity.inputs).length), [
      ['modobb', 0], ['mostrarbblegacy', true], ['fonteobbb', 0], ['escalabb', 2],
      ['maxbuscaorigemobbb', 20], ['dispatrbb', 1], ['corpominbb', 0.65], ['maxcandlesdispbb', 3], ['maxidadeobbb', 150],
    ]);
    for (const [name, value] of Object.entries(original.constants)) assert.equal(updated.constants[name], value, name);
    return 'hash de referência, 26 inputs e constantes legadas conferidos. Compilação PENDENTE';
  },
  B02() {
    const bars = swingBars();
    const { trace, debug } = compare(bars, { PeriodoSwing: 10, MostrarPivos: true });
    const swing = trace.flatMap((calls, index) => calls
      .filter(([call, title]) => call === 'plottext' && /swing|^(BOS|CHoCH) (alta|baixa)$/.test(title))
      .map(([, title]) => [index, title]));
    assert.deepEqual(swing, [
      [10, 'Fundo swing'], [11, 'Topo swing'], [12, 'BOS alta'], [15, 'CHoCH baixa'],
      [24, 'Fundo swing'], [25, 'BOS baixa'], [36, 'Topo swing'], [37, 'CHoCH alta'],
    ]);
    assert.deepEqual(archived(debug, 3).map((event) => [event.origem, event.confirmacao, event.lo]), [[1, 11, 120], [26, 36, 110]]);
    assert.deepEqual(archived(debug, 4).map((event) => [event.origem, event.confirmacao, event.lo]), [[0, 10, 80], [14, 24, 70]]);
    assert.deepEqual(archived(debug, 7).map((event) => [event.ref, event.confirmacao, event.lo]), [[11, 12, 120], [36, 37, 110]]);
    assert.deepEqual(archived(debug, 8).map((event) => [event.ref, event.confirmacao, event.lo]), [[10, 15, 80], [24, 25, 70]]);
    assert.ok(!labels(compare(bars, { PeriodoSwing: 9 }).trace).some((text) => text.endsWith('swing')));
    return '8 eventos nos preços e barras esperados, com prioridade do topo no empate e sem repetição';
  },
  B03() {
    for (const PeriodoSwing of [10, 50]) {
      const off = compare(prices, { PeriodoSwing }).trace;
      const enabled = compare(prices, { PeriodoSwing, MostrarEstruturaInterna: true }).trace;
      const filtered = compare(prices, { PeriodoSwing, MostrarEstruturaInterna: true, FiltroConfluenciaInterna: true }).trace;
      for (const text of ['BOS interno alta', 'BOS interno baixa', 'CHoCH interno alta', 'CHoCH interno baixa']) {
        assert.ok(labels(enabled).includes(text), text);
      }
      assert.ok(labels(filtered).filter((text) => text.includes('interno')).length < labels(enabled).filter((text) => text.includes('interno')).length);
      assert.deepEqual(labels(enabled).filter((text) => !text.includes('interno')), labels(off));
      assert.deepEqual(labels(filtered).filter((text) => !text.includes('interno')), labels(off));
    }
    assert.equal(updated.constants.janelainterna, 5);
    for (const direction of [1, -1]) {
      for (const variant of ['passa', 'empate', 'igual', 'ausente']) {
        const positive = direction === 1;
        const bars = dated([...Array(5).fill([100, 110, 90, 100]),
          positive ? [100, variant === 'empate' ? 114 : 116, 92, 106]
            : [100, 108, variant === 'empate' ? 92 : 84, 94]]);
        const field = positive ? 'topo' : 'fundo';
        const level = positive ? 105 : 95;
        const { trace } = compare(bars, { MostrarEstruturaInterna: true, FiltroConfluenciaInterna: true }, (model, index) => {
          if (index !== 5) return;
          model.set('tem' + field, variant !== 'ausente');
          model.set('nivel' + field, variant === 'igual' ? level : (positive ? 130 : 70));
          model.set('tem' + field + 'interno', true);
          model.set(field + 'interno', level);
        });
        assert.equal(labels([trace[5]]).includes(positive ? 'BOS interno alta' : 'BOS interno baixa'), variant === 'passa');
      }
    }
    return 'quatro categorias internas, bloqueios nos dois sentidos e swing equivalente nas janelas 10 e 50';
  },
  B04() {
    let internal = 0;
    let swing = 0;
    for (const UsarATRBlocos of [false, true]) {
      for (const MitigarPorFechamento of [false, true]) {
        compare(prices, { PeriodoSwing: 10, MostrarBlocosInternos: true, MostrarBlocosSwing: true, UsarATRBlocos, MitigarPorFechamento },
          undefined, (reference, quiet, debug, bar) => {
            for (const group of [0, 1]) {
              const expected = blockList(reference, bar, group);
              assert.deepEqual(blockList(quiet, bar, group), expected);
              assert.deepEqual(blockList(debug, bar, group), expected);
              if (group === 0) internal = Math.max(internal, expected.length);
              else swing = Math.max(swing, expected.length);
            }
          });
      }
    }
    assert.ok(internal > 0 && swing > 0);
    const bars = swingBars();
    bars[12][2] = 60;
    const rejected = compare(bars, { PeriodoSwing: 10, MostrarBlocosSwing: true }).debug;
    const block = archived(rejected, 11).find(({ nascimento }) => nascimento === 12);
    assert.equal(block.estado, 4);
    assert.equal(block.origem, 1);
    assert.equal(block.ref, 1);
    assert.deepEqual([block.brutolo, block.brutohi], [90, 120]);

    const caps = swingBars().slice(0, 13);
    compare(caps, { PeriodoSwing: 10, MostrarBlocosSwing: true }, (model, index, variant) => {
      if (index === 12) seedBlocks(model, 11, 1, Array.from({ length: 100 }, (_, offset) => ({ low: 50, high: 150 + offset })), variant === 2);
    }, (reference, quiet, debug, index) => {
      if (index === 12) {
        const expected = blockList(reference, index, 1);
        assert.equal(expected.length, 100);
        assert.equal(expected[0][2], 151);
        assert.deepEqual(blockList(quiet, index, 1), expected);
        assert.deepEqual(blockList(debug, index, 1), expected);
      }
    });
    return `quatro combinações, máximos observados de ${internal} internos e ${swing} swing, rejeição na criação e descarte a 100`;
  },
  B05() {
    for (const ModoFaixaOB of [1, 2, 3, 4]) {
      for (const OrdemFaixaOB of [1, 2]) {
        for (const AncorarFaixaOB of [false, true]) {
          compare(prices, { PeriodoSwing: 10, ModoFaixaOB, OrdemFaixaOB, AncorarFaixaOB });
        }
      }
    }
    const flat = dated([[100, 110, 90, 100], [100, 110, 90, 100], [100, 110, 90, 100]]);
    flat[2][4] = 1261103;
    for (const requested of [1, 2, 20, 25]) {
      const { trace } = compare(flat, { MostrarBlocosSwing: true, QuantidadeBlocosSwing: requested }, (model, index, variant) => {
        if (index === 2) seedBlocks(model, 1, 1, Array.from({ length: 20 }, (_, n) => ({ low: 70 - n, high: 110 + n })), variant === 2);
      });
      assert.equal(horizontal(trace[2]).length, Math.min(requested, 20));
    }
    const { trace } = compare(flat, { ModoFaixaOB: 1, AncorarFaixaOB: true }, (model, index, variant) => {
      if (index === 2) seedBlocks(model, 1, 1, [{ low: 50, high: 130, time: 930 }], variant === 2);
    });
    assert.deepEqual(horizontal(trace[2]).map((call) => call.slice(8)), [
      [1261102, 1261102, 40, 930, 2359], [1261103, 0, 40],
    ]);
    const change = dated([[100, 110, 90, 100], [100, 110, 90, 100], [100, 110, 80, 100], [100, 110, 90, 100]]);
    const switching = compare(change, { ModoFaixaOB: 1, AncorarFaixaOB: false }, (model, index, variant) => {
      if (index === 1) seedBlocks(model, 0, 1, [{ low: 70, high: 120 }, { low: 85, high: 115, birth: 1 }], variant === 2);
    }).trace;
    assert.ok(switching[1].some(([call, value]) => call === 'plot2' && value === 85));
    assert.deepEqual(switching[2], [['noplot', 1], ['noplot', 2]]);
    assert.ok(switching[3].some(([call, value]) => call === 'plot2' && value === 70));
    return '16 configurações de faixa, limite de 20, lacuna na troca e virada de sessão';
  },
  B06() {
    const histories = [];
    for (const direction of [1, -1]) {
      for (const [difference, tolerance, expected] of [[0, 0.1, true], [0.5, 0.1, true], [1, 0.1, false], [0, 0, false]]) {
        const bars = dated(Array.from({ length: 205 }, () => [105, 110, 100, 105]));
        const field = direction === 1 ? 'topoeq' : 'fundoeq';
        const price = direction === 1 ? 111 : 99;
        bars[200][direction === 1 ? 1 : 2] = price;
        const { trace, debug } = compare(bars, { MostrarEQHEQL: true, LimiarEQ: tolerance }, (model, index, variant) => {
          if (index !== 203) return;
          model.set('pernaeq', direction === 1 ? 1 : 0);
          model.set('tem' + field, true);
          model.set(field, price - difference);
          model.set('atrwilder', 10);
          if (variant === 2) model.set(direction === 1 ? 'smcorigemeqtopo' : 'smcorigemeqfundo', 195);
        });
        const text = direction === 1 ? 'EQH' : 'EQL';
        assert.equal(labels([trace[203]]).includes(text), expected);
        if (expected) {
          const pair = archived(debug, direction === 1 ? 15 : 16).find(({ nascimento }) => nascimento === 203);
          assert.deepEqual([pair.ref, pair.origem, pair.hi, pair.confirmacao], [195, 200, price, 203]);
        }
        histories.push(bars);
      }
    }
    assert.ok(histories.every((bars) => !labels(compare(bars).trace).some((text) => ['EQH', 'EQL'].includes(text))));
    return 'EQH/EQL nos dois sentidos, preço do segundo pivô, tolerância estrita, limiar zero e saída oculta';
  },
  B07() {
    const base = [100, 105, 95, 100];
    const patterns = [
      { lane: 13, bars: [base, [101, 111, 100, 110], [111, 114, 108, 112], [108, 110, 105, 107], [105, 108, 104, 105]], bounds: [105, 108] },
      { lane: 14, bars: [base, [99, 100, 89, 90], [89, 92, 86, 88], [90, 95, 87, 90], [94, 96, 91, 94]], bounds: [92, 95] },
    ];
    for (const { lane, bars: pattern, bounds } of patterns) {
      const bars = dated([...Array(13).fill(base), ...pattern, base]);
      for (const ExtensaoFVG of [0, 1]) {
        const { trace, debug } = compare(bars, { MostrarFVG: true, ExtensaoFVG, FiltroAutomaticoFVG: true });
        assert.equal(horizontal(trace[15], 'FVG').length, 1);
        assert.equal(horizontal(trace[16], 'FVG').length, 1);
        assert.equal(horizontal(trace[17], 'FVG').length, 0);
        const emitted = horizontal(trace[16], 'FVG')[0];
        assert.deepEqual([emitted[1], emitted[10]], [(bounds[0] + bounds[1]) / 2, (bounds[1] - bounds[0]) / 2]);
        assert.equal(horizontal(trace[16]).length, ExtensaoFVG === 1 ? 2 : 1);
        const gap = archived(debug, lane).find(({ nascimento }) => nascimento === 15);
        assert.deepEqual([gap.ref, gap.origem, gap.confirmacao, gap.publicacao, gap.terminal, gap.estado], [13, 14, 15, 16, 17, 2]);
        assert.deepEqual([gap.lo, gap.hi], bounds);
      }
      const recent = dated(pattern.slice(0, 3));
      assert.equal(horizontal(compare(recent, { MostrarFVG: true }).trace[2], 'FVG').length, 0);
      assert.equal(horizontal(compare(recent, { MostrarFVG: true, FiltroAutomaticoFVG: false }).trace[2], 'FVG').length, 1);
    }
    const bars = dated([[100, 105, 95, 100], [100, 110, 96, 109], [110, 112, 108, 111]]);
    const capped = compare(bars, { MostrarFVG: true, FiltroAutomaticoFVG: false }, (model, index) => {
      if (index !== 2) return;
      model.set('carimbosfvg', 2, 1);
      model.set('quantidadesfvg', 100, 1);
      for (let offset = 1; offset <= 100; offset++) {
        const position = 100 + offset;
        model.set('direcoesfvg', 1, position);
        model.set('formacoesfvg', 1, position);
        model.set('inferioresfvg', 70, position);
        model.set('superioresfvg', 80, position);
        model.set('datasorigemfvg', 1261102, position);
        model.set('datasdireitafvg', 1261102, position);
      }
    }, (reference, quiet, debug, index) => {
      if (index === 2) for (const model of [reference, quiet, debug]) assert.equal(model.element('quantidadesfvg', 2), 100);
    });
    assert.equal(horizontal(capped.trace[2], 'FVG').length, 5);
    return 'FVG espelhado, filtro, toque, mitigação, extensão entre sessões e limites de 5/100';
  },
  B08() {
    const bars = dated(Array.from({ length: 7 }, () => [150, 200, 100, 150]));
    bars[6][4] = 1261103;
    const { trace, debug } = compare(bars, { MostrarZonasPD: true }, (model, index, variant) => {
      if (index !== 5 && index !== 6) return;
      model.set('temtopo', true);
      model.set('temfundo', true);
      model.set('topopd', 200);
      model.set('fundopd', 100);
      model.set('diaorigempd', 1261102);
      model.set('horaorigempd', 930);
      if (variant === 2) model.set('smcorigempd', 0);
    });
    const drawn = horizontal(trace[6]);
    assert.deepEqual(drawn.map((call) => call[5]), ['Premium', 'Equilibrium', 'Discount', '', '', '']);
    assert.deepEqual(drawn.slice(0, 3).map((call) => [call[1] - call[10], call[1] + call[10]]), [[195, 200], [147.5, 152.5], [100, 105]]);
    assert.deepEqual(archived(debug, 17).map(({ lo, hi }) => [lo, hi]), [[100, 200]]);
    const history = swingBars();
    const zones = compare(history, { PeriodoSwing: 10, MostrarZonasPD: true }).debug;
    const snapshots = archived(zones, 17);
    assert.deepEqual(snapshots.find(({ confirmacao }) => confirmacao === 24).origem, 1);
    assert.deepEqual(snapshots.find(({ confirmacao }) => confirmacao === 25).origem, 14);
    assert.ok(!compare(history, { ModoFaixaOB: 4, MostrarZonasPD: true }).trace.some((calls) => horizontal(calls, 'Premium').length));
    return 'seis limites, um rótulo por zona, faixa em duas sessões e redefinição a partir de t+1';
  },
  B09() {
    function breaker(mirror, { enabled = true, order = 1, bounce = false, edge = false, flip = false } = {}) {
      const pre = [105, 110, 100, 105];
      const down = [pre, pre, pre, [116, 120, 106, bounce ? 112 : 108],
        [108, 109, 101, 103], [102, 102, 97, 99], [100, 110, 99, 109],
        [110, 112, 110, 111], [110, 111, 109, 110]];
      if (edge) down.splice(3, 3, [116, 120, 100, 105], [105, 109, 96, 98], [98, 99, 95, 97]);
      const bars = dated(mirror ? down.map(([o, h, l, c]) => [210 - o, 210 - l, 210 - h, 210 - c]) : down);
      for (let index = 6; index < bars.length; index++) bars[index][4] = 1261103;
      return compare(bars, {
        ModoFaixaOB: mirror ? 2 : 1, OrdemFaixaOB: order, MostrarBreakerBlocks: enabled, FiltroAutomaticoFVG: false,
        HabilitarFlip: flip, MostrarFlip: flip,
      }, (model, index, variant) => {
        if (index !== 3) return;
        seedBlocks(model, 2, 1, mirror
          ? [{ side: -1, low: 101, high: 110 }, { side: -1, low: 100, high: 110, birth: 1 }]
          : [{ low: 100, high: 109 }, { low: 100, high: 110, birth: 1 }], variant === 2);
      }).trace;
    }
    for (const mirror of [false, true]) {
      for (const order of [1, 2]) {
        const trace = breaker(mirror, { order });
        assert.deepEqual(breaker(mirror, { order, flip: true }), trace);
        assert.equal(horizontal(trace[5], 'Breaker').length, 0);
        const published = horizontal(trace[6], 'Breaker')[0];
        assert.deepEqual([published[1], published[2], published[8], published[10]], [
          order === 1 ? 105 : (mirror ? 105.5 : 104.5), 'clltgray', 1261102, order === 1 ? 5 : 4.5,
        ]);
        assert.equal(horizontal(trace[7], 'Breaker').length, 1);
        assert.equal(horizontal(trace[8], 'Breaker').length, 0);
      }
      assert.ok(!breaker(mirror, { enabled: false }).some((calls) => horizontal(calls, 'Breaker').length));
      assert.ok(!breaker(mirror, { bounce: true }).some((calls) => horizontal(calls, 'Breaker').length));
      assert.ok(!breaker(mirror, { edge: true }).some((calls) => horizontal(calls, 'Breaker').length));
    }
    return 'modos 1/2, ordens 1/2, repique e toque sem interseção rejeitados, publicação e invalidação na barra seguinte';
  },
  B10() {
    const first = {
      2: [fact(3, 1, 100)],
      4: [fact(4, 3, 90)],
      6: [fact(3, 5, 110)],
      8: [fact(4, 7, 95)],
      9: [fact(7, 5, 110, 1)],
      12: [fact(4, 11, 85)],
      14: [fact(3, 13, 100)],
      15: [fact(8, 11, 85, 1)],
    };
    const closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 111, 94, 92, 90, 90, 90, 84, 84];
    for (const direction of [1, -1]) {
      const inverse = direction === 1 ? first : Object.fromEntries(Object.entries(first).map(([bar, events]) => [bar,
        events.map((event) => fact(event.lane % 2 === 1 ? event.lane + 1 : event.lane - 1,
          event.origin, 200 - event.price, -event.previousBias)),
      ]));
      const model = scripted(closes.map((close) => direction === 1 ? close : 200 - close), inverse);
      const snapshots = archived(model, 19);
      assert.deepEqual(snapshots.filter(({ nascimento }) => [9, 10, 15].includes(nascimento))
        .map(({ nascimento, origem, ref, brutohi, qualificacao }) => [nascimento, origem, ref, brutohi, qualificacao]),
      [[9, 7, 8, direction, 0], [10, -1, -1, 2, 9], [15, 13, 14, -direction, 0]]);
      assert.ok(archived(model, 18).every(({ brutohi }) => brutohi === 0));
      const event = archived(model, direction === 1 ? 7 : 8)[0];
      assert.deepEqual([event.nascimento, event.origem, event.ref, event.confirmacao, event.publicacao, event.qualificacao], [9, 5, 6, 9, 10, 2]);
    }

    const sameBar = scripted([100, 100, 100, 111, 110], { 3: [fact(3, 1, 110), fact(7, 1, 110)] });
    assert.equal(archived(sameBar, 7)[0].qualificacao, 3);
    assert.equal(archived(sameBar, 7)[0].ref, 3);
    const unknown = scripted([...Array(9).fill(90), 101, 101], {
      2: [fact(4, 1, 80)], 4: [fact(3, 3, 90)], 6: [fact(4, 5, 85)], 8: [fact(3, 7, 100)], 9: [fact(7, 7, 100)],
    });
    assert.deepEqual(archived(unknown, 19).filter(({ nascimento }) => nascimento === 9)
      .map(({ ref, brutohi, qualificacao }) => [ref, brutohi, qualificacao]), [[-1, 1, 8]]);
    const returned = scripted([...closes.slice(0, 11), 111, 111], first);
    assert.deepEqual(archived(returned, 19).at(-1).qualificacao, 10);
    assert.equal(archived(returned, 19).at(-1).brutohi, 0);

    const context = { 2: [fact(3, 1, 110)], 4: [fact(7, 1, 110)] };
    for (const buffer of [0, 1, 3]) {
      const model = scripted([100, 100, 100, 110, 111, 112, 113, 114], context, { BufferRupturaSMCTicks: buffer });
      const event = archived(model, 7)[0];
      assert.deepEqual([event.nascimento, event.publicacao, event.qualificacao, event.barraqualificacao], [4, 5, 2, buffer === 3 ? 6 : 4]);
    }
    const touch = scripted([100, 100, 100, 109, 110, 110], context, { BufferRupturaSMCTicks: 0 });
    assert.equal(archived(touch, 7)[0].qualificacao, 4);
    const delayed = Array.from({ length: 107 }, (_, bar) => bar < 4 ? 100 : 111);
    delayed[104] = 113;
    assert.deepEqual(archived(scripted(delayed, context, { BufferRupturaSMCTicks: 3 }), 7)
      .map(({ qualificacao, barraqualificacao }) => [qualificacao, barraqualificacao]), [[2, 104]]);
    delayed[104] = 112;
    delayed[105] = 113;
    assert.deepEqual(archived(scripted(delayed, context, { BufferRupturaSMCTicks: 3 }), 7)
      .map(({ qualificacao, barraqualificacao }) => [qualificacao, barraqualificacao]), [[6, 104]]);
    const cancelled = scripted([100, 100, 100, 110, 111, 110, 113, 114], context, { BufferRupturaSMCTicks: 3 });
    assert.equal(archived(cancelled, 7)[0].qualificacao, 5);
    const replaced = scripted([100, 100, 100, 110, 111, 113, 114], {
      ...context, 5: [fact(3, 4, 115)],
    }, { BufferRupturaSMCTicks: 3 });
    assert.equal(archived(replaced, 7)[0].qualificacao, 18);

    const consecutive = scripted(Array(12).fill(100), {
      2: [fact(3, 1, 110)], 4: [fact(3, 3, 109)], 6: [fact(3, 5, 110)], 8: [fact(4, 7, 90)],
    });
    assert.equal(consecutive.element('smchisttotal', 1), 2);
    assert.equal(consecutive.element('smchistorigem', 200), 5);
    assert.deepEqual(archived(consecutive, 3).map(({ nascimento, ref }) => [nascimento, ref]), [[2, -1], [4, 2], [6, 4]]);

    const atrBars = dated([...Array(14).fill([100, 105, 95, 100]), [115, 118, 114, 116], [116, 117, 114, 116]]);
    const atr = runtime(updated, atrBars, { DebugSMC: true });
    for (let bar = 0; bar <= 13; bar++) atr.step(bar);
    assert.equal(atr.get('smcatrdisponivel'), false);
    atr.step(14);
    assert.equal(atr.get('smcatr'), 10);
    assert.equal(atr.get('atrwilder'), 0);
    atr.step(15);
    assert.equal(atr.get('smcatr'), (13 * 10 + 18) / 14);
    atrBars[14][1] = 113;
    const invalid = runtime(updated, atrBars, { DebugSMC: true });
    atrBars.forEach((_, index) => invalid.step(index));
    assert.equal(invalid.get('smcatrdisponivel'), false);
    const unavailableTick = scripted(Array(17).fill(100), {}, {}, 0);
    assert.equal(unavailableTick.get('smcatrdisponivel'), false);
    assert.equal(archived(unavailableTick, 19).at(-1).qualificacao, 7);
    const invalidInput = scripted(Array(17).fill(100), {}, { PeriodoATRSMC: 1 });
    assert.equal(invalidInput.get('smcconfigvalida'), false);
    assert.equal(archived(invalidInput, 19).at(-1).dadosvalidos, false);
    return 'ruptura causal, espera inclusiva de 100 barras, fluxo/proteção espelhados, alternância, timestamps e ATR separado';
  },
  B11() {
    const options = {
      PeriodoSwing: 10, DebugSMC: true, MostrarPivos: true, MostrarEstruturaInterna: true,
      MostrarBlocosInternos: true, MostrarBlocosSwing: true, MostrarEQHEQL: true, MostrarFVG: true, MostrarZonasPD: true,
    };
    compare(prices, options);
    const bars = prices.slice(0, 410).map((bar) => bar.slice());
    const reload = runtime(updated, bars, options);
    const replay = runtime(updated, bars, options);
    const historicalLoad = runtime(updated, bars, options);
    for (let index = 0; index < bars.length; index++) {
      const expected = reload.step(index);
      const loaded = historicalLoad.step(index, index === bars.length - 1);
      if (index === bars.length - 1) assert.deepEqual(loaded, expected);
      const current = bars[index];
      const previousCount = replay.get('smcpublicados');
      bars[index] = [current[0], current[1] + 4, current[2] - 3, current[0], current[4], current[5]];
      replay.step(index);
      const count = replay.get('smcpublicados');
      assert.equal(replay.get('smcorigempublicada'), index - 1);
      assert.ok(index === 0 ? count === 0 : count > previousCount);
      bars[index] = current;
      assert.deepEqual(replay.step(index), expected);
      assert.equal(replay.get('smcpublicados'), count);
    }
    for (let lane = 1; lane <= 19; lane++) {
      assert.deepEqual(archived(replay, lane), archived(reload, lane));
      assert.deepEqual(archived(historicalLoad, lane), archived(reload, lane));
    }
    const jumped = runtime(updated, bars, options);
    jumped.step(0);
    jumped.step(1);
    jumped.step(4);
    assert.equal(jumped.get('smcloteausente'), true);
    assert.equal(jumped.get('smcorigempublicada'), 0);
    return '410 barras, dois ticks por barra, 19 partições idênticas e salto de histórico diagnosticado';
  },
  B12() {
    const options = { PeriodoSwing: 10, MostrarBlocosSwing: true, MostrarBlocosInternos: true, MostrarFVG: true };
    function timed(program, overrides) {
      const times = [];
      let model;
      for (let trial = 0; trial < 3; trial++) {
        model = runtime(program, prices, overrides);
        const start = performance.now();
        prices.forEach((_, index) => model.step(index, index === prices.length - 1));
        times.push(performance.now() - start);
      }
      return { elapsed: times.sort((a, b) => a - b)[1], model };
    }
    const reference = timed(original, options);
    const quiet = timed(updated, options);
    const debug = timed(updated, { ...options, DebugSMC: true });
    for (let lane = 1; lane <= 19; lane++) assert.ok(archived(debug.model, lane).length <= 100);
    assert.deepEqual(archived(debug.model, 19).map(({ nascimento }) => nascimento), Array.from({ length: 100 }, (_, index) => 749 + index));
    assert.ok(debug.model.get('smcreciclados') > 0);
    assert.ok(debug.model.get('smcmaiorlote') <= 320);
    assert.equal(debug.model.get('smcrejeitadoscapacidade'), 0);

    const bars = dated([[100, 105, 95, 100], [101, 111, 100, 110], [111, 114, 108, 112], [112, 115, 110, 113]]);
    const full = runtime(updated, bars, { DebugSMC: true, FiltroAutomaticoFVG: false });
    for (let index = 0; index < 3; index++) full.step(index);
    full.set('smcusados', 100, 13);
    for (let offset = 0; offset < 100; offset++) {
      const position = 640 + 12 * 100 + offset;
      full.set('smceventoestado', 0, position);
      full.set('smceventonascimento', 200 + offset, position);
    }
    full.step(3);
    assert.equal(full.get('smcrejeitadoscapacidade'), 1);
    assert.equal(archived(full, 13)[0].nascimento, 200);
    assert.equal(full.element('smceventoqualificacao', 0), 17);
    return `100 por partição, ativos preservados e CAPACITY_FULL. Mediana local em ms, referência/off/on ${[reference, quiet, debug].map(({ elapsed }) => elapsed.toFixed(1)).join('/')}`;
  },
  F01() {
    for (const scale of [0, 1]) {
      for (const side of [1, -1]) {
        const fixture = flipFixture(scale, side);
        assert.equal(fixture.events.length, 1);
        const event = fixture.events[0];
        assert.deepEqual([event.extremo, event.meio, event.reacao], [10, 12, 14]);
        assert.deepEqual([event.origemextremo, event.origemmeio, event.origemreacao], [9, 11, 13]);
        assert.deepEqual([event.nivel, event.extremopreco, event.reacaopreco], side === -1 ? [100, 120, 112] : [100, 80, 88]);
        assert.deepEqual([event.cruzamento, event.confirmacao, event.publicacao], [15, 15, 16]);
        assert.equal(fixture.progress[15][0], 2);
        assert.equal(fixture.trace.slice(0, 16).flatMap(segments).length, 0);
        const [line] = segments(fixture.trace[16]);
        assert.deepEqual(line, ['linesegment', 100, 100, fixture.bars[12][4], fixture.bars[15][4], false,
          `FLIP${side === 1 ? '+' : '−'} ${scale === 0 ? 'I' : 'S'}`, side === 1 ? 32768 : 255,
          1, 0, 8, 1, fixture.bars[12][5], fixture.bars[15][5]]);
      }
    }
    assert.equal(flipFixture(0, -1, { config: { EscalaFlip: 1 } }).events.length, 0);
    assert.equal(flipFixture(1, -1, { config: { EscalaFlip: 0 } }).events.length, 0);
    assert.equal(flipFixture(0, -1, { config: { EscalaFlip: 2 } }).events.length, 1);
    const invalid = flipFixture(1, -1, { config: { EscalaFlip: 3 } });
    assert.equal(invalid.model.get('flipconfigvalida'), false);
    assert.equal(invalid.events.length, 0);
    return 'compra e venda em ambas as escalas, IDs, preço, rótulo, escala e publicação B+1';
  },
  F02() {
    const unavailable = flipFixture(1, -1, { config: { PeriodoATRSMC: 14 } });
    assert.deepEqual(unavailable.progress[13], [0, 11]);
    assert.equal(unavailable.events.length, 0);
    assert.equal(flipFixture(1, -1, { config: { PeriodoATRSMC: 14, ReacaoMinFlipATR: 0 } }).events.length, 1);
    const insufficient = flipFixture(1, -1, { config: { ReacaoMinFlipATR: 2 } });
    assert.deepEqual(insufficient.progress[15], [1, 12]);
    const equal = flipFixture(1, -1, { events: { 14: [[1, 13, 119]] } });
    assert.deepEqual(equal.progress[15], [1, 13]);
    const currentFlow = flipFixture(1, -1, {
      closes: [...flipCloses.slice(0, 9), 100, 100, 100, 106, ...flipCloses.slice(13)],
      events: { 9: [], 10: [], 12: [[2, 11, 100], [5, 5, 105]] },
    });
    assert.equal(currentFlow.model.element('smcfluxo', 1), 1);
    assert.equal(currentFlow.events.length, 0);
    return 'fluxo prévio, ATR indisponível ou insuficiente, reação mínima em ticks e tolerância estrita';
  },
  F03() {
    const early = flipFixture(1, -1, { events: { 14: [], 15: [[1, 13, 112]] } });
    assert.deepEqual(early.progress[16], [0, 4]);
    assert.equal(early.events.length, 0);
    const overwritten = flipFixture(1, -1, { closes: [...flipCloses.slice(0, 15), 101, 99],
      events: { 15: [[2, 14, 98]] } });
    assert.equal(overwritten.events.length, 1);
    assert.deepEqual([overwritten.events[0].meio, overwritten.events[0].legado, overwritten.events[0].confirmacao], [12, -1, 16]);
    const linked = flipFixture(1, -1, { events: { 15: [[6, 11, 100, 1]] } });
    assert.deepEqual([linked.events[0].legado, linked.events[0].tipolegado], [15, 2]);
    const touch = flipFixture(1, -1, { closes: [...flipCloses.slice(0, 15), 100, 101, 99] });
    assert.deepEqual(touch.progress.slice(16, 18), [[2, 2], [2, 2]]);
    assert.equal(touch.events[0].confirmacao, 17);
    assert.deepEqual(segments(touch.trace[18])[0].slice(3, 5), [touch.bars[12][4], touch.bars[17][4]]);
    assert.notEqual(touch.bars[12][4], touch.bars[17][4]);
    return 'reação tardia rejeitada, pavio e toque preservam, nível congelado e vínculo legado opcional';
  },
  F04() {
    const series = [...flipCloses, 98, 97];
    const pending = flipFixture(1, -1, { closes: series, config: { BufferRupturaSMCTicks: 3 },
      events: { 15: [[6, 11, 100, 1]] } });
    assert.deepEqual([pending.events[0].cruzamento, pending.events[0].legado, pending.events[0].confirmacao], [15, 15, 17]);
    const returned = flipFixture(1, -1, { closes: [...flipCloses, 100, 97], config: { BufferRupturaSMCTicks: 3 } });
    assert.equal(returned.events.length, 0);
    assert.deepEqual(returned.progress[17], [0, 10]);
    assert.equal(flipFixture(1, -1, { config: { MaxBarrasFlip: 3 } }).events.length, 1);
    assert.deepEqual(flipFixture(1, -1, { config: { MaxBarrasFlip: 2 } }).progress[16], [0, 6]);
    assert.equal(flipFixture(1, -1, { config: { MaxBarrasFlip: 0 } }).events.length, 1);
    const zero = flipFixture(1, -1, { closes: [...flipCloses.slice(0, 15), 100, 99],
      config: { BufferRupturaSMCTicks: 0 } });
    assert.equal(zero.events[0].confirmacao, 16);
    return 'primeiro cruzamento, buffer posterior, retorno e prazo inclusivo ou ilimitado';
  },
  F05() {
    for (const [envelope, config, reason] of [
      [{ 15: [99, 99, 97, 99] }, { PermitirGapFlip: false }, 9],
      [{ 15: [108, 121, 98, 99] }, {}, 8],
      [{ 15: [99, 98, 95, 99] }, {}, 7],
      [{ 15: [115, 123, 109, 121] }, {}, 5],
    ]) {
      const test = flipFixture(1, -1, { envelope, config });
      assert.deepEqual(test.progress[16], [0, reason]);
      assert.equal(test.events.length, 0);
    }
    assert.equal(flipFixture(1, -1, { envelope: { 15: [99, 99, 97, 99] } }).events.length, 1);
    return 'gap permitido/bloqueado, dupla penetração, OHLC inválido e extremo original';
  },
  F06() {
    for (const context of [0, 1, -1]) {
      const test = flipFixture(0, -1, { before(model, index) {
        if (index === 16) model.set('smcfluxo', -context, 1);
      } });
      assert.equal(test.events[0].contexto, context);
      assert.equal(test.events[0].reversao, false);
    }
    const external = flipFixture(1, -1, { closes: [...flipCloses.slice(0, 15), 89] });
    assert.equal(external.events[0].reversao, true);
    assert.equal(flipFixture().events[0].reversao, false);
    const subsequent = flipFixture(1, -1, {
      closes: [...flipCloses, 98, 99, 102, 103, 94, 100, 121],
      events: { 17: [[2, 16, 96]], 19: [[1, 18, 107]], 20: [[6, 16, 96, -1]] },
      repeat: true,
    });
    assert.deepEqual(subsequent.events.map(({ confirmacao, nivel, continuacao, falha }) => [confirmacao, nivel, continuacao, falha]),
      [[15, 100, 20, 22], [20, 96, -1, 22]]);
    assert.deepEqual(subsequent.trace.flatMap(segments).map((line) => line[1]), [100, 96]);
    return 'contextos interno/externo, perda protegida swing, continuação e falha preservam o evento original';
  },
  F07() {
    function filled(terminal) {
      return flipFixture(1, -1, { before(model, index, lane) {
        if (index !== 16) return;
        model.set('flipusados', 100, lane);
        const base = (lane - 1) * 100;
        for (let index = base; index < base + 100; index++) {
          model.set('flipeventofalha', index === base && terminal ? 3 : -1, index);
          model.set('flipeventoextremopreco', 130, index);
          model.set('flipeventocontinuacao', -1, index);
        }
      } });
    }
    const full = filled(false);
    assert.deepEqual(full.progress[16], [0, 17]);
    assert.equal(full.model.get('flipsemvagatotal'), 1);
    assert.equal(full.model.get('fliptotal'), 0);
    assert.equal(segments(full.trace[16]).length, 0);
    const recycled = filled(true);
    assert.equal(recycled.events.length, 100);
    assert.equal(recycled.events[0].confirmacao, 15);
    assert.equal(recycled.model.get('fliptotal'), 1);
    return 'cap de 100 por partição, rejeição sem sobrescrever ativos e reciclagem de terminal';
  },
  F08() {
    const shown = flipFixture(1, -1, { repeat: true, config: { MostrarCandidatosFlip: true } });
    assert.equal(segments(shown.trace[15])[0][6], 'Candidato − S');
    assert.equal(segments(shown.trace[16])[0][6], 'FLIP− S');
    const hidden = flipFixture(1, -1, { repeat: true, config: { MostrarFlip: false } });
    assert.deepEqual(hidden.events, shown.events);
    assert.equal(hidden.trace.flatMap(segments).length, 0);
    const reload = flipFixture(1, -1, { historical: true });
    assert.deepEqual(reload.events, shown.events);
    const exclusive = flipFixture(1, -1, { config: { ModoFaixaOB: 1, MostrarCandidatosFlip: true } });
    assert.deepEqual(exclusive.events, shown.events);
    assert.equal(exclusive.trace.flatMap(segments).length, 0);
    return 'mesmos registros após recarga e reavaliação, guias opcionais e desenho apenas no modo 0';
  },
  F09() {
    for (const DebugSMC of [false, true]) {
      for (const ModoFaixaOB of [0, 1, 2, 3, 4]) {
        const options = { DebugSMC, ModoFaixaOB, PeriodoSwing: 10, MostrarPivos: true, MostrarEstruturaInterna: DebugSMC,
          MostrarBlocosSwing: true, MostrarBlocosInternos: DebugSMC, MostrarEQHEQL: true, MostrarFVG: true,
          MostrarZonasPD: true, MostrarBreakerBlocks: true };
        const ref = runtime(accepted, prices, options);
        const off = runtime(updated, prices, { ...options, MostrarFlip: true });
        const on = runtime(updated, prices, { ...options, HabilitarFlip: true, MostrarFlip: true });
        let segmentsDrawn = 0;
        for (let bar = 0; bar < prices.length; bar++) {
          const legacy = ref.step(bar);
          assert.deepEqual(off.step(bar), legacy);
          const withFlip = on.step(bar);
          assert.deepEqual(withFlip.filter(([draw]) => draw !== 'linesegment'), legacy);
          segmentsDrawn += segments(withFlip).length;
        }
        if (ModoFaixaOB === 0) {
          assert.ok(on.get('fliptotal') > 0);
          assert.equal(segmentsDrawn, on.get('fliptotal'));
          if (!DebugSMC) assert.ok(archived(on, 1).length > 0);
        } else assert.equal(segmentsDrawn, 0);
        for (let lane = 1; lane <= 19; lane++) assert.deepEqual(archived(off, lane), archived(ref, lane));
      }
    }
    return 'comparação com smc-08a em 850 barras, cinco modos e os dois estados de DebugSMC, com Flips gerados pelo fonte';
  },
  P01() {
    for (const scale of [0, 1]) {
      for (const side of [-1, 1]) {
        for (const type of [0, 1, 2]) {
          const { trace, bars } = flipFixture(scale, side, {
            envelope: poiLeg, config: { MostrarFaixasFlip: true, TipoZonaFlip: type },
          });
          const label = side === -1 ? 'POI FLIP-' : 'POI FLIP+';
          assert.equal(horizontal(trace[15], label).length, 0);
          const [zone] = horizontal(trace[16], label);
          const center = type === 1 ? 110.5 : 109.5;
          assert.equal(zone[1], side === -1 ? center : 200 - center);
          assert.equal(zone[10], type === 1 ? 1.5 : 2.5);
          assert.deepEqual(zone.slice(8, 10), [bars[15][4], bars[15][4]]);
          assert.equal(zone[11], bars[15][5]);
          assert.equal(horizontal(trace[16], '').filter((call) => call[1] === zone[1] && call[10] === 0).length, 1);
        }
      }
    }
    return 'geometria nas duas direções e escalas, publicação em B+1 e meio opcional';
  },
  P02() {
    const bounds = ({ zones: [zone] }) => [zone.origemzona, zone.lozona, zone.hizona];
    const fallback = { 13: [110, 114, 106, 110], 14: [108, 111, 105, 108], 15: [99, 103, 95, 99] };
    assert.deepEqual(bounds(poiFixture({ envelope: fallback })), [13, 106, 114]);
    for (const config of [{ FallbackPivoFlip: false }, { MaxBuscaOrigemFlip: 1 }]) {
      const absent = poiFixture({ envelope: fallback, config });
      assert.equal(absent.events.length, 1);
      assert.equal(absent.zones.length, 0);
      assert.equal(absent.reason, 10);
    }
    assert.deepEqual(bounds(poiFixture({ envelope: { 13: [109, 112.25, 107.25, 110] } })), [13, 107, 113]);
    assert.deepEqual(bounds(poiFixture({ envelope: { 15: [99, 109, 95, 99] } })), [13, 107, 112]);
    const base = {
      events: { 14: [[1, 12, 112]] },
      envelope: { 12: [105, 106, 101, 105], 13: [108, 109, 103, 108], 14: [109, 112, 107, 110] },
    };
    assert.deepEqual(bounds(poiFixture({ ...base, config: { TipoZonaFlip: 2 } })), [14, 101, 112]);
    assert.deepEqual(bounds(poiFixture({ ...base, config: { TipoZonaFlip: 2, MaxBaseCandlesFlip: 2 } })), [14, 103, 112]);
    assert.deepEqual(bounds(poiFixture({ ...base, config: {
      TipoZonaFlip: 2, PeriodoATRSMC: 50, ReacaoMinFlipATR: 0,
    } })), [14, 107, 112]);
    for (const config of [{ MaxLarguraFlipATR: 0.01 }, { MaxLarguraFlipATR: 1, PeriodoATRSMC: 50, ReacaoMinFlipATR: 0 }]) {
      const wide = poiFixture({ config });
      assert.equal(wide.events.length, 1);
      assert.equal(wide.zones.length, 0);
      assert.equal(wide.reason, 12);
    }
    assert.equal(poiFixture({ config: { TipoZonaFlip: 3 } }).reason, 15);
    return 'fallback, janela, arredondamento externo, BASE contígua, ATR indisponível e largura';
  },
  P03() {
    const wait = { envelope: { 13: [109, 112, 98, 110] }, config: { ExigirFreshFlip: true } };
    assert.equal(poiFixture(wait).zones[0].estado, 1);
    assert.equal(poiFixture({ ...wait, tail: [[97, 99, 94, 96]] }).zones[0].estado, 2);
    const pre = { envelope: { 14: [110, 111, 103, 105] } };
    const acceptedZone = poiFixture(pre).zones[0];
    assert.equal(acceptedZone.pre, true);
    assert.equal(acceptedZone.estado, 3);
    assert.equal(acceptedZone.profundidade, 0.4);
    const rejected = poiFixture({ ...pre, config: { ExigirFreshFlip: true } });
    assert.equal(rejected.events.length, 1);
    assert.equal(rejected.zones.length, 0);
    assert.equal(rejected.reason, 14);
    const distal = poiFixture({
      events: { 14: [[1, 12, 112]] },
      envelope: { 12: [104, 108, 101, 105], 13: [110, 112, 108, 110],
        14: [114, 115, 107, 113], 15: [112, 113, 95, 99] },
    });
    assert.equal(distal.events.length, 1);
    assert.equal(distal.reason, 13);
    return 'WAIT_EXIT aceito pelo filtro, saída posterior, PRE_MITIGATED e distal antes de B';
  },
  P04() {
    const envelope = { 13: [109, 112, 106, 110] };
    const touches = [[99, 106, 96, 100], [100, 109, 98, 101], [101, 112, 97, 100]];
    for (const side of [-1, 1]) {
      for (const [depth, state, length] of [[0, 3, 1], [0.5, 4, 2], [1, 5, 3]]) {
        const [zone] = poiFixture({ side, envelope, tail: touches.slice(0, length) }).zones;
        assert.deepEqual([zone.profundidade, zone.estado, zone.visitas], [depth, state, 1]);
      }
    }
    const gap = [114, 116, 113, 114];
    const skipped = poiFixture({ envelope, tail: [gap] }).zones[0];
    assert.deepEqual([skipped.estado, skipped.visitas, skipped.intersecaoinvalidacao], [6, 0, false]);
    assert.equal(poiFixture({ envelope, tail: [[108, 112, 104, 112]] }).zones[0].estado, 5);
    const outside = [101, 104, 98, 100];
    const incomingWrong = poiFixture({ envelope, tail: [...touches, gap, [112, 114, 110, 112], outside, touches[0]],
      config: { BufferInvalidacaoTicksFlip: 5 } }).zones[0];
    assert.deepEqual([incomingWrong.estado, incomingWrong.visitas, incomingWrong.profundidade], [5, 2, 1]);
    assert.equal(poiFixture({ envelope, tail: [...touches, outside, touches[0]],
      config: { MaxVisitasFlip: 1 } }).zones[0].fimzona, 19);
    const hidden = poiFixture({ envelope, tail: touches, config: { OcultarMitigadasFlip: 50 } });
    assert.equal(horizontal(hidden.trace.at(-1), 'POI FLIP-').length, 0);
    assert.equal(hidden.zones[0].fimzona, -1);
    assert.equal(poiFixture({ envelope, tail: touches, config: { EncerrarAposMitigacaoFlip: 50 } }).zones[0].fimzona, 17);
    return 'simetria, toque, profundidade máxima, visitas, gap e controles de mitigação';
  },
  P05() {
    const touch = [99, 107, 96, 100];
    const reaction = [101, 113, 94, 95];
    const config = { ModoRetesteFlip: 1, ReacaoRetesteATRFlip: 0 };
    assert.equal(poiFixture({ tail: [touch, reaction], config }).zones[0].reteste, 17);
    const simultaneous = poiFixture({ tail: [touch, reaction],
      config: { ...config, ModoInvalidacaoFlip: 1, MaxIdadeFlip: 1, MostrarInvalidadasFlip: 2, CorInvalidadaFlip: 12345 } });
    assert.deepEqual([simultaneous.zones[0].fimzona, simultaneous.zones[0].estado,
      simultaneous.zones[0].reteste, simultaneous.zones[0].intersecaoinvalidacao], [17, 6, -1, true]);
    assert.equal(horizontal(simultaneous.trace.at(-1), 'POI FLIP-')[0][2], 12345);
    assert.equal(poiFixture({ tail: [touch, reaction], config: { ...config, MaxIdadeFlip: 1 } }).zones[0].estado, 7);
    const hold = [107, 108, 106, 107];
    assert.equal(poiFixture({ tail: [touch, hold, hold], config: { ...config, MaxBarrasRetesteFlip: 1 } }).zones[0].statusreteste, 4);
    const mode2 = { tail: [[100, 104, 97, 100], touch, reaction], config: { ...config, ModoRetesteFlip: 2 } };
    assert.equal(poiFixture(mode2).zones[0].statusreteste, 3);
    const qualified = poiFixture({ ...mode2, before(model, index) {
      if (index === 17) stageFacts(model, 16, [fact(2, 15, 96)]);
    } }).zones[0];
    assert.deepEqual([qualified.alvoref, qualified.reteste, qualified.statusreteste], [16, 18, 2]);
    const tooLate = poiFixture({ ...mode2, before(model, index) {
      if (index === 18) stageFacts(model, 17, [fact(2, 16, 96)]);
    } }).zones[0];
    assert.equal(tooLate.statusreteste, 3);
    const laterVisit = poiFixture({
      tail: [[100, 104, 97, 100], touch, [100, 105, 97, 100], [104, 111, 100, 107], [102, 104, 94, 95]],
      config: { ModoRetesteFlip: 2, ReacaoRetesteATRFlip: 1.55, PeriodoATRSMC: 2 },
      before(model, index) {
        if (index === 17) stageFacts(model, 16, [fact(2, 15, 96)]);
      },
    }).zones[0];
    assert.deepEqual([laterVisit.visitas, laterVisit.reteste], [2, -1]);
    return 'reteste posterior, alvo interno prévio, prazo inclusivo e prioridade da invalidação';
  },
  P06() {
    function seeded(count, terminal, duplicate) {
      return poiFixture({ before(model, index, lane) {
        if (index !== 16) return;
        model.set('poiusados', count, lane);
        model.set('poiidtotal', count);
        for (let offset = 0; offset < count; offset++) {
          const slot = (lane - 1) * 100 + offset;
          model.set('poiid', offset + 1, slot);
          model.set('poifimzona', terminal && offset < 2 ? 3 - offset : -1, slot);
          model.set('poiorigemzona', duplicate && offset === 0 ? 13 : 0, slot);
          model.set('poilozona', duplicate && offset === 0 ? 107 : 200, slot);
          model.set('poihizona', duplicate && offset === 0 ? 112 : 210, slot);
          model.set('poiestado', 2, slot);
        }
      }, config: { MostrarFaixasFlip: false } });
    }
    const linked = seeded(1, false, true);
    assert.equal(linked.zones.length, 1);
    assert.equal(linked.zoneId, 1);
    const saturated = seeded(100, false, false);
    assert.equal(saturated.events.length, 1);
    assert.equal(saturated.reason, 17);
    assert.equal(saturated.zoneId, 0);
    assert.deepEqual(saturated.zones.map(({ id }) => id), Array.from({ length: 100 }, (_, i) => i + 1));
    const recycled = seeded(100, true, false);
    assert.equal(recycled.zones.length, 100);
    assert.equal(recycled.zones[0].id, 1);
    assert.equal(recycled.zones[1].id, 101);
    assert.equal(recycled.zoneId, 101);
    const ranked = poiFixture({ config: { MaxFlipVisiveis: 2 }, before(model, index, lane) {
      if (index !== 16) return;
      model.set('poiusados', 3, lane);
      model.set('poiidtotal', 3);
      for (const [offset, origin] of [[0, 9], [1, 8], [2, 9]]) {
        const slot = (lane - 1) * 100 + offset;
        model.set('poiid', offset + 1, slot);
        model.set('poilados', -1, slot);
        model.set('poilozona', 200 + offset * 10, slot);
        model.set('poihizona', 204 + offset * 10, slot);
        model.set('poiorigemzona', origin, slot);
        model.set('poifimzona', -1, slot);
        model.set('poiestado', 2, slot);
        model.set('poiativacao', 12, slot);
        model.set('poidia', 1261102, slot);
        model.set('poihora', 1030, slot);
      }
    } });
    assert.deepEqual(horizontal(ranked.trace[16], 'POI FLIP-').map((call) => call[1]), [109.5, 222]);
    return 'vínculo por geometria, capacidade, reciclagem e ordem estável com limite visual';
  },
  P07() {
    const tail = Array.from({ length: 18 }, () => [98, 103, 96, 99]);
    tail.at(-1).splice(0, 4, 113, 115, 113, 114);
    const live = poiFixture({ tail, repeat: true });
    const reload = poiFixture({ tail, historical: true });
    assert.deepEqual(live.zones, reload.zones);
    assert.deepEqual(live.trace.at(-1), reload.trace.at(-1));
    const [opening, middle, ending] = horizontal(live.trace.at(-1)).filter((call) => call[10] === 2.5);
    assert.deepEqual(opening.slice(8), [live.bars[15][4], live.bars[15][4], 2.5, live.bars[15][5], 2359]);
    assert.deepEqual(middle.slice(8), [live.bars[16][4], live.bars[16][4], 2.5]);
    assert.deepEqual(ending.slice(8), [live.bars[33][4], live.bars[33][4], 2.5, 0, live.bars[33][5]]);
    assert.equal(horizontal(poiFixture({ config: { MeioZonaFlip: false } }).trace[16], '').length, 0);
    assert.equal(horizontal(poiFixture({ tail, config: { MostrarInvalidadasFlip: 0 } }).trace.at(-1), 'POI FLIP-').length, 0);

    const bars = dated(Array.from({ length: 140 }, (_, index) => {
      const close = Math.round(100 + 14 * Math.sin(index / 5) + 5 * Math.cos(index / 2));
      return [close, close + 4, close - 4, close];
    }));
    for (const mode of [0, 1, 2, 3, 4]) {
      const options = { HabilitarFlip: true, MostrarFlip: true, MostrarCandidatosFlip: true,
        PeriodoSwing: 10, ModoFaixaOB: mode, MostrarFVG: true, MostrarBlocosSwing: true, MostrarBreakerBlocks: true };
      const old = runtime(acceptedFlip, bars, options);
      const newer = runtime(updated, bars, { ...options, MostrarFaixasFlip: mode > 0 });
      for (let bar = 0; bar < bars.length; bar++) assert.deepEqual(newer.step(bar), old.step(bar));
      for (let lane = 1; lane <= 4; lane++) assert.deepEqual(flipArchive(newer, lane), flipArchive(old, lane));
    }
    return 'reavaliação, recarga, três sessões, meio opcional e comparação com a revisão aceita da 09A';
  },
  A01() {
    for (const side of [-1, 1]) {
      const equal = { side, events: { 14: [[1, 13, 120]] }, envelope: { 13: [110, 120, 106, 110] } };
      assert.equal(poiFixture(equal).events.length, 0);
      const eq = poiFixture({ ...equal, config: { ModoFalhaFlip: 1 } });
      assert.equal(eq.events.length, 1);
      assert.equal(qualification(eq).modofalha, 1);
      const sweep = { side, events: { 14: [[1, 13, 122]] }, envelope: { 13: [110, 122, 106, 110] } };
      assert.equal(poiFixture({ ...sweep, config: { ModoFalhaFlip: 1 } }).events.length, 0);
      const accepted = poiFixture({ ...sweep, config: { ModoFalhaFlip: 2 } });
      assert.equal(accepted.events.length, 1);
      assert.equal(qualification(accepted).modofalha, 2);
      const unrecovered = poiFixture({ ...sweep, envelope: { 13: [115, 122, 106, 121] }, config: { ModoFalhaFlip: 2 } });
      assert.equal(unrecovered.events.length, 0);
    }
    return 'EQ e varredura de dois ticks com recuperação em compra e venda';
  },
  A02() {
    const volumeRows = { 12: [105, 109, 101, 105, 10], 13: [...poiLeg[13], 10], 14: [...poiLeg[14], 10] };
    const strong = { ...volumeRows, 15: [108, 109, 95, 96, 15] };
    for (const side of [-1, 1]) {
      const filters = { FiltroDispFlip: 2, FiltroVolumeFlip: 2, PeriodoVolumeFlip: 3 };
      const clean = poiFixture({ side, envelope: strong, config: filters });
      assert.deepEqual([qualification(clean).qualestado, qualification(clean).dispem, qualification(clean).volumeem,
        qualification(clean).nota, clean.zones.length], [2, 15, 15, 2, 1]);
      const lowVol = { ...volumeRows, 15: [108, 109, 95, 96, 14] };
      const missing = poiFixture({ side, envelope: lowVol, config: { ...filters, MaxBarrasFVGFlip: 0 } });
      assert.deepEqual([qualification(missing).qualestado, qualification(missing).volumeem, missing.zones.length], [3, -1, 0]);
      const optional = poiFixture({ side, envelope: lowVol, config: { ...filters, FiltroVolumeFlip: 1 } });
      assert.deepEqual([qualification(optional).qualestado, qualification(optional).nota], [2, 1]);
      const gapWithoutBody = poiFixture({ side, envelope: { 15: [99, 99, 99, 99] },
        config: { FiltroDispFlip: 2, MaxBarrasFVGFlip: 0 } });
      assert.deepEqual([gapWithoutBody.events.length, qualification(gapWithoutBody).qualestado], [1, 3]);
      const noAtr = poiFixture({ side, envelope: strong,
        config: { FiltroDispFlip: 2, PeriodoATRSMC: 50, ReacaoMinFlipATR: 0, MaxBarrasFVGFlip: 0 } });
      assert.equal(qualification(noAtr).qualestado, 3);
    }
    const combined = { ...volumeRows, 14: [110, 111, 102, 103, 10], 15: [104, 106, 98, 99, 15] };
    const config = { FiltroDispFlip: 2, DispATRFlip: 1.2, MaxBarrasFVGFlip: 0 };
    assert.equal(qualification(poiFixture({ envelope: combined, config })).dispem, 15);
    assert.equal(qualification(poiFixture({ envelope: combined, config: { ...config, MaxCandlesDispFlip: 1 } })).dispem, -1);
    return 'corpos combinados, ATR indisponível, gap sem corpo e volume comparado somente com a média anterior';
  },
  A03() {
    const config = { FiltroFVGFlip: 2, FiltroAutomaticoFVG: false, MostrarFVG: false };
    for (const side of [-1, 1]) {
      const pending = poiFixture({ side, config });
      assert.deepEqual([pending.events.length, qualification(pending).qualestado, pending.zones.length], [1, 1, 0]);
      const late = poiFixture({ side, config, tail: [[100, 103, 96, 98]], repeat: true });
      assert.deepEqual([late.events[0].confirmacao, qualification(late).fvgem, qualification(late).qualbarra,
        qualification(late).qualpublicacao, late.zones[0].ativacao], [15, 16, 16, 17, 16]);
      assert.equal(late.trace.flat().some(([draw, , , , , label]) => draw === 'horizontallinecustom' && label === 'FVG'), false);
      assert.equal(segments(late.trace[16]).length, 0);
      assert.equal(segments(late.trace[17]).length, 1);
      assert.equal(qualification(poiFixture({ side, config, tail: [[99, 103, 97, 100]] })).qualestado, 4);
      assert.equal(qualification(poiFixture({ side, config, tail: [[98, 97, 96, 98]] })).qualestado, 4);
      const onDeadline = [[104, 110, 93, 94], [93, 94, 90, 91]];
      assert.equal(qualification(poiFixture({ side, config, tail: onDeadline })).qualbarra, 17);
      assert.equal(qualification(poiFixture({ side, config: { ...config, MaxBarrasFVGFlip: 1 }, tail: onDeadline })).qualestado, 3);
    }
    return 'detector FVG oculto, janela inclusiva e qualificação sem publicação retroativa';
  },
  A04() {
    for (const side of [-1, 1]) {
      const config = { FiltroFibFlip: 3, MostrarFibFlip: true };
      const base = poiFixture({ side, config, tail: [[92, 105, 87, 90]] });
      const fib = qualification(base);
      assert.deepEqual([fib.fiblo, fib.fibhi], side === -1 ? [95, 112] : [88, 105]);
      assert.equal(base.zones.length, 1);
      const rulers = segments(base.trace.at(-1)).filter((line) => line[6].startsWith('Fib'));
      assert.equal(rulers.length, 3);
      assert.equal(rulers[0][1], side === -1 ? 103.5 : 96.5);
      const entire = poiFixture({ side, config: { ...config, ModoLocalizacaoFlip: 1 } });
      assert.deepEqual([entire.events.length, entire.zones.length, entire.reason], [1, 0, 16]);
      assert.equal(poiFixture({ side, config: { ...config, ModoLocalizacaoFlip: 2 } }).zones.length, 1);
      assert.equal(poiFixture({ side, config: { FiltroFibFlip: 2, ModoRangeFlip: 1 } }).reason, 16);
      assert.equal(poiFixture({ side, config: { FiltroFibFlip: 4, FibCustomMin: 83, FibCustomMax: 88 } }).zones.length, 1);
    }
    return 'range congelado no rompimento, espelho, faixa inteira, interseção e referência externa';
  },
  A05() {
    for (const side of [-1, 1]) {
      const ordinary = poiFixture({ side, config: { MostrarExtremeFlip: true } });
      assert.equal(qualification(ordinary).extrememotivo, 18);
      const extreme = poiFixture({ side, envelope: { 9: [107, 120, 103, 109],
        10: [107, 110, 102, 106], 11: [105, 108, 100, 104], 12: [106, 109, 101, 105],
        13: [111, 114, 106, 110], 14: [109, 112, 104, 108] },
      config: { MostrarExtremeFlip: true, MostrarFaixasFlip: false } });
      assert.ok(qualification(extreme).extremeid > 0);
      assert.equal(horizontal(extreme.trace[16], 'Extreme POI').length, 1);
      assert.deepEqual(poiArchive(extreme.model, extreme.lane + 4).map(({ origemzona, ativacao }) => [origemzona, ativacao]), [[9, 15]]);

      const continuationSetup = { side, tail: [[100, 104, 96, 98], [100, 104, 96, 99],
        [101, 105, 98, 102], [104, 107, 99, 103], [103, 104, 93, 94]],
      events: { 17: [[2, 16, 96]], 19: [[1, 18, 107]], 20: [[6, 16, 96, -1]] },
      config: { MostrarContinuationFlip: true, MostrarFaixasFlip: false } };
      const continuation = poiFixture(continuationSetup);
      assert.ok(qualification(continuation).continuationid > 0);
      assert.equal(horizontal(continuation.trace[20], 'Continuation POI').length, 0);
      assert.equal(horizontal(continuation.trace[21], 'Continuation POI').length, 1);
      assert.deepEqual(poiArchive(continuation.model, continuation.lane + 8).map(({ origemzona, ativacao }) =>
        [origemzona, ativacao]), [[18, 20]]);
      const choch = poiFixture({ ...continuationSetup, events: { ...continuationSetup.events, 20: [[6, 16, 96, 1]] } });
      assert.equal(qualification(choch).continuationid, 0);
    }
    return 'Extreme causal e Continuation após quebra de alvo pós-Flip com correção posterior';
  },
  A06() {
    for (const side of [-1, 1]) {
      for (const scale of [0, 1]) {
        for (const ModoFaixaOB of [0, 1, 2, 3, 4]) {
          const options = { side, scale, config: { ModoFaixaOB }, tail: [[100, 103, 96, 98], [100, 112, 96, 99]] };
          const prior = poiFixture({ ...options, program: acceptedPOI });
          const current = poiFixture({ ...options, repeat: true });
          assert.deepEqual(current.trace, prior.trace);
          assert.deepEqual(current.events, prior.events);
          assert.deepEqual(current.zones, prior.zones);
        }
      }
    }
    const options = { config: { FiltroFVGFlip: 2, FiltroAutomaticoFVG: false, MostrarFibFlip: true },
      tail: [[100, 103, 96, 98], [102, 106, 97, 99]] };
    const replay = poiFixture({ ...options, repeat: true });
    const reload = poiFixture({ ...options, historical: true });
    assert.deepEqual(qualification(replay), qualification(reload));
    assert.deepEqual(replay.zones, reload.zones);
    return 'desenhos e registros da 09B idênticos com defaults, incluindo recarga e reavaliação';
  },
  I01() {
    for (const side of [1, -1]) {
      const { lines, bars } = idmFixture({ side });
      assert.ok(lines.slice(0, 17).every((line) => line.length === 0));
      assert.equal(lines[17].length, 1);
      const [line] = lines[17];
      assert.deepEqual(line.slice(1, 5), [side === 1 ? 100 : 120, side === 1 ? 100 : 120, bars[16][4], bars[17][4]]);
      assert.equal(line[9], 1);
      assert.deepEqual(line.slice(12), [bars[16][5], bars[17][5]]);
    }
    return 'IDM LOW/HIGH tracejados, com origem no BOS e publicação na barra seguinte';
  },
  I02() {
    for (const side of [1, -1]) {
      const initial = idmFixture({ side });
      const [zone] = idmArchive(initial.model, side);
      assert.deepEqual([zone.origem, zone.pivo, zone.protecaoorigem, zone.protecaoref, zone.bosref, zone.alvoref,
        zone.ativacao, zone.publicacao], [10, 11, 7, 8, 16, 6, 16, 17]);
      assert.equal(initial.model.element('smcfluxo', 1), side);
      const neutral = idmFixture({ side, events: { 2: [], 4: [] } });
      assert.deepEqual(idmArchive(neutral.model, side), []);
      const sameBar = idmFixture({ side, events: { 13: [], 16: [[1, 12, 115], [7, 5, 120, 1]] } });
      assert.deepEqual(idmArchive(sameBar.model, side), []);
      const late = idmFixture({ side, length: 19, envelope: { 17: [121, 125, 104, 123] },
        config: { BufferRupturaSMCTicks: 3 } });
      assert.equal(late.lines[17].length, 0);
      const [buffered] = idmArchive(late.model, side);
      assert.deepEqual([buffered.bosref, buffered.ativacao, buffered.publicacao], [16, 17, 18]);
    }
    const second = idmSecondBOS();
    const noProtection = idmFixture({ ...second, events: { ...second.events, 21: [] } });
    assert.equal(noProtection.model.element('idmmotivo', 1), 4);
    assert.deepEqual(idmArchive(noProtection.model).map(({ estado, origem }) => [estado, origem]), [[1, 10]]);
    return 'fluxo confirmado no BOS, buffer tardio, proteção nova obrigatória e Q da própria barra fora da seleção';
  },
  I03() {
    const count = (options) => idmArchive(idmFixture(options).model).length;
    assert.equal(count({ config: { MaxBuscaPullback: 6, MinDistProtegidoTicks: 10 } }), 1);
    assert.equal(count({ config: { MaxBuscaPullback: 5 } }), 0);
    assert.equal(count({ config: { MinDistProtegidoTicks: 11 } }), 0);
    assert.equal(count({ config: { ToleranciaSMCTicks: 10 } }), 0);
    assert.equal(count({ config: { PeriodoATRSMC: 50 } }), 0);
    assert.equal(count({ config: { PeriodoATRSMC: 50, MinPullbackIDMATR: 0, MinReacaoIDMATR: 0 } }), 1);
    assert.equal(count({ config: { MinPullbackIDMATR: 10 } }), 0);
    assert.equal(count({ config: { MinReacaoIDMATR: 10 } }), 0);
    assert.equal(idmArchive(idmFixture({ config: { MinPullbackIDMATR: 1, MinReacaoIDMATR: 1 } }).model)[0].atr, 11);
    assert.equal(count({ envelope: { 14: [105, 104, 101, 107] } }), 0);
    const extra = { events: { 14: [[2, 13, 108]], 15: [[1, 14, 117]] },
      envelope: { 13: [110, 114, 108, 112], 14: [110, 117, 109, 115], 15: [115, 119, 110, 117] } };
    assert.equal(idmArchive(idmFixture(extra).model)[0].origem, 10);
    const recent = { ...extra, envelope: { ...extra.envelope, 16: [117, 123, 108, 121] } };
    assert.equal(idmArchive(idmFixture(recent).model)[0].origem, 13);
    return 'janela inclusiva, limites de ticks, ATR congelado, toque e retorno ao candidato anterior';
  },
  I04() {
    for (const side of [1, -1]) {
      const options = { side, length: 21, envelope: { 17: [106, 112, 100, 106], 18: [106, 110, 99, 108] } };
      const watched = idmFixture({ ...options, repeat: true });
      const [zone] = idmArchive(watched.model, side);
      assert.deepEqual([zone.estado, zone.fim], [2, 18]);
      const slot = side === 1 ? 0 : 100;
      assert.equal(watched.model.element('idmprimeirotoque', slot), 17);
      assert.equal(watched.model.element('idmpenetracaoticks', slot), 1);
      assert.deepEqual(watched.lines[18][0].slice(12), [watched.bars[16][5], watched.bars[18][5]]);
      assert.deepEqual(watched.lines[20][0].slice(12), [watched.bars[16][5], watched.bars[18][5]]);
      const second = idmSecondBOS();
      const sameBar = idmFixture({ ...second, side, envelope: {
        ...second.envelope,
        30: [125, 133, 99, 131],
      } });
      assert.deepEqual(idmArchive(sameBar.model, side).map(({ estado, fim, ativacao }) => [estado, fim, ativacao]),
        [[2, 30, 16]]);
    }
    const otherSide = idmFixture({ ...idmSecondBOS(), before(model, index) {
      if (index !== 31) return;
      model.set('idmusados', 1, 2);
      model.set('idmid', 2, 100);
      model.set('idmidtotal', 2);
      model.set('idmestado', 1, 100);
      model.set('idmativacao', 26, 100);
      model.set('idmnivelticks', 132, 100);
      model.set('idmnivel', 132, 100);
    } });
    assert.deepEqual(idmArchive(otherSide.model, -1).map(({ estado, fim }) => [estado, fim]), [[2, 30]]);
    assert.deepEqual(idmArchive(otherSide.model).map(({ estado, ativacao }) => [estado, ativacao]), [[3, 16], [1, 30]]);
    return 'toque até a primeira penetração confirmada, inclusive quando coincide com outro BOS';
  },
  I05() {
    const second = idmSecondBOS();
    const replaced = idmFixture(second);
    assert.deepEqual(idmArchive(replaced.model).map(({ estado, fim }) => [estado, fim]), [[3, 30], [1, -1]]);
    const keep = idmFixture({ ...second, config: { PoliticaNovoBOS: 1 } });
    assert.deepEqual(idmArchive(keep.model).map(({ estado }) => estado), [1, 1]);
    assert.deepEqual(keep.lines[31].map((line) => line[1]), [110, 100]);
    const noCandidate = idmFixture({ ...second, events: { ...second.events, 25: [] } });
    assert.deepEqual(idmArchive(noCandidate.model).map(({ estado }) => estado), [1]);
    const reused = idmFixture(idmSecondBOS(100));
    assert.deepEqual(idmArchive(reused.model).map(({ id, estado, ativacao }) => [id, estado, ativacao]), [[1, 1, 16]]);
    assert.equal(reused.model.element('idmmotivo', 1), 6);
    assert.deepEqual([0, 1].map((slot) => ['idmvinculoid', 'idmvinculopivo', 'idmvinculobos', 'idmvinculoqualificacao']
      .map((name) => reused.model.element(name, slot))), [[1, 11, 16, 16], [1, 23, 30, 30]]);
    return 'substituição, manutenção múltipla e dois BOS ligados ao mesmo ID';
  },
  I06() {
    function seeded(withTerminal) {
      return idmFixture({ config: { PoliticaNovoBOS: 1 }, before(model, index) {
        if (index !== 17) return;
        model.set('idmusados', 100, 1);
        model.set('idmidtotal', 100);
        for (let slot = 0; slot < 100; slot++) {
          const terminal = withTerminal && slot < 2;
          model.set('idmid', slot + 1, slot);
          model.set('idmestado', terminal ? 2 : 1, slot);
          model.set('idmfim', terminal ? 10 - slot : -1, slot);
          model.set('idmpivo', 200 + slot, slot);
          model.set('idmnivelticks', 96, slot);
          model.set('idmnivel', 96, slot);
          model.set('idmativacao', 0, slot);
          model.set('idmcontextoorigem', 1, slot);
        }
      } });
    }
    const full = seeded(false);
    assert.equal(full.model.element('idmmotivo', 1), 17);
    assert.equal(full.model.get('idmidtotal'), 100);
    assert.equal(full.lines[17].length, 10);
    assert.deepEqual(idmArchive(full.model).map(({ id }) => id), Array.from({ length: 100 }, (_, slot) => slot + 1));
    const recycled = seeded(true);
    assert.deepEqual(idmArchive(recycled.model).slice(0, 2).map(({ id, estado }) => [id, estado]), [[1, 2], [101, 1]]);
    assert.equal(recycled.lines[17][0][1], 100);
    return '100 registros por lado, reciclagem do terminal mais antigo e máximo visual de 10';
  },
  G01() {
    for (const side of [1, -1]) {
      const cases = [
        [[107, 112, 100, 106], 1],
        [[107, 112, 99, 100], 2],
        [[107, 112, 99, 99], 7],
        [[107, 112, 99, 106], 8, { SweepIDMTicks: 2 }],
        [[98, 99, 96, 97], 7],
      ];
      for (const [candle, state, config] of cases) {
        const result = idmFixture({ side, length: 21, config, envelope: { 17: candle } });
        const [level] = idmArchive(result.model, side);
        assert.equal(level.estado, state);
        assert.equal(level.fim, state === 1 ? -1 : 17);
        assert.equal(result.model.element('smcfluxo', 1), side);
      }
    }
    return 'toque, sweep, rompimento, tomada abaixo do mínimo e gap, sem mudar o fluxo swing';
  },
  G02() {
    for (const side of [1, -1]) {
      const second = idmSecondBOS();
      for (const [protection, state] of [[100, 9], [105, 10]]) {
        const result = idmFixture({
          ...second, side, config: { PoliticaNovoBOS: 1 },
          events: { ...second.events, 21: [[4, 20, protection]] },
        });
        assert.deepEqual(idmArchive(result.model, side).map(({ estado, fim }) => [estado, fim]),
          [[state, 30], [1, -1]]);
      }
      const result = idmFixture({ side, length: 21, envelope: { 17: [102, 106, 88, 89] } });
      const slot = side === 1 ? 0 : 100;
      assert.deepEqual([result.model.element('idmestado', slot), result.model.element('idmresultado', slot),
        result.model.element('idmbarraresultado', slot)], [7, 4, 17]);
    }
    const options = { length: 21, envelope: { 19: [106, 110, 98, 105] } };
    const state = (config) => idmArchive(idmFixture({ ...options, config }).model).map(({ estado, fim }) => [estado, fim]);
    assert.deepEqual(state({ MaxIdadeIDM: 2 }), [[12, 19]]);
    assert.deepEqual(state({ MaxIdadeIDM: 3 }), [[2, 19]]);
    assert.deepEqual(state({ MaxIdadeIDM: 0 }), [[2, 19]]);
    return 'promoção, nível fora do contexto, tomada antes da falha estrutural e validade inclusiva';
  },
  G03() {
    const envelope = { 17: [106, 119, 99, 106], 18: [101, 119, 100, 101], 19: [103, 110, 101, 110] };
    const state = (result) => ['idmestado', 'idmfim', 'idmresultado', 'idmbarraresultado']
      .map((field) => result.model.element(field, 0));
    const reaction = { ModoConfirmacaoIDM: 1, MaxBarrasConfirmacaoIDM: 2 };
    assert.deepEqual(state(idmFixture({ length: 19, envelope, config: reaction })), [2, 17, 1, -1]);
    assert.deepEqual(state(idmFixture({ length: 21, envelope, config: reaction })), [2, 17, 2, 19]);
    assert.deepEqual(state(idmFixture({ length: 21, envelope, config: { ...reaction, MaxBarrasConfirmacaoIDM: 1 } })),
      [2, 17, 5, 18]);
    assert.deepEqual(state(idmFixture({ length: 21, envelope, config: { ModoConfirmacaoIDM: 0 } })),
      [2, 17, 0, -1]);
    assert.deepEqual(state(idmFixture({ length: 21, envelope })), [2, 17, 3, 17]);
    return 'reação após a tomada por fechamento, modos 0/1, prazo e modo 2 sem alvo disponível';
  },
  G04() {
    const options = {
      length: 25,
      events: { 19: [[3, 18, 130]], 20: [[3, 20, 135]] },
      envelope: { 18: [118, 130, 105, 118], 20: [107, 135, 98, 106],
        21: [128, 132, 105, 131], 22: [131, 133, 105, 132] },
      config: { BufferRupturaSMCTicks: 2 },
    };
    options.envelope[16] = [117, 124, 104, 122];
    for (const side of [1, -1]) {
      const live = idmFixture({ ...options, side, repeat: true });
      const slot = side === 1 ? 0 : 100;
      const result = (model) => ['idmestado', 'idmfim', 'idmresultado', 'idmbarraresultado',
        'idmalvoresultadoref', 'idmalvoresultadoticks'].map((field) => model.element(field, slot));
      assert.deepEqual(result(live.model), [2, 20, 2, 22, 19, side === 1 ? 130 : 90]);
      const marker = (draws) => segments(draws).find((line) => line[6] === 'IDM Confirmado');
      assert.equal(marker(live.trace[22]), undefined);
      assert.deepEqual(marker(live.trace[23]).slice(12), [live.bars[22][5], live.bars[23][5]]);
      const reload = idmFixture({ ...options, side, historical: true });
      assert.deepEqual(reload.trace.at(-1), live.trace.at(-1));
      const hidden = idmFixture({ ...options, side, config: {
        ...options.config, MostrarIDMConfirmacao: false, MostrarPrecoIDM: false,
      } });
      assert.deepEqual(result(hidden.model), result(live.model));
      assert.equal(marker(hidden.trace.at(-1)), undefined);
      assert.equal(hidden.lines.at(-1)[0][6], hidden.label + ' Sweep');
    }
    const crossedOnCapture = idmFixture({ ...options, envelope: { ...options.envelope, 20: [107, 135, 98, 132] } });
    assert.equal(crossedOnCapture.model.element('idmresultado', 0), 3);
    assert.equal(crossedOnCapture.model.element('idmbarraresultado', 0), 20);
    return 'alvo congelado antes da tomada, buffer posterior, publicação e recarga espelhadas';
  },
  G05() {
    const second = idmSecondBOS();
    const options = { ...second, length: 34,
      envelope: { ...second.envelope, 31: [108, 116, 99, 105] },
      config: { PoliticaNovoBOS: 1, ModoConfirmacaoIDM: 0 } };
    const baseline = idmFixture(options);
    assert.deepEqual(idmArchive(baseline.model).map(({ estado, fim }) => [estado, fim]), [[2, 31], [7, 31]]);
    const withDisplay = (display) => idmFixture({ ...options, config: { ...options.config, ...display } });
    for (const [display, expected] of [
      [{ MostrarIDMCapturados: false }, [110]], [{ MostrarIDMRompidos: false }, [100]],
      [{ MaxIDMsVisiveis: 1 }, [110]], [{ MaxIDMsVisiveis: 0 }, []],
    ]) {
      const result = withDisplay(display);
      assert.deepEqual(idmArchive(result.model), idmArchive(baseline.model));
      assert.deepEqual(result.lines.at(-1).map((line) => line[1]), expected);
    }
    const expired = idmFixture({ length: 21, config: { MaxIdadeIDM: 1, MostrarIDMExpirados: true } });
    assert.match(expired.lines.at(-1)[0][6], /Expirado/);
    const invalid = idmFixture({ length: 20, envelope: { 17: [106, 105, 98, 106] } });
    assert.equal(idmArchive(invalid.model)[0].estado, 1);
    const lost = idmFixture({ length: 21, config: { ModoConfirmacaoIDM: 1 },
      envelope: { 17: [105, 110, 99, 101], 18: [98, 100, 87, 89] } });
    assert.equal(lost.model.element('idmresultado', 0), 4);
    assert.equal(lost.model.element('idmbarraresultado', 0), 18);
    return 'dois níveis no mesmo candle, controles visuais, OHLC inválido e perda de contexto posterior';
  },
  J01() {
    for (const side of [1, -1]) {
      const options = idmPostOptions();
      const post = idmFixture({ ...options, side, repeat: true, config: { ModoIDM: 2, MostrarIDMCandidatos: true } });
      const [level] = idmModelArchive(post.model, 2, side);
      assert.deepEqual([level.origem, level.pivo, level.bosref, level.ativacao, level.publicacao, level.estado, level.fim],
        [19, 20, 16, 22, 23, 2, 23]);
      assert.ok(post.lines[21].some((line) => line[6].includes('POST_BOS Candidato')));
      assert.ok(post.lines[23].some((line) => line[6].includes('POST_BOS')));
      assert.ok(post.lines[23].every((line) => !line[6].includes('Candidato')));
      assert.equal(idmModelArchive(post.model, 0, side).length, 0);
      const all = idmFixture({ ...options, side, config: { ModoIDM: 3 } });
      assert.deepEqual(idmModelArchive(all.model, 2, side), idmModelArchive(post.model, 2, side));
      const interrupted = idmFixture({
        ...options, side, config: { ModoIDM: 2 },
        events: { ...options.events, 19: [[3, 18, 130]], 22: [...options.events[22], [7, 18, 130, 1]] },
        envelope: { ...options.envelope, 22: [119, 133, 109, 132] },
      });
      assert.equal(idmModelArchive(interrupted.model, 2, side).length, 0);
      const preTaken = idmFixture({ ...options, side, config: { ModoIDM: 2 },
        envelope: { ...options.envelope, 21: [114, 125, 104, 117] } });
      assert.equal(idmModelArchive(preTaken.model, 2, side).length, 0);
    }
    return 'POST_BOS espelhado, candidato visual, primeiro pullback, ativação e interrupção causal';
  },
  J02() {
    for (const side of [1, -1]) {
      const fixture = idmLocalFixture(side, { repeat: true });
      const [level] = idmModelArchive(fixture.model, 1, side);
      assert.deepEqual([level.origem, level.pivo, level.fim, level.flipref, level.ativacao, level.publicacao, level.resultado,
        level.barraresultado], [13, 14, 15, 16, 16, 17, 2, 17]);
      const draws = (bar) => segments(fixture.trace[bar]).filter((line) => line[6].includes('FLIP_LOCAL'));
      assert.equal(draws(16).length, 0);
      assert.deepEqual(draws(17)[0].slice(12), [fixture.bars[16][5], fixture.bars[17][5]]);
      assert.ok(fixture.trace.flat().every((call) => !/^FLIP[+-]/.test(call[6] ?? '')));
      const all = idmLocalFixture(side, { config: { ModoIDM: 3 }, historical: true });
      assert.deepEqual(idmModelArchive(all.model, 1, side), idmModelArchive(fixture.model, 1, side));
      const duringBreak = idmLocalFixture(side, { firstSweep: 16 });
      assert.equal(idmModelArchive(duringBreak.model, 1, side)[0].fim, 16);
      const late = idmLocalFixture(side, { confirmPivot: 15 });
      assert.equal(idmModelArchive(late.model, 1, side).length, 0);
      const rejected = idmLocalFixture(side, { config: { FiltroVolumeFlip: 2 } });
      assert.equal(idmModelArchive(rejected.model, 1, side).length, 0);
    }
    return 'FLIP_LOCAL em ambos os lados, sweep antes ou em B, dependência oculta e associação sem retroatividade';
  },
  J03() {
    for (const side of [1, -1]) {
      const config = { FiltroFVGFlip: 2, FiltroAutomaticoFVG: false, MostrarFVG: false,
        FiltroPOIIDM: 2, FiltroFibIDM: 2, FiltroFVGIDM: 2, FiltroDispIDM: 2, FiltroVolumeIDM: 2,
        PeriodoVolumeFlip: 2, CorpoMinFlip: 0.55 };
      const lower = { 14: [110, 111, 105, 108, 10], 15: [109, 113, 103, 105, 10],
        16: [108, 110, 95, 98, 30], 17: [99, 100, 95, 96, 10] };
      const delayed = idmLocalFixture(side, { config: { ...config, MostrarIDMCandidatos: true }, lower, repeat: true });
      const [level] = idmModelArchive(delayed.model, 1, side);
      assert.deepEqual([level.fim, level.flipref, level.ativacao, level.publicacao, level.evidencias], [15, 16, 17, 18, 31]);
      const labelsAt = (bar) => segments(delayed.trace[bar]).map((line) => line[6]);
      assert.ok(labelsAt(17).some((label) => label.includes('FLIP_LOCAL Candidato')));
      assert.ok(labelsAt(18).some((label) => label.includes('FLIP_LOCAL Sweep')));
      assert.ok(labelsAt(17).every((label) => label !== 'IDM Confirmado'));
      assert.equal(level.barraresultado, 18);
      const scoreOnly = idmLocalFixture(side, { config: { FiltroVolumeIDM: 1, FiltroFibIDM: 1 } });
      assert.equal(idmModelArchive(scoreOnly.model, 1, side)[0].evidencias, 2);
      const unavailable = idmLocalFixture(side, { config: { FiltroVolumeIDM: 2 } });
      assert.equal(idmModelArchive(unavailable.model, 1, side).length, 0);
      const lateFVG = idmLocalFixture(side, { config: { FiltroFVGIDM: 2, FiltroAutomaticoFVG: false }, lower });
      assert.equal(idmModelArchive(lateFVG.model, 1, side).length, 0);
      const earlierTarget = idmLocalFixture(side, { config: { ModoConfirmacaoIDM: 2 } });
      assert.equal(idmModelArchive(earlierTarget.model, 1, side)[0].resultado, 3);
    }
    return 'cinco filtros causais, qualificação tardia do Flip, evidência opcional e alvo consumido antes da associação';
  },
  J04() {
    for (const side of [1, -1]) {
      const lane = side === 1 ? 1 : 2;
      const configure = (pendingCount) => (model, index) => {
        if (index !== 23) return;
        model.set('idmusados', 100, 4 + lane);
        model.set('idmnovosids', 100, 2);
        const base = (3 + lane) * 100;
        for (let offset = 0; offset < 100; offset++) {
          const slot = base + offset;
          model.set('idmid', 1_000_000_001 + offset, slot);
          model.set('idmmodeloregistro', 2, slot);
          model.set('idmestado', 2, slot);
          model.set('idmresultado', offset < pendingCount ? 1 : 0, slot);
          model.set('idmpivo', 300 + offset, slot);
          model.set('idmfim', 5 + offset, slot);
          model.set('idmcontextoorigem', 1, slot);
          model.set('idmnivelticks', side === 1 ? 96 : 124, slot);
        }
      };
      const options = { ...idmPostOptions(), length: 24, side, config: { ModoIDM: 2, MaxBarrasConfirmacaoIDM: 1000,
        ReacaoPosIDMATR: 10000, ModoConfirmacaoIDM: 2 } };
      const full = idmFixture({ ...options, before: configure(100) });
      assert.equal(full.model.element('idmmotivo', 4 + lane), 17);
      assert.ok(idmModelArchive(full.model, 2, side).every((row) => row.id <= 1_000_000_100));
      const recyclable = idmFixture({ ...options, before: configure(1) });
      const [pending, replaced] = idmModelArchive(recyclable.model, 2, side);
      assert.deepEqual([pending.id, pending.resultado, replaced.id, replaced.estado], [1_000_000_001, 1, 1_000_000_101, 1]);
    }
    const options = idmPostOptions();
    const aliased = idmFixture({ ...options, config: { ModoIDM: 3 }, before(model, index) {
      if (index !== 23) return;
      model.set('idmnivelticks', 105, 0);
      model.set('idmnivel', 105, 0);
    } });
    assert.deepEqual(aliased.lines[23].map((line) => line[1]), [105]);
    assert.deepEqual(aliased.lines[24].map((line) => line[1]), [105]);
    assert.deepEqual([idmModelArchive(aliased.model, 0, 1)[0].fim, idmModelArchive(aliased.model, 2, 1)[0].fim], [23, 23]);
    return 'partições de capacidade, reciclagem protegida e deduplicação estritamente visual';
  },
  J05() {
    for (const side of [1, -1]) {
      const options = { firstSweep: 16, lower: { 14: [110, 112, 105, 108] },
        before(model, index) {
          if (index === 16) stageFacts(model, 15, [fact(side === -1 ? 1 : 2, 14, side === -1 ? 112 : 88)]);
        } };
      const fixture = idmLocalFixture(side, options);
      const [selected] = idmModelArchive(fixture.model, 1, side);
      assert.deepEqual([selected.origem, selected.pivo, selected.fim], [14, 15, 16]);
      const historical = idmLocalFixture(side, { ...options, historical: true, config: { MostrarIDM: false } });
      assert.deepEqual(idmModelArchive(historical.model, 1, side), [selected]);
      const structural = idmFixture({ ...idmPostOptions(), side });
      const all = idmFixture({ ...idmPostOptions(), side, config: { ModoIDM: 3 } });
      assert.deepEqual(idmModelArchive(all.model, 0, side), idmModelArchive(structural.model, 0, side));
    }
    return 'desempate do sweep, recarga, visibilidade e paridade de STRUCTURAL em ALL';
  },
  L01() {
    const rows = [
      [100, 110, 90, 100], [100, 109, 91, 100], [101, 110, 90, 100],
      [104, 112, 103, 110], [95, 103, 87, 90], [100, 104, 95, 99],
    ];
    const { bars, trace } = liquidityFixture(rows, { 1: [fact(1, 0, 110), fact(2, 0, 90)] }, { repeat: true });
    assert.equal(segments(trace[3]).length, 0);
    const buySide = segments(trace[4]).find((line) => line[6] === 'LG BSL · Interno');
    const sellSide = segments(trace[5]).find((line) => line[6] === 'LG SSL · Interno');
    assert.deepEqual([buySide[1], ...buySide.slice(12)], [110, bars[1][5], bars[3][5]]);
    assert.deepEqual([sellSide[1], ...sellSide.slice(12)], [90, bars[1][5], bars[4][5]]);
    return 'LG BSL e SSL após toque exato e recuperação no fechamento, com âncoras causais';
  },
  L02() {
    const scenarios = [
      ['lqsmalltake', [105, 111, 98, 109], { MinCapturaTicks: 2 }, 1],
      ['lqbreakstarted', [106, 112, 104, 111], {}, 2],
      ['lqrecuperacaoinsuficiente', [105, 112, 100, 109], { BufferRecuperacaoTicks: 2 }, 2],
      ['lqpavioinsuficiente', [109, 112, 100, 110], { MinPavioGrab: 0.25 }, 2],
      ['lqgrab', [108, 112, 104, 108], { MinCapturaTicks: 2, BufferRecuperacaoTicks: 2, MinPavioGrab: 0.5 }, 2],
      ['lqgaptaken', [111, 115, 111, 112], {}, 5],
      ['lqdadosinvalidos', [100, 109, 102, 110], {}, 0],
    ];
    for (const side of [1, 2]) {
      for (const [state, bar, config, depth] of scenarios) {
        const rows = [[100, 110, 94, 100], [100, 110, 96, 100], bar, [108, 115, 100, 107], [100, 105, 96, 100]];
        const mirrored = side === 1 ? rows : rows.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);
        const { model, trace } = liquidityFixture(mirrored, { 1: [fact(side, 0, side === 1 ? 110 : 90)] }, { config });
        const [level] = liquidityArchive(model);
        assert.deepEqual([level.side, level.estado, level.fim, level.publicacao, level.penetracaoticks, level.sources[0].tomada],
          [side, model.get(state), 2, depth > 0 ? 3 : -1, depth, depth > 0]);
        if (state === 'lqbreakstarted') {
          assert.equal(level.desfecho, model.get('lqsweep'));
          assert.equal(level.barradesfecho, 3);
        }
        assert.equal(segments(trace.at(-1)).length, ['lqgrab', 'lqbreakstarted'].includes(state) ? 1 : 0);
      }
    }
    return 'classificação física espelhada, pavio e buffer inclusivos, gap e interrupção por OHLC inválido';
  },
  L03() {
    const rows = [[100, 110, 90, 100], [100, 110, 90, 100], [100, 109, 91, 100], [100, 109, 91, 100],
      [100, 112, 88, 100], [100, 110, 94, 100], [100, 109, 94, 100], [100, 114, 95, 100], [100, 107, 94, 100]];
    const events = {
      1: [fact(1, 0, 110), fact(2, 0, 90), fact(3, 0, 110)], 3: [fact(3, 2, 109)],
      5: [fact(1, 0, 110)], 6: [fact(1, 5, 110)],
    };
    const live = liquidityFixture(rows, events, { repeat: true });
    const result = liquidityArchive(live.model);
    assert.deepEqual(result.map((level) => [level.ticks, level.origemnivel, level.ativacao, level.fim,
      level.sources.map((source) => source.tipo)]), [[110, 0, 1, 4, [2, 1]], [109, 2, 3, 4, [2]],
      [110, 5, 6, 7, [1]], [90, 0, 1, 4, [1]]]);
    assert.ok(result.every((level) => level.estado === live.model.get('lqgrab')));
    assert.equal(new Set(result.map((level) => level.id)).size, 4);
    assert.equal(segments(live.trace[5]).length, 3);
    assert.ok(segments(live.trace[5]).some((line) => line[6] === 'LG BSL · Interno · Swing'));
    assert.deepEqual(liquidityArchive(liquidityFixture(rows, events, { historical: true }).model), result);
    const hidden = liquidityFixture(rows, events, { config: { MostrarCapturasLiquidez: false, MostrarBSL: false } });
    assert.deepEqual(liquidityArchive(hidden.model), result);
    assert.equal(segments(hidden.trace.at(-1)).length, 0);
    const externalOnly = liquidityFixture(rows, events, { config: { FonteSwingInterno: false } });
    assert.deepEqual(liquidityArchive(externalOnly.model).map((level) => [level.ticks, level.sources[0].tipo]), [[110, 2], [109, 2]]);
    const atConfirmation = liquidityFixture([rows[0], [100, 111, 92, 100], ...rows.slice(2)],
      { 1: [fact(1, 0, 110)] });
    assert.deepEqual(liquidityArchive(atConfirmation.model), []);
    assert.equal(atConfirmation.model.element('lqdiagnostico', 1), atConfirmation.model.get('lqfonteconsumida'));
    return 'dupla captura, preços adjacentes, coexistência das escalas, rejeição de origem consumida e nova geração';
  },
  L04() {
    const config = { HabilitarCapturasLiquidez: true, MostrarCapturasLiquidez: true,
      FonteSwingInterno: false, FonteSwingExterno: false };
    const options = { length: 22, config, envelope: { 18: [106, 110, 88, 89] } };
    const capture = idmFixture(options);
    const [idmOnly] = liquidityArchive(capture.model);
    assert.deepEqual([idmOnly.ticks, idmOnly.estado, idmOnly.fim, idmOnly.sources[0].tipo, idmOnly.sources[0].tomada],
      [100, capture.model.get('lqbreakstarted'), 18, 3, true]);
    assert.deepEqual([idmOnly.desfecho, idmOnly.barradesfecho], [capture.model.get('lqsweep'), 19]);
    const expired = idmFixture({ ...options, config: { ...config, MaxIdadeIDM: 1 } });
    const [timedOut] = liquidityArchive(expired.model);
    assert.deepEqual([timedOut.estado, timedOut.fim, timedOut.penetracaoticks, timedOut.sources[0].tomada],
      [expired.model.get('lqsemfonte'), 18, 0, false]);
    const aliased = idmFixture({ ...options, config: { ...config, FonteSwingInterno: true, MaxIdadeIDM: 1 },
      envelope: { 18: [106, 110, 98, 105] } });
    const retained = liquidityArchive(aliased.model).find((level) => level.ticks === 100);
    assert.equal(retained.estado, aliased.model.get('lqgrab'));
    assert.deepEqual(retained.sources.map(({ tipo, tomada }) => [tipo, tomada]), [[3, false], [1, true]]);
    const post = idmFixture({ ...idmPostOptions(), config: { ...config, ModoIDM: 2 } });
    assert.deepEqual(liquidityArchive(post.model).map((level) => [level.ticks, level.estado, level.fim]),
      [[105, post.model.get('lqgrab'), 23]]);
    const local = idmLocalFixture(-1, { config });
    assert.equal(liquidityArchive(local.model).length, 0);
    const disabled = idmFixture({ ...options, config: { ...config, HabilitarIDM: false } });
    assert.equal(liquidityArchive(disabled.model).length, 0);
    return 'IDM estrutural e POST_BOS, validade individual, ausência de FLIP_LOCAL e captura antes da perda de contexto';
  },
  L05() {
    const rows = Array.from({ length: 106 }, (_, index) => [100, 1000 - index, 90, 100]);
    rows[102] = [100, 902, 90, 100];
    const events = Object.fromEntries(Array.from({ length: 101 }, (_, index) =>
      [index + 1, [fact(1, index, 1000 - index)]]));
    events[104] = [fact(1, 103, 897)];
    const { model } = liquidityFixture(rows, events);
    const levels = liquidityArchive(model);
    assert.equal(model.element('lqdiagnostico', 1), model.get('smccapacityfull'));
    assert.equal(model.element('lqbarradiagnostico', 1), 101);
    assert.equal(levels.length, 100);
    assert.deepEqual(levels.filter((level) => level.id > 100).map((level) => [level.id, level.ticks, level.ativacao]), [[101, 897, 104]]);
    assert.ok(levels.every((level) => level.estado === model.get('lqativo')));
    assert.ok(levels.every((level) => level.sources.length === 1));
    const manyBars = Array.from({ length: 605 }, () => [100, 110, 90, 100]);
    manyBars[602] = [100, 112, 90, 100];
    const manyAliases = Object.fromEntries(Array.from({ length: 601 }, (_, index) =>
      [index + 1, [fact(1, index, 110)]]));
    const packed = liquidityFixture(manyBars.slice(0, -1), manyAliases);
    assert.equal(packed.model.element('lqbarradiagnostico', 1), 601);
    const [packedLevel] = liquidityArchive(packed.model);
    assert.equal(packedLevel.sources.length, 600);
    assert.ok(packedLevel.sources.every((source) => source.tomada));
    const reused = liquidityFixture(manyBars, { ...manyAliases, 603: [fact(1, 602, 112)] });
    const [newLevel] = liquidityArchive(reused.model);
    assert.deepEqual([newLevel.id, newLevel.ticks, newLevel.sources.length], [2, 112, 1]);
    assert.equal(reused.model.element('lqtotalfontes', 1), 600);
    return '100 gerações e 600 vínculos por lado, rejeição em capacidade e reciclagem do terminal';
  },
  L06() {
    const rows = Array.from({ length: 30 }, (_, index) => [100, 160 - index, 90, 100]);
    rows[26] = [100, 166, 90, 100];
    const events = Object.fromEntries(Array.from({ length: 25 }, (_, index) =>
      [index + 1, [fact(1, index, 160 - index)]]));
    const live = liquidityFixture(rows, events, { config: { MostrarNiveisLiquidez: true } });
    const levels = liquidityArchive(live.model);
    assert.equal(levels.length, 25);
    assert.equal(segments(live.trace[26]).length, 20);
    assert.equal(segments(live.trace[27]).length, 20);
    assert.equal(segments(live.trace[27])[0][1], 136);
    const labelOnly = liquidityFixture(rows, events, { config: { MostrarLinhaCaptura: false,
      MostrarFonteLQ: false, MaxCapturasLQVisiveis: 2 } });
    const labels = segments(labelOnly.trace.at(-1));
    assert.deepEqual(labels.map((draw) => [draw[1], draw[6]]), [[136, 'LG BSL'], [137, 'LG BSL']]);
    assert.deepEqual(labels[0].slice(12), [labelOnly.bars[26][5], labelOnly.bars[27][5]]);
    const lineOnly = liquidityFixture(rows, events, { historical: true, config: { MostrarRotuloLQ: false } });
    assert.ok(segments(lineOnly.trace.at(-1)).every((draw) => draw[6] === ''));
    assert.deepEqual(liquidityArchive(lineOnly.model), levels);
    return 'limites visuais independentes, ordenação estável, marcador curto e linha sem rótulo';
  },
  L07() {
    assert.equal(sha(acceptedIDMSource), '66948ea8cd7091e03cd24da5c98830afca6b66d853643baa086cd047c4051e19');
    const bars = prices.slice(0, 430);
    for (const ModoFaixaOB of [0, 1, 2, 3, 4]) {
      const config = { PeriodoSwing: 10, ModoFaixaOB, MostrarPivos: true, MostrarFVG: true,
        HabilitarFlip: true, MostrarFlip: true, HabilitarIDM: true, MostrarIDM: true, ModoIDM: 3,
        HabilitarCapturasLiquidez: false, MostrarCapturasLiquidez: true, MostrarNiveisLiquidez: true };
      const old = runtime(acceptedIDM, bars, config);
      const current = runtime(updated, bars, config);
      bars.forEach((_, index) => assert.deepEqual(current.step(index), old.step(index)));
    }
    const native = runtime(updated, bars, { PeriodoSwing: 10, HabilitarCapturasLiquidez: true,
      FonteSwingExterno: false, MostrarEstruturaInterna: false });
    bars.forEach((_, index) => native.step(index));
    assert.ok(liquidityArchive(native).some((level) => level.estado === native.get('lqgrab') && level.sources[0].tipo === 1));
    return 'paridade com a 10C nos cinco modos e LG gerado pelo detector interno oculto a partir de OHLC';
  },
  R01() {
    const rows = [[100, 110, 94, 100], [100, 109, 96, 100], [106, 112, 104, 111],
      [111, 115, 104, 110], [105, 116, 99, 105], [100, 109, 96, 100]];
    for (const side of [1, 2]) {
      const mirrored = side === 1 ? rows : rows.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);
      const result = liquidityFixture(mirrored, { 1: [fact(side, 0, side === 1 ? 110 : 90)] }, { repeat: true });
      assert.equal(segments(result.trace[3]).length, 0);
      const line = segments(result.trace[4]).find((draw) => draw[6] === (side === 1 ? 'SW BSL · Interno' : 'SW SSL · Interno'));
      assert.ok(line, 'SW deve aparecer imediatamente após o primeiro retorno');
      assert.deepEqual(line.slice(12), [result.bars[1][5], result.bars[3][5]]);
      const [capture] = liquidityArchive(result.model);
      assert.deepEqual([capture.fim, capture.publicacao, capture.barradesfecho, capture.publicacaodesfecho],
        [2, 3, 3, 4]);
      assert.deepEqual([capture.extremotomada, capture.extremocaptura],
        side === 1 ? [112, 115] : [88, 85]);
    }
    return 'sweep BSL e SSL na primeira recuperação, com igualdade e publicação no candle seguinte';
  },
  R02() {
    const rows = [...Array.from({ length: 13 }, () => [100, 108, 95, 100]),
      [100, 110, 94, 100], [100, 109, 96, 100], [106, 112, 104, 111],
      [111, 115, 104, 109], [109, 113, 104, 110], [110, 120, 104, 108], [108, 125, 100, 107], [100, 109, 96, 100]];
    for (const side of [1, 2]) {
      const sideName = side === 1 ? 'BSL' : 'SSL';
      const initial = side === 1 ? rows : rows.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);
      const events = { 14: [fact(side, 13, side === 1 ? 110 : 90)] };
      const config = { MaxBarrasStopHunt: 3, BufferRecuperacaoTicks: 2, MostrarRupturaPendente: true, MostrarBreakSemRecuperacao: true };
      const live = liquidityFixture(initial, events, { config, repeat: true });
      const [capture] = liquidityArchive(live.model);
      assert.deepEqual([capture.desfecho, capture.fim, capture.barradesfecho, capture.publicacaodesfecho],
        [live.model.get('lqstophunt'), 15, 18, 19]);
      assert.equal(capture.extremocaptura, side === 1 ? 120 : 80);
      const pending = segments(live.trace[18])[0];
      assert.ok(pending[6].startsWith('Ruptura pendente ' + sideName));
      assert.deepEqual([pending[4], pending[13]], [live.bars[17][4], live.bars[17][5]]);
      const final = segments(live.trace[19])[0];
      assert.match(final[6], /^SH /);
      assert.deepEqual([final[3], final[4], ...final.slice(12)], [live.bars[14][4], live.bars[18][4], live.bars[14][5], live.bars[18][5]]);
      const reload = liquidityFixture(initial, events, { config: { ...config, MostrarLinhaCaptura: false }, historical: true });
      assert.deepEqual(liquidityArchive(reload.model), [capture]);
      assert.deepEqual(segments(reload.trace.at(-1))[0].slice(12), [live.bars[18][5], live.bars[19][5]]);
      const hidden = liquidityFixture(initial, events, { config: { ...config, MostrarStopHunt: false } });
      assert.deepEqual(liquidityArchive(hidden.model), [capture]);
      assert.equal(segments(hidden.trace.at(-1)).length, 0);
      const expired = liquidityFixture(initial, events, { config: { ...config, MaxBarrasStopHunt: 2 } });
      const [noReturn] = liquidityArchive(expired.model);
      assert.deepEqual([noReturn.desfecho, noReturn.barradesfecho, noReturn.publicacaodesfecho],
        [expired.model.get('lqbreaksemrecuperacao'), 17, 18]);
      assert.match(segments(expired.trace.at(-1))[0][6], /^Break sem recuperação /);
      assert.equal(segments(expired.trace.at(-1))[0][13], expired.bars[17][5]);
    }
    return 'Stop Hunt no prazo inclusivo, banda intermediária, extremo na recuperação e expiração entre sessões';
  },
  R03() {
    const rows = [[100, 110, 94, 100], [100, 109, 96, 100], [112, 115, 111, 113],
      [113, 116, 105, 108], [106, 109, 96, 100], [100, 109, 96, 100]];
    for (const side of [1, 2]) {
      const mirror = (series) => side === 1 ? series : series.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);
      const events = { 1: [fact(side, 0, side === 1 ? 110 : 90)] };
      const off = liquidityFixture(mirror(rows), events);
      const [gap] = liquidityArchive(off.model);
      assert.deepEqual([gap.estado, gap.desfecho, gap.fim], [off.model.get('lqgaptaken'), 0, 2]);
      assert.equal(segments(off.trace.at(-1)).length, 0);
      const config = { PermitirGapPadraoLQ: true, MinPavioGrab: 1 };
      const on = liquidityFixture(mirror(rows), events, { config });
      const [included] = liquidityArchive(on.model);
      assert.deepEqual([included.estado, included.desfecho], [on.model.get('lqgaptaken'), on.model.get('lqsweep')]);
      const insufficient = liquidityFixture(mirror(rows), events, { config: { ...config, MinCapturaTicks: 6 } });
      assert.equal(liquidityArchive(insufficient.model)[0].desfecho, 0);
      const data = liquidityFixture(mirror([...rows.slice(0, 3), [110, 107, 100, 108], ...rows.slice(4)]), events, { config });
      const [invalid] = liquidityArchive(data.model);
      assert.deepEqual([invalid.estado, invalid.desfecho, invalid.fim, invalid.barradesfecho,
        invalid.extremocaptura], [data.model.get('lqgaptaken'), data.model.get('lqdadosinvalidos'), 2, 3, side === 1 ? 115 : 85]);
      assert.equal(segments(data.trace.at(-1)).length, 0);
    }
    return 'gap preservado, permissão e mínimo independentes e OHLC inválido encerra a espera';
  },
  R04() {
    const rows = [[100, 110, 90, 100], [100, 109, 91, 100], [108, 114, 96, 112],
      [102, 114, 86, 88], [88, 103, 83, 84], [88, 118, 84, 115], [111, 116, 97, 105]];
    const result = liquidityFixture(rows, { 1: [fact(1, 0, 110), fact(2, 0, 90)] },
      { config: { BufferRecuperacaoTicks: 25, MostrarRupturaPendente: true }, repeat: true });
    assert.deepEqual(segments(result.trace[4]).map((line) => line[6]),
      ['Ruptura pendente SSL · Interno', 'Ruptura pendente BSL · Interno']);
    assert.deepEqual(liquidityArchive(result.model).map((level) => [level.fim, level.barradesfecho, level.desfecho]),
      [[2, 4, result.model.get('lqstophunt')], [3, 5, result.model.get('lqstophunt')]]);
    assert.deepEqual(segments(result.trace.at(-1)).map((line) => line[6]), ['SH SSL · Interno', 'SH BSL · Interno']);
    return 'esperas simultâneas BSL e SSL e ordenação por fechamento da recuperação';
  },
  R05() {
    const rows = Array.from({ length: 107 }, (_, index) => [100, 1100 - index, 90, 100]);
    rows.splice(99, 8, [100, 900, 90, 100], [100, 899, 90, 100], [900, 905, 900, 902],
      [902, 910, 901, 905], [905, 909, 900, 905], [905, 909, 894, 895],
      [895, 908, 893, 896], [896, 908, 893, 897]);
    const events = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [index + 1, [fact(1, index, rows[index][1])]]));
    events[103] = [fact(1, 102, 910)];
    events[105] = [fact(1, 104, 909)];
    const { model, trace } = liquidityFixture(rows, events, { config: { MostrarRupturaPendente: true } });
    assert.equal(model.element('lqbarradiagnostico', 1), 103);
    assert.equal(model.element('lqdiagnostico', 1), model.get('smccapacityfull'));
    assert.match(segments(trace[104])[0][6], /^Ruptura pendente /);
    assert.match(segments(trace[105])[0][6], /^SH /);
    const archive = liquidityArchive(model);
    assert.equal(archive.length, 100);
    assert.deepEqual(archive.filter((level) => level.id > 99).map((level) => [level.id, level.ticks, level.ativacao]), [[101, 909, 105]]);
    return 'capacidade preserva esperas e permite reciclagem depois do encerramento';
  },
  R06() {
    assert.equal(sha(acceptedLiquiditySource), '7b885e3c948ebf4abe58346b916abe77daa7599d1ad2620f53bff6f1fe253ed3');
    const bars = prices.slice(0, 430);
    for (const ModoFaixaOB of [0, 1, 2, 3, 4]) {
      const config = { PeriodoSwing: 10, ModoFaixaOB, MostrarPivos: true, MostrarFVG: true,
        HabilitarFlip: true, MostrarFlip: true, HabilitarIDM: true, MostrarIDM: true, ModoIDM: 3,
        HabilitarCapturasLiquidez: false, MostrarCapturasLiquidez: true, MostrarNiveisLiquidez: true };
      const previous = runtime(acceptedLiquidity, bars, config);
      const current = runtime(updated, bars, config);
      bars.forEach((_, index) => assert.deepEqual(current.step(index), previous.step(index)));
    }
    return 'paridade com a revisão aceita da 11A nos cinco modos com liquidez desligada';
  },
  C01() {
    const config = { FonteEQH_EQL: true, FonteSwingExterno: false, FonteSwingInterno: false };
    const rows = [[100, 110, 90, 100], [100, 111, 89, 100], [100, 109, 92, 100],
      [100, 111, 89, 100], [100, 113, 87, 100], [100, 108, 93, 100]];
    const events = { 3: [{ ...fact(15, 1, 110), ref: 0, hi: 111 }, { ...fact(16, 1, 90), ref: 0, hi: 89 }] };
    const { model, trace } = liquidityFixture(rows, events, { config, repeat: true });
    assert.deepEqual(liquidityArchive(model).map((level) => [level.ticks, level.origemnivel, level.ativacao, level.fim]),
      [[111, 1, 3, 4], [89, 1, 3, 4]]);
    assert.deepEqual(segments(trace.at(-1)).map((line) => line[6]), ['LG SSL · EQL', 'LG BSL · EQH']);
    const invalid = liquidityFixture([...rows.slice(0, 3), [100, 112, 88, 100], ...rows.slice(4)], events, { config });
    assert.deepEqual(liquidityArchive(invalid.model), []);
    const bars = dated(Array.from({ length: 207 }, () => [105, 110, 100, 105]));
    bars[200][1] = 111;
    const native = runtime(updated, bars, { ...config, HabilitarCapturasLiquidez: true, MostrarEQHEQL: false, LimiarEQ: 0.5 });
    const drawing = bars.map((_, index) => {
      if (index === 203) {
        native.set('pernaeq', 1);
        native.set('temtopoeq', true);
        native.set('topoeq', 111);
        native.set('atrwilder', 10);
        native.set('smcorigemeqtopo', 195);
      }
      return native.step(index);
    });
    assert.ok(liquidityArchive(native).some((level) => level.ticks === 111 && level.origemnivel === 195));
    assert.ok(!labels(drawing).includes('EQH'));
    return 'pools EQ dos dois lados, fonte oculta e rejeição por penetração antes da publicação';
  },
  C02() {
    const date = 1261102;
    const next = calcDate(date, 1);
    const later = calcDate(date, 2);
    const config = { FonteSessaoAnterior: true, InicioSessaoLQ: 2355, FimSessaoLQ: 10, IntervaloSessaoLQ: 5,
      FonteSwingInterno: false, FonteSwingExterno: false };
    const rows = [[100, 106, 94, 100], [100, 111, 92, 100], [100, 109, 87, 100], [100, 110, 95, 100],
      [100, 112, 90, 105], [100, 109, 93, 100], [100, 109, 94, 100], [100, 108, 95, 100]];
    const clock = { 0: [date, 2350], 1: [date, 2355], 2: [next, 0], 3: [next, 5],
      4: [next, 10], 5: [next, 2355], 6: [later, 5], 7: [later, 10] };
    const live = liquidityFixture(rows, {}, { clock, config, repeat: true });
    const [bsl, ssl] = liquidityArchive(live.model);
    assert.deepEqual([bsl.ticks, bsl.origemnivel, bsl.ativacao, bsl.fim], [111, 1, 3, 4]);
    assert.deepEqual([ssl.ticks, ssl.origemnivel, ssl.ativacao, ssl.fim, ssl.estado], [87, 2, 3, 6, live.model.get('lqsemfonte')]);
    assert.ok(segments(live.trace[5]).some((line) => line[6] === 'LG BSL · Sessão anterior'));
    assert.deepEqual(liquidityArchive(liquidityFixture(rows, {}, { clock, config, historical: true }).model), [bsl, ssl]);
    const incomplete = liquidityFixture(rows, {}, { clock: { ...clock, 2: [next, 1] }, config });
    assert.deepEqual(liquidityArchive(incomplete.model), []);
    return 'cobertura explícita, virada de data, sessão parcial e substituição das fontes';
  },
  C03() {
    const rows = [[100, 110, 95, 100], [100, 109, 95, 100], [100, 108, 97, 105],
      [106, 112, 99, 109], [108, 109, 105, 106], [106, 108, 93, 94], [103, 109, 97, 103]];
    for (const side of [1, 2]) {
      const mirror = (series) => side === 1 ? series : series.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);
      const events = { 1: [fact(side + 2, 0, side === 1 ? 110 : 90), fact(3 - side, 0, side === 1 ? 95 : 105)] };
      const config = { FonteSwingInterno: false, ReacaoPosCapturaATR: 0, MaxBarrasConfirmacaoLQ: 2 };
      function observed(mode, history = rows, options = {}) {
        const { model } = liquidityFixture(mirror(history), options.events ?? events,
          { config: { ...config, ModoConfirmacaoLQ: mode, ...options.config }, repeat: true });
        const [capture] = liquidityArchive(model);
        assert.equal(capture.estado, model.get('lqgrab'));
        return [capture.confirmacao, capture.confirmacaoem, capture.confirmacaopublicacao];
      }
      assert.deepEqual(observed(0), [0, -1, -1]);
      assert.deepEqual(observed(1), [2, 4, 5]);
      assert.deepEqual(observed(2), [2, 5, 6]);
      assert.deepEqual(observed(2, rows, { config: { MaxBarrasConfirmacaoLQ: 1 } }), [5, 4, 5]);
      assert.deepEqual(observed(2, rows, { events: { 1: [events[1][0]] } }), [3, 3, 4]);
      assert.deepEqual(observed(1, [...rows.slice(0, 4), [106, 105, 101, 106], ...rows.slice(5)]), [4, 4, 5]);
    }
    return 'confirmação LQ espelhada nos modos 0/1/2, alvo causal, dados inválidos e prazo inclusivo';
  },
  C04() {
    for (const side of [1, -1]) {
      const config = { HabilitarFlip: true, HabilitarIDM: false, FiltroIDMFlip: 2, FiltroSweepFlip: 2 };
      const local = idmLocalFixture(side, { config });
      assert.equal(qualification(local).qualbarra, 16);
      const refs = (fixture) => ['lqref', 'idmref'].map((field) =>
        fixture.model.element('flipevento' + field, (fixture.lane - 1) * 100));
      assert.deepEqual(refs(local), [-15, -15]);
      const lower = { 15: [112, 114, 103, 113] };
      const generic = { ...config, ModoCapturaFlip: 2, BufferRecuperacaoTicks: 14 };
      const late = idmLocalFixture(side, { config: generic, lower, repeat: true });
      assert.deepEqual([qualification(late).qualbarra, qualification(late).qualpublicacao], [17, 18]);
      assert.equal(late.model.get('lqcalculooculto'), true);
      assert.ok(refs(late)[0] > 0);
      assert.equal(refs(late)[0], refs(late)[1]);
      assert.equal(qualification(late).nota, 0);
      assert.equal(qualification(idmLocalFixture(side, { config: { ...generic, ModoCapturaFlip: 1 }, lower })).qualbarra, -1);
      assert.equal(qualification(idmLocalFixture(side, { config: { ...generic, MaxBarrasFVGFlip: 0 }, lower })).qualbarra, -1);
      assert.equal(qualification(idmLocalFixture(side, { config: { ...generic, BufferRecuperacaoTicks: 0 }, lower })).qualbarra, 16);
      const grab = idmLocalFixture(side, { config: { ...config, ModoCapturaFlip: 1 } });
      assert.equal(qualification(grab).qualbarra, 16);
      const idm = idmLocalFixture(side, { config: { ...config, ModoCapturaFlip: 1, HabilitarIDM: true } });
      assert.equal(idm.model.element('idmcapturalq', side === 1 ? 200 : 300), refs(idm)[0]);
    }
    const optional = idmLocalFixture(-1, { config: { HabilitarFlip: true, HabilitarIDM: false,
      ModoCapturaFlip: 1, FiltroSweepFlip: 1 } });
    assert.equal(qualification(optional).qualbarra, 16);
    assert.equal(optional.model.get('lqcalculooculto'), false);
    const remembered = idmLocalFixture(-1, {
      config: { HabilitarFlip: true, HabilitarIDM: false, FiltroSweepFlip: 2, ModoCapturaFlip: 1,
        FiltroVolumeFlip: 2, PeriodoVolumeFlip: 2 },
      lower: { 14: [110, 111, 105, 108, 10], 15: [109, 113, 103, 105, 10],
        16: [108, 110, 95, 99, 10], 17: [99, 100, 95, 96, 30] },
      before(model, index) {
        if (index !== 18) return;
        for (let slot = 0; slot < model.element('lqtotalniveis', 1); slot++) {
          if (model.element('lqfim', slot) === 15) model.set('lqestado', model.get('lqlivre'), slot);
        }
      },
    });
    assert.equal(qualification(remembered).qualbarra, 17);
    return 'filtros local, LG e SH, espera causal após B, fonte oculta e associação IDM sem circularidade';
  },
  C05() {
    for (const side of [-1, 1]) {
      const options = { side, events: { 14: [[1, 13, 122]] }, envelope: { 13: [110, 122, 106, 110] } };
      const config = { ModoFalhaFlip: 2, ModoCapturaFlip: 1 };
      const matched = poiFixture({ ...options, config });
      assert.equal(qualification(matched).qualbarra, 15);
      const ref = matched.model.element('flipeventolqextremoref', (matched.lane - 1) * 100);
      assert.equal(liquidityArchive(matched.model).find((level) => level.id === ref).ticks, side === -1 ? 120 : 80);
      const omitted = poiFixture({ ...options, config: { ...config, MinCapturaTicks: 3 } });
      assert.equal(qualification(omitted).qualbarra, -1);
    }
    return 'varredura genérica do Flip exige tomada do preço exato de H0/L0';
  },
  C06() {
    assert.equal(sha(acceptedRecoverySource), 'b04e993c1e9eddaf20c53805d2fed5f93f3970dfadb894475ad29eef2ad5f35c');
    const bars = prices.slice(0, 430);
    for (const HabilitarCapturasLiquidez of [true, false]) {
      const config = { PeriodoSwing: 10, HabilitarFlip: true, MostrarFlip: true, HabilitarIDM: true,
        MostrarIDM: true, ModoIDM: 3, HabilitarCapturasLiquidez, MostrarCapturasLiquidez: true, MostrarRupturaPendente: true };
      const previous = runtime(acceptedRecovery, bars, config);
      const current = runtime(updated, bars, config);
      bars.forEach((_, index) => assert.deepEqual(current.step(index), previous.step(index)));
    }
    return 'paridade com a revisão aceita da 11B com as opções novas desligadas';
  },
  D01() {
    assert.equal(sha(acceptedAdvancedLiquiditySource), '8d93849770f15ebbe24825ece1989732bb7ad6c951774659efc7d9b3e4e4c76d');
    for (const side of [1, -1]) {
      const rows = [[105, 110, 100, 105], [105, 110, 100, 105], [105, 110, 100, 105],
        [116, 120, 106, 108], [108, 109, 101, 103], [102, 102, 97, 99],
        [100, 110, 99, 109], [110, 112, 110, 111], [110, 111, 109, 110]];
      const bars = dated(side === 1 ? rows : rows.map(([o, h, l, c]) => [210 - o, 210 - l, 210 - h, 210 - c]));
      for (let bar = 6; bar < bars.length; bar++) bars[bar][4] = 1261103;
      for (const order of [1, 2]) {
        for (const MitigarPorFechamento of [false, true]) {
          const config = { DebugSMC: true, ModoFaixaOB: side === 1 ? 1 : 2, OrdemFaixaOB: order,
            MostrarBreakerBlocks: true, MitigarPorFechamento, MostrarFVG: false, FiltroAutomaticoFVG: false };
          const previous = runtime(acceptedAdvancedLiquidity, bars, config);
          const legacy = runtime(updated, bars, config);
          const both = runtime(updated, bars, { ...config, ModoBB: 3 });
          const hidden = runtime(updated, bars, { ...config, ModoBB: 3, MostrarBBLegacy: false });
          bars.forEach((_, index) => {
            if (index === 3) [previous, legacy, both, hidden].forEach((model) =>
              seedBlocks(model, 2, 1, [{ side, low: 100, high: 109 }, { side, low: 100, high: 110, birth: 1 }], true));
            const expected = previous.step(index);
            assert.deepEqual(legacy.step(index), expected);
            assert.deepEqual(both.step(index), expected);
            assert.equal(horizontal(hidden.step(index), 'Breaker').length, 0);
            if (index === 6) assert.equal(horizontal(expected, 'Breaker').length, 1);
          });
          for (let lane = 1; lane <= 19; lane++)
            assert.deepEqual(archived(legacy, lane), archived(previous, lane));
        }
      }
    }
    return '11C idêntica nas duas direções e ordens, FVG oculto, troca de sessão e visibilidade independente';
  },
  D02() {
    for (const side of [1, -1]) {
      for (const scale of [0, 1]) {
        for (const source of [0, 1]) {
          const options = { side, scale, source };
          const { markers, model, slot } = breakerCandidateFixture({ ...options, repeat: true });
          const sign = side === 1 ? '+' : '-';
          const name = source === 1 ? 'LUX' : 'ICT';
          const price = source === 1 ? 101 : 100;
          const label = `OB BB ${name} ${scale === 1 ? 'S' : 'I'} ${sign}`;
          assert.deepEqual(markers, [[8, label, side === 1 ? price : 240 - price]]);
          assert.deepEqual(breakerCandidateFixture({ ...options, historical: true, mode: 2 }).markers, markers);
          const quiet = breakerCandidateFixture({ ...options, debug: false, mode: 3 });
          assert.deepEqual(quiet.markers, []);
          const fields = ['origem', 'intermediario', 'intermediarioref', 'saida', 'deslocamentoinicio',
            'deslocamentofim', 'cruzamento', 'quebra', 'confirmacao', 'publicacao', 'remocao', 'motivoremocao'];
          const history = (runtime, position) => fields.map((field) => runtime.element('bb' + field, position));
          assert.deepEqual(history(quiet.model, quiet.slot), history(model, slot));
          assert.deepEqual(history(model, slot), [4, 4, 7, 5, 6, 6, 6, 6, 7, 8,
            source === 1 ? 8 : -1, source === 1 ? 1 : 0]);
          if (source === 1) {
            assert.equal(model.element(side === 1 ? 'bblo' : 'bbhi', slot), side === 1 ? 101 : 139);
            assert.equal(model.element(side === 1 ? 'bbhi' : 'bblo', slot), side === 1 ? 106 : 134);
          }
        }
      }
    }
    return 'fontes ICT e LuxAlgo espelhadas, duas escalas, remoção por pavio e publicação única em u+1';
  },
  D03() {
    assert.deepEqual(breakerCandidateFixture({ mode: 0 }).markers, []);
    assert.deepEqual(breakerCandidateFixture({ config: { FonteOBBB: 2 } }).markers, []);
    assert.deepEqual(breakerCandidateFixture({ lateTarget: true }).markers, []);
    assert.deepEqual(breakerCandidateFixture({ config: { DispATRBB: 100 } }).markers, []);
    assert.deepEqual(breakerCandidateFixture({ replace: { 4: [102, 107, 100, 102] } }).markers, []);
    assert.deepEqual(breakerCandidateFixture({ replace: { 7: [122, 124, 98, 99] } }).markers, []);
    assert.deepEqual(breakerCandidateFixture({ replace: { 5: [104, 103, 102, 108] } }).markers, []);
    assert.deepEqual(breakerCandidateFixture({ replace: { 5: [108, 109, 104, 105] } }).markers,
      [[8, 'OB BB ICT I +', 104]]);
    assert.deepEqual(breakerCandidateFixture({ replace: { 5: [112, 112, 108, 109] } }).markers,
      [[8, 'OB BB ICT I +', 100]]);
    const luxDoji = breakerCandidateFixture({ source: 1, replace: { 4: [102, 107, 100, 102] } });
    assert.deepEqual(luxDoji.markers, [[8, 'OB BB LUX_SOURCE I +', 101]]);
    assert.deepEqual(breakerCandidateFixture({ source: 1, removal: 7 }).markers, []);
    const close = breakerCandidateFixture({ source: 1, replace: { 8: [122, 123, 99, 100] } });
    assert.equal(close.model.element('bbmotivoremocao', close.slot), 2);
    assert.equal(close.model.element('bbconfirmacao', close.slot), 7);
    const multi = breakerCandidateFixture({ replace: { 5: [106, 113, 106, 112], 6: [111, 118, 110, 117] } });
    assert.deepEqual(multi.markers, [[8, 'OB BB ICT I +', 100]]);
    assert.equal(multi.model.element('bbdeslocamentoinicio', multi.slot), 5);
    const delayed = breakerCandidateFixture({ config: { BufferRupturaSMCTicks: 5 },
      replace: { 6: [107, 118, 107, 117] } });
    assert.deepEqual(delayed.markers, [[8, 'OB BB ICT I +', 100]]);
    assert.equal(delayed.model.element('bbcruzamento', delayed.slot), 6);
    assert.equal(delayed.model.element('bbquebra', delayed.slot), 7);
    assert.deepEqual(breakerCandidateFixture({ replace: { 6: [120, 124, 119, 121] } }).markers, []);
    assert.deepEqual(breakerCandidateFixture({ replace: { 7: [122, 124, 103, 105] } }).markers,
      [[8, 'OB BB ICT I +', 100]]);
    return 'causalidade, doji, falha anterior a u, OHLC inválido, deslocamento, base +1 e classificação LuxAlgo';
  },
  D04() {
    const bars = generated(450);
    const config = { PeriodoSwing: 10, UsarATRBlocos: false, MostrarEstruturaInterna: false,
      MostrarBreakerBlocks: true, MostrarFVG: false };
    const isMarker = ([name, label]) => name === 'plottext' && label.startsWith('OB BB');
    for (const ModoFaixaOB of [0, 1, 2, 3, 4]) {
      const options = { ...config, ModoFaixaOB, DebugSMC: true };
      const previous = runtime(acceptedAdvancedLiquidity, bars, options);
      const legacy = runtime(updated, bars, options);
      const ict = runtime(updated, bars, { ...options, ModoBB: 1 });
      const lux = runtime(updated, bars, { ...options, ModoBB: 1, FonteOBBB: 1 });
      const visible = [[], []];
      bars.forEach((_, index) => {
        const expected = previous.step(index);
        assert.deepEqual(legacy.step(index), expected);
        [ict, lux].forEach((model, source) => {
          const drawing = model.step(index);
          assert.deepEqual(drawing.filter((call) => !isMarker(call)), expected);
          visible[source].push(...drawing.filter(isMarker).map(([, label]) => label));
        });
      });
      for (const markers of visible) {
        assert.ok(markers.some((label) => label.includes(' I ')));
        assert.ok(markers.some((label) => label.includes(' S ')));
      }
    }
    const previous = runtime(acceptedAdvancedLiquidity, bars, config);
    const quiet = runtime(updated, bars, { ...config, ModoBB: 1, FonteOBBB: 1 });
    bars.forEach((_, index) => assert.deepEqual(quiet.step(index), previous.step(index)));
    assert.ok([1, 2, 3, 4].some((lane) => {
      const start = (lane - 1) * 100;
      const used = quiet.element('bbusados', lane);
      return Array.from({ length: used }, (_, offset) => start + offset)
        .some((slot) => quiet.element('bbconfirmacao', slot) >= 0);
    }));
    return 'duas fontes geradas por OHLC, inclusive com OB e debug ocultos, e paridade nos cinco modos legados';
  },
  I07() {
    const options = { length: 21, envelope: { 18: [106, 110, 99, 108] } };
    const live = idmFixture({ ...options, repeat: true });
    const reload = idmFixture({ ...options, historical: true });
    const hidden = idmFixture({ ...options, config: { MostrarIDM: false } });
    const hiddenLow = idmFixture({ ...options, config: { MostrarIDMLow: false } });
    const hiddenHigh = idmFixture({ ...options, side: -1, config: { MostrarIDMHigh: false } });
    assert.deepEqual(live.lines.at(-1), reload.lines.at(-1));
    assert.deepEqual(idmArchive(live.model), idmArchive(reload.model));
    assert.deepEqual(idmArchive(live.model), idmArchive(hidden.model));
    assert.deepEqual(idmArchive(live.model), idmArchive(hiddenLow.model));
    assert.equal(idmArchive(hiddenHigh.model, -1).length, 1);
    assert.ok([hidden, hiddenLow, hiddenHigh].every(({ lines }) => lines.every((line) => line.length === 0)));
    assert.equal(idmFixture({ config: { ModoIDM: 4 } }).model.get('idmconfigvalida'), false);
    for (const ModoFaixaOB of [0, 1, 2, 3, 4]) {
      const config = { ModoFaixaOB, MostrarFlip: true, MostrarFaixasFlip: true, MostrarCandidatosFlip: true };
      const prior = poiFixture({ config, program: acceptedAdvanced });
      const current = poiFixture({ config });
      assert.deepEqual(current.trace, prior.trace);
      assert.deepEqual(current.events, prior.events);
      assert.deepEqual(current.zones, prior.zones);
      if (ModoFaixaOB > 0) assert.ok(idmFixture({ config }).lines.every((line) => line.length === 0));
    }
    const nativeBars = prices.slice(0, 430);
    const chartOptions = { PeriodoSwing: 10, MostrarPivos: true, MostrarFVG: true, MostrarBlocosSwing: true };
    const prior = runtime(acceptedAdvanced, nativeBars, chartOptions);
    const native = runtime(updated, nativeBars, { ...chartOptions, HabilitarIDM: true, MostrarIDM: true });
    nativeBars.forEach((_, index) => {
      const trace = native.step(index);
      assert.deepEqual(trace.filter(([draw]) => draw !== 'linesegment'), prior.step(index));
    });
    for (const [side, expected] of [[1, [399, 408, 409, 415]], [-1, [101, 118, 119, 219]]]) {
      const [zone] = idmArchive(native, side);
      assert.deepEqual([zone.origem, zone.ativacao, zone.publicacao, zone.fim], expected);
      assert.equal(zone.nivelticks, nativeBars[zone.origem][side === 1 ? 2 : 1]);
    }
    return 'recarga, cinco modos da 09C e dois IDMs gerados a partir de OHLC com Flip e estrutura interna visual desligados';
  },
};

console.log(`Baseline ${commit} SHA-256 ${sha(baseline)}`);
console.log(`Candidato SHA-256 ${sha(candidate)}`);
for (const [id, test] of Object.entries(cases)) {
  try {
    console.log(`${id} PASS (local) — ${test()}`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`${id} FAIL (local) — ${error.stack}`);
  }
}
