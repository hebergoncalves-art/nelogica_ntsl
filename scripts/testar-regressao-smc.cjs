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
  const candleFields = { open: 0, high: 1, low: 2, close: 3, date: 4, time: 5 };
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
const updated = compile(candidate);

function dated(rows) {
  return rows.map((row, index) => {
    const minutes = 570 + (index % 16) * 5;
    return [...row, calcDate(1261102, Math.floor(index / 16)), Math.floor(minutes / 60) * 100 + minutes % 60];
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
  rows.forEach(({ lane, origin, price, previousBias }, offset) => {
    const slot = frame * model.get('smclote') + offset;
    const values = { faixa: lane, origem: origin, ref: -1, nascimento: bar, estado: 1, lo: price,
      hi: price, brutolo: previousBias, brutohi: lane % 2 === 1 ? 1 : -1 };
    for (const [field, value] of Object.entries(values)) model.set('smcevento' + field, value, slot);
  });
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
  before = () => {}, after = () => {}, repeat = false, historical = false } = {}) {
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
  const bars = dated(side === -1 ? rows : rows.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]));
  bars.push(dated([[100, 101, 99, 100]])[0]);
  const model = runtime(updated, bars, {
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
    assert.deepEqual(Object.entries(updated.inputs).slice(37), [
      ['mostrarfaixasflip', false], ['tipozonaflip', 0], ['maxbuscaorigemflip', 30], ['fallbackpivoflip', true],
      ['maxbasecandlesflip', 3], ['baserangeflipatr', 1], ['maxlarguraflipatr', 0], ['exigirfreshflip', false],
      ['meiozonaflip', true], ['maxflipvisiveis', 10], ['modoinvalidacaoflip', 0], ['bufferinvalidacaoticksflip', 1],
      ['mostrarinvalidadasflip', 1], ['ocultarmitigadasflip', 0], ['encerraraposmitigacaoflip', 0],
      ['maxidadeflip', 0], ['maxvisitasflip', 0], ['modoretesteflip', 0], ['reacaoretesteatrflip', 0.5],
      ['maxbarrasretesteflip', 20], ['corfaixaflipalta', 'clgreen'], ['corfaixaflipbaixa', 'clred'],
      ['corinvalidadaflip', 'clgray'], ['mostrarorigemflip', false],
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
