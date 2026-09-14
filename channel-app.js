const model = globalThis.PrototypeModel;
const storageKey = 'fa-channel-screenshot-prototype-v2';
const channelName = 'IDC Teams Mobile Meeting Triad';
const channelTeam = 'CMD - IDC';
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const icon = (name, branded = true) => branded && ['audio-lines', 'notebook-pen'].includes(name)
  ? '<img class="copilot-inline-icon" src="copilot.svg" alt="Copilot" aria-hidden="true">'
  : `<i data-lucide="${name}" aria-hidden="true"></i>`;
const logo = (mini = false) => `<span class="cmd-logo ${mini ? 'mini' : ''}" aria-hidden="true"><span>CMD</span><span>IDC</span></span>`;
const iconButton = (name, label, action, extra = '') => `<button class="icon-button" title="${label}" aria-label="${label}" data-action="${action}" ${extra}>${icon(name)}</button>`;
const portrait = (colleague = false) => `<span class="avatar-wrap"><img class="person-avatar" src="avatar-${colleague ? 'colleague' : 'author'}.jpg" alt="Sample portrait"><span class="presence">${icon('check')}</span></span>`;
const clock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const duration = seconds => seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} sec` : ''}`;
function initialDemo() {
  const fresh = model.initialState();
  const sample = model.startSession(fresh, 'Copilot notetaking: Teams as the home', 'launch', true);
  sample.seconds = 754;
  sample.dateLabel = 'Mon, 14 Sep';
  sample.postedAt = '9:42 AM';
  model.completeSession(fresh, sample.id);
  fresh.threads[0].replies.push('Does Teams remain the home even when capture starts in another app?', 'Yes. The in-person notes capture that decision. Let\'s track the sharing flow and permissions here.');
  fresh.channelMessages = [];
  return fresh;
}
let state = initialDemo();
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && Array.isArray(saved.sessions) && Array.isArray(saved.threads) && Array.isArray(saved.channelMessages)) {
    saved.sessions.forEach(session => { session.title = session.title.replace(/Facilitator/g, 'Copilot'); });
    saved.sessions.forEach(session => {
      if (session.status !== 'complete' || session.decision !== 'Start the pilot on 28 September. Keep the wider launch date unchanged.') return;
      Object.assign(session, model.sampleNotes());
      if (['Pilot readiness discussion', 'Meeting with Copilot'].includes(session.title)) session.title = 'Copilot notetaking: Teams as the home';
    });
    saved.threads.forEach(thread => {
      thread.replies = thread.replies.map(reply => reply === 'Can we use this thread for any follow-up questions?' ? 'Does Teams remain the home even when capture starts in another app?' : reply === 'Yes, let\'s keep the follow-up discussion here.' ? 'Yes. The in-person notes capture that decision. Let\'s track the sharing flow and permissions here.' : reply);
    });
    state = saved;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }
} catch {}
let view = 'channel';
let selectedId = state.threads[0]?.sessionId;
let recapTab = 'Notes';
const recapTabs = ['Notes', 'AI summary', 'Custom summary', 'Mentions', 'Shared files', 'Speakers', 'Transcript'];
const dismissedRecapNotices = new Set();
let showNotice = true;
let paused = false;
let modalKind = 'sheet';
let modalTrigger;
let toastTimer;
let startupTimer;
let recordingNotice = true;
let transcriptionLanguage = 'English (US)';
let recapReturn = 'thread';
const copilotMessages = [];
let copilotPending = false;
let copilotTimer;
let copilotScope;
let copilotMenu = '';
const copilotImage = '<img class="capture-logo" src="copilot.svg" alt="Copilot">';
const currentSession = () => state.sessions.find(session => session.id === selectedId);
const threadFor = id => state.threads.find(thread => thread.sessionId === id);
function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} }
function icons() { globalThis.lucide?.createIcons(); }
function toast(message) {
  const output = document.querySelector('#toast');
  clearTimeout(toastTimer);
  output.textContent = message;
  output.classList.add('show');
  toastTimer = setTimeout(() => output.classList.remove('show'), 2700);
}
function navigate(destination, sessionId) {
  if (view === 'startup' && destination !== 'startup') clearTimeout(startupTimer);
  if (sessionId) selectedId = sessionId;
  view = destination;
  render();
  app.querySelector('h1')?.focus({ preventScroll: true });
}
function header(title = channelName, subtitle = channelTeam, kind = 'channel') {
  const back = kind === 'channel' ? 'back-channels' : kind === 'recap' ? recapReturn : 'channel';
  return `<header class="channel-header">${iconButton('chevron-left', 'Back', back)}${logo()}<div class="heading"><div class="header-title"><h1 tabindex="-1" title="${escapeHtml(title)}">${escapeHtml(title)}</h1>${icon('lock-keyhole')}</div><p>${escapeHtml(subtitle)}</p></div>${kind === 'channel' ? iconButton('video', 'Meeting options', 'meeting-menu', 'aria-haspopup="dialog"') : kind === 'thread' ? iconButton('messages-square', 'Thread details', 'thread-details') : ''}${['channel', 'thread'].includes(kind) ? '<button class="icon-button channel-copilot" title="Chat with Copilot" aria-label="Chat with Copilot" data-action="channel-copilot"><img src="copilot.svg" alt=""></button>' : ''}</header>`;
}
function copilotView() {
  return `<section class="copilot-sheet"><h2 id="modal-title" class="modal-title-hidden">Copilot</h2><button class="copilot-handle" data-action="close" aria-label="Close Copilot" title="Close Copilot"><span></span></button><header class="copilot-toolbar">${iconButton('menu', 'Copilot conversations', 'copilot-history')}<div class="copilot-modes" role="group" aria-label="Copilot mode"><button aria-pressed="true">Work</button><button disabled title="Web is not connected in this prototype">Web</button></div>${iconButton('square-pen', 'New Copilot chat', 'copilot-new')}${iconButton('ellipsis', 'Copilot options', 'copilot-options')}</header>${copilotMenu ? `<div class="copilot-menu">${copilotMenu === 'history' ? '<p>Current conversation</p><button class="text-button" data-action="copilot-new">New chat</button>' : '<p>Local sample responses. No live Copilot, web, files, or microphone connection.</p>'}</div>` : ''}<div class="copilot-conversation" role="log" aria-label="Copilot conversation" aria-live="polite">${copilotMessages.length ? copilotMessages.map(message => `<article class="${message.user ? 'copilot-question' : 'copilot-answer'}">${!message.user ? '<small>Sample response</small>' : ''}<p>${escapeHtml(message.text)}</p>${message.sessionId ? `<button class="copilot-citation" data-action="copilot-source" data-id="${escapeHtml(message.sessionId)}" title="Open source: ${escapeHtml(message.title)}">${escapeHtml(message.title)} ${icon('external-link')}</button>` : ''}</article>`).join('') : `<div class="copilot-empty"><img src="copilot.svg" alt="Copilot"></div>`}${copilotPending ? '<p class="copilot-loading" role="status"><span></span>Putting it together...</p>' : ''}</div>${!copilotMessages.length ? `<div class="copilot-prompts"><button data-action="copilot-prompt" data-prompt="Summarise ${copilotScope ? 'thread' : 'channel'}">${icon('list-collapse')}<span>Summarise ${copilotScope ? 'thread' : 'channel'}</span></button><button disabled title="File search is not connected in this prototype">${icon('map-pin')}<span>Find recent file</span></button><button data-action="copilot-prompt" data-prompt="Get open actions">${icon('layout-grid')}<span>Get open actions</span></button></div>` : ''}<form id="copilot-message" class="copilot-composer"><button type="button" class="icon-button" disabled aria-label="Attachments unavailable" title="Attachments are not connected">${icon('plus')}</button><input name="message" aria-label="Message Copilot" placeholder="Message Copilot" autocomplete="off" maxlength="1000" required ${copilotPending ? 'disabled' : ''}>${copilotPending ? `<button type="button" class="copilot-stop" data-action="copilot-stop" aria-label="Stop response" title="Stop response">${icon('square')}</button>` : `<button type="button" class="copilot-speak" disabled title="Voice is not connected in this prototype">${icon('audio-lines', false)}Speak</button><button class="copilot-send" type="submit" aria-label="Send to Copilot" title="Send to Copilot" hidden>${icon('arrow-up')}</button>`}</form></section>`;
}
function renderCopilot() {
  modal.innerHTML = copilotView();
  const prompts = modal.querySelector('.copilot-prompts');
  if (prompts) prompts.insertAdjacentHTML('afterbegin', `<button data-action="copilot-prompt" data-prompt="What did we decide about the home for Copilot notetaking, and where was that decision made?">${icon('message-circle-question')}<span>Where should the notes live?</span></button>`);
  icons();
  const scroll = modal.querySelector('.copilot-conversation');
  const latestQuestion = scroll.querySelector('.copilot-question:last-of-type') || [...scroll.querySelectorAll('.copilot-question')].pop();
  scroll.scrollTop = latestQuestion ? latestQuestion.offsetTop - scroll.offsetTop : 0;
}
function openCopilot() {
  const scope = ['thread', 'recap'].includes(view) ? selectedId : null;
  if (scope !== copilotScope) copilotMessages.length = 0;
  copilotScope = scope;
  copilotMenu = '';
  modalTrigger = document.activeElement;
  modalKind = 'copilot';
  modal.className = 'copilot-dialog';
  renderCopilot();
  modal.showModal();
  positionModal();
}
function stopCopilot() {
  clearTimeout(copilotTimer);
  if (copilotPending) copilotMessages.push({ text: 'Response stopped.' });
  copilotPending = false;
}
function askCopilot(message) {
  if (!message || copilotPending) return;
  copilotMenu = '';
  copilotMessages.push({ user: true, text: message });
  copilotPending = true;
  renderCopilot();
  modal.querySelector('[data-action="copilot-stop"]').focus({ preventScroll: true });
  copilotTimer = setTimeout(() => {
    let sessions = state.threads.filter(thread => thread.channelId === 'launch').map(thread => state.sessions.find(session => session.id === thread.sessionId)).filter(session => session?.status === 'complete');
    if (/latest|last|recent/i.test(message)) sessions = sessions.slice(0, 1);
    else if (copilotScope) sessions = sessions.filter(session => session.id === copilotScope);
    const field = /action|follow.?up|next step/i.test(message) ? 'action' : /decid|decision|home|reside|live|belong|system of work/i.test(message) ? 'decision' : /summari|summary|recap|notes|discuss/i.test(message) ? 'summary' : null;
    if (field && sessions.length) sessions.forEach(session => copilotMessages.push({
      text: `${session[field]}\n\nSource: the ${field === 'decision' ? 'Decisions' : field === 'action' ? 'Follow-up' : 'Summary'} section of the in-person notetaking session "${session.title}" (${session.dateLabel || 'Mon, 14 Sep'}). This is captured in-person conversation content shared to the channel, not an online meeting transcript or a channel reply.${session.decision === model.sampleNotes().decision ? '\n\nThe in-person decision is now part of the team\'s shared record in Teams: it can inform this answer and remain linked to the original notes for follow-up.' : ''}`,
      sessionId: session.id,
      title: `In-person notes · ${session.title}`
    }));
    else copilotMessages.push({ text: 'No matching answer is available in the local sample notes.' });
    copilotPending = false;
    renderCopilot();
    modal.querySelector('[name="message"]').focus({ preventScroll: true });
  }, 1400);
}
function composer(inThread) {
  return `<form id="${inThread ? 'thread-reply' : 'channel-message'}" class="composer"><button type="button" class="icon-button add-button" data-action="composer-options" aria-label="More message options" title="More message options">${icon('plus')}</button><div class="composer-box">${inThread ? `<div class="composer-scope">Send to: thread only ${icon('chevron-down')}</div>` : ''}<div class="composer-input"><input name="message" aria-label="${inThread ? 'Reply in thread' : 'Message in channel'}" placeholder="${inThread ? 'Reply in thread' : 'Message in channel'}" autocomplete="off" maxlength="1000" required>${iconButton('smile', 'Insert smile', 'smile', 'type="button"')}</div></div><button class="icon-button send-button" type="submit" aria-label="Send message" title="Send message" hidden>${icon('send')}</button><button class="icon-button attachment-button" type="button" disabled title="Camera is outside this prototype" aria-label="Camera unavailable in prototype">${icon('camera')}</button><button class="icon-button attachment-button" type="button" disabled title="Voice messages are outside this prototype" aria-label="Voice message unavailable in prototype">${icon('mic')}</button></form>`;
}
function replyLink(session) {
  const thread = threadFor(session.id);
  const replies = thread.replies;
  return `<button class="thread-link" data-action="thread" data-id="${session.id}">${replies.length ? '<span class="reply-avatars"><img src="avatar-colleague.jpg" alt=""><img src="avatar-author.jpg" alt=""></span>' : icon('messages-square')}<span>${replies.length ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'Start a thread'}</span>${replies.length ? `<small>Last reply ${thread.lastReplyAt || '9:48 AM'}</small>` : ''}</button>`;
}
function completedCard(session) {
  return `<article class="chat-entry unread" data-session="${session.id}">${portrait()}<div><div class="sender">Nimish Garg <time>${escapeHtml(session.postedAt || 'Just now')}</time></div><div class="meeting-card"><h2>${escapeHtml(session.title)}</h2><div class="card-row">${icon('audio-lines')}<span>In-person conversation</span></div><div class="card-row">${icon('clock-3')}<span>${escapeHtml(session.dateLabel || 'Mon, 14 Sep')} · ${duration(session.seconds)}</span></div><div class="card-row">${logo(true)}<span>${channelName}</span></div><div class="card-footer"><button class="primary" data-action="thread" data-id="${session.id}">Open chat</button>${iconButton('ellipsis', 'Conversation options', 'conversation-options', `data-id="${session.id}"`)}</div></div>${replyLink(session)}</div></article>`;
}
function channelView() {
  const sessions = state.threads.filter(thread => thread.channelId === 'launch').map(thread => state.sessions.find(session => session.id === thread.sessionId)).filter(session => session?.status === 'complete');
  return header() + `${showNotice ? `<aside class="threads-notice"><p>A channel owner set this channel to a threads layout</p><button class="text-button" data-action="threads-help">Learn how threads work</button>${iconButton('x', 'Dismiss threads notice', 'dismiss-notice')}</aside>` : ''}<div class="scroll channel-scroll"><article class="chat-entry">${portrait(true)}<div><div class="sender">Project lead <time>9:30 AM</time></div><p class="chat-copy">We are discussing where Copilot notetaking conversations should live, even when capture starts outside Teams.</p><p class="chat-copy">Let's bring the in-person notes back here so the team can use the decision and continue the work.</p></div></article><div class="day-divider">Today</div>${sessions.map(completedCard).join('')}${state.channelMessages.map(message => `<article class="chat-entry">${portrait()}<div><div class="sender">Nimish Garg <time>Just now</time></div><p class="chat-copy">${escapeHtml(message)}</p></div></article>`).join('')}</div>${composer(false)}`;
}
function threadView() {
  const session = currentSession();
  const thread = threadFor(session.id);
  return header(session.title, channelName, 'thread') + `<div class="scroll channel-scroll thread-scroll"><div class="day-divider">${escapeHtml(session.dateLabel || 'Mon, 14 Sep')}</div><div class="ended-event">${icon('audio-lines')}<span>Notetaking ended: ${duration(session.seconds)}.</span></div><article class="recap-card"><div class="recap-kind">${icon('audio-lines')}In-person conversation</div><h2>${escapeHtml(session.title)}</h2><p>${escapeHtml(session.dateLabel || 'Mon, 14 Sep')} · ${duration(session.seconds)}</p><div class="recap-action"><button data-action="recap">View recap</button></div></article>${thread.replies.map((reply, index) => `<article class="chat-entry">${portrait(index === 0)}<div><div class="sender">${index === 0 && session.postedAt !== 'Just now' ? 'Project lead' : 'Nimish Garg'} <time>${index < 2 && session.postedAt !== 'Just now' ? '9:48 AM' : 'Just now'}</time></div><p class="chat-copy">${escapeHtml(reply)}</p></div></article>`).join('')}</div>${composer(true)}`;
}
function recapView() {
  const session = currentSession();
  const transcript = session.transcript || [];
  const speakers = [...new Set(transcript.map(line => line.speaker))];
  const empty = (title, text) => `<div class="recap-empty">${icon('notebook-text')}<h3>${title}</h3><p>${text}</p></div>`;
  const section = (title, text) => `<section class="recap-note-section"><h3>${title}</h3><ul><li>${escapeHtml(text)}</li></ul></section>`;
  let body = '';
  if (recapTab === 'Notes') body = `<p class="recap-ai-notice">AI-generated content in notes may be incorrect. <button class="text-button" data-action="recap-ai-info">Learn more</button></p>${session.decision ? section('Decisions', session.decision) + section('Follow-up tasks', session.action) + (session.decision === model.sampleNotes().decision ? section('Open questions', 'How should people choose the Teams destination when capture starts elsewhere? Which permissions and participant-awareness checks are required before sharing?') : '') : empty('No notes available', 'No notes were created for this conversation.')}`;
  if (recapTab === 'AI summary') body = `<span class="recap-ai-badge">AI generated · Sample</span><h3 class="recap-section-title">Meeting notes</h3>${session.summary ? [['Conversation summary', session.summary], ['Key decision', session.decision], ['Next steps', session.action]].map(([title, text]) => `<details class="recap-summary" open><summary>${title}</summary><p>${escapeHtml(text)}</p></details>`).join('') : empty('No summary available', 'There is no summary for this conversation.')}`;
  if (recapTab === 'Custom summary') body = `<form id="custom-summary-form"><label class="field-label" for="custom-summary">Custom summary</label><textarea id="custom-summary" class="field recap-custom" name="summary" maxlength="4000" placeholder="Add your summary">${escapeHtml(session.customSummary || '')}</textarea><button class="primary" type="submit">Save</button></form>`;
  if (recapTab === 'Mentions') body = empty('No mentions', 'No one was @mentioned in these notes.');
  if (recapTab === 'Shared files') body = `<h3 class="recap-section-title">Attached</h3>${empty('No shared files', 'No files have been attached to this conversation.')}`;
  if (recapTab === 'Speakers') body = speakers.length ? `<p class="recap-source-label">Sample speaker attribution · Transcript turns</p>${speakers.map((speaker, speakerIndex) => `<section class="recap-speaker"><div class="recap-speaker-name"><span class="speaker-avatar speaker-color-${speakerIndex % 4}">${escapeHtml(speaker.split(' ').map(word => word[0]).slice(0, 2).join(''))}</span><h3>${escapeHtml(speaker)}</h3></div><div class="speaker-turns" style="grid-template-columns:repeat(${transcript.length},minmax(0,1fr))">${transcript.map((line, index) => line.speaker === speaker ? `<button class="speaker-color-${speakerIndex % 4}" data-action="recap-transcript-turn" data-turn="${index}" title="${escapeHtml(speaker)}: transcript entry ${index + 1}" aria-label="${escapeHtml(speaker)}: transcript entry ${index + 1}"></button>` : '<span></span>').join('')}</div></section>`).join('')}` : empty('No speakers available', 'Speaker information is unavailable for this conversation.');
  if (recapTab === 'Transcript') body = transcript.length ? `<p class="recap-source-label">${icon('circle-dot')}In-person transcription · Sample</p>${transcript.map((line, index) => `<article class="recap-transcript-entry" id="transcript-turn-${index}" tabindex="-1"><span class="speaker-avatar speaker-color-${speakers.indexOf(line.speaker) % 4}">${escapeHtml(line.speaker.split(' ').map(word => word[0]).slice(0, 2).join(''))}</span><div><div class="recap-transcript-meta"><span>${escapeHtml(line.speaker)}</span><span>${index + 1}</span></div><p>${escapeHtml(line.text)}</p></div></article>`).join('')}` : empty('No transcript available', 'The transcript was never created, has expired, or has been deleted.');
  const notice = ['Notes', 'Shared files'].includes(recapTab) && !dismissedRecapNotices.has(`${session.id}:${recapTab}`) ? `<aside class="recap-occurrence"><p>${recapTab === 'Notes' ? "You're viewing meeting notes" : 'You are viewing shared files'} for this occurrence.</p>${iconButton('x', 'Dismiss recap notice', 'dismiss-recap-notice')}</aside>` : '';
  return `<header class="recap-header">${iconButton('chevron-left', 'Back', recapReturn)}<div><h1 tabindex="-1" title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</h1><p>${escapeHtml(session.dateLabel || 'Mon, 14 Sep')} · ${duration(session.seconds)}</p></div><button class="icon-button channel-copilot" data-action="channel-copilot" title="Chat with Copilot" aria-label="Chat with Copilot"><img src="copilot.svg" alt=""></button></header><p class="recap-session-kind">${icon('notebook-pen')}In-person notetaking</p><div class="recap-pill-tabs" role="tablist" aria-label="Recap views">${recapTabs.map((tab, index) => `<button id="recap-tab-${index}" role="tab" aria-controls="recap-panel" aria-selected="${tab === recapTab}" tabindex="${tab === recapTab ? '0' : '-1'}" data-action="recap-tab" data-tab="${tab}">${tab}</button>`).join('')}</div>${notice}<div id="recap-panel" role="tabpanel" aria-labelledby="recap-tab-${recapTabs.indexOf(recapTab)}" tabindex="0" class="scroll recap-content recap-body">${body}</div>`;
}
function selectRecapTab(tab) {
  recapTab = tab;
  render();
  const selected = app.querySelector('[role="tab"][aria-selected="true"]');
  selected.focus({ preventScroll: true });
  selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function startupView() {
  return `<section class="startup-screen"><div class="startup-header">${iconButton('x', 'Cancel startup', 'channel')}<h1 tabindex="-1">Meeting with Copilot</h1></div><div class="startup-panel">${copilotImage}<p>Joining with microphone on</p></div><p class="startup-progress" role="status">Setting things up...</p></section>`;
}
function recordingView() {
  const session = currentSession();
  return `<section class="capture-screen"><header class="capture-toolbar">${iconButton('chevron-left', 'Back to channel', 'channel')}<div class="capture-title"><h1 tabindex="-1">${escapeHtml(session.title)}</h1><span class="capture-time"><span class="record-indicator"></span><span id="timer">${clock(session.seconds)}</span>${icon('shield')}</span></div>${iconButton('message-circle', 'Session information', 'capture-info')}${iconButton('users-round', 'Participants', 'capture-people')}${iconButton('ellipsis', 'Notetaking options', 'capture-options')}</header>${recordingNotice ? `<aside class="recording-notice">${icon('circle-dot')}<div><p>You started recording. Transcription started automatically. <button class="privacy-link" data-action="capture-privacy">Privacy Policy</button></p><button class="language-button" data-action="capture-language">Manage language settings</button></div>${iconButton('x', 'Dismiss recording notice', 'dismiss-recording-notice')}</aside>` : ''}<div class="capture-center">${copilotImage}<h2>${paused ? 'Your microphone is muted' : 'Copilot is taking notes'}</h2><p>${paused ? 'Unmute your mic to continue listening.' : 'Mute your mic if you want it to stop listening.'}</p></div><div class="capture-controls"><button class="round-control microphone ${paused ? 'muted' : ''}" data-action="mute" aria-label="${paused ? 'Unmute microphone' : 'Mute microphone'}" title="${paused ? 'Unmute microphone' : 'Mute microphone'}" aria-pressed="${paused}">${icon(paused ? 'mic-off' : 'mic')}</button><button class="round-control hangup" data-action="finish" aria-label="End notetaking" title="End notetaking">${icon('phone')}</button></div></section>`;
}
function savedView() {
  return `<section class="saved-screen"><div class="saved-header" style="display:flex;justify-content:flex-end">${iconButton('x', 'Close and go to channel post', 'channel-post')}</div><div class="saved-message">${copilotImage}<h1 tabindex="-1">Your notes are saved</h1><p>Notes have been attached to this conversation<br>and shared with the channel.</p></div><div class="saved-actions"><button class="saved-primary" data-action="view-notes">${icon('external-link')}View notes</button><button class="saved-secondary" data-action="copy-session-link">${icon('copy')}Copy link</button><button class="saved-edit" data-action="edit-title">${icon('pencil')}Edit meeting title</button></div></section>`;
}
function render() {
  document.querySelector('.device').classList.toggle('capture-dark', ['startup', 'recording', 'saved'].includes(view));
  if (view === 'channel') app.innerHTML = channelView();
  if (view === 'thread') app.innerHTML = threadView();
  if (view === 'recap') app.innerHTML = recapView();
  if (view === 'recording') app.innerHTML = recordingView();
  if (view === 'startup') app.innerHTML = startupView();
  if (view === 'saved') app.innerHTML = savedView();
  icons();
  updateLive();
}
function positionModal() {
  if (!modal.open) return;
  const bounds = document.querySelector('.device').getBoundingClientRect();
  if (modalKind === 'copilot') {
    Object.assign(modal.style, { position: 'fixed', left: `${bounds.left}px`, top: 'auto', right: 'auto', bottom: `${Math.max(0, innerHeight - bounds.bottom)}px`, width: `${bounds.width}px`, height: `${Math.round(bounds.height * 0.57)}px`, maxHeight: `${bounds.height - 70}px` });
    return;
  }
  modal.style.height = '';
  if (modalKind === 'menu') {
    const anchor = app.querySelector('[data-action="meeting-menu"]').getBoundingClientRect();
    const width = Math.min(324, bounds.width - 28);
    Object.assign(modal.style, { position: 'fixed', left: `${bounds.right - width - 10}px`, top: `${anchor.bottom + 6}px`, right: 'auto', bottom: 'auto', width: `${width}px`, maxHeight: `${innerHeight - anchor.bottom - 25}px` });
  } else Object.assign(modal.style, { position: 'fixed', left: `${bounds.left}px`, top: 'auto', right: 'auto', bottom: `${Math.max(0, innerHeight - bounds.bottom)}px`, width: `${bounds.width}px`, maxHeight: `${Math.min(bounds.height - 40, innerHeight - 20)}px` });
}
function openSheet(title, body) {
  modalTrigger = document.activeElement;
  modalKind = 'sheet';
  modal.className = '';
  modal.innerHTML = `<div class="sheet"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="modal-title">${title}</h2>${iconButton('x', 'Close', 'close')}</div>${body}</div>`;
  modal.showModal();
  positionModal();
  icons();
}
function closeModal() { modal.close(); }
function languageSettings() {
  closeModal();
  openSheet('Language settings', `<form id="language-form"><label class="field-label" for="transcription-language">Spoken language</label><select class="field" id="transcription-language" name="language">${['English (US)', 'English (UK)', 'Hindi'].map(language => `<option ${language === transcriptionLanguage ? 'selected' : ''}>${language}</option>`).join('')}</select><button class="primary full">Save</button></form>`);
}
function meetingMenu() {
  modalTrigger = document.activeElement;
  modalKind = 'menu';
  modal.className = 'channel-menu';
  modal.innerHTML = `<h2 id="modal-title" class="modal-title-hidden">Meeting options</h2><div class="menu-options"><button class="menu-option" disabled title="Online meetings are outside this prototype">${icon('audio-lines', false)}<span>Meet now</span></button><button class="menu-option" disabled title="Scheduling is outside this prototype">${icon('calendar-plus')}<span>Schedule meeting</span></button><button class="menu-option notetaking" data-action="start-channel">${icon('notebook-pen')}<span>Take notes with Copilot</span></button></div>`;
  modal.showModal();
  positionModal();
  icons();
}
function setup() {
  closeModal();
  const active = state.sessions.find(session => session.status === 'recording');
  if (active) { navigate('recording', active.id); return; }
  clearTimeout(startupTimer);
  navigate('startup');
  startupTimer = setTimeout(() => {
    if (view !== 'startup') return;
    const session = model.startSession(state, 'Copilot notetaking: Teams as the home', 'launch', true);
    session.dateLabel = 'Mon, 14 Sep'; session.postedAt = 'Just now';
    paused = false; recordingNotice = true;
    save(); navigate('recording', session.id);
  }, 3500);
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'close') closeModal();
  if (action === 'channel') navigate('channel');
  if (action === 'channel-copilot') openCopilot();
  if (action === 'copilot-prompt') askCopilot(button.dataset.prompt);
  if (action === 'copilot-stop') { stopCopilot(); renderCopilot(); modal.querySelector('input').focus(); }
  if (action === 'copilot-new') { stopCopilot(); copilotMessages.length = 0; copilotMenu = ''; renderCopilot(); }
  if (action === 'copilot-history' || action === 'copilot-options') { const menu = action === 'copilot-history' ? 'history' : 'options'; copilotMenu = copilotMenu === menu ? '' : menu; renderCopilot(); }
  if (action === 'copilot-source') { closeModal(); recapReturn = 'thread'; recapTab = 'Notes'; navigate('recap', button.dataset.id); }
  if (action === 'channel-post') {
    navigate('channel');
    const post = app.querySelector(`[data-session="${CSS.escape(selectedId)}"]`);
    post?.scrollIntoView({ block: 'center' });
    post?.querySelector('[data-action="thread"]')?.focus({ preventScroll: true });
  }
  if (action === 'meeting-menu') meetingMenu();
  if (action === 'start-channel') setup();
  if (action === 'thread') { closeModal(); navigate('thread', button.dataset.id); }
  if (action === 'recap' || action === 'view-notes') { recapReturn = action === 'view-notes' ? 'saved' : 'thread'; recapTab = 'Notes'; navigate('recap'); }
  if (action === 'saved') navigate('saved');
  if (action === 'recap-tab') selectRecapTab(button.dataset.tab);
  if (action === 'dismiss-recap-notice') { dismissedRecapNotices.add(`${selectedId}:${recapTab}`); render(); }
  if (action === 'recap-ai-info') openSheet('About these notes', '<p>These are fabricated sample notes for this prototype. In a live experience, AI-generated notes should be checked against the conversation before they are relied on or shared.</p>');
  if (action === 'recap-transcript-turn') {
    selectRecapTab('Transcript');
    const entry = document.getElementById(`transcript-turn-${button.dataset.turn}`);
    entry?.scrollIntoView({ block: 'center' });
    entry?.focus({ preventScroll: true });
  }
  if (action === 'dismiss-notice') { showNotice = false; render(); }
  if (action === 'mute') { paused = !paused; render(); }
  if (action === 'dismiss-recording-notice') { recordingNotice = false; render(); }
  if (action === 'capture-language') languageSettings();
  if (action === 'capture-info') openSheet('Session information', `<p>Notes will appear in ${channelName} after notetaking ends. This session is not joinable from the channel.</p>`);
  if (action === 'capture-people') openSheet('Participants', '<p>You are capturing this in-person conversation. No other devices are connected in this prototype.</p>');
  if (action === 'capture-privacy') openSheet('Privacy', '<p>This is a local prototype. No microphone is accessed, no audio is recorded, and no content is uploaded. Live participant awareness and channel-sharing permissions still need product validation.</p><a class="text-button" href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer">Microsoft Privacy Statement</a>');
  if (action === 'capture-options') openSheet('Notetaking options', '<button class="channel-option" data-action="language-from-options">Language settings</button><button class="channel-option" data-action="close">Cancel</button>');
  if (action === 'language-from-options') languageSettings();
  if (action === 'edit-title') openSheet('Edit meeting title', `<form id="edit-title-form"><label class="field-label" for="meeting-title">Meeting title</label><input class="field" id="meeting-title" name="title" value="${escapeHtml(currentSession().title)}" maxlength="100" required><button class="primary full">Save</button></form>`);
  if (action === 'copy-session-link') copySessionLink();
  if (action === 'finish') {
    model.completeSession(state, selectedId);
    paused = false;
    save();
    navigate('saved');
  }
  if (action === 'conversation-options' || action === 'thread-details') {
    if (button.dataset.id) selectedId = button.dataset.id;
    openSheet('Conversation details', `<p><strong>${escapeHtml(currentSession().title)}</strong></p><p style="margin-top:10px">In-person conversation · ${duration(currentSession().seconds)}</p><p style="margin-top:10px">Shared with ${channelName}.</p><button class="primary full" data-action="thread">Open chat</button>`);
  }
  if (action === 'threads-help') openSheet('Channel threads', '<p>Each conversation has its own thread. Open chat or select the replies to continue that conversation.</p>');
  if (action === 'back-channels') openSheet('Channels', `<button class="channel-option" data-action="close">${logo()}<span><strong>${channelName}</strong><small>${channelTeam}</small></span>${icon('check')}</button>`);
  if (action === 'composer-options') openSheet('Message options', `<p>Text replies are available in this concept. Attachments and media are not connected.</p><button class="secondary full" style="margin-top:18px" data-action="close">Close</button>`);
  if (action === 'smile') {
    const input = app.querySelector('.composer input');
    input.value += ' :)';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }
  if (action === 'reset-confirm') {
    clearTimeout(startupTimer);
    stopCopilot(); copilotMessages.length = 0;
    state = initialDemo(); selectedId = state.threads[0].sessionId; paused = false; showNotice = true;
    save(); closeModal(); navigate('channel'); toast('Demo reset.');
  }
});
document.addEventListener('input', event => {
  if (event.target.matches('#copilot-message input')) {
    const hasText = Boolean(event.target.value.trim());
    modal.querySelector('.copilot-send').hidden = !hasText;
    modal.querySelector('.copilot-speak').hidden = hasText;
    return;
  }
  if (!event.target.matches('.composer input')) return;
  const form = event.target.closest('form');
  if (form.id === 'copilot-message') return;
  const hasText = Boolean(event.target.value.trim());
  form.querySelector('.send-button').hidden = !hasText;
  form.querySelectorAll('.attachment-button').forEach(button => { button.hidden = hasText; });
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!['edit-title-form', 'language-form', 'thread-reply', 'channel-message', 'copilot-message', 'custom-summary-form'].includes(form.id)) return;
  event.preventDefault();
  const fields = new FormData(form);
  if (form.id === 'custom-summary-form') { currentSession().customSummary = fields.get('summary').trim(); save(); toast('Custom summary saved.'); return; }
  if (form.id === 'copilot-message') {
    askCopilot(fields.get('message').trim());
    return;
  }
  if (form.id === 'edit-title-form') {
    const title = fields.get('title').trim();
    if (!title) { form.querySelector('input[name="title"]').focus(); return; }
    currentSession().title = title;
    save(); closeModal(); render(); toast('Meeting title updated.');
  } else if (form.id === 'language-form') {
    transcriptionLanguage = fields.get('language'); closeModal(); toast('Spoken language: ' + transcriptionLanguage);
  } else {
    const message = fields.get('message').trim();
    if (!message) return;
    if (form.id === 'thread-reply') {
      threadFor(selectedId).replies.push(message);
      threadFor(selectedId).lastReplyAt = 'just now';
    }
    else state.channelMessages.push(message);
    save(); render();
    const scroll = app.querySelector('.scroll'); scroll.scrollTop = scroll.scrollHeight;
    app.querySelector('.composer input').focus();
  }
});
document.addEventListener('keydown', event => {
  if (event.target.getAttribute('role') !== 'tab' || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = recapTabs.indexOf(recapTab);
  selectRecapTab(event.key === 'Home' ? recapTabs[0] : event.key === 'End' ? recapTabs.at(-1) : recapTabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + recapTabs.length) % recapTabs.length]);
});
modal.addEventListener('close', () => { stopCopilot(); if (modalTrigger?.isConnected) modalTrigger.focus(); });
modal.addEventListener('click', event => { if (event.target === modal) { const bounds = modal.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeModal(); } });
window.addEventListener('resize', positionModal);
document.querySelector('#reset').addEventListener('click', () => openSheet('Reset demo?', '<p>Restore the sample completed conversation and remove sessions and messages created in this preview.</p><button class="primary full" data-action="reset-confirm">Reset demo</button>'));
function updateLive() {
  if (view !== 'recording') return;
  const session = currentSession();
  document.querySelector('#timer').textContent = clock(session.seconds);
}
setInterval(() => {
  const active = state.sessions.find(session => session.status === 'recording');
  if (!active) return;
  active.seconds += 1; updateLive();
  if (active.seconds % 5 === 0) save();
}, 1000);
async function copySessionLink() {
  const link = new URL(location.href);
  link.hash = `session=${encodeURIComponent(selectedId)}`;
  try { await navigator.clipboard.writeText(link.href); toast('Local prototype link copied.'); }
  catch { openSheet('Conversation link', `<p>This local link works in this browser with its saved demo data.</p><input class="field" aria-label="Conversation link" readonly value="${escapeHtml(link.href)}" style="margin-top:15px">`); modal.querySelector('input').select(); }
}
function openLinkedSession() {
  const requested = new URLSearchParams(location.hash.slice(1)).get('session');
  if (!requested) return;
  const session = state.sessions.find(item => item.id === requested && item.status === 'complete');
  if (session && threadFor(requested)) { selectedId = requested; view = 'thread'; }
  else toast('This conversation is not saved in this browser.');
}
window.addEventListener('hashchange', () => { openLinkedSession(); render(); });
openLinkedSession();
render();