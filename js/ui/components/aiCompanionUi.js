/**
 * Deep Focus v2.0 - Zenith AI Companion UI Component
 * Provides live cognitive coaching, stats analysis, and focus advice
 */

import store from '../../state/store.js';

export function initAiCompanionUi() {
  const messagesContainer = document.getElementById('chat-messages');
  const suggestionsContainer = document.getElementById('chat-suggestions');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');

  if (!messagesContainer) return;

  // Disable input & send button
  if (chatInput) {
    chatInput.disabled = true;
    chatInput.placeholder = "Zenith AI is coming soon...";
    chatInput.style.opacity = '0.5';
    chatInput.style.cursor = 'not-allowed';
  }
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';
    sendBtn.style.cursor = 'not-allowed';
  }

  // Render Coming Soon welcome card
  renderComingSoonCard();

  function renderComingSoonCard() {
    messagesContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 12px; gap: 8px;">
        <div style="background: var(--accent-alpha-10); color: var(--accent); border: 1px solid var(--accent-alpha-30); border-radius: 12px; padding: 4px 10px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">
          Preview Mode
        </div>
        <h3 style="font-size: 1.1rem; color: var(--text-primary); font-weight: 600; margin: 0;">🚀 Zenith AI — Coming Soon</h3>
        <p class="text-muted" style="font-size: 0.8rem; line-height: 1.5; margin: 0; max-width: 320px;">
          Zenith AI is currently under development. It will provide personalized focus coaching, intelligent productivity insights, adaptive sound recommendations, and session analysis while keeping your data private.
        </p>
      </div>
    `;
    if (suggestionsContainer) {
      suggestionsContainer.innerHTML = '';
    }
  }
}
