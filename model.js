(function (root) {
  const channels = [
    { id: 'launch', name: 'Launch planning', team: 'Northstar team' },
    { id: 'field', name: 'Site operations', team: 'Northstar team' }
  ];
  function initialState() {
    return {
      channels,
      sessions: [{ id: 'walkthrough', title: 'Site walkthrough', status: 'complete', seconds: 754, channelId: null,
        summary: 'The reception area is ready for the pilot. The team agreed to move the welcome desk beside the main entrance and keep the east corridor clear.',
        decision: 'Move the welcome desk to the main entrance before the pilot.',
        action: 'Site lead to update the floor plan by Friday.',
        transcript: [{ speaker: 'Site lead', text: 'The reception area is ready. We should move the welcome desk beside the main entrance.' }, { speaker: 'Project lead', text: 'Agreed. Keep the east corridor clear, and update the floor plan by Friday.' }] }],
      threads: []
    };
  }
  function startSession(state, title, channelId, consent) {
    if (!consent) throw new Error('Confirm participant awareness before starting.');
    if (channelId && !state.channels.some(channel => channel.id === channelId)) throw new Error('Choose a valid channel.');
    const session = { id: 'session-' + (state.sessions.length + 1), title: title.trim() || 'In-person conversation', status: 'recording', seconds: 0, channelId: channelId || null,
      summary: '', decision: '', action: '', transcript: [] };
    state.sessions.unshift(session);
    return session;
  }
  function sampleNotes() {
    return {
      summary: 'In an in-person product discussion, the team agreed that Teams should be the home for conversations captured with Copilot notetaking. Capture may start in Teams, Copilot, or another surface. The resulting notes, decisions, and follow-up discussion should come together in Teams, with channels as the first shared destination.',
      decision: 'Make Teams the home for Copilot notetaking conversations, regardless of where capture starts. Start with channels so the team can find the notes, continue the discussion, and use the decision in later work.',
      action: 'Design lead to map capture-to-channel sharing by Friday. Product lead to define the destination and sharing permissions. Engineering lead to demonstrate a Copilot answer that cites the original in-person notes.',
      transcript: [
        { speaker: 'Product lead', text: 'Where should these conversations live if someone starts notetaking in Copilot or another surface?' },
        { speaker: 'Design lead', text: 'Teams should be their home. Capture can start elsewhere, but the notes and follow-up should come back to the team. Channels are our first shared destination.' },
        { speaker: 'Engineering lead', text: 'Then a later question in the channel should be able to refer to this in-person decision, with a citation to these notes. We must distinguish those notes from online meeting notes and channel replies.' },
        { speaker: 'Product lead', text: 'Agreed. That is how the in-person conversation contributes to Teams as the system of work. We still need to define destination selection and sharing permissions.' },
        { speaker: 'Design lead', text: 'I will map the sharing flow by Friday. Product will define permissions, and engineering will demonstrate the cited answer.' }
      ]
    };
  }
  function completeSession(state, sessionId) {
    const session = state.sessions.find(item => item.id === sessionId);
    if (!session || session.status !== 'recording') throw new Error('No active session.');
    Object.assign(session, sampleNotes(), { status: 'complete' });
    if (session.channelId) state.threads.unshift({ sessionId: session.id, channelId: session.channelId, replies: [] });
    return session;
  }
  function attachSession(state, sessionId, channelId, confirmed) {
    const session = state.sessions.find(item => item.id === sessionId);
    if (!session || session.status !== 'complete') throw new Error('Only completed conversations can be shared.');
    if (!state.channels.some(channel => channel.id === channelId)) throw new Error('Choose a valid channel.');
    if (!confirmed) throw new Error('Confirm sharing with channel members.');
    if (session.channelId) throw new Error('This conversation already belongs to a channel.');
    session.channelId = channelId;
    state.threads.unshift({ sessionId, channelId, replies: [] });
  }
  const api = { initialState, startSession, completeSession, attachSession, sampleNotes };
  if (typeof module !== 'undefined') module.exports = api;
  else root.PrototypeModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);