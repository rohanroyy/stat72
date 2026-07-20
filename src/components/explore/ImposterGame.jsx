import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function ImposterGame({ onClose }) {
  const [mode, setMode] = useState('lobby'); // 'lobby' | 'room' | 'game'
  const [roomCode, setRoomCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [players, setPlayers] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [myPlayerName, setMyPlayerName] = useState('You');

  // Notifications for join/leave popup
  const [notifications, setNotifications] = useState([]);

  // Game states
  const [gameStatus, setGameStatus] = useState('waiting'); // 'waiting' | 'roles' | 'prompt' | 'drawing' | 'voting' | 'gameover'
  const [leadId, setLeadId] = useState('');
  const [imposterId, setIsImposterId] = useState('');
  const [secretPrompt, setSecretPrompt] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [strokesThisTurn, setStrokesThisTurn] = useState([]);
  const [allStrokes, setAllStrokes] = useState([]); // Array of { points: [{x,y},...], player: string }
  const [liveDrawerName, setLiveDrawerName] = useState('');
  const [votes, setVotes] = useState({}); // playerId -> vote count
  const [hasVoted, setHasVoted] = useState(false);
  const [voteTimer, setVoteTimer] = useState(10);
  const [revealTimer, setRevealTimer] = useState(5);
  const [promptTimer, setPromptTimer] = useState(10);
  const [gameResult, setGameResult] = useState(null); // { imposterWon: bool, removedPlayer: object }

  // Canvas drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);

  const canvasRef = useRef(null);
  const channelRef = useRef(null);

  // Generate 6-digit random code (mix of capital letters and numbers)
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Add a self-destructing notification
  const addNotification = (text) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  // Handle room creation
  const handleCreateRoom = () => {
    const code = generateRoomCode();
    setRoomCode(code);

    const selfId = 'player_' + Math.random().toString(36).substr(2, 9);
    setMyPlayerId(selfId);

    // Get current user's name if logged in
    let loggedInName = 'Player 1';
    try {
      const stored = localStorage.getItem('bahattor_logged_in_student');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name) loggedInName = parsed.name;
      }
    } catch (_) { }
    setMyPlayerName(loggedInName);

    const hostPlayer = {
      id: selfId,
      name: loggedInName,
      isHost: true,
      isActive: true
    };

    setPlayers([hostPlayer]);
    setMode('room');
    addNotification('Room created successfully!');

    if (isSupabaseConfigured()) {
      setupRealtimeChannel(code, selfId, loggedInName, true);
    }
  };

  // Handle room join
  const handleJoinRoom = () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (code.length !== 6) {
      alert('Please enter a valid 6-digit room code.');
      return;
    }
    setRoomCode(code);

    const selfId = 'player_' + Math.random().toString(36).substr(2, 9);
    setMyPlayerId(selfId);

    let loggedInName = 'Player ' + Math.floor(Math.random() * 100);
    try {
      const stored = localStorage.getItem('bahattor_logged_in_student');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name) loggedInName = parsed.name;
      }
    } catch (_) { }
    setMyPlayerName(loggedInName);

    setMode('room');

    if (isSupabaseConfigured()) {
      setupRealtimeChannel(code, selfId, loggedInName, false);
    } else {
      // Offline fallback: fake successful join
      const hostPlayer = { id: 'host_offline', name: 'Offline Host', isHost: true, isActive: true };
      const selfPlayer = { id: selfId, name: loggedInName, isHost: false, isActive: true };
      setPlayers([hostPlayer, selfPlayer]);
      addNotification('Joined Room (Offline Fallback)');
    }
  };

  // Realtime Supabase Setup
  const setupRealtimeChannel = (code, selfId, name, isHost) => {
    const channel = supabase.channel(`imposter-room-${code}`, {
      config: { broadcast: { self: true } }
    });

    channelRef.current = channel;

    channel.on('broadcast', { event: 'player_joined' }, ({ payload }) => {
      setPlayers(prev => {
        if (prev.some(p => p.id === payload.id)) return prev;
        addNotification(`${payload.name} joined the room.`);
        const updated = [...prev, { id: payload.id, name: payload.name, isHost: payload.isHost, isActive: true }];
        // If we are host, broadcast current players list to update new joiner
        if (isHost) {
          channel.send({
            type: 'broadcast',
            event: 'sync_players',
            payload: { players: updated }
          });
        }
        return updated;
      });
    });

    channel.on('broadcast', { event: 'sync_players' }, ({ payload }) => {
      setPlayers(payload.players);
    });

    channel.on('broadcast', { event: 'player_left' }, ({ payload }) => {
      setPlayers(prev => {
        const leaving = prev.find(p => p.id === payload.id);
        if (leaving) addNotification(`${leaving.name} left the room.`);
        return prev.filter(p => p.id !== payload.id);
      });
    });

    channel.on('broadcast', { event: 'start_game' }, ({ payload }) => {
      setLeadId(payload.leadId);
      setIsImposterId(payload.imposterId);
      setGameStatus('roles');
      setMode('game');
      setRevealTimer(5);
    });

    channel.on('broadcast', { event: 'submit_prompt' }, ({ payload }) => {
      setSecretPrompt(payload.prompt);
      setGameStatus('prompt');
      setPromptTimer(10);
    });

    channel.on('broadcast', { event: 'draw_point' }, ({ payload }) => {
      // Real-time canvas draw point sync
      setAllStrokes(prev => {
        const updated = [...prev];
        if (payload.isNewStroke || updated.length === 0) {
          updated.push({ points: [{ x: payload.x, y: payload.y }], player: payload.playerName });
        } else {
          updated[updated.length - 1].points.push({ x: payload.x, y: payload.y });
        }
        return updated;
      });
    });

    channel.on('broadcast', { event: 'pass_turn' }, ({ payload }) => {
      setCurrentTurnIdx(payload.nextIdx);
      setStrokesThisTurn([]);
      setLiveDrawerName(payload.nextDrawerName);
      if (payload.isDrawingFinished) {
        setGameStatus('voting');
        setVoteTimer(10);
      }
    });

    channel.on('broadcast', { event: 'cast_vote' }, ({ payload }) => {
      setVotes(prev => ({
        ...prev,
        [payload.votedId]: (prev[payload.votedId] || 0) + 1
      }));
    });

    channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
      setGameResult(payload.result);
      setGameStatus('gameover');
    });

    channel.on('broadcast', { event: 'continue_game' }, ({ payload }) => {
      setPlayers(payload.players);
      setVotes({});
      setHasVoted(false);
      setGameResult(null);
      setGameStatus('drawing');
      setCurrentTurnIdx(0);
      setStrokesThisTurn([]);
      // Preserves allStrokes, ensuring canvas content remains exactly as paused
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'player_joined',
          payload: { id: selfId, name, isHost }
        });
      }
    });
  };

  // Leave room or exit game
  const handleLeaveRoom = () => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'player_left',
        payload: { id: myPlayerId }
      });
      channelRef.current.unsubscribe();
    }
    setMode('lobby');
    setPlayers([]);
    setAllStrokes([]);
    setGameStatus('waiting');
  };

  // Start game trigger (host only)
  const handleStartGame = () => {
    const activePlayers = players.filter(p => p.isActive);
    if (activePlayers.length < 3) {
      alert('Need at least 3 players to start the game.');
      return;
    }

    // Pick random lead and imposter
    const leadIdx = Math.floor(Math.random() * activePlayers.length);
    let imposterIdx = Math.floor(Math.random() * activePlayers.length);
    while (imposterIdx === leadIdx) {
      imposterIdx = Math.floor(Math.random() * activePlayers.length);
    }

    const leadPlayer = activePlayers[leadIdx];
    const imposterPlayer = activePlayers[imposterIdx];

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'start_game',
        payload: { leadId: leadPlayer.id, imposterId: imposterPlayer.id }
      });
    }
  };

  // Handlers for role reveal screen countdown
  useEffect(() => {
    if (gameStatus !== 'roles') return;
    const interval = setInterval(() => {
      setRevealTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameStatus('prompt');
          setPromptTimer(10);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStatus]);

  // Lead Prompt Submit
  const handlePromptSubmit = () => {
    const trimmed = promptInput.trim();
    if (!trimmed) return;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'submit_prompt',
        payload: { prompt: trimmed }
      });
    }
  };

  // Handlers for prompt screen countdown before drawing
  useEffect(() => {
    if (gameStatus !== 'prompt') return;

    const interval = setInterval(() => {
      setPromptTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameStatus('drawing');
          setCurrentTurnIdx(0);
          setStrokesThisTurn([]);
          setAllStrokes([]);
          // Set live drawer name
          const initialDrawer = players.filter(p => p.isActive)[0];
          setLiveDrawerName(initialDrawer ? initialDrawer.name : '');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStatus, secretPrompt, leadId, players]);

  // Canvas drawing functions
  const handleCanvasMouseDown = (e) => {
    if (gameStatus !== 'drawing') return;
    const activePlayers = players.filter(p => p.isActive);
    if (activePlayers[currentTurnIdx]?.id !== myPlayerId) return; // not my turn
    if (strokesThisTurn.length >= 2) return; // max 2 strokes

    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Support mouse & touch events
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    const firstPoint = { x, y };
    setCurrentPoints([firstPoint]);

    // Broadcast live drawing coordinate
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'draw_point',
        payload: { x, y, isNewStroke: true, playerName: myPlayerName }
      });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing || gameStatus !== 'drawing') return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    const newPoint = { x, y };
    setCurrentPoints(prev => [...prev, newPoint]);

    // Broadcast live drawing coordinate
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'draw_point',
        payload: { x, y, isNewStroke: false, playerName: myPlayerName }
      });
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length > 0) {
      const strokeObj = { points: currentPoints, player: myPlayerName };
      setAllStrokes(prev => [...prev, strokeObj]);
      setStrokesThisTurn(prev => [...prev, strokeObj]);
    }
    setCurrentPoints([]);
  };

  // Draw loop for Canvas updates
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#111111';

    // Draw past strokes
    allStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    // Draw current active stroke
    if (currentPoints.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      }
      ctx.stroke();
    }
  }, [allStrokes, currentPoints]);

  // Turn navigation for user
  const handlePassTurn = () => {
    if (strokesThisTurn.length < 1) {
      alert('You must draw at least 1 stroke before passing.');
      return;
    }
    const activePlayers = players.filter(p => p.isActive);
    const nextIdx = currentTurnIdx + 1;
    const isFinished = nextIdx >= activePlayers.length;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'pass_turn',
        payload: {
          nextIdx,
          isDrawingFinished: isFinished,
          nextDrawerName: isFinished ? '' : (activePlayers[nextIdx] ? activePlayers[nextIdx].name : '')
        }
      });
    }
  };

  // Voting Phase timer logic
  useEffect(() => {
    if (gameStatus !== 'voting') return;

    const interval = setInterval(() => {
      setVoteTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          tallyVotes();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStatus, hasVoted, players]);

  const handleCastVote = (targetPlayerId) => {
    if (hasVoted) return;
    setHasVoted(true);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'cast_vote',
        payload: { votedId: targetPlayerId }
      });
    }
  };

  const tallyVotes = () => {
    const activePlayers = players.filter(p => p.isActive);
    let maxVotes = -1;
    let votedOutId = '';

    activePlayers.forEach(p => {
      const count = votes[p.id] || 0;
      if (count > maxVotes) {
        maxVotes = count;
        votedOutId = p.id;
      }
    });

    const votedOutPlayer = activePlayers.find(p => p.id === votedOutId);
    if (!votedOutPlayer) return;

    const isImposterCaught = votedOutPlayer.id === imposterId;

    const result = {
      imposterWon: !isImposterCaught,
      removedPlayer: votedOutPlayer
    };

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_over',
        payload: { result }
      });
    }
  };

  // Continue Game with remaining players (Preserves canvas state)
  const handleContinueGame = () => {
    if (!gameResult?.removedPlayer) return;

    const updatedPlayers = players.map(p => {
      if (p.id === gameResult.removedPlayer.id) {
        return { ...p, isActive: false };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    setVotes({});
    setHasVoted(false);
    setGameResult(null);

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'continue_game',
        payload: { players: updatedPlayers }
      });
      // Host triggers turn reset starting with index 0
      const activePlayers = updatedPlayers.filter(p => p.isActive);
      channelRef.current.send({
        type: 'broadcast',
        event: 'pass_turn',
        payload: {
          nextIdx: 0,
          isDrawingFinished: false,
          nextDrawerName: activePlayers[0] ? activePlayers[0].name : ''
        }
      });
    }
    setGameStatus('drawing');
  };

  // New Game Trigger
  const handleNewGame = () => {
    // Reset all actives
    const resetPlayers = players.map(p => ({ ...p, isActive: true }));
    setPlayers(resetPlayers);
    setVotes({});
    setHasVoted(false);
    setSecretPrompt('');
    setPromptInput('');
    setAllStrokes([]);
    setStrokesThisTurn([]);
    setGameResult(null);

    if (channelRef.current) {
      // Host assigns roles
      const leadIdx = Math.floor(Math.random() * resetPlayers.length);
      let imposterIdx = Math.floor(Math.random() * resetPlayers.length);
      while (imposterIdx === leadIdx) {
        imposterIdx = Math.floor(Math.random() * resetPlayers.length);
      }
      channelRef.current.send({
        type: 'broadcast',
        event: 'start_game',
        payload: { leadId: resetPlayers[leadIdx].id, imposterId: resetPlayers[imposterIdx].id }
      });
    }
  };

  return (
    <div className="imposter-game-overlay">
      {/* Notifications Panel */}
      <div className="imposter-notifications">
        {notifications.map(n => (
          <div key={n.id} className="imposter-toast">{n.text}</div>
        ))}
      </div>

      {/* Top Header Row with Exit Button */}
      <div className="imposter-top-bar">
        <span className="game-header-logo">🕵️‍♂️ Guess the Imposter</span>
        <button className="imposter-exit-btn" onClick={onClose}>Exit</button>
      </div>

      {/* Main Container */}
      <div className="imposter-main-content">
        {mode === 'lobby' && (
          <div className="game-lobby-view">
            <h2>Select Game Mode</h2>
            <div className="lobby-options-container" style={{ gridTemplateColumns: '1fr' }}>
              <button className="lobby-big-btn select-multi-mode" onClick={handleCreateRoom}>
                <span className="btn-icon">⚡</span>
                <span className="btn-title">Create Multiplayer Room</span>
                <span className="btn-desc">Get a 6-digit code to invite others</span>
              </button>
            </div>

            <div className="lobby-join-section">
              <h3>Or Join a Room</h3>
              <div className="join-form-row">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                />
                <button className="join-submit-btn" onClick={handleJoinRoom}>Join Room</button>
              </div>
            </div>

            <div className="lobby-instructions-card">
              <h4>Game Rules</h4>
              <ul>
                <li>একজন <strong>Lead</strong> আর একজন <strong>Imposter</strong> হিসেবে সিলেক্ট হবে।</li>
                <li>লিড একটা Secret Word বেছে নেবে, যেটা ইম্পোস্টার ছাড়া বাকি সবাই দেখতে পাবে।</li>
                <li>সবাই মিলে এক ক্যানভাসেই পালাক্রমে ছবি আঁকবে।</li>
                <li>পরের জনের কাছে ক্যানভাস পাস করার আগে তুমি <strong>সর্বোচ্চ ১ বা ২ টা</strong> লাইন আঁকতে পারবে।</li>
                <li>রাউন্ড শেষে কাকে ইম্পোস্টার মনে হচ্ছে, তাকে ভোট দাও!</li>
              </ul>
            </div>
          </div>
        )}

        {mode === 'room' && (
          <div className="game-room-view">
            <div className="room-code-display">
              <span className="code-label">ROOM CODE</span>
              <span className="code-value">{roomCode}</span>
            </div>

            <div className="room-players-panel">
              <h3>Players in Room ({players.length})</h3>
              <div className="players-list-grid">
                {players.map(player => (
                  <div key={player.id} className="player-row-card">
                    <span className="player-avatar-placeholder">👤</span>
                    <span className="player-name-text">{player.name}</span>
                    {player.isHost && <span className="host-badge">Host</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="room-actions-bar">
              <button className="room-leave-btn" onClick={handleLeaveRoom}>Leave Room</button>
              {players.find(p => p.id === myPlayerId)?.isHost && (
                <div className="host-actions-group">
                  <button className="room-start-btn" onClick={handleStartGame} disabled={players.length < 3}>
                    Start Game
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'game' && (
          <div className="game-active-view">
            {/* Phase 1: Role Reveal Screen */}
            {gameStatus === 'roles' && (
              <div className={`roles-reveal-overlay role-${myPlayerId === imposterId ? 'imposter' : myPlayerId === leadId ? 'lead' : 'normal'}`}>
                <div className="role-reveal-content">
                  {myPlayerId === imposterId ? (
                    <>
                      <span className="role-glowing-icon">🚨</span>
                      <h1>YOU ARE THE IMPOSTER</h1>
                      <p>Hide your identity and blend in with the drawing!</p>
                    </>
                  ) : myPlayerId === leadId ? (
                    <>
                      <span className="role-glowing-icon">✍️</span>
                      <h1>YOU ARE THE LEAD</h1>
                      <p>Choose the secret word for the normal players!</p>
                    </>
                  ) : (
                    <>
                      <span className="role-glowing-icon">🕵️‍♂️</span>
                      <h1>YOU ARE A NORMAL PLAYER</h1>
                      <p>Analyze drawings to catch the Imposter!</p>
                    </>
                  )}
                  <div className="countdown-ring">
                    <span>{revealTimer}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 2: Lead Prompt Input / Display Screen */}
            {gameStatus === 'prompt' && (
              <div className="prompt-phase-container">
                {myPlayerId === leadId ? (
                  <div className="lead-prompt-box">
                    <h2>Enter the Secret Word/Phrase</h2>
                    <input
                      type="text"
                      placeholder="e.g. Cat, Eiffel Tower, Guitar"
                      value={promptInput}
                      onChange={e => setPromptInput(e.target.value)}
                    />
                    <button onClick={handlePromptSubmit} disabled={!promptInput.trim()}>Submit Word</button>
                  </div>
                ) : (
                  <div className="player-prompt-waiting-box">
                    {secretPrompt ? (
                      <div className="secret-word-display">
                        <h2>SECRET WORD FOR THIS ROUND</h2>
                        {myPlayerId === imposterId ? (
                          <div className="imposter-hidden-prompt">
                            <span className="secret-censored">❓❓❓❓❓</span>
                            <p className="imposter-alert">You are the Imposter. The word is hidden from you!</p>
                          </div>
                        ) : (
                          <div className="secret-word-reveal">
                            <span className="secret-text">{secretPrompt}</span>
                          </div>
                        )}
                        <p className="timer-sub-info">Drawing starts in {promptTimer} seconds...</p>
                      </div>
                    ) : (
                      <div className="spinner-block">
                        <div className="spinner" />
                        <p>Waiting for the Lead to choose a word...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Phase 3: Drawing Canvas Screen */}
            {gameStatus === 'drawing' && (
              <div className="canvas-phase-container">
                <div className="canvas-header-banner">
                  <div className="prompt-indicator">
                    <span className="lbl">Secret Prompt:</span>
                    <span className="val">{myPlayerId === imposterId ? '❓❓❓' : secretPrompt}</span>
                  </div>
                  <div className="drawer-indicator">
                    <span className="drawer-label">Active:</span>
                    <span className="drawer-name">#{liveDrawerName} is drawing...</span>
                  </div>
                </div>

                <div className="canvas-container-box">
                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={380}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    onTouchStart={handleCanvasMouseDown}
                    onTouchMove={handleCanvasMouseMove}
                    onTouchEnd={handleCanvasMouseUp}
                  />
                </div>

                <div className="canvas-footer-bar">
                  {players.filter(p => p.isActive)[currentTurnIdx]?.id === myPlayerId ? (
                    <div className="your-turn-block">
                      <span className="turn-alert-pulse">🔴 Your Turn</span>
                      <span className="strokes-count">Strokes: {strokesThisTurn.length}/2</span>
                      <button
                        className="pass-turn-btn"
                        onClick={handlePassTurn}
                        disabled={strokesThisTurn.length < 1}
                      >
                        Pass Turn
                      </button>
                    </div>
                  ) : (
                    <span className="waiting-turn-alert">Please wait for your turn to draw...</span>
                  )}
                </div>
              </div>
            )}

            {/* Phase 4: Voting Overlay */}
            {gameStatus === 'voting' && (
              <div className="voting-overlay-container">
                <div className="voting-dialog">
                  <h2>🕵️‍♂️ Vote for the Imposter</h2>
                  <p>Which player has no clue what the word was? Vote now!</p>

                  <div className="timer-badge">
                    <span>{voteTimer}s left</span>
                  </div>

                  <div className="voting-grid">
                    {players.filter(p => p.isActive).map(player => {
                      const voteCount = votes[player.id] || 0;
                      return (
                        <button
                          key={player.id}
                          className={`vote-player-row ${hasVoted ? 'voted-disabled' : ''}`}
                          onClick={() => handleCastVote(player.id)}
                          disabled={hasVoted}
                        >
                          <span className="vote-p-name">{player.name}</span>
                          <div className="vote-dots-tray">
                            {Array.from({ length: voteCount }).map((_, i) => (
                              <span key={i} className="vote-red-dot" />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Phase 5: Game Over Screen */}
            {gameStatus === 'gameover' && gameResult && (
              <div className="game-over-overlay">
                <div className="game-over-dialog">
                  {gameResult.imposterWon ? (
                    <div className="over-status-block loss">
                      <span className="over-icon">🚨</span>
                      <h2>{gameResult.removedPlayer.name} is not the imposter!</h2>
                      <p>The Imposter is still among us...</p>
                    </div>
                  ) : (
                    <div className="over-status-block win">
                      <span className="over-icon">🏆</span>
                      <h2>Imposter Loss!</h2>
                      <p>The Imposter ({gameResult.removedPlayer.name}) was successfully identified!</p>
                    </div>
                  )}

                  <div className="over-actions-row">
                    {gameResult.imposterWon && (
                      <button className="continue-game-btn" onClick={handleContinueGame}>
                        Continue Game
                      </button>
                    )}
                    <button className="new-game-btn" onClick={handleNewGame}>
                      New Game
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
