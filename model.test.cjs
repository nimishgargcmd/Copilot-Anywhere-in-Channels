const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initialState, startSession, completeSession, attachSession } = require('./model.js');

test('channel capture stays unpublished until completion creates exactly one thread', () => {
  const state = initialState();
  const session = startSession(state, 'Pilot readiness', 'launch', true);
  assert.equal(state.threads.length, 0);
  completeSession(state, session.id);
  assert.equal(state.threads.length, 1);
  assert.equal(state.threads[0].sessionId, session.id);
  assert.equal(session.status, 'complete');
  assert.match(session.decision, /Teams the home/);
  assert.match(session.decision, /regardless of where capture starts/);
  assert.match(session.transcript.map(line => line.text).join(' '), /citation to these notes/);
  assert.throws(() => completeSession(state, session.id), /No active session/);
  assert.equal(state.threads.length, 1);
  assert.throws(() => attachSession(state, session.id, 'launch', true), /already belongs/);
});
test('multiple captures publish independent threads only when each ends', () => {
  const state = initialState();
  const first = startSession(state, 'Pilot readiness', 'launch', true);
  const second = startSession(state, 'Reception review', 'launch', true);
  assert.equal(state.threads.length, 0);
  completeSession(state, second.id);
  assert.deepEqual(state.threads.map(thread => thread.sessionId), [second.id]);
  completeSession(state, first.id);
  assert.equal(state.threads.length, 2);
});
test('past session requires sharing confirmation and cannot be duplicated or silently moved', () => {
  const state = initialState();
  assert.throws(() => attachSession(state, 'walkthrough', 'launch', false), /Confirm sharing/);
  assert.equal(state.threads.length, 0);
  attachSession(state, 'walkthrough', 'launch', true);
  assert.equal(state.sessions[0].channelId, 'launch');
  assert.throws(() => attachSession(state, 'walkthrough', 'field', true), /already belongs/);
  assert.equal(state.threads.length, 1);
});
test('standalone capture has no channel thread until explicitly shared', () => {
  const state = initialState();
  assert.throws(() => startSession(state, 'Test', 'launch', false), /participant awareness/);
  assert.throws(() => startSession(state, 'Test', 'missing', true), /valid channel/);
  const session = startSession(state, 'Standalone', null, true);
  assert.equal(state.threads.length, 0);
  assert.throws(() => attachSession(state, session.id, 'launch', true), /completed/);
  completeSession(state, session.id);
  attachSession(state, session.id, 'field', true);
  assert.equal(state.threads.length, 1);
});