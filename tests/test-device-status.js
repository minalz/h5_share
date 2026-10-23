// Reference artwork keeps its geometry while battery digits use a measured value or a bounded random fallback.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const PhoneStatusBar = require('../device-status');
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) MicroMessenger/8.0';
const android = 'Mozilla/5.0 (Linux; Android 14; Mobile) MicroMessenger/8.0';
const localTime = () => new Date(2026, 9, 19, 9, 7, 0);
function create(navigator = {}, extra = {}) {
  return PhoneStatusBar.create({ navigator, now: localTime, isSecureContext: true, ...extra });
}
function unknownBattery(info) {
  assert.equal(info.batteryLevel, null, 'Unavailable battery is not 100%');
  assert.equal(info.charging, null, 'Unavailable charging state is not false');
  assert.equal(info.batterySource, 'unknown');
}
function unknownStrength(info) {
  assert.equal(info.signalBars, null, 'Connectivity does not measure cellular reception');
  assert.equal(info.signalSource, 'unknown');
  assert.equal(info.wifiStrength, null, 'A Wi-Fi transport does not reveal its signal strength');
}
function recordingContext() {
  const calls = [], context = { measureText: value => ({ width: String(value).length * 24 }) };
  const methods = ['save', 'restore', 'scale', 'translate', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'rect', 'roundRect', 'fill', 'stroke', 'fillRect', 'clearRect', 'strokeRect', 'clip', 'fillText', 'strokeText', 'setLineDash', 'quadraticCurveTo', 'bezierCurveTo', 'drawImage'];
  for (const name of methods) context[name] = (...args) => {
    for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${name} uses finite coordinates`);
    calls.push({ name, args });
  };
  return { context, calls };
}
function assertVectorPercentage(calls, expected) {
  assert.equal(calls.filter(call => call.name === 'fill').length, String(expected).length, 'Each percentage digit is filled as its own vector glyph');
  assert.ok(calls.some(call => call.name === 'quadraticCurveTo'), 'The percentage uses embedded curved glyph outlines');
  assert.deepEqual(calls.filter(call => call.name === 'fillText').map(call => call.args[0]), ['09:07'], 'Only the clock depends on system text rendering; battery digits use fixed outlines');
  for (const call of calls.filter(call => call.name === 'scale')) {
    assert.equal(Math.abs(call.args[0]), Math.abs(call.args[1]), 'Glyph and icon scaling preserves aspect ratio instead of compressing digits horizontally');
  }
  const glyphScale = calls.find(call => call.name === 'scale' && call.args[0] > 0 && call.args[1] < 0);
  assert.ok(glyphScale, 'The built-in font outlines have a consistent coordinate transform');
  return glyphScale.args[0];
}
function bridgeResult(result) {
  return () => ({ invoke(method, parameters, callback) {
    assert.equal(method, 'getNetworkType'); assert.deepEqual(parameters, {}); callback(result);
  } });
}
async function main() {
  assert.equal(PhoneStatusBar.HEIGHT, 88);
  const referenceImage = { width: 897, height: 92, naturalWidth: 897, naturalHeight: 92 };
  let referenceBatteryReads = 0, referenceBridgeReads = 0;
  const reference = create({ userAgent: android, connection: { type: 'cellular' }, getBattery: async () => { referenceBatteryReads++; return { level: .12, charging: false }; } }, {
    referenceImage,
    getBridge: () => { referenceBridgeReads++; return { invoke() { throw new Error('Reference mode must not query WeChat'); } }; }
  });
  const initialReference = reference.snapshot();
  assert.equal(initialReference.batterySource, 'random');
  assert.ok(Number.isInteger(initialReference.batteryLevel) && initialReference.batteryLevel >= 20 && initialReference.batteryLevel <= 100);
  const refreshedReference = await reference.refresh();
  for (const observed of [initialReference, refreshedReference]) {
    assert.equal(observed.mode, 'reference');
    assert.equal(observed.platform, 'ios', 'The screenshot supplies its own icon style on every device');
    assert.equal(observed.time, '09:07');
    for (const source of ['networkSource', 'signalSource']) assert.equal(observed[source], 'reference');
    for (const measurement of ['signalBars', 'wifiStrength']) assert.equal(observed[measurement], null, 'Reference artwork does not invent signal measurements');
  }
  assert.equal(refreshedReference.batteryLevel, 12, 'A real measurement below the fallback range must be retained');
  assert.equal(refreshedReference.batterySource, 'device');
  assert.equal(refreshedReference.charging, false);
  assert.equal(referenceBatteryReads, 1, 'Reference mode reads the available battery API at refresh');
  assert.equal(referenceBridgeReads, 0, 'Reference mode never waits for the WeChat bridge');
  for (const width of [942, 471]) {
    const { context, calls } = recordingContext();
    const drawn = reference.draw(context, width);
    assert.equal(drawn.mode, 'reference');
    const imageCalls = calls.filter(call => call.name === 'drawImage');
    assert.equal(imageCalls.length, 1, 'All original icons come from one unmodified reference crop');
    const [image, sx, sy, sw, sh, dx, dy, dw, dh] = imageCalls[0].args;
    assert.equal(image, referenceImage);
    assert.deepEqual([dx, dy, dw, dh], [0, 0, 942, PhoneStatusBar.HEIGHT]);
    assert.deepEqual([sx, sw], [0, referenceImage.width], 'The full source width retains every icon');
    assert.ok(Math.abs(sw / sh - dw / dh) < 1e-9, 'Reference icons are not stretched');
    assert.ok(Math.abs(sy - (referenceImage.height - sh) / 2) < 1e-9, 'The vertical background crop is centered');
    assert.ok(sy >= 0 && sy < 5 && sy + sh <= referenceImage.height, 'Only a few background pixels are cropped');
    assert.ok(calls.some(call => call.name === 'scale' && call.args[0] === width / 942 && call.args[1] === width / 942));
    assert.ok(calls.some(call => call.name === 'fillText' && call.args[0] === '09:07' && call.args[2] <= PhoneStatusBar.HEIGHT), 'Current local time replaces the reference clock');
    assertVectorPercentage(calls, 12);
    assert.ok(!calls.some(call => call.name === 'fillText' && ['?', '—'].includes(call.args[0])), 'No unknown-state labels alter the reference icons');
    assert.ok(!calls.some(call => ['arc', 'stroke', 'roundRect'].includes(call.name)), 'Reference mode does not redraw approximate signal, Wi-Fi or battery shapes');
  }
  assert.equal(referenceBatteryReads, 1, 'Repeated snapshots and drawing do not request or randomize the current export again');

  function randomReference(navigator = {}, extra = {}) {
    return create(navigator, { referenceImage, random: () => 0, ...extra });
  }
  function fallback(info, expected = 20) {
    assert.equal(info.mode, 'reference');
    assert.equal(info.batterySource, 'random', 'A generated percentage is explicitly distinguishable from a device reading');
    assert.equal(info.batteryLevel, expected);
    assert.equal(info.charging, null);
    assert.ok(Number.isInteger(info.batteryLevel) && info.batteryLevel >= 20 && info.batteryLevel <= 100);
  }
  for (const [random, expected] of [[0, 20], [.5, 60], [1 - Number.EPSILON, 100]]) {
    fallback(await randomReference({}, { random: () => random }).refresh(), expected);
  }
  const percentageScales = new Map();
  for (const [level, expected] of [[0, 0], [1, 100], [.426, 43], [.59, 59], [.68, 68], [.72, 72]]) {
    let randomCalls = 0;
    const measured = randomReference({ getBattery: async () => ({ level, charging: false }) }, { random: () => { randomCalls++; return 0; } });
    const observed = await measured.refresh();
    assert.equal(observed.batteryLevel, expected); assert.equal(observed.batterySource, 'device');
    assert.equal(randomCalls, 0, 'Successful device readings have priority over fallback generation');
    const { context, calls } = recordingContext(); measured.draw(context);
    percentageScales.set(expected, assertVectorPercentage(calls, expected));
  }
  assert.ok(percentageScales.get(100) < percentageScales.get(43), 'The three-digit 100 value shrinks uniformly to fit the battery');
  fallback(await randomReference().refresh(), 20);
  let referenceInsecureCalls = 0;
  fallback(await randomReference({ getBattery: async () => { referenceInsecureCalls++; return { level: .7 }; } }, { isSecureContext: false }).refresh());
  assert.equal(referenceInsecureCalls, 0, 'An insecure context does not request the device battery');
  for (const getBattery of [() => { throw new Error('Access denied'); }, async () => { throw new Error('Unavailable'); }]) {
    fallback(await randomReference({ getBattery }).refresh());
  }
  for (const invalid of [null, {}, { level: NaN }, { level: -.1 }, { level: 1.1 }, { level: '0.5' }]) {
    fallback(await randomReference({ getBattery: async () => invalid }).refresh());
  }
  let randomCalls = 0;
  const stableRandom = randomReference({}, { random: () => randomCalls++ === 0 ? 0 : 1 - Number.EPSILON });
  fallback(await stableRandom.refresh(), 20);
  for (let retry = 0; retry < 3; retry++) {
    fallback(stableRandom.snapshot(), 20);
    const { context, calls } = recordingContext();
    fallback(stableRandom.draw(context), 20);
    assertVectorPercentage(calls, 20);
  }
  assert.equal(randomCalls, 1, 'An export and its repeated draw/encoding attempts share one fallback percentage');
  fallback(await stableRandom.refresh(), 100);
  assert.equal(randomCalls, 2, 'A later publish generates one fresh fallback value');
  let resolveReferenceBattery;
  const timedReference = randomReference({ getBattery: () => new Promise(resolve => { resolveReferenceBattery = resolve; }) }, { timeoutMs: 20 });
  const referenceStarted = performance.now();
  fallback(await timedReference.refresh());
  assert.ok(performance.now() - referenceStarted < 250, 'A stalled battery read cannot block reference export');
  resolveReferenceBattery({ level: .99, charging: true }); await Promise.resolve(); await Promise.resolve();
  fallback(timedReference.snapshot(), 20);
  const referenceResolvers = [];
  const concurrentReference = randomReference({ getBattery: () => new Promise(resolve => referenceResolvers.push(resolve)) }, { timeoutMs: 100 });
  const oldReference = concurrentReference.refresh(); await Promise.resolve();
  const newReference = concurrentReference.refresh(); await Promise.resolve();
  referenceResolvers[1]({ level: .64, charging: false }); await newReference;
  referenceResolvers[0]({ level: .21, charging: true }); await oldReference;
  assert.equal(concurrentReference.snapshot().batteryLevel, 64, 'An older battery refresh cannot overwrite a newer observation');
  assert.equal(concurrentReference.snapshot().charging, false);
  let model = create({ userAgent: iphone }), info = model.snapshot();
  assert.equal(info.platform, 'ios'); assert.equal(info.time, '09:07'); assert.equal(info.online, true);
  assert.equal(info.network, 'unknown'); assert.equal(info.networkSource, 'unknown');
  unknownStrength(info); unknownBattery(info); unknownBattery(await model.refresh());
  for (const nav of [
    { userAgent: iphone }, { userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' },
    { userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X)' },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }
  ]) assert.equal(create(nav).snapshot().platform, 'ios', 'iOS and iPad desktop mode use iOS graphics');
  for (const nav of [
    { userAgent: android }, { userAgent: 'Mozilla/5.0 (Linux; Adr 13; Mobile) MicroMessenger/8.0' },
    { userAgent: 'Mozilla/5.0 (Linux; HarmonyOS 4.0; Mobile)' },
    { userAgent: 'Reduced browser UA', userAgentData: { platform: 'Android' } }
  ]) assert.equal(create(nav).snapshot().platform, 'android');
  for (const nav of [
    {}, { userAgent: 'Desktop browser' }, { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 0 }
  ]) assert.equal(create(nav).snapshot().platform, 'generic', 'Desktop/unknown devices must not pretend to be iPhones');
  let date = new Date(2026, 9, 19, 23, 59);
  model = create({}, { now: () => date }); assert.equal(model.snapshot().time, '23:59');
  date = new Date(2026, 9, 20, 0, 5); assert.equal(model.snapshot().time, '00:05');

  let batteryCalls = 0;
  const battery = { level: .426, charging: true };
  model = create({ userAgent: android, connection: { type: 'wifi', effectiveType: '4g' }, getBattery: async () => { batteryCalls++; return battery; } });
  info = await model.refresh(); assert.equal(batteryCalls, 1);
  assert.equal(info.batteryLevel, 43); assert.equal(info.charging, true); assert.equal(info.batterySource, 'device');
  assert.equal(info.network, 'wifi'); assert.equal(info.networkSource, 'device'); unknownStrength(info);
  battery.level = .37; battery.charging = false;
  assert.equal(model.snapshot().batteryLevel, 37); assert.equal(model.snapshot().charging, false);
  for (const type of ['wifi', 'cellular', 'ethernet', 'none']) {
    info = await create({ connection: { type } }).refresh();
    assert.equal(info.network, type); assert.equal(info.networkSource, 'device'); unknownStrength(info);
  }
  for (const connection of [{ effectiveType: '4g' }, { effectiveType: '3g' }, { type: 'unknown', effectiveType: '4g' }]) {
    info = await create({ connection }).refresh();
    assert.equal(info.network, 'unknown', 'A speed estimate cannot distinguish Wi-Fi from cellular');
    assert.equal(info.networkSource, 'unknown'); unknownStrength(info);
  }
  info = await create({ onLine: false }).refresh();
  assert.equal(info.online, false); assert.equal(info.network, 'none'); assert.equal(info.networkSource, 'connectivity'); unknownStrength(info);
  info = await create({ onLine: false, connection: { type: 'wifi' } }).refresh();
  assert.equal(info.online, false); assert.equal(info.network, 'wifi'); assert.equal(info.networkSource, 'device'); unknownStrength(info);

  let insecureCalls = 0;
  info = await create({ getBattery: async () => { insecureCalls++; return battery; } }, { isSecureContext: false }).refresh();
  assert.equal(insecureCalls, 0); unknownBattery(info);
  for (const getBattery of [() => { throw new Error('Access denied'); }, async () => { throw new Error('Unavailable'); }]) unknownBattery(await create({ getBattery }).refresh());
  for (const invalid of [null, {}, { level: NaN, charging: true }, { level: -.1, charging: true }, { level: 1.1, charging: true }, { level: '0.5', charging: true }]) unknownBattery(await create({ getBattery: async () => invalid }).refresh());
  for (const [level, expected] of [[0, 0], [1, 100]]) {
    info = await create({ getBattery: async () => ({ level, charging: false }) }).refresh();
    assert.equal(info.batteryLevel, expected); assert.equal(info.charging, false); assert.equal(info.batterySource, 'device');
  }
  info = await create({ getBattery: async () => ({ level: .5 }) }).refresh();
  assert.equal(info.batteryLevel, 50); assert.equal(info.charging, null, 'A missing charging property stays unknown');
  let resolveBattery;
  model = create({ getBattery: () => new Promise(resolve => { resolveBattery = resolve; }) }, { timeoutMs: 20 });
  const started = performance.now(); info = await model.refresh();
  assert.ok(performance.now() - started < 250, 'A stalled battery API cannot block publishing'); unknownBattery(info);
  resolveBattery({ level: .13, charging: true }); await Promise.resolve(); await Promise.resolve(); unknownBattery(model.snapshot());

  for (const result of [{ err_msg: 'network_type:wifi' }, { err_msg: 'getNetworkType:ok', networkType: 'wifi' }]) {
    info = await create({ userAgent: iphone }, { getBridge: bridgeResult(result) }).refresh();
    assert.equal(info.network, 'wifi'); assert.equal(info.networkSource, 'wechat'); unknownStrength(info);
  }
  for (const type of ['2g', '3g', '4g', '5g', 'wwan', 'edge']) {
    info = await create({ userAgent: iphone }, { getBridge: bridgeResult({ err_msg: `network_type:${type}` }) }).refresh();
    assert.equal(info.network, 'cellular'); assert.equal(info.networkSource, 'wechat'); unknownStrength(info);
  }
  for (const result of [
    { err_msg: 'network_type:wwan', subtype: '4g' },
    { err_msg: 'getNetworkType:ok', networkType: 'wwan', subtype: '4g' }
  ]) {
    model = create({ userAgent: iphone }, { getBridge: bridgeResult(result) });
    info = await model.refresh();
    assert.equal(info.network, 'cellular'); assert.equal(info.networkType, '4g', 'An observed WeChat subtype preserves the actual cellular standard');
    assert.equal(info.networkSource, 'wechat'); unknownStrength(info);
    const { context, calls } = recordingContext(); model.draw(context);
    assert.ok(calls.some(call => call.name === 'fillText' && call.args[0] === '4G'), 'The export displays an observed cellular standard');
  }
  for (const result of [null, {}, { err_msg: 'getNetworkType:fail', networkType: 'wifi' }, { err_msg: 'getNetworkType:fail', subtype: '4g' }, { err_msg: 'network_type:unknown' }, { err_msg: 'getNetworkType:ok' }, { err_msg: 'getNetworkType:ok', networkType: 'not-a-transport' }]) {
    info = await create({ connection: { type: 'ethernet' } }, { getBridge: bridgeResult(result) }).refresh();
    assert.equal(info.network, 'ethernet', 'Failed/invalid bridge responses preserve browser measurements'); assert.equal(info.networkSource, 'device');
  }
  for (const getBridge of [() => null, () => ({}), () => { throw new Error('Unavailable'); }, () => ({ invoke() { throw new Error('Denied'); } })]) {
    info = await create({ connection: { type: 'cellular' } }, { getBridge }).refresh();
    assert.equal(info.network, 'cellular'); assert.equal(info.networkSource, 'device');
  }
  let lateNetwork;
  model = create({ connection: { type: 'ethernet' } }, { timeoutMs: 20, getBridge: () => ({ invoke(_method, _params, callback) { lateNetwork = callback; } }) });
  const bridgeStarted = performance.now(); info = await model.refresh();
  assert.ok(performance.now() - bridgeStarted < 250, 'A stalled WeChat bridge cannot block publishing'); assert.equal(info.network, 'ethernet');
  lateNetwork({ err_msg: 'network_type:wifi' }); await Promise.resolve();
  assert.equal(model.snapshot().network, 'ethernet', 'A bridge response after timeout cannot mutate the status');
  const callbacks = [];
  model = create({}, { timeoutMs: 100, getBridge: () => ({ invoke(_method, _params, callback) { callbacks.push(callback); } }) });
  const older = model.refresh(); await Promise.resolve(); const newer = model.refresh(); await Promise.resolve();
  assert.equal(callbacks.length, 2, 'Every refresh requests a fresh observation');
  callbacks[1]({ err_msg: 'network_type:4g' }); await newer;
  callbacks[0]({ err_msg: 'network_type:wifi' }); await older;
  assert.equal(model.snapshot().network, 'cellular', 'An older refresh cannot overwrite a newer observation'); assert.equal(model.snapshot().networkSource, 'wechat');

  for (const userAgent of [iphone, android, 'Desktop browser']) {
    for (const nav of [{ userAgent }, { userAgent, onLine: false },
      { userAgent, connection: { type: 'wifi' }, getBattery: async () => ({ level: .12, charging: true }) },
      { userAgent, connection: { type: 'cellular' }, getBattery: async () => ({ level: 0, charging: false }) }]) {
      model = create(nav); await model.refresh();
      for (const width of [942, 471]) {
        const { context, calls } = recordingContext(); const drawn = model.draw(context, width);
        const time = calls.find(call => call.name === 'fillText' && call.args[0] === '09:07');
        assert.ok(time && time.args[2] >= 0 && time.args[2] <= PhoneStatusBar.HEIGHT, 'Local clock fits in the bar');
        assert.ok(calls.some(call => ['fillRect', 'fill', 'stroke'].includes(call.name)), 'Status graphics are drawn');
        assert.ok(calls.some(call => call.name === 'save') && calls.some(call => call.name === 'restore'));
        if (drawn.batteryLevel === null) assert.ok(!calls.some(call => call.name === 'fillText' && /100%?/.test(String(call.args[0]))), 'Unknown battery is not rendered as full');
        assert.ok(!calls.some(call => call.name === 'fillText' && /null|undefined|NaN/.test(String(call.args[0]))), 'Unknown measurements have deliberate visual markers');
      }
    }
  }
  const iosDrawing = recordingContext(), androidDrawing = recordingContext();
  create({ userAgent: iphone, connection: { type: 'wifi' } }).draw(iosDrawing.context);
  create({ userAgent: android, connection: { type: 'wifi' } }).draw(androidDrawing.context);
  const arcs = drawing => drawing.calls.filter(call => call.name === 'arc');
  assert.ok(arcs(iosDrawing).length > arcs(androidDrawing).length, 'iOS Wi-Fi arcs and the Android fan use distinct platform shapes');
  console.log('PASS: reference icon geometry with measured or stable 20–100 fallback digits; live measurements, platform detection, timeouts and stale observation isolation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
