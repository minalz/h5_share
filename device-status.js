/* Reference icons with device battery readings or an explicitly marked random fallback. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PhoneStatusBar = factory();
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const HEIGHT = 88;
  /* Fixed numeric outlines from Nunito 700 (Google Fonts), matched to the reference.
   * The following license applies to BATTERY_DIGITS only:
   * Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)
   *
   * This Font Software is licensed under the SIL Open Font License, Version 1.1.
   * This license is copied below, and is also available with a FAQ at:
   * http://scripts.sil.org/OFL
   *
   *
   * -----------------------------------------------------------
   * SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
   * -----------------------------------------------------------
   *
   * PREAMBLE
   * The goals of the Open Font License (OFL) are to stimulate worldwide
   * development of collaborative font projects, to support the font creation
   * efforts of academic and linguistic communities, and to provide a free and
   * open framework in which fonts may be shared and improved in partnership
   * with others.
   *
   * The OFL allows the licensed fonts to be used, studied, modified and
   * redistributed freely as long as they are not sold by themselves. The
   * fonts, including any derivative works, can be bundled, embedded,
   * redistributed and/or sold with any software provided that any reserved
   * names are not used by derivative works. The fonts and derivatives,
   * however, cannot be released under any other type of license. The
   * requirement for fonts to remain under this license does not apply
   * to any document created using the fonts or their derivatives.
   *
   * DEFINITIONS
   * "Font Software" refers to the set of files released by the Copyright
   * Holder(s) under this license and clearly marked as such. This may
   * include source files, build scripts and documentation.
   *
   * "Reserved Font Name" refers to any names specified as such after the
   * copyright statement(s).
   *
   * "Original Version" refers to the collection of Font Software components as
   * distributed by the Copyright Holder(s).
   *
   * "Modified Version" refers to any derivative made by adding to, deleting,
   * or substituting -- in part or in whole -- any of the components of the
   * Original Version, by changing formats or by porting the Font Software to a
   * new environment.
   *
   * "Author" refers to any designer, engineer, programmer, technical
   * writer or other person who contributed to the Font Software.
   *
   * PERMISSION & CONDITIONS
   * Permission is hereby granted, free of charge, to any person obtaining
   * a copy of the Font Software, to use, study, copy, merge, embed, modify,
   * redistribute, and sell modified and unmodified copies of the Font
   * Software, subject to the following conditions:
   *
   * 1) Neither the Font Software nor any of its individual components,
   * in Original or Modified Versions, may be sold by itself.
   *
   * 2) Original or Modified Versions of the Font Software may be bundled,
   * redistributed and/or sold with any software, provided that each copy
   * contains the above copyright notice and this license. These can be
   * included either as stand-alone text files, human-readable headers or
   * in the appropriate machine-readable metadata fields within text or
   * binary files as long as those fields can be easily viewed by the user.
   *
   * 3) No Modified Version of the Font Software may use the Reserved Font
   * Name(s) unless explicit written permission is granted by the corresponding
   * Copyright Holder. This restriction only applies to the primary font name as
   * presented to the users.
   *
   * 4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
   * Software shall not be used to promote, endorse or advertise any
   * Modified Version, except to acknowledge the contribution(s) of the
   * Copyright Holder(s) and the Author(s) or with their explicit written
   * permission.
   *
   * 5) The Font Software, modified or unmodified, in part or in whole,
   * must be distributed entirely under this license, and must not be
   * distributed under any other license. The requirement for fonts to
   * remain under this license does not apply to any document created
   * using the Font Software.
   *
   * TERMINATION
   * This license becomes null and void if any of the above conditions are
   * not met.
   *
   * DISCLAIMER
   * THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
   * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
   * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
   * OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
   * COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
   * INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
   * DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
   * FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
   * OTHER DEALINGS IN THE FONT SOFTWARE.
   */
  const BATTERY_DIGITS = {"0":{"advance":600,"path":[["moveTo",300,-10],["quadraticCurveTo",175,-10,109,84.5],["quadraticCurveTo",43,179,43,354],["quadraticCurveTo",43,472,72.5,552.5],["quadraticCurveTo",102,633,159.5,674],["quadraticCurveTo",217,715,300,715],["quadraticCurveTo",426,715,491.5,623],["quadraticCurveTo",557,531,557,355],["quadraticCurveTo",557,238,527.5,156.5],["quadraticCurveTo",498,75,441,32.5],["quadraticCurveTo",384,-10,300,-10],["closePath"],["moveTo",300,95],["quadraticCurveTo",368,95,400.5,158],["quadraticCurveTo",433,221,433,355],["quadraticCurveTo",433,489,400.5,549.5],["quadraticCurveTo",368,610,300,610],["quadraticCurveTo",233,610,200,549.5],["quadraticCurveTo",167,489,167,355],["quadraticCurveTo",167,221,200,158],["quadraticCurveTo",233,95,300,95],["closePath"]]},"1":{"advance":600,"path":[["moveTo",156,0],["quadraticCurveTo",130,0,115.5,14.5],["quadraticCurveTo",101,29,101,54],["quadraticCurveTo",101,80,115.5,93],["quadraticCurveTo",130,106,156,106],["lineTo",268,106],["lineTo",268,597],["lineTo",330,597],["lineTo",183,508],["quadraticCurveTo",164,497,147.5,499.5],["quadraticCurveTo",131,502,119.5,513.5],["quadraticCurveTo",108,525,104,541],["quadraticCurveTo",100,557,106.5,573.5],["quadraticCurveTo",113,590,132,601],["lineTo",270,684],["quadraticCurveTo",290,696,310,704.5],["quadraticCurveTo",330,713,347,713],["quadraticCurveTo",368,713,382,701.5],["quadraticCurveTo",396,690,396,664],["lineTo",396,106],["lineTo",498,106],["quadraticCurveTo",524,106,538.5,93],["quadraticCurveTo",553,80,553,54],["quadraticCurveTo",553,28,538.5,14],["quadraticCurveTo",524,0,498,0],["closePath"]]},"2":{"advance":600,"path":[["moveTo",133,0],["quadraticCurveTo",101,0,86.5,14.5],["quadraticCurveTo",72,29,72,57],["quadraticCurveTo",72,74,81,90],["quadraticCurveTo",90,106,107,124],["lineTo",308,338],["quadraticCurveTo",354,386,374,425.5],["quadraticCurveTo",394,465,394,505],["quadraticCurveTo",394,555,362.5,581],["quadraticCurveTo",331,607,271,607],["quadraticCurveTo",237,607,203,597.5],["quadraticCurveTo",169,588,134,565],["quadraticCurveTo",116,553,100.5,555],["quadraticCurveTo",85,557,73.5,568],["quadraticCurveTo",62,579,58,595],["quadraticCurveTo",54,611,59.5,627.5],["quadraticCurveTo",65,644,83,656],["quadraticCurveTo",126,685,179.5,700],["quadraticCurveTo",233,715,287,715],["quadraticCurveTo",363,715,415,692],["quadraticCurveTo",467,669,494,625],["quadraticCurveTo",521,581,521,518],["quadraticCurveTo",521,476,507.5,436],["quadraticCurveTo",494,396,466.5,355],["quadraticCurveTo",439,314,395,268],["lineTo",207,72],["lineTo",207,106],["lineTo",501,106],["quadraticCurveTo",528,106,542,93],["quadraticCurveTo",556,80,556,54],["quadraticCurveTo",556,28,542,14],["quadraticCurveTo",528,0,501,0],["closePath"]]},"3":{"advance":600,"path":[["moveTo",286,-10],["quadraticCurveTo",232,-10,174,4],["quadraticCurveTo",116,18,73,46],["quadraticCurveTo",53,59,46,76],["quadraticCurveTo",39,93,42.5,108.5],["quadraticCurveTo",46,124,57.5,135],["quadraticCurveTo",69,146,86.5,148],["quadraticCurveTo",104,150,125,139],["quadraticCurveTo",166,117,204,107.5],["quadraticCurveTo",242,98,282,98],["quadraticCurveTo",326,98,356,110],["quadraticCurveTo",386,122,401.5,146],["quadraticCurveTo",417,170,417,204],["quadraticCurveTo",417,254,383.5,278.5],["quadraticCurveTo",350,303,286,303],["lineTo",222,303],["quadraticCurveTo",194,303,179.5,317],["quadraticCurveTo",165,331,165,356],["quadraticCurveTo",165,381,179.5,395],["quadraticCurveTo",194,409,222,409],["lineTo",274,409],["quadraticCurveTo",312,409,339,421.5],["quadraticCurveTo",366,434,381,457],["quadraticCurveTo",396,480,396,513],["quadraticCurveTo",396,559,365.5,583],["quadraticCurveTo",335,607,277,607],["quadraticCurveTo",240,607,207.5,598.5],["quadraticCurveTo",175,590,136,567],["quadraticCurveTo",118,556,101.5,558],["quadraticCurveTo",85,560,74,571],["quadraticCurveTo",63,582,59,597.5],["quadraticCurveTo",55,613,61,629.5],["quadraticCurveTo",67,646,86,658],["quadraticCurveTo",129,686,181,700.5],["quadraticCurveTo",233,715,288,715],["quadraticCurveTo",361,715,413,692.5],["quadraticCurveTo",465,670,492.5,628.5],["quadraticCurveTo",520,587,520,528],["quadraticCurveTo",520,486,504,451.5],["quadraticCurveTo",488,417,459,393],["quadraticCurveTo",430,369,389,359],["lineTo",389,371],["quadraticCurveTo",461,359,501,311.5],["quadraticCurveTo",541,264,541,193],["quadraticCurveTo",541,131,510,85],["quadraticCurveTo",479,39,422,14.5],["quadraticCurveTo",365,-10,286,-10],["closePath"]]},"4":{"advance":600,"path":[["moveTo",413,-8],["quadraticCurveTo",383,-8,366,8.5],["quadraticCurveTo",349,25,349,56],["lineTo",349,134],["lineTo",102,134],["quadraticCurveTo",71,134,52.5,147],["quadraticCurveTo",34,160,34,188],["quadraticCurveTo",34,204,42.5,223],["quadraticCurveTo",51,242,73,273],["lineTo",347,670],["quadraticCurveTo",361,691,378,702],["quadraticCurveTo",395,713,417,713],["quadraticCurveTo",443,713,460,697.5],["quadraticCurveTo",477,682,477,649],["lineTo",477,240],["lineTo",526,240],["quadraticCurveTo",555,240,569.5,226.5],["quadraticCurveTo",584,213,584,187],["quadraticCurveTo",584,161,569.5,147.5],["quadraticCurveTo",555,134,526,134],["lineTo",477,134],["lineTo",477,56],["quadraticCurveTo",477,25,460,8.5],["quadraticCurveTo",443,-8,413,-8],["closePath"],["moveTo",349,240],["lineTo",349,552],["lineTo",378,552],["lineTo",142,206],["lineTo",142,240],["closePath"]]},"5":{"advance":600,"path":[["moveTo",306,-10],["quadraticCurveTo",253,-10,198,4],["quadraticCurveTo",143,18,97,47],["quadraticCurveTo",78,59,71.5,75.5],["quadraticCurveTo",65,92,68.5,108.5],["quadraticCurveTo",72,125,83.5,136.5],["quadraticCurveTo",95,148,111.5,150],["quadraticCurveTo",128,152,148,141],["quadraticCurveTo",185,120,223,109],["quadraticCurveTo",261,98,304,98],["quadraticCurveTo",346,98,376,113],["quadraticCurveTo",406,128,422,155],["quadraticCurveTo",438,182,438,218],["quadraticCurveTo",438,274,404,308.5],["quadraticCurveTo",370,343,311,343],["quadraticCurveTo",279,343,249,332.5],["quadraticCurveTo",219,322,190,296],["quadraticCurveTo",181,288,167,280.5],["quadraticCurveTo",153,273,137,273],["quadraticCurveTo",112,273,99,286],["quadraticCurveTo",86,299,86,322],["lineTo",86,649],["quadraticCurveTo",86,676,100.5,690.5],["quadraticCurveTo",115,705,142,705],["lineTo",471,705],["quadraticCurveTo",498,705,512.5,691.5],["quadraticCurveTo",527,678,527,652],["quadraticCurveTo",527,627,512.5,613],["quadraticCurveTo",498,599,471,599],["lineTo",211,599],["lineTo",211,375],["lineTo",178,375],["quadraticCurveTo",204,410,247,429],["quadraticCurveTo",290,448,341,448],["quadraticCurveTo",408,448,457.5,419.5],["quadraticCurveTo",507,391,534.5,340.5],["quadraticCurveTo",562,290,562,223],["quadraticCurveTo",562,154,531,101.5],["quadraticCurveTo",500,49,442.5,19.5],["quadraticCurveTo",385,-10,306,-10],["closePath"]]},"6":{"advance":600,"path":[["moveTo",326,-10],["quadraticCurveTo",239,-10,177.5,31.5],["quadraticCurveTo",116,73,84,151],["quadraticCurveTo",52,229,52,340],["quadraticCurveTo",52,430,72.5,499.5],["quadraticCurveTo",93,569,132,617],["quadraticCurveTo",171,665,227.5,690],["quadraticCurveTo",284,715,355,715],["quadraticCurveTo",399,715,444.5,701.5],["quadraticCurveTo",490,688,530,661],["quadraticCurveTo",546,651,551,635],["quadraticCurveTo",556,619,552.5,603.5],["quadraticCurveTo",549,588,538.5,576.5],["quadraticCurveTo",528,565,512,562.5],["quadraticCurveTo",496,560,477,571],["quadraticCurveTo",443,591,413,599],["quadraticCurveTo",383,607,353,607],["quadraticCurveTo",295,607,255,580],["quadraticCurveTo",215,553,194.5,499],["quadraticCurveTo",174,445,174,364],["lineTo",174,289],["lineTo",162,289],["quadraticCurveTo",170,340,195.5,376.5],["quadraticCurveTo",221,413,261,432.5],["quadraticCurveTo",301,452,350,452],["quadraticCurveTo",411,452,458,423],["quadraticCurveTo",505,394,532,343],["quadraticCurveTo",559,292,559,226],["quadraticCurveTo",559,158,529.5,104.5],["quadraticCurveTo",500,51,447.5,20.5],["quadraticCurveTo",395,-10,326,-10],["closePath"],["moveTo",319,92],["quadraticCurveTo",355,92,382.5,108],["quadraticCurveTo",410,124,425,153.5],["quadraticCurveTo",440,183,440,221],["quadraticCurveTo",440,260,425,289],["quadraticCurveTo",410,318,382.5,334.5],["quadraticCurveTo",355,351,319,351],["quadraticCurveTo",283,351,256,334.5],["quadraticCurveTo",229,318,213.5,289],["quadraticCurveTo",198,260,198,221],["quadraticCurveTo",198,183,213.5,153.5],["quadraticCurveTo",229,124,256,108],["quadraticCurveTo",283,92,319,92],["closePath"]]},"7":{"advance":600,"path":[["moveTo",172,-8],["quadraticCurveTo",149,-8,134,3],["quadraticCurveTo",119,14,116,32.5],["quadraticCurveTo",113,51,125,74],["lineTo",427,642],["lineTo",427,598],["lineTo",103,598],["quadraticCurveTo",76,598,61.5,612],["quadraticCurveTo",47,626,47,651],["quadraticCurveTo",47,677,61.5,691],["quadraticCurveTo",76,705,103,705],["lineTo",490,705],["quadraticCurveTo",517,705,534,691],["quadraticCurveTo",551,677,551,651],["quadraticCurveTo",551,629,545,612.5],["quadraticCurveTo",539,596,529,577],["lineTo",245,34],["quadraticCurveTo",234,12,216.5,2],["quadraticCurveTo",199,-8,172,-8],["closePath"]]},"8":{"advance":600,"path":[["moveTo",300,-10],["quadraticCurveTo",218,-10,159.5,13.5],["quadraticCurveTo",101,37,69.5,82],["quadraticCurveTo",38,127,38,190],["quadraticCurveTo",38,240,58.5,278.5],["quadraticCurveTo",79,317,115,341],["quadraticCurveTo",151,365,197,371],["lineTo",197,350],["quadraticCurveTo",133,364,94.5,411.5],["quadraticCurveTo",56,459,56,525],["quadraticCurveTo",56,585,86,627.5],["quadraticCurveTo",116,670,171,692.5],["quadraticCurveTo",226,715,300,715],["quadraticCurveTo",375,715,430,692.5],["quadraticCurveTo",485,670,515,627.5],["quadraticCurveTo",545,585,545,525],["quadraticCurveTo",545,481,527.5,444],["quadraticCurveTo",510,407,478.5,383],["quadraticCurveTo",447,359,405,351],["lineTo",405,371],["quadraticCurveTo",475,361,518.5,312.5],["quadraticCurveTo",562,264,562,190],["quadraticCurveTo",562,127,530.5,82],["quadraticCurveTo",499,37,440.5,13.5],["quadraticCurveTo",382,-10,300,-10],["closePath"],["moveTo",300,90],["quadraticCurveTo",371,90,407,117.5],["quadraticCurveTo",443,145,443,199],["quadraticCurveTo",443,253,407,280],["quadraticCurveTo",371,307,300,307],["quadraticCurveTo",230,307,193.5,280],["quadraticCurveTo",157,253,157,199],["quadraticCurveTo",157,145,193.5,117.5],["quadraticCurveTo",230,90,300,90],["closePath"],["moveTo",300,407],["quadraticCurveTo",340,407,368,419.5],["quadraticCurveTo",396,432,411,456],["quadraticCurveTo",426,480,426,512],["quadraticCurveTo",426,560,392.5,587.5],["quadraticCurveTo",359,615,300,615],["quadraticCurveTo",241,615,208,587.5],["quadraticCurveTo",175,560,175,512],["quadraticCurveTo",175,463,208,435],["quadraticCurveTo",241,407,300,407],["closePath"]]},"9":{"advance":600,"path":[["moveTo",245,-10],["quadraticCurveTo",202,-10,156,3.5],["quadraticCurveTo",110,17,70,44],["quadraticCurveTo",54,54,49,70],["quadraticCurveTo",44,86,47.5,101.5],["quadraticCurveTo",51,117,61.5,128.5],["quadraticCurveTo",72,140,88,142.5],["quadraticCurveTo",104,145,123,134],["quadraticCurveTo",157,114,187,106],["quadraticCurveTo",217,98,247,98],["quadraticCurveTo",305,98,345,125],["quadraticCurveTo",385,152,405.5,206.5],["quadraticCurveTo",426,261,426,341],["lineTo",426,416],["lineTo",438,416],["quadraticCurveTo",431,366,405,329],["quadraticCurveTo",379,292,339,272.5],["quadraticCurveTo",299,253,250,253],["quadraticCurveTo",190,253,142.5,282],["quadraticCurveTo",95,311,68,362.5],["quadraticCurveTo",41,414,41,479],["quadraticCurveTo",41,548,70.5,601],["quadraticCurveTo",100,654,153,684.5],["quadraticCurveTo",206,715,274,715],["quadraticCurveTo",362,715,423,674],["quadraticCurveTo",484,633,516,554.5],["quadraticCurveTo",548,476,548,365],["quadraticCurveTo",548,275,527.5,205.5],["quadraticCurveTo",507,136,468,88],["quadraticCurveTo",429,40,372.5,15],["quadraticCurveTo",316,-10,245,-10],["closePath"],["moveTo",282,355],["quadraticCurveTo",318,355,345.5,371.5],["quadraticCurveTo",373,388,388,417.5],["quadraticCurveTo",403,447,403,485],["quadraticCurveTo",403,524,388,553],["quadraticCurveTo",373,582,345.5,598],["quadraticCurveTo",318,614,282,614],["quadraticCurveTo",246,614,219,598],["quadraticCurveTo",192,582,176.5,553],["quadraticCurveTo",161,524,161,485],["quadraticCurveTo",161,447,176.5,417.5],["quadraticCurveTo",192,388,219,371.5],["quadraticCurveTo",246,355,282,355],["closePath"]]}};
  function drawReferencePercentage(ctx, level) {
    const digits = Array.from(String(level), digit => BATTERY_DIGITS[digit]);
    const advance = digits.reduce((sum, glyph) => sum + glyph.advance, 0);
    // Reduce the whole glyph uniformly for 100; never squash text horizontally.
    const size = Math.min(26.75, 36000 / advance), scale = size / 1000;
    ctx.save();
    ctx.translate(769.75 - advance * scale / 2, 52 - (26.75 - size) * .35);
    ctx.scale(scale, -scale); ctx.fillStyle = '#fff';
    for (const glyph of digits) {
      ctx.beginPath();
      for (const [method, ...coordinates] of glyph.path) ctx[method](...coordinates);
      ctx.fill(); ctx.translate(glyph.advance, 0);
    }
    ctx.restore();
  }
  function safely(read, fallback) { try { return read() ?? fallback; } catch { return fallback; } }
  function platform(nav) {
    const ua = safely(() => nav.userAgent, ''), legacy = safely(() => nav.platform, '');
    if (/iPhone|iPad|iPod/i.test(ua + ' ' + legacy) || (/MacIntel/i.test(legacy) && safely(() => nav.maxTouchPoints, 0) > 1)) return 'ios';
    if (/Android|\bAdr\b|HarmonyOS|OpenHarmony/i.test(ua) || /Android/i.test(safely(() => nav.userAgentData.platform, ''))) return 'android';
    return 'generic';
  }
  function transport(value) {
    if (typeof value !== 'string') return null;
    const type = value.trim().toLowerCase();
    if (type === 'wifi') return { network: 'wifi', networkType: type };
    if (['2g','3g','4g','5g','wwan','edge','cellular'].includes(type)) return { network: 'cellular', networkType: type };
    if (['ethernet','none'].includes(type)) return { network: type, networkType: type };
    return null;
  }
  function bridgeTransport(result) {
    if (!result || typeof result !== 'object') return null;
    const message = String(result.err_msg || result.errMsg || '');
    if (/fail|cancel|denied|not[_ ]?support|permission|error/i.test(message)) return null;
    const legacy = message.match(/^network_type:([a-z0-9]+)$/i);
    if (legacy) return transport(result.subtype) || transport(legacy[1]);
    if (!/^getNetworkType:ok$/i.test(message)) return null;
    return transport(result.subtype) || transport(result.networkType || result.network_type || result.type);
  }
  function create(options = {}) {
    const nav = options.navigator || (typeof navigator === 'object' ? navigator : {});
    const now = options.now || (() => new Date());
    const secure = options.isSecureContext ?? (typeof globalThis !== 'object' || globalThis.isSecureContext !== false);
    const timeoutMs = options.timeoutMs ?? 500;
    const getBridge = options.getBridge || (() => typeof globalThis === 'object' ? globalThis.WeixinJSBridge : null);
    const random = options.random || Math.random;
    let battery = null, wechatNetwork = null, revision = 0, randomBattery = null;
    function fallbackBattery() {
      if (randomBattery === null) randomBattery = 20 + Math.min(80, Math.max(0, Math.floor(random() * 81)));
      return randomBattery;
    }
    function snapshot() {
      const date = now(), online = safely(() => nav.onLine, true) !== false;
      const time = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      const level = safely(() => battery.level, null);
      const knownBattery = Number.isFinite(level) && level >= 0 && level <= 1;
      const charging = knownBattery ? safely(() => battery.charging, null) : null;
      if (options.referenceImage) return { mode: 'reference', platform: 'ios', time, online,
        batteryLevel: knownBattery ? Math.round(level * 100) : fallbackBattery(),
        charging: typeof charging === 'boolean' ? charging : null, batterySource: knownBattery ? 'device' : 'random',
        network: 'reference', networkType: 'reference', networkSource: 'reference',
        signalBars: null, signalSource: 'reference', wifiStrength: null, simCount: null };
      const connection = safely(() => nav.connection || nav.mozConnection || nav.webkitConnection, null);
      // effectiveType estimates speed and cannot identify the physical network.
      const browserNetwork = transport(safely(() => connection.type, ''));
      const network = wechatNetwork || browserNetwork;
      return { platform: platform(nav), time, online,
        batteryLevel: knownBattery ? Math.round(level * 100) : null,
        charging: typeof charging === 'boolean' ? charging : null,
        batterySource: knownBattery ? 'device' : 'unknown',
        network: network?.network || (online ? 'unknown' : 'none'),
        networkType: network?.networkType || (online ? 'unknown' : 'none'),
        networkSource: wechatNetwork ? 'wechat' : browserNetwork ? 'device' : online ? 'unknown' : 'connectivity',
        signalBars: null, signalSource: 'unknown', wifiStrength: null, simCount: null };
    }
    async function bounded(operation) {
      let timer;
      try {
        return await Promise.race([Promise.resolve().then(operation), new Promise(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); })]);
      } catch { return null; }
      finally { if (timer !== undefined) clearTimeout(timer); }
    }
    function readBattery() {
      return bounded(async () => {
        if (!secure || typeof nav.getBattery !== 'function') return null;
        const result = await nav.getBattery();
        if (!result || !Number.isFinite(result.level) || result.level < 0 || result.level > 1) return null;
        return result;
      });
    }
    function readWechatNetwork() {
      return bounded(() => {
        if (!options.getBridge && !/MicroMessenger/i.test(safely(() => nav.userAgent,''))) return null;
        const bridge = getBridge();
        if (!bridge || typeof bridge.invoke !== 'function') return null;
        return new Promise(resolve => bridge.invoke('getNetworkType', {}, result => resolve(bridgeTransport(result))));
      });
    }
    async function refresh() {
      const current = ++revision;
      const [nextBattery,nextNetwork] = await Promise.all([readBattery(),options.referenceImage ? null : readWechatNetwork()]);
      if (current === revision) {
        battery = nextBattery; wechatNetwork = nextNetwork;
        // Sample once per publish; all draw/encoding retries retain the same number.
        if (options.referenceImage && !nextBattery) { randomBattery = null; fallbackBattery(); }
      }
      return snapshot();
    }
    function draw(ctx, width = 942) {
      const info = snapshot();
      ctx.save(); ctx.scale(width / 942,width / 942);
      ctx.fillStyle = '#f7f7f7'; ctx.fillRect(0,0,942,HEIGHT);
      if (options.referenceImage) {
        const image = options.referenceImage, imageWidth = image.naturalWidth || image.width, imageHeight = image.naturalHeight || image.height;
        const scale = Math.max(942 / imageWidth, HEIGHT / imageHeight);
        const sw = 942 / scale, sh = HEIGHT / scale;
        // Crop only the strip's empty vertical margins; keep the icon proportions.
        ctx.drawImage(image, (imageWidth - sw) / 2, (imageHeight - sh) / 2, sw, sh, 0, 0, 942, HEIGHT);
        ctx.fillStyle = '#f7f7f7'; ctx.fillRect(0, 0, 610, HEIGHT);
        ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.font = `600 ${37 * 942 / 897}px -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
        ctx.fillText(info.time, 119 * 942 / 897, HEIGHT / 2 + 11 * 942 / 897);
        // Replace only the original digits, leaving the screenshot's icon outline and bolt intact.
        ctx.save(); ctx.translate(-(imageWidth - sw) / 2 * scale, -(imageHeight - sh) / 2 * scale); ctx.scale(scale, scale);
        ctx.fillStyle = '#34c759'; ctx.fillRect(752, 32, 36, 22);
        drawReferencePercentage(ctx, info.batteryLevel);
        ctx.restore();
        ctx.restore(); return info;
      }
      ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `${info.platform === 'ios' ? '600 39' : '500 35'}px -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
      ctx.fillText(info.time,info.platform === 'ios' ? 59 : 34,59);
      if (info.platform === 'ios') drawIOS(ctx,info); else drawAndroid(ctx,info);
      ctx.restore(); return info;
    }
    return { snapshot,refresh,draw };
  }
  function label(ctx,value,x,y,size = 21,color = '#777') {
    ctx.fillStyle = color; ctx.textAlign = 'center';
    ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`;
    ctx.fillText(value,x,y); ctx.textAlign = 'left';
  }
  function unknownBadge(ctx,x,y) {
    ctx.fillStyle = '#f7f7f7'; ctx.beginPath(); ctx.arc(x,y - 7,11,0,Math.PI * 2); ctx.fill(); label(ctx,'?',x,y,20);
  }
  function wifiIOS(ctx,x,y) {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (const radius of [31,18]) { ctx.beginPath(); ctx.arc(x,y,radius,Math.PI * 1.25,Math.PI * 1.75); ctx.stroke(); }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x,y - 1,4,0,Math.PI * 2); ctx.fill();
    unknownBadge(ctx,x + 27,y + 2);
  }
  function wifiAndroid(ctx,x,y) {
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(x,y);
    ctx.arc(x,y,35,Math.PI * 1.25,Math.PI * 1.75); ctx.closePath(); ctx.fill(); unknownBadge(ctx,x + 27,y + 2);
  }
  function signalIOS(ctx) {
    ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const height = 9 + i * 7;
      ctx.beginPath(); ctx.roundRect(657 + i * 13,60 - height,9,height,3); ctx.stroke();
    }
    unknownBadge(ctx,680,58);
  }
  function signalAndroid(ctx) {
    ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(748,61); ctx.lineTo(782,61); ctx.lineTo(782,28); ctx.closePath(); ctx.stroke(); unknownBadge(ctx,771,56);
  }
  function drawNetwork(ctx,info,x,wifiDraw) {
    if (info.network === 'wifi') wifiDraw(ctx,x,62);
    else if (info.network === 'cellular' && /^(2g|3g|4g|5g)$/.test(info.networkType)) label(ctx,info.networkType.toUpperCase(),x,57,25,'#111');
    else if (info.network === 'ethernet') label(ctx,'LAN',x,57,21,'#111');
    else label(ctx,info.network === 'none' ? '×' : '—',x,57,25);
  }
  function bolt(ctx,x,y,color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + 9,y); ctx.lineTo(x,y + 16);
    ctx.lineTo(x + 7,y + 16); ctx.lineTo(x + 3,y + 30); ctx.lineTo(x + 19,y + 11); ctx.lineTo(x + 11,y + 11); ctx.closePath(); ctx.fill();
  }
  function drawIOS(ctx,info) {
    signalIOS(ctx); drawNetwork(ctx,info,755,wifiIOS);
    const x = 814,y = 30,known = Number.isFinite(info.batteryLevel);
    const color = info.charging === true ? '#30c854' : known && info.batteryLevel <= 20 ? '#ff453a' : '#111';
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x,y,65,33,8); ctx.stroke();
    ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.roundRect(x + 68,y + 10,4,13,2); ctx.fill();
    if (known) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(x + 3,y + 3,59,27,5); ctx.clip(); ctx.fillStyle = color;
      ctx.fillRect(x + 3,y + 3,59 * info.batteryLevel / 100,27); ctx.restore();
      label(ctx,String(info.batteryLevel),x + 32.5,y + 25,25,'#111');
      ctx.save(); ctx.beginPath(); ctx.rect(x + 3,y + 3,59 * info.batteryLevel / 100,27); ctx.clip();
      label(ctx,String(info.batteryLevel),x + 32.5,y + 25,25,'#fff'); ctx.restore();
    } else label(ctx,'—',x + 32.5,y + 25,25);
    if (info.charging === true) bolt(ctx,x + 77,y + 1,'#30c854');
  }
  function drawAndroid(ctx,info) {
    drawNetwork(ctx,info,704,wifiAndroid); signalAndroid(ctx);
    const known = Number.isFinite(info.batteryLevel);
    ctx.fillStyle = '#111'; ctx.font = '500 28px -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right'; ctx.fillText(known ? `${info.batteryLevel}%` : '—',870,59); ctx.textAlign = 'left';
    const x = 884,y = 30,color = info.charging === true ? '#269c45' : known && info.batteryLevel <= 20 ? '#d92e2e' : '#777';
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x,y,22,34,3); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(x + 7,y - 4,8,4);
    if (known) ctx.fillRect(x + 3,y + 31 - 28 * info.batteryLevel / 100,16,28 * info.batteryLevel / 100);
    else label(ctx,'?',x + 11,y + 26,21);
    if (info.charging === true) bolt(ctx,x + 3,y + 2,info.batteryLevel > 50 ? '#fff' : color);
  }
  return { HEIGHT,create };
});
