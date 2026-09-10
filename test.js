#!/usr/bin/env node
// Boyne Cup engine test harness. Run:  node test.js
// Loads the real app code from index.html with a fake browser, then hammers the scoring engine.
"use strict";
const fs = require("fs"), vm = require("vm");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
src = src.slice(0, src.indexOf("/* ═══ BOOT + EVENTS")); // everything except the DOM boot

// ── fake browser ──────────────────────────────────────────────
const el = () => new Proxy({ innerHTML:"", textContent:"", hidden:false, style:{}, dataset:{}, classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, click(){}, focus(){} }, { get:(t, k) => k in t ? t[k] : (typeof k === "string" ? "" : undefined), set:(t, k, v) => (t[k] = v, true) });
const ctx = { console, Math, Date, JSON, Object, Array, Number, String, Boolean, Set, Map, Promise, RegExp, Error, Infinity, NaN, isNaN, parseInt, parseFloat, setTimeout, clearTimeout, navigator:{}, fetch:() => new Promise(() => {}), 
  localStorage:{ _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k, v){ this._d[k] = String(v); }, removeItem(k){ delete this._d[k]; } },
  document:{ querySelector:() => el(), querySelectorAll:() => [], addEventListener(){}, documentElement:el() }, window:{ scrollTo(){} } };
ctx.globalThis = ctx; vm.createContext(ctx);
const T = { pass:0, fail:0, fails:[] };
function ok(cond, name, detail){ if (cond) T.pass++; else { T.fail++; T.fails.push(name + (detail !== undefined ? "  →  " + JSON.stringify(detail) : "")); } }
function eq(a, b, name){ ok(JSON.stringify(a) === JSON.stringify(b), name, { got:a, want:b }); }
ctx.ok = ok; ctx.eq = eq; ctx.T = T;

const tests = String.raw`
Store._initLocal();
const G = (rid, mid, h, k, v) => Store.set(["gross", mkey(rid, mid), String(h), k], v);
const O = (rid, mid, h, v) => Store.set(["over", mkey(rid, mid), String(h), v === undefined ? null : v].slice(0, 3), v);
const reset = () => { ["gross","over","meta","surv","pair","hcp","cfg","call","signed"].forEach(k => Store.set([k], null)); Me.save(null); CONFIG.carry = 0; CONFIG.halvedMatch = "split"; };
const r1 = ROUND.r1, c1 = courseOf(r1), par = (r, h) => courseOf(r).par[h-1];
const play = (rid, mid, h, scores) => Object.entries(scores).forEach(([k, v]) => G(rid, mid, h, k, v));

/* ── A. STROKES ─────────────────────────────────────────────── */
reset();
{ const sc = scorers(r1, matchOf("r1","m1")); const t = Object.fromEntries(sc.map(x => [x.key, x.total]));
  eq(t, { a1:0, a2:12, b1:12, b2:12+2 }, "A1 best ball: strokes are difference from low man in group (4/16/16/18)");
  const a2 = sc.find(x => x.key === "a2"); const holes = Object.keys(a2.holes).map(Number).sort((x, y) => x - y);
  eq(holes.length, 12, "A2 12 strokes → 12 stroke holes"); ok(holes.every(h => c1.si[h-1] <= 12), "A3 stroke holes are exactly SI 1..12");
  const cam = sc.find(x => x.key === "b2"); ok(Object.values(cam.holes).every(v => v === 1), "A4 14 strokes → one per hole, none doubled"); }
{ Store.set(["pair","r1","m2"], { a:["a1"], b:["b4"] }); // 4 v 18 singles-style within best ball round
  const sc = scorers(r1, matchOf("r1","m2")); const g = sc.find(x => x.key === "b4"); eq(g.total, 14, "A5 4 v 18 → 14 strokes");
  Store.set(["hcp","b4"], 24); const sc2 = scorers(r1, matchOf("r1","m2")); const g2 = sc2.find(x => x.key === "b4"); eq(g2.total, 20, "A6 in-app handicap override respected (24-4=20)");
  eq(g2.holes[c1.si.indexOf(1) + 1], 2, "A7 20 strokes → SI 1 hole gets 2"); eq(g2.holes[c1.si.indexOf(3) + 1], 1, "A8 20 strokes → SI 3 hole gets 1"); Store.set(["hcp"], null); }
{ const r9 = { ...r1, id:"r1", holes:9 }; const sc = scorers(r9, { id:"m2", a:["a1"], b:["b2"] }); eq(sc.find(x => x.key === "b2").total, 7, "A9 9-hole round halves the 14-stroke difference → 7");
  CONFIG.nineHoleHalf = false; const sc2 = scorers(r9, { id:"m2", a:["a1"], b:["b2"] }); eq(sc2.find(x => x.key === "b2").total, 14, "A10 nineHoleHalf=false → full 14"); CONFIG.nineHoleHalf = true; }
{ Store.set(["pair","r2","m1"], { a:["a1","a2"], b:["b1","b2"] }); const sc = scorers(ROUND.r2, matchOf("r2","m1")); eq(sc.map(x => x.total), [0, 0], "A11 scramble: no strokes"); eq(sc.map(x => x.key), ["a","b"], "A12 scramble rows are the two sides"); }
reset();

/* ── B. HOLE RESULT ─────────────────────────────────────────── */
{ const m = matchOf("r1","m1"), sc = scorers(r1, m), p = par(r1, 1); // hole 1: SI 9 → a2(12), b1(12), b2(14) all get a stroke; a1 none
  play("r1","m1",1, { a1:p, a2:p+1, b1:p+1, b2:p+1 }); eq(holeResult(r1, m, sc, 1).res, "h", "B1 best ball: a1 net par v b1 net par → halved");
  play("r1","m1",1, { a1:p-1, a2:p+1, b1:p+1, b2:p+1 }); eq(holeResult(r1, m, sc, 1).res, "a", "B2 birdie beats net par");
  play("r1","m1",1, { a1:p, a2:p+1, b1:p, b2:p+3 }); eq(holeResult(r1, m, sc, 1).res, "b", "B3 opponent's stroke: gross par with stroke → net birdie wins");
  play("r1","m1",2, { a1:p, a2:p+3 }); eq(holeResult(r1, m, sc, 2), null, "B4 incomplete hole → no result");
  O("r1","m1",2,"b"); eq(holeResult(r1, m, sc, 2).res, "b", "B5 override wins even with incomplete scores"); ok(holeResult(r1, m, sc, 2).over, "B6 override flagged");
  reset(); }
{ // second-man tiebreak: r4 bestball2. pairing a1(4)&a2(16) v b3(9)&b1(16); low man a1 → strokes a2 12, b3 5, b1 12
  Store.set(["pair","r4","m1"], { a:["a1","a2"], b:["b3","b1"] }); const r4 = ROUND.r4, m = matchOf("r4","m1"), sc = scorers(r4, m), c4 = courseOf(r4);
  const h = c4.si.indexOf(18) + 1, p = par(r4, h); // easiest hole: nobody strokes
  play("r4","m1",h, { a1:p, a2:p+2, b3:p, b1:p+1 }); const res = holeResult(r4, m, sc, h); eq(res.res, "b", "B7 2nd-man tiebreak: best nets tie, second man decides"); ok(/second man/.test(res.why), "B8 explanation mentions second man");
  play("r4","m1",h, { a1:p, a2:p+1, b3:p, b1:p+1 }); eq(holeResult(r4, m, sc, h).res, "h", "B9 both tie → halved");
  // same scores under plain bestball would halve
  const plain = { ...r4, scoring:"bestball" }; play("r4","m1",h, { a1:p, a2:p+2, b3:p, b1:p+1 }); eq(holeResult(plain, m, sc, h).res, "h", "B10 plain best ball ignores second man");
  reset(); }

/* ── C. MATCH STATE ─────────────────────────────────────────── */
const winHoles = (rid, mid, side, from, to) => { for (let h = from; h <= to; h++) O(rid, mid, h, side); };
{ Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] });
  winHoles("r1","m1","a",1,9); let s = matchState("r1","m1"); eq([s.up, s.thru, s.closed, s.text], [9, 9, false, "9 UP"], "C1 9 up with 9 to play is NOT over (dormie)");
  O("r1","m1",10,"a"); s = matchState("r1","m1"); eq([s.closed, s.text, s.pts], [true, "10&8", { a:2, b:0 }], "C2 10 up with 8 left → 10&8, 2 points");
  reset(); Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] });
  winHoles("r1","m1","a",1,3); winHoles("r1","m1","b",4,6); for (let h = 7; h <= 18; h++) O("r1","m1",h,"h"); s = matchState("r1","m1");
  eq([s.closed, s.text, s.short, s.pts], [true, "HALVED", "AS", { a:1, b:1 }], "C3 all square after 18 → halved, 1 each");
  CONFIG.halvedMatch = "none"; s = matchState("r1","m1"); eq(s.pts, { a:0, b:0 }, "C4 halvedMatch=none → nobody scores"); CONFIG.halvedMatch = "split";
  O("r1","m1",18,"b"); s = matchState("r1","m1"); eq([s.closed, s.text, s.pts], [true, "1 UP", { a:0, b:2 }], "C5 won on the 18th → 1 UP, full points");
  reset(); Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] });
  winHoles("r1","m1","a",1,5); winHoles("r1","m1","b",6,8); s = matchState("r1","m1"); eq([s.up, s.thru, s.closed, s.text], [2, 8, false, "2 UP"], "C6 5-3 → 2 UP thru 8");
  eq([s.aH, s.bH, s.hH], [5, 3, 0], "C7 hole tallies"); ok(s.started && !s.closed, "C8 started, not closed");
  reset(); }
{ // carryover
  Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); O("r1","m1",1,"h"); O("r1","m1",2,"h"); O("r1","m1",3,"h"); O("r1","m1",4,"a");
  CONFIG.carry = 0; let s = matchState("r1","m1"); eq([s.up, s.per[4].worth], [1, 1], "C9 carry 0: hole worth 1");
  CONFIG.carry = 2; s = matchState("r1","m1"); eq([s.up, s.per[4].worth, s.stack], [3, 3, 0], "C10 carry cap 2: three halves stack to 2, hole worth 3, stack resets");
  CONFIG.carry = 99; s = matchState("r1","m1"); eq([s.up, s.per[4].worth], [4, 4], "C11 unlimited carry: worth 4");
  CONFIG.carry = 2; O("r1","m1",5,"h"); O("r1","m1",6,"h"); s = matchState("r1","m1"); eq(s.stack, 2, "C12 live stack shows 2 carried");
  // closure must account for stack: 3 up thru 6 with 12 left → not closed; potential = left + stack
  ok(!s.closed, "C13 not closed with plenty left");
  reset(); Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); CONFIG.carry = 2; winHoles("r1","m1","a",1,9); O("r1","m1",10,"h"); s = matchState("r1","m1");
  ok(!s.closed && s.up === 9 && s.left === 8 && s.stack === 1, "C14 9 up, 8 left, 1 carried: potential 9 → not closed (B could still tie)");
  O("r1","m1",11,"h"); s = matchState("r1","m1"); ok(!s.closed && s.stack === 2 && s.left === 7, "C15 9 up, 7 left + stack 2 = 9 potential → still not closed");
  O("r1","m1",12,"h"); s = matchState("r1","m1"); ok(s.closed && s.text === "9&6", "C16 stack capped at 2: 9 up, 6 left + 2 = 8 < 9 → closed 9&6");
  CONFIG.carry = 0; reset(); }

/* ── D. ROUNDS, CUP, SURVIVOR, PAIRINGS ─────────────────────── */
{ let p = roundPoints("r2"); eq([p.avail, p.final, p.any, p.a, p.b], [6, false, false, 0, 0], "D1 unset pairings: 6 available, not final, nothing scored");
  eq(roundStatus("r2"), "upcoming", "D2 status upcoming"); eq(matchesOf(ROUND.r2).map(isSet), [0,0,0].map(() => false), "D3 all three r2 matches unset");
  Me.save("a1"); eq(myMatch("r2"), null, "D4 no 'your match' before pairings");
  Store.set(["pair","r2","m2"], { a:["a1","a3"], b:["b5","b6"] }); const mine = myMatch("r2"); eq(mine && mine.id, "m2", "D5 pairing set → 'your match' found");
  eq(canEdit("r2","m2"), true, "D6 participant can edit"); Me.save("a2"); eq(canEdit("r2","m2"), false, "D7 non-participant cannot"); Me.save("admin"); eq(canEdit("r2","m2"), true, "D8 commissioner can");
  Me.save(null); eq(canEdit("r2","m2"), false, "D9 signed out cannot"); ok(/sign in/i.test(editNote("r2","m2")), "D10 signed-out note");
  Me.save("a2"); ok(/only the players/.test(editNote("r2","m2")), "D11 non-participant note"); Me.save(null);
  // scramble scores live on side keys: survive a re-pairing
  G("r2","m2",1,"a",4); G("r2","m2",1,"b",5); Store.set(["pair","r2","m2"], { a:["a2","a4"], b:["b1","b2"] }); eq(matchState("r2","m2").aH, 1, "D12 scramble scores persist across re-pairing (they belong to the side)");
  // own-ball scores are keyed by player: re-pairing hides them
  Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); play("r1","m1",1, { a1:4, a2:5, b1:5, b2:6 }); ok(matchState("r1","m1").started, "D13 r1 m1 started");
  Store.set(["pair","r1","m1"], { a:["a3","a4"], b:["b1","b2"] }); { const s = matchState("r1","m1"); ok(s.thru === 0 && s.aH === 0, "D14 after swapping side A, hole 1 is incomplete again (old A entries hidden; B's remain)"); ok(gross("r1","m1",1,"a1") === 4, "D14b …but the old entry is still stored, not deleted"); }
  reset(); }
{ Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); Store.set(["pair","r1","m2"], { a:["a3","a4"], b:["b3","b4"] }); Store.set(["pair","r1","m3"], { a:["a5","a6"], b:["b5","b6"] });
  winHoles("r1","m1","a",1,10); winHoles("r1","m2","b",1,10); for (let h = 1; h <= 18; h++) O("r1","m3",h,"h");
  let p = roundPoints("r1"); eq([p.ma, p.mb, p.final, p.sa, p.sb], [3, 3, true, 0, 0], "D15a matches decided 3-3; no cards submitted → no survivor bonus yet");
  eq(survStatus("r1","m1","a"), "play", "D15b decided match with holes left → ball still in play");
  for (let h = 11; h <= 18; h++) { O("r1","m1",h,"h"); O("r1","m2",h,"h"); } p = roundPoints("r1"); eq([p.sa, p.sb], [0, 0], "D15c all 18 scored but nothing submitted → still no survivor points");
  const signAll = (rid) => matchesOf(ROUND[rid]).forEach(m => scorers(ROUND[rid], m).forEach(x => Store.set(["signed", mkey(rid, m.id), x.key], "t"))); signAll("r1");
  p = roundPoints("r1"); eq([p.a, p.b, p.final, p.sa, p.sb], [7.5, 7.5, true, 4.5, 4.5], "D15 cards submitted everywhere: 3 + 1.5 pairings + 3 sweep each"); eq(roundStatus("r1"), "final", "D16 status final");
  Store.set(["surv","r1","m2","b"], 7); p = roundPoints("r1"); eq([p.b, p.sb], [4, 1], "D17 B's Match 2 pairing lost it on 7 → B 3 + 1.0"); eq(survStatus("r1","m2","b"), "lost", "D17a status lost"); eq(survLostHole("r1","m2","b"), 7, "D17b hole recorded");
  const sw1 = roundSweep("r1"); eq([sw1.a.swept, sw1.a.pts, sw1.b.swept, sw1.b.lost], [true, 3, false, 1], "D17c round sweep: A kept all three → +3, B lost one → no sweep");
  const t0 = cupTotals(); eq([t0.a, t0.b], [7.5, 4], "D17d cup totals include pairing bonuses + round sweep");
  Store.set(["surv","r1","m2","b"], null); eq(survStatus("r1","m2","b"), "kept", "D17e undo → kept again");
  reset(); Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); winHoles("r1","m1","a",1,5); eq(survStatus("r1","m1","a"), "play", "D17f match in progress → ball 'in play', no bonus yet"); eq(roundPoints("r1").sa, 0, "D17g no survivor points until the match is decided");
  Me.save("a1"); eq([canSurv("a","r1","m1"), canSurv("b","r1","m1")], [true, true], "D22 anyone scoring the match can mark a loss for either side"); Me.save("a3"); eq(canSurv("a","r1","m1"), false, "D22b a player not in the match cannot"); Me.save("admin"); eq([canSurv("a","r1","m1"), canSurv("b","r1","m1")], [true, true], "D23 commissioner both");
  reset(); }
{ // clinch maths: give A 19 match points from rounds 1-4 (r1 6, r2 6, r3 6 of 12, r4... ) simpler: A wins every match in r1,r2,r3 (6+6+12=24) → A has 24, B max = 12 remaining + survivor 2.5 → 14.5 → A clinched
  ["r1","r2","r4","r5"].forEach(rid => ROUND[rid].matches.forEach((m, i) => Store.set(["pair", rid, m.id], { a:["a"+(2*i+1), "a"+(2*i+2)], b:["b"+(2*i+1), "b"+(2*i+2)] })));
  ROUND.r3.matches.forEach((m, i) => Store.set(["pair","r3",m.id], { a:["a"+(i+1)], b:["b"+(i+1)] }));
  ["r1","r2","r3"].forEach(rid => ROUND[rid].matches.forEach(m => winHoles(rid, m.id, "a", 1, 18)));
  const signAll2 = (rid) => matchesOf(ROUND[rid]).forEach(m => scorers(ROUND[rid], m).forEach(x => Store.set(["signed", mkey(rid, m.id), x.key], "t"))); ["r1","r2","r3"].forEach(signAll2);
  let t = cupTotals(); eq([t.a, t.matchLeft], [24 + 12 * 0.5 + 3 * 3, 12], "D24 A: 24 match + 12 pairings kept (6) + three round sweeps (9); 12 match pts left"); ok(t.aWon && !t.bWon, "D25 A has clinched: B's ceiling is 12 match + 6 pairings (3) + 2 sweeps (6) = 21 < 39"); eq(t.done, false, "D26 not done");
  // B wins everything left; A loses every ball from here: A = 24 + 6 + 3 (Thu sweep) = 33; B = 12 + 18 × 0.5 + 3 sweeps... B lost r1-r3? no — B kept all too
  ["r4","r5"].forEach(rid => ROUND[rid].matches.forEach(m => winHoles(rid, m.id, "b", 1, 18))); ["r4","r5"].forEach(signAll2); CONFIG.rounds.forEach(r => matchesOf(r).forEach(m => Store.set(["surv", r.id, m.id, "a"], 3)));
  t = cupTotals(); eq([t.a, t.b, t.done], [24, 12 + 18 * 0.5 + 5 * 3, true], "D27 all done: A 24 (lost every ball), B 12 match + 9 pairings + 5 round sweeps = 36"); ok(t.bWon && !t.aWon, "D28 survivor bonuses can outweigh matches");
  reset(); }
{ // tie scenario: 18-18 on match points, survivor decides
  CONFIG.rounds.forEach(r => ROUND[r.id].matches.forEach((m, i) => Store.set(["pair", r.id, m.id], r.scoring === "singles" ? { a:["a"+(i+1)], b:["b"+(i+1)] } : { a:["a"+(2*i+1), "a"+(2*i+2)], b:["b"+(2*i+1), "b"+(2*i+2)] })));
  ["r1","r2"].forEach(rid => ROUND[rid].matches.forEach(m => winHoles(rid, m.id, "a", 1, 18))); ["r4","r5"].forEach(rid => ROUND[rid].matches.forEach(m => winHoles(rid, m.id, "b", 1, 18)));
  ROUND.r3.matches.forEach((m, i) => winHoles("r3", m.id, i < 3 ? "a" : "b", 1, 18));
  CONFIG.rounds.forEach(r => matchesOf(r).forEach(m => scorers(r, m).forEach(x => Store.set(["signed", mkey(r.id, m.id), x.key], "t"))));
  CONFIG.rounds.forEach(r => matchesOf(r).forEach(m => { Store.set(["surv", r.id, m.id, "a"], 5); Store.set(["surv", r.id, m.id, "b"], 5); }));
  let t = cupTotals(); eq([t.a, t.b, t.done, t.aWon, t.bWon], [18, 18, true, false, false], "D29 18-18, every ball lost, done → shared");
  Store.set(["surv","r1","m1","b"], null); t = cupTotals(); ok(t.bWon && t.b === 18.5, "D30 one kept ball breaks the tie");
  reset(); }

/* ── E. HONOURS ─────────────────────────────────────────────── */
{ Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); Store.set(["pair","r1","m2"], { a:["a3","a4"], b:["b3","b4"] });
  const c = c1; for (let h = 1; h <= 18; h++) { const p = par(r1, h);
    // m1: B wins 1-2, A wins 3-8 and 11-18, halves 9-10 → A comeback from 2 down, B flop; a1 snowman on 5, blowups on 1,2,5; a2 birdies on multiples of 4
    let a1 = p + (h <= 2 ? 3 : h === 5 ? 4 : 0), a2 = p + (h <= 2 ? 2 : h % 4 === 0 ? -1 : 0), b1 = p + (h <= 2 ? 0 : 2), b2 = p + (h <= 2 ? 1 : 2);
    if (h === 9 || h === 10) { a1 = p; a2 = p; b1 = p; b2 = p; } play("r1","m1",h, { a1, a2, b1, b2 }); }
  for (let h = 1; h <= 16; h++) { const p = par(r1, h); play("r1","m2",h, { a3:p+1, a4:p+2, b3:p, b4:p+1 }); }
  ["a1","a2","b1","b2"].forEach(k => Store.set(["signed","r1_m1",k], "t")); const S = playerStats(); const s1 = matchState("r1","m1"), s2 = matchState("r1","m2");
  ok(s1.closed && s1.lead === "a", "E1 m1 A wins"); ok(s2.closed && s2.lead === "b" && s2.text === "11&2", "E2 m2 B wins 11&2");
  eq([S.a1.comeback, S.b1.flop, S.a1.snow, S.a1.blow], [1, 1, 1, 3], "E3 comeback / flop / snowman / blow-ups");
  eq([S.a2.birdies, S.a1.closer, S.a1.hh], [4, 3, 2], "E4 birdies / closer (last 3) / halved");
  eq([S.a1.pts, S.a2.pts, S.b3.pts, S.a3.pts], [1, 1, 1, 0], "E5 points split between partners");
  eq([S.a1.w, S.a1.l, S.b1.l, S.b3.w], [1, 0, 1, 1], "E6 W/L tallies"); ok(S.a1.hot >= 6, "E7 hot hand streak ≥ 6"); ok(S.b3.pars === 16 && S.b3.parStreak === 16, "E8 par streak");
  ok(S.a3.ppm === 0 && S.b3.ppm === 1, "E9 points per match (anchor metric)"); ok(S.a2.sandbag < 0, "E10 sandbagger: a2 net well under par");
  ok(S.a3.hardN > 0 && S.a3.easyN > 0, "E11 hard/easy thirds populated"); eq(S.a3.easy, 6, "E12 easy-third gross to par = 6 holes × +1");
  Store.set(["surv","r1","m1","b"], 2); Store.set(["surv","r1","m2","a"], 17); const S2 = playerStats();
  eq([S2.b1.svLost, S2.b1.earliest, S2.a1.svKept, S2.a1.svPts, S2.a3.heart, S2.b3.reckless], [1, 2, 1, 0.5, 1, 0], "E12b survivor accolades: early exit hole 2, kept +0.5, heartbreaker on 17, no reckless (b3 kept & won)");
  eq(S2.a3.reckless, 0, "E12c a3 lost ball and lost match → not reckless"); Store.set(["surv","r1","m2","b"], 9); eq(playerStats().b3.reckless, 1, "E12d b3 won 11&2 but lost ball on 9 → reckless winner");
  Store.set(["surv","r1","m1","b"], { hole:5, by:"b2" }); const S3 = playerStats(); eq([S3.b2.svLost, S3.b2.earliest, S3.b1.svLost, S3.b1.svKept], [1, 5, 0, 0], "E12e loss with a named player: only the loser is charged; partner neither lost nor kept");
  eq(survLoss("r1","m1","b"), { hole:5, by:"b2" }, "E12f loss record keeps hole and who");
  // render smoke tests (no exceptions)
  let okRender = true; try { renderCup(); renderHonours(); renderFormat(); UI.rid = "r1"; UI.mid = "m1"; UI.card = false; renderLive(); UI.card = true; UI.hole = 5; renderLive(); renderField(r1, "m1"); Me.save("admin"); UI.editPairs = true; renderLive(); } catch(e){ okRender = false; console.error(e); }
  ok(okRender, "E13 all renderers run without throwing"); Me.save(null); UI.editPairs = false;
  reset(); }

/* ── F. LOCK ────────────────────────────────────────────────── */
{ Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); Me.save("a1"); winHoles("r1","m1","a",1,10);
  eq(canEdit("r1","m1"), true, "F1 participant can keep scoring after the match is decided (play to 18)"); eq(cardComplete("r1","m1"), false, "F1b card not complete at 10 holes");
  for (let h = 11; h <= 18; h++) O("r1","m1",h,"h"); eq(cardComplete("r1","m1"), true, "F1c card complete after 18"); eq(canEdit("r1","m1"), true, "F1d still editable until submitted");
  eq(rowComplete("r1","m1","a1"), true, "F1e a1's row complete (via hole results)"); Store.set(["signed","r1_m1","a1"], "G. Bonfiglio · 5:01 PM");
  eq([canEditRow("r1","m1","a1"), canEditRow("r1","m1","a2")], [false, true], "F2 submitting locks only that player's row; partner's stays open"); eq(signedCount("r1","m1"), { n:1, of:4 }, "F2b 1 of 4 cards in"); eq(allSigned("r1","m1"), false, "F2c match not fully signed");
  Me.save("admin"); eq(canEditRow("r1","m1","a1"), true, "F3 commissioner may amend a signed row"); ["a2","b1","b2"].forEach(k => Store.set(["signed","r1_m1",k], "x")); eq(allSigned("r1","m1"), true, "F4 all four in → Final ✓");
  Store.set(["signed","r1_m1"], null); Me.save("a1"); eq(canEditRow("r1","m1","a1"), true, "F5 un-submitting reopens the row");
  reset(); }


/* ── H. EVERY PAIRING PERMUTATION vs AN INDEPENDENT ORACLE ── */
// Oracle: rules re-implemented from scratch, straight from the group's notes. Shares no code with the app.
{ const HCP = Object.fromEntries(CONFIG.players.map(p => [p.id, p.hcp]));
  const oracleStrokes = (ids, si, holes, halve) => { const low = Math.min(...ids.map(i => HCP[i])); const out = {};
    ids.forEach(id => { const n = Math.round((HCP[id] - low) * (halve ? 0.5 : 1)); const per = {}; for (let h = 1; h <= holes; h++) { const rank = si[h-1]; per[h] = (n >= rank ? 1 : 0) + (n >= rank + holes ? 1 : 0); } out[id] = { n, per }; }); return out; };
  const oracleHole = (fmt, aIds, bIds, grossOf, strokes, h) => { const nets = ids => ids.map(id => grossOf(id) - strokes[id].per[h]).sort((x, y) => x - y);
    const A = nets(aIds), B = nets(bIds); if (A[0] !== B[0]) return A[0] < B[0] ? "a" : "b"; if (fmt === "bestball2" && A[1] !== undefined && A[1] !== B[1]) return A[1] < B[1] ? "a" : "b"; return "h"; };
  const pairs = ids => { const out = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push([ids[i], ids[j]]); return out; };
  const A = CONFIG.players.filter(p => p.team === "a").map(p => p.id), B = CONFIG.players.filter(p => p.team === "b").map(p => p.id);
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let combos = 0, holesChecked = 0, strokeMismatch = 0, holeMismatch = 0, dblStroke = 0;
  for (const rid of ["r1","r4","r3"]) { const r = ROUND[rid], c = courseOf(r), single = r.scoring === "singles";
    const sidesA = single ? A.map(x => [x]) : pairs(A), sidesB = single ? B.map(x => [x]) : pairs(B);
    for (const sa of sidesA) for (const sb of sidesB) { combos++; reset(); Store.set(["pair", rid, "m1"], { a:sa, b:sb }); const m = matchOf(rid, "m1"), sc = scorers(r, m);
      const ora = oracleStrokes([...sa, ...sb], c.si, r.holes, r.holes <= 9);
      for (const x of sc) { const o = ora[x.key]; if (o.n !== x.total) strokeMismatch++; for (let h = 1; h <= r.holes; h++) if ((x.holes[h] || 0) !== o.per[h]) strokeMismatch++; if (Object.values(x.holes).some(v => v > 1)) dblStroke++; }
      // random gross scores on 6 random holes, compare hole results
      for (let k = 0; k < 6; k++) { const h = 1 + Math.floor(rnd() * r.holes), p = c.par[h-1], g = {}; [...sa, ...sb].forEach(id => g[id] = p + Math.floor(rnd() * 5) - 1); play(rid, "m1", h, g);
        const want = oracleHole(r.scoring, sa, sb, id => g[id], ora, h), got = holeResult(r, m, sc, h)?.res; if (want !== got) { holeMismatch++; if (holeMismatch <= 3) console.log("hole mismatch", { rid, sa, sb, h, g, want, got }); } holesChecked++; } } }
  eq(strokeMismatch, 0, "H1 strokes match the oracle for every pairing (" + combos + " combinations)"); eq(holeMismatch, 0, "H2 hole results match the oracle (" + holesChecked + " holes across " + combos + " pairings)");
  const maxGap = Math.max(...Object.values(HCP)) - Math.min(...Object.values(HCP));
  ok(maxGap <= 18 ? dblStroke === 0 : dblStroke > 0, "H3 2-stroke holes appear only if the biggest handicap gap exceeds 18 (this roster: gap " + maxGap + ")", { dblStroke, maxGap });
  // every full-round arrangement: 3 disjoint A pairs v 3 disjoint B pairs, in every order → 15 × 15 × 6 = 1350 arrangements
  const perfect = ids => { const [x, ...rest] = ids; if (!rest.length) return [[]]; const out = []; for (let i = 0; i < rest.length; i++) { const y = rest[i], others = rest.filter((_, j) => j !== i); perfect(others).forEach(pm => out.push([[x, y], ...pm])); } return out; };
  const permute = a => a.length <= 1 ? [a] : a.flatMap((x, i) => permute([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
  let arrangements = 0, badRound = 0; const pa = perfect(A), pb = perfect(B);
  for (const xa of pa) for (const xb of pb) for (const order of permute([0, 1, 2])) { arrangements++; reset();
    ROUND.r1.matches.forEach((m, i) => Store.set(["pair","r1",m.id], { a:xa[i], b:xb[order[i]] }));
    const ms = matchesOf(ROUND.r1), seen = new Set(); ms.forEach(m => [...m.a, ...m.b].forEach(id => seen.add(id)));
    if (seen.size !== 12 || !ms.every(isSet)) { badRound++; continue; }
    // each match: A wins holes 1-10; expect round 6-0 final, every A player 1 pt, every B player 0
    ms.forEach(m => winHoles("r1", m.id, "a", 1, 10)); const p = roundPoints("r1"); const S = playerStats();
    if (!(p.ma === 6 && p.mb === 0 && p.final && A.every(id => S[id].pts === 1 && S[id].w === 1) && B.every(id => S[id].pts === 0 && S[id].l === 1))) badRound++; }
  eq(badRound, 0, "H4 every full-round arrangement (" + arrangements + ") pairs all 12 exactly once and scores 6–0 correctly");
  reset(); }

/* ── I. LIVE SETTINGS + COMMISSIONER CONTROLS ───────────── */
{ reset(); Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] });
  Store.set(["cfg","carry"], 1); O("r1","m1",1,"h"); O("r1","m1",2,"h"); O("r1","m1",3,"a"); let s = matchState("r1","m1"); eq([s.up, s.per[3].worth], [2, 2], "I1 in-app carry=1 caps the stack at 1 → hole worth 2");
  Store.set(["cfg","carry"], null); s = matchState("r1","m1"); eq(s.up, 1, "I2 clearing the setting falls back to the file default (no carry)");
  for (let h = 1; h <= 18; h++) O("r1","m1",h,"h"); Store.set(["cfg","halvedMatch"], "none"); eq(matchState("r1","m1").pts, { a:0, b:0 }, "I3 in-app halvedMatch=none → no points"); Store.set(["cfg","halvedMatch"], null); eq(matchState("r1","m1").pts, { a:1, b:1 }, "I4 back to 1 each");
  Store.set(["cfg","teams"], { a:{ name:"Gaylord Gooners", short:"GG" } }); eq([TA().name, TA().short, TB().short], ["Gaylord Gooners", "GG", "B"], "I5 team rename overrides only what's set"); Store.set(["cfg","teams"], null);
  Store.set(["cfg","survivorPts"], 0); eq(survApplies(ROUND.r1), false, "I6 survivor pts 0 switches survivor off"); Store.set(["cfg","survivorPts"], null);
  Store.set(["cfg","survOff","r3"], true); eq([survApplies(ROUND.r3), survApplies(ROUND.r1)], [false, true], "I7 survivor off for one round only"); Store.set(["cfg","survOff"], null);
  reset(); Store.set(["pair","r4","m1"], { a:["a1","a2"], b:["b3","b1"] }); const r4 = ROUND.r4, m4 = matchOf("r4","m1"), sc4 = scorers(r4, m4), c4 = courseOf(r4), h = c4.si.indexOf(18) + 1, p = par(r4, h);
  play("r4","m1",h, { a1:p, a2:p+2, b3:p, b1:p+1 }); eq(holeResult(r4, m4, sc4, h).res, "b", "I8 second-man on → B"); Store.set(["cfg","secondMan"], false); eq(holeResult(r4, m4, sc4, h).res, "h", "I9 second-man off → halved"); Store.set(["cfg","secondMan"], null);
  // call a match
  reset(); Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); winHoles("r1","m1","a",1,5); winHoles("r1","m1","b",6,7);
  Store.set(["call","r1_m1"], "a"); s = matchState("r1","m1"); eq([s.closed, s.lead, s.pts, s.called, s.short], [true, "a", { a:2, b:0 }, "a", "3 UP"], "I10 called for A: closed, full points, status shows the margin");
  Store.set(["call","r1_m1"], "h"); s = matchState("r1","m1"); eq([s.pts, s.short], [{ a:1, b:1 }, "AS"], "I11 called halved → 1 each");
  Store.set(["call","r1_m1"], "void"); s = matchState("r1","m1"); eq([s.closed, s.pts, s.short], [true, { a:0, b:0 }, "VOID"], "I12 voided → closed, no points"); eq(roundPoints("r1").avail, 6, "I12b available points unchanged");
  Store.set(["call","r1_m1"], null); s = matchState("r1","m1"); eq([s.closed, s.up], [false, 3], "I13 un-called → back to live scores");
  // lock
  Me.save("a1"); eq(canEdit("r1","m1"), true, "I14 participant can edit"); Store.set(["cfg","lock","r1"], true); eq(canEdit("r1","m1"), false, "I15 locked round → participant can't"); ok(/locked/.test(editNote("r1","m1")), "I16 lock note"); eq(canSurv("a","r1","m1"), false, "I17 …nor mark survivor");
  Me.save("admin"); eq(canEdit("r1","m1"), true, "I18 commissioner still can"); Store.set(["cfg","lock"], null); Me.save(null);
  reset(); }

/* ── J. CAPTAIN PAIRINGS ───────────────────────────────────── */
{ reset(); Me.save("a3"); ok(isCaptain(), "J1 Mike Chun is a captain"); eq([canPair("a"), canPair("b"), canPair()], [true, false, true], "J2 captain may set own side only");
  Me.save("a2"); eq([isCaptain(), canPair(), canPair("a")], [false, false, false], "J3 non-captain player cannot"); Me.save("admin"); eq([canPair("a"), canPair("b")], [true, true], "J4 commissioner both");
  Me.save("b1"); eq([canPair("b"), canPair("a")], [true, false], "J5 Matt Jackson sets B only");
  // pairings-first order
  Store.set(["cfg","pairFirst","r2"], "a"); eq(canPair("b","r2"), false, "J6 A goes first on r2 → B's captain locked out"); eq(pairWait("r2","b"), "a", "J7 waiting on A");
  Me.save("a3"); eq(canPair("a","r2"), true, "J8 A's captain can enter"); ROUND.r2.matches.forEach((m, i) => Store.set(["pair","r2",m.id], { a:["a"+(2*i+1), "a"+(2*i+2)], b:[] }));
  Me.save("b1"); eq(canPair("b","r2"), true, "J9 once A has all three pairs in, B unlocks"); Me.save("admin"); Store.set(["cfg","pairFirst","r2"], "b"); eq(canPair("a","r2"), true, "J10 commissioner is never locked out");
  Me.save(null); reset(); }

/* ── L. LIFECYCLE: when does each fact become true? ────────── */
// A match goes: not started → live → decided (points) → 18 in (submit available) → submitted (row locked, survivor kept).
{ reset(); Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); const r = ROUND.r1, m = matchOf("r1","m1"), sc = scorers(r, m), c = courseOf(r);
  const state = () => { const s = matchState("r1","m1"); return { started:s.started, closed:s.closed, ptsA:s.pts.a, survA:survStatus("r1","m1","a"), survB:survStatus("r1","m1","b"), sa:roundPoints("r1").sa, rowA1:rowComplete("r1","m1","a1"), card:cardComplete("r1","m1") }; };
  eq(state(), { started:false, closed:false, ptsA:0, survA:"play", survB:"play", sa:0, rowA1:false, card:false }, "L1 before any score: nothing true, balls in play");
  // A wins holes 1-10 with real gross scores (a1 eagles beat any net birdie; everyone else par)
  for (let h = 1; h <= 10; h++) { const p = c.par[h-1]; play("r1","m1",h, { a1:p-2, a2:p, b1:p, b2:p }); if (h < 10) eq(state().closed, false, "L2." + h + " not decided thru " + h); }
  let st = state(); eq([st.closed, st.ptsA], [true, 2], "L3 decided 10&8 → 2 points on the board immediately"); eq([st.survA, st.survB, st.sa], ["play", "play", 0], "L4 …but survivor still in play, no bonus");
  eq([st.rowA1, st.card], [false, false], "L5 card not complete — 8 holes still to score"); Me.save("a1"); eq(canEditRow("r1","m1","a1"), true, "L6 players can keep scoring after the decision");
  eq(canSurv("b","r1","m1"), true, "L7 a1 can mark an opponent's lost ball"); Store.set(["surv","r1","m1","b"], { hole:12, by:"b2" }); eq(survStatus("r1","m1","b"), "lost", "L8 B lost on 12 (marked by an opponent)");
  for (let h = 11; h <= 18; h++) { const p = c.par[h-1]; play("r1","m1",h, { a1:p, a2:p, b1:p, b2:p }); }
  st = state(); eq([st.rowA1, st.card, st.survA, st.sa], [true, true, "play", 0], "L9 18 in: card complete, still no survivor bonus until submitted");
  Store.set(["signed","r1_m1","a1"], "t"); eq([survStatus("r1","m1","a"), roundPoints("r1").sa], ["play", 0], "L10 one of the two A cards submitted → side not yet kept");
  Store.set(["signed","r1_m1","a2"], "t"); eq([survStatus("r1","m1","a"), roundPoints("r1").sa], ["kept", 0.5], "L11 both A cards submitted → kept, +0.5"); eq(canEditRow("r1","m1","a1"), false, "L12 submitted row locked for players");
  Store.set(["signed","r1_m1","b1"], "t"); Store.set(["signed","r1_m1","b2"], "t"); eq([survStatus("r1","m1","b"), roundPoints("r1").sb, allSigned("r1","m1")], ["lost", 0, true], "L13 B submitted but lost → no bonus; match fully signed");
  // undo a lost ball after submission? players can't (locked), commissioner can
  Me.save("b2"); eq(canSurv("b","r1","m1"), true, "L14 canSurv is match-membership…"); Me.save("admin"); Store.set(["surv","r1","m1","b"], null); eq([survStatus("r1","m1","b"), roundPoints("r1").sb], ["kept", 0.5], "L15 commissioner clears the loss → kept");
  // points never double count and never go negative
  const p = roundPoints("r1"); ok(p.ma + p.mb === 2 && p.sa >= 0 && p.sb >= 0, "L16 match points sum to the match value; bonuses non-negative");
  reset(); }
// Random partial cards: survivor is never 'kept' without signatures; bonus equals 0.5 × kept sides; a signed side with a loss never scores.
{ let seed = 99; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; let bad = 0;
  for (let n = 0; n < 400; n++) { reset(); Store.set(["pair","r1","m1"], { a:["a1","a2"], b:["b1","b2"] }); const r = ROUND.r1, c = courseOf(r);
    const upto = Math.floor(rnd() * 19); for (let h = 1; h <= upto; h++) { const p = c.par[h-1]; play("r1","m1",h, { a1:p + Math.floor(rnd()*3), a2:p + Math.floor(rnd()*3), b1:p + Math.floor(rnd()*3), b2:p + Math.floor(rnd()*3) }); }
    const signA = rnd() < 0.4 && upto === 18, signB = rnd() < 0.4 && upto === 18, lostA = rnd() < 0.3, lostB = rnd() < 0.3;
    if (lostA) Store.set(["surv","r1","m1","a"], { hole:1 + Math.floor(rnd() * 18), by:"a1" }); if (lostB) Store.set(["surv","r1","m1","b"], { hole:1 + Math.floor(rnd() * 18), by:"b2" });
    if (signA) ["a1","a2"].forEach(k => Store.set(["signed","r1_m1",k], "t")); if (signB) ["b1","b2"].forEach(k => Store.set(["signed","r1_m1",k], "t"));
    const sA = survStatus("r1","m1","a"), sB = survStatus("r1","m1","b"), p = roundPoints("r1");
    const expA = lostA ? "lost" : signA ? "kept" : "play", expB = lostB ? "lost" : signB ? "kept" : "play";
    const expSa = (expA === "kept" ? 0.5 : 0), expSb = (expB === "kept" ? 0.5 : 0);
    if (sA !== expA || sB !== expB || p.sa !== expSa || p.sb !== expSb) { bad++; if (bad < 3) console.log("lifecycle fuzz", { upto, signA, signB, lostA, lostB, sA, sB, sa:p.sa, sb:p.sb }); } }
  eq(bad, 0, "L17 400 random partial cards: survivor status and bonus always follow lost > submitted > in play"); reset(); }

/* ── G. FUZZ ────────────────────────────────────────────────── */
{ let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let bad = 0, closedCount = 0, halvedCount = 0; const N = 1500;
  for (let n = 0; n < N; n++) { reset(); CONFIG.carry = [0, 2, 99][Math.floor(rnd() * 3)]; CONFIG.halvedMatch = rnd() < 0.5 ? "split" : "none";
    const rid = ["r1","r2","r3","r4"][Math.floor(rnd() * 4)], r = ROUND[rid], mid = r.matches[0].id; Store.set(["pair", rid, mid], r.scoring === "singles" ? { a:["a1"], b:["b2"] } : { a:["a1","a2"], b:["b1","b2"] });
    const played = Math.floor(rnd() * (r.holes + 1)); let manual = { up:0, stack:0 };
    for (let h = 1; h <= played; h++) { const x = rnd(), res = x < 0.4 ? "a" : x < 0.8 ? "b" : "h"; O(rid, mid, h, res);
      const s = matchState(rid, mid); if (s.per[h - 1] === undefined || (h > 1 && s.per[h-1] === null)) {} }
    const s = matchState(rid, mid), m = matchOf(rid, mid);
    // invariants
    const total = s.pts.a + s.pts.b; const okPts = !s.closed ? total === 0 : (s.lead === "h" ? (CONFIG.halvedMatch === "none" ? total === 0 : total === m.pts) : total === m.pts);
    const potential = s.left + s.stack; const okClose = s.closed ? (s.left === 0 || s.mag > potential) : (s.mag <= potential);
    const okUp = Math.sign(s.up) === (s.lead === "a" ? 1 : s.lead === "b" ? -1 : 0);
    const okThru = s.thru === played; const okShort = !s.started || /^(AS|\d+ UP|\d+&\d+)$/.test(s.short);
    if (!(okPts && okClose && okUp && okThru && okShort)) { bad++; if (bad <= 3) console.log("fuzz fail", { rid, carry:CONFIG.carry, hm:CONFIG.halvedMatch, played, s:{ up:s.up, thru:s.thru, left:s.left, stack:s.stack, closed:s.closed, short:s.short, pts:s.pts } }); }
    if (s.closed) closedCount++; if (s.closed && s.lead === "h") halvedCount++; }
  ok(bad === 0, "G1 fuzz: " + N + " random matches satisfy all invariants (points, closure, sign, thru, label)", { bad });
  ok(closedCount > N / 10 && halvedCount > 0, "G2 fuzz covered closed and halved matches", { closedCount, halvedCount });
  reset(); }
`;
vm.runInContext(src + "\n" + tests, ctx, { filename:"engine+tests.js" });
console.log(`\n${T.pass} passed, ${T.fail} failed`);
T.fails.forEach(f => console.log("  ✗ " + f));
process.exit(T.fail ? 1 : 0);
