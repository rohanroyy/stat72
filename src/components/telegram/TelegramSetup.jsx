import React, { useState } from 'react';
import { DEFAULT_BOT_TOKEN } from '../../services/telegramService';

export default function TelegramSetup({ onConfigSubmit }) {
  const [token, setToken] = useState(DEFAULT_BOT_TOKEN);
  const [chatId, setChatId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (token.trim() && chatId.trim()) {
      onConfigSubmit(token.trim(), chatId.trim());
    }
  };


  return (
    <div className="setup-screen telegram-theme">
      <div className="setup-logo tg-logo">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/>
        </svg>
        <span>StudyDock Telegram</span>
      </div>

      <div className="setup-card glassmorphic-tg">
        <h2>Connect Telegram Bot</h2>
        <p>
          Configure your Telegram Bot token and Chat ID. The bot must be an administrator in the target group, and Privacy Mode should be disabled.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="setup-input-group">
            <label className="setup-label" htmlFor="tg-token-input">
              Bot API Token
            </label>
            <input
              id="tg-token-input"
              className="setup-input"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="e.g. 1234567890:ABCdef..."
              autoComplete="off"
              spellCheck="false"
              required
            />
          </div>

          <div className="setup-input-group">
            <label className="setup-label" htmlFor="tg-chat-input">
              Telegram Group Chat ID
            </label>
            <input
              id="tg-chat-input"
              className="setup-input"
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. -1002244668800"
              autoComplete="off"
              spellCheck="false"
              required
            />
            <span className="caption-sub">Make sure to include the negative sign (usually starts with -100)</span>
          </div>

          <button
              type="submit"
              className="setup-submit tg-submit-btn"
              disabled={!token.trim() || !chatId.trim()}
            >
              Connect &amp; Sync
            </button>
          
        </form>

        <div className="setup-steps">
          <h3>How to Setup Telegram Sync</h3>
          <ol>
            <li>
              Add your bot (<strong>@PoraPagolBot</strong>) as an <strong>Administrator</strong> in your Telegram group.
            </li>
            <li>
              Ensure <strong>Topics/Forums</strong> are enabled in your group settings.
            </li>
            <li>
              Disable privacy mode: Message <strong>@BotFather</strong>, send <code>/setprivacy</code>, choose your bot, and set it to <strong>"Disable"</strong>.
            </li>
            <li>
              Get your Chat ID: Add <strong>@RawDataBot</strong> to the group (it will output the chat ID, usually starts with -100) or check bot updates.
            </li>
            <li>
              Send a document/photo/video in any group topic. It will sync automatically!
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
