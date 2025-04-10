// --- DOM Elemente ---
const usernameOverlay = document.getElementById('username-overlay');
const usernameInput = document.getElementById('username-input');
const startGameButton = document.getElementById('start-game-button');
const gameContainer = document.getElementById('game-container');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendButton = document.getElementById('chat-send-button');
const killCounterDisplay = document.getElementById('kill-count');

// --- Spiel Zustand ---
let localPlayerId = null;
let username = "Anon";
let players = {}; // Speichert alle Spieler { id: { x, y, mx, my, kills, emoji, name, element, cursorElement, nameElement } }
let keysPressed = {}; // Hält gedrückte Tasten
let localKills = 0;
const playerSpeed = 5;
const hitDistance = 50; // Wie nah man sein muss, um zu treffen (Pixel)
const hitCooldown = 500; // Millisekunden zwischen Schlägen
let canHit = true;

const possibleEmojis = ["😀", "😎", "🥳", "👽", "🤖", "👻", "👾", "🦊", "🐻", "🐼", "👑", " V "];
const cursorEmoji = "🖱️"; // Oder ein anderes Emoji für den Cursor

// --- WebSocket Simulation ---
// In einer echten Anwendung würdest du hier eine WebSocket-Verbindung aufbauen
// const socket = new WebSocket('ws://dein-server.de');
// socket.onmessage = handleServerMessage;
// function sendMessageToServer(type, data) { socket.send(JSON.stringify({ type, ...data })); }

// --- Hilfsfunktionen ---
function generateUniqueId() {
    return Math.random().toString(36).substring(2, 15);
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

// --- Spieler Erstellung / Entfernung ---
function createPlayerElement(id, data) {
    const playerDiv = document.createElement('div');
    playerDiv.classList.add('player');
    playerDiv.id = `player-${id}`;
    playerDiv.style.left = `${data.x}px`;
    playerDiv.style.top = `${data.y}px`;

    const emojiSpan = document.createElement('span');
    emojiSpan.classList.add('player-emoji');
    emojiSpan.textContent = data.emoji;

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('player-name');
    nameSpan.textContent = data.name;

    playerDiv.appendChild(emojiSpan);
    playerDiv.appendChild(nameSpan);
    gameContainer.appendChild(playerDiv);

    const cursorDiv = document.createElement('div');
    cursorDiv.classList.add('cursor');
    cursorDiv.id = `cursor-${id}`;
    cursorDiv.textContent = cursorEmoji;
    cursorDiv.style.left = `${data.mx}px`;
    cursorDiv.style.top = `${data.my}px`;
    cursorDiv.style.display = (id === localPlayerId) ? 'none' : 'block'; // Eigenen Cursor nicht anzeigen
    gameContainer.appendChild(cursorDiv);

    return { element: playerDiv, cursorElement: cursorDiv, nameElement: nameSpan };
}

function removePlayerElement(id) {
    const playerData = players[id];
    if (playerData) {
        playerData.element?.remove();
        playerData.cursorElement?.remove();
    }
}

// --- Spiel Logik ---
function updatePlayerPosition(id, x, y) {
    const player = players[id];
    if (!player) return;

    // Grenzen des Spielbereichs
    const containerRect = gameContainer.getBoundingClientRect();
    const playerRect = player.element.getBoundingClientRect(); // Ungefähre Größe

    player.x = Math.max(0, Math.min(containerRect.width - playerRect.width / 1.5, x)); // /1.5 ist Schätzung für Emoji-Breite
    player.y = Math.max(0, Math.min(containerRect.height - playerRect.height, y));

    player.element.style.left = `${player.x}px`;
    player.element.style.top = `${player.y}px`;
}

function updatePlayerCursor(id, mx, my) {
    const player = players[id];
    if (!player || !player.cursorElement) return;

    player.mx = mx;
    player.my = my;
    player.cursorElement.style.left = `${mx}px`;
    player.cursorElement.style.top = `${my}px`;
}

function updatePlayerName(id, name) {
     const player = players[id];
     if (!player || !player.nameElement) return;
     player.name = name;
     player.nameElement.textContent = name;
}

function updateKillCounter() {
    killCounterDisplay.textContent = localKills;
}

function handleMovement() {
    if (!players[localPlayerId]) return;

    let dx = 0;
    let dy = 0;

    if (keysPressed['w'] || keysPressed['ArrowUp']) dy -= playerSpeed;
    if (keysPressed['s'] || keysPressed['ArrowDown']) dy += playerSpeed;
    if (keysPressed['a'] || keysPressed['ArrowLeft']) dx -= playerSpeed;
    if (keysPressed['d'] || keysPressed['ArrowRight']) dx += playerSpeed;

    if (dx !== 0 || dy !== 0) {
        const currentX = players[localPlayerId].x;
        const currentY = players[localPlayerId].y;
        updatePlayerPosition(localPlayerId, currentX + dx, currentY + dy);
        // --- SIMULATION: Sende Update an Server ---
        sendMyUpdate();
    }
}

function handleHit() {
    if (!canHit || !players[localPlayerId]) return;

    canHit = false;
    players[localPlayerId].element.classList.add('hit');

    const localPlayer = players[localPlayerId];
    let hitSomeone = false;

    for (const id in players) {
        if (id === localPlayerId) continue; // Sich selbst nicht treffen

        const targetPlayer = players[id];
        const dist = distance(localPlayer.x, localPlayer.y, targetPlayer.x, targetPlayer.y);

        if (dist < hitDistance) {
            console.log(`Hitting player ${targetPlayer.name} (ID: ${id})`);
            // --- SIMULATION: Sende Hit an Server ---
            // sendMessageToServer('hit', { targetId: id });
            // --- Direkte Simulation für Demo ---
            handleServerHitConfirmation({ attackerId: localPlayerId, victimId: id });
            hitSomeone = true;
            break; // Nur einen pro Klick treffen (optional)
        }
    }

     // --- SIMULATION: Sende Schlag-Aktion (auch wenn nichts getroffen) ---
     sendMyUpdate(true); // 'true' signalisiert Schlag-Aktion

    // Cooldown und Animation zurücksetzen
    setTimeout(() => {
        canHit = true;
        if (players[localPlayerId]) {
             players[localPlayerId].element.classList.remove('hit');
        }
         // --- SIMULATION: Sende Update nach Schlag-Animation ---
         sendMyUpdate(false);
    }, hitCooldown);
}

// --- Chat Logik ---
function addChatMessage(sender, message, isSystem = false) {
    const messageElement = document.createElement('p');
    if (isSystem) {
        messageElement.innerHTML = `<i>${message}</i>`;
    } else {
        messageElement.innerHTML = `<b>${sender}:</b> ${escapeHtml(message)}`;
    }
    chatMessages.appendChild(messageElement);
    // Auto-scroll nach unten
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message && localPlayerId) {
        // --- SIMULATION: Sende Chat an Server ---
        // sendMessageToServer('chat', { message: message });
        // --- Direkte Anzeige für Demo ---
        addChatMessage(players[localPlayerId].name, message);
        chatInput.value = '';
    }
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, """)
         .replace(/'/g, "'");
}

// --- Event Listener ---
function setupEventListeners() {
    // Tastatur
    window.addEventListener('keydown', (e) => {
        keysPressed[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
        keysPressed[e.key.toLowerCase()] = false;
    });

    // Maus Bewegung
    gameContainer.addEventListener('mousemove', (e) => {
        if (!players[localPlayerId]) return;
        const rect = gameContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        updatePlayerCursor(localPlayerId, mouseX, mouseY);
        // --- SIMULATION: Sende Update an Server ---
         sendMyUpdate();
    });

    // Maus Klick (Schlagen)
    gameContainer.addEventListener('click', (e) => {
        handleHit();
    });

    // Chat Senden
    chatSendButton.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Spiel Start
    startGameButton.addEventListener('click', startGame);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startGame();
        }
    });
}

// --- Spiel Start ---
function startGame() {
    username = usernameInput.value.trim() || `Anon${Math.floor(Math.random() * 100)}`;
    username = username.substring(0, 12); // Namen kürzen
    usernameOverlay.style.display = 'none'; // Overlay ausblenden

    localPlayerId = generateUniqueId();
    const startX = Math.random() * (gameContainer.clientWidth - 50);
    const startY = Math.random() * (gameContainer.clientHeight - 50);
    const startEmoji = getRandomElement(possibleEmojis);

    players[localPlayerId] = {
        x: startX,
        y: startY,
        mx: startX, // Maus startet beim Spieler
        my: startY,
        kills: 0,
        emoji: startEmoji,
        name: username,
        element: null, // Wird in createPlayerElement gesetzt
        cursorElement: null,
        nameElement: null,
        isHitting: false // Für Animation
    };

    const elements = createPlayerElement(localPlayerId, players[localPlayerId]);
    players[localPlayerId].element = elements.element;
    players[localPlayerId].cursorElement = elements.cursorElement;
    players[localPlayerId].nameElement = elements.nameElement;
    players[localPlayerId].cursorElement.style.display = 'none'; // Eigenen Cursor verstecken

    localKills = 0;
    updateKillCounter();
    addChatMessage(null, `Du bist als ${username} (${startEmoji}) beigetreten!`, true);

    // --- SIMULATION: Sende "Join" Nachricht an Server ---
    // sendMessageToServer('join', { id: localPlayerId, ...players[localPlayerId] });

    // --- SIMULATION: Füge ein paar Dummy-Bots hinzu ---
    setTimeout(() => simulateAddBot("Bot1", "🤖"), 1000);
    setTimeout(() => simulateAddBot("Bot2", "👻"), 2000);

    // Starte den Game Loop
    requestAnimationFrame(gameLoop);
}

// --- Game Loop ---
function gameLoop() {
    handleMovement(); // Lokale Bewegung verarbeiten

    // --- SIMULATION: Bot Bewegung ---
    simulateBotMovement();

    // (In einem echten Spiel würde hier nichts gerendert,
    // das passiert durch die Server-Nachrichten)

    requestAnimationFrame(gameLoop);
}

// --- WebSocket Nachrichten Behandlung (SIMULIERT) ---

// Simuliert das Empfangen einer Nachricht vom Server
function handleServerMessage(message) {
    // In echt: const data = JSON.parse(message.data);
    const data = message; // Direkte Übergabe in der Simulation

    switch (data.type) {
        case 'playerJoined':
            if (data.id !== localPlayerId && !players[data.id]) {
                console.log("Sim: Player joined", data);
                players[data.id] = { ...data, element: null, cursorElement: null, nameElement: null, isHitting: false };
                const elements = createPlayerElement(data.id, data);
                players[data.id].element = elements.element;
                players[data.id].cursorElement = elements.cursorElement;
                players[data.id].nameElement = elements.nameElement;
                addChatMessage(null, `${data.name} (${data.emoji}) ist beigetreten.`, true);
            }
            break;
        case 'playerLeft':
            if (data.id !== localPlayerId && players[data.id]) {
                console.log("Sim: Player left", data);
                addChatMessage(null, `${players[data.id].name} hat das Spiel verlassen.`, true);
                removePlayerElement(data.id);
                delete players[data.id];
            }
            break;
        case 'playerUpdate':
            if (data.id !== localPlayerId && players[data.id]) {
                // console.log("Sim: Player update", data);
                updatePlayerPosition(data.id, data.x, data.y);
                updatePlayerCursor(data.id, data.mx, data.my);
                 // Schlag-Animation anzeigen/entfernen
                 if (data.isHitting && !players[data.id].isHitting) {
                     players[data.id].element.classList.add('hit');
                     players[data.id].isHitting = true;
                 } else if (!data.isHitting && players[data.id].isHitting) {
                     players[data.id].element.classList.remove('hit');
                     players[data.id].isHitting = false;
                 }
            }
            break;
        case 'chat':
             if (data.senderId !== localPlayerId && players[data.senderId]) {
                 console.log("Sim: Chat received", data);
                 addChatMessage(players[data.senderId].name, data.message);
             }
            break;
        case 'hitConfirmation': // Server bestätigt einen Treffer
             console.log("Sim: Hit confirmation", data);
             handleServerHitConfirmation(data);
             break;
        // Weitere Nachrichten-Typen...
    }
}

function handleServerHitConfirmation({ attackerId, victimId }) {
    const attacker = players[attackerId];
    const victim = players[victimId];

    if (!attacker || !victim) return;

    // Kills für Angreifer erhöhen
    attacker.kills = (attacker.kills || 0) + 1;
    if (attackerId === localPlayerId) {
        localKills = attacker.kills;
        updateKillCounter();
    }
    // Optional: Name aktualisieren, wenn Kills angezeigt werden sollen
    // updatePlayerName(attackerId, `${attacker.name} [${attacker.kills}]`);

    // Kills für Opfer zurücksetzen und respawnen
    victim.kills = 0;
    if (victimId === localPlayerId) {
        localKills = 0;
        updateKillCounter();
        addChatMessage(null, `Du wurdest von ${attacker.name} getroffen! Deine Kills wurden zurückgesetzt.`, true);
    } else {
         addChatMessage(null, `${attacker.name} hat ${victim.name} getroffen!`, true);
    }
    // updatePlayerName(victimId, `${victim.name} [0]`); // Update Name mit 0 Kills


    // Opfer an zufälliger Position respawnen
    const respawnX = Math.random() * (gameContainer.clientWidth - 50);
    const respawnY = Math.random() * (gameContainer.clientHeight - 50);
    updatePlayerPosition(victimId, respawnX, respawnY);

    // --- SIMULATION: Server würde allen dieses Update senden ---
    // (Nicht nötig in reiner Client-Simulation, da wir direkt manipulieren)
}


// Simuliert das Senden des eigenen Zustands an den Server
let lastUpdateTime = 0;
const updateInterval = 50; // Send update every 50ms

function sendMyUpdate(isHittingUpdate = false) {
    const now = Date.now();
    if (!localPlayerId || (!isHittingUpdate && now - lastUpdateTime < updateInterval)) {
        // Nicht zu oft senden, außer wenn es ein explizites Schlag-Update ist
        return;
    }
    lastUpdateTime = now;

    const localPlayer = players[localPlayerId];
    const data = {
        type: 'playerUpdate',
        id: localPlayerId,
        x: localPlayer.x,
        y: localPlayer.y,
        mx: localPlayer.mx,
        my: localPlayer.my,
        // Sende isHitting nur, wenn es sich gerade ändert (oder explizit gewünscht)
        isHitting: isHittingUpdate ? localPlayer.element.classList.contains('hit') : localPlayer.isHitting
    };
     // --- SIMULATION: Senden an Server ---
     // sendMessageToServer('playerUpdate', data);

     // --- SIMULATION: Empfange eigene Nachricht (für Debugging/Konsistenz) ---
     // In echt wäre das unnötig
     // handleServerMessage(data);
}

// --- Bot Simulation (Nur für Demo-Zwecke) ---
let botTargetPositions = {};

function simulateAddBot(name, emoji) {
    const botId = generateUniqueId();
    const botData = {
        id: botId,
        x: Math.random() * (gameContainer.clientWidth - 50),
        y: Math.random() * (gameContainer.clientHeight - 50),
        mx: 0, my: 0, // Bots haben keine Maus
        kills: 0,
        emoji: emoji,
        name: name,
        isBot: true
    };
    // Simuliere "playerJoined" Nachricht vom Server
    handleServerMessage({ type: 'playerJoined', ...botData });
    botTargetPositions[botId] = { x: botData.x, y: botData.y }; // Startziel
}

function simulateBotMovement() {
    const botSpeed = 1; // Langsamer als Spieler
    for (const id in players) {
        if (players[id].isBot) {
            const bot = players[id];
            let target = botTargetPositions[id];

            // Wenn Ziel erreicht oder kein Ziel, neues zufälliges Ziel setzen
            if (!target || distance(bot.x, bot.y, target.x, target.y) < 10) {
                 target = {
                     x: Math.random() * (gameContainer.clientWidth - 50),
                     y: Math.random() * (gameContainer.clientHeight - 50)
                 };
                 botTargetPositions[id] = target;
            }

            // Einfache Bewegung Richtung Ziel
            let dx = 0;
            let dy = 0;
            if (bot.x < target.x) dx = botSpeed;
            else if (bot.x > target.x) dx = -botSpeed;
            if (bot.y < target.y) dy = botSpeed;
            else if (bot.y > target.y) dy = -botSpeed;

            const newX = bot.x + dx;
            const newY = bot.y + dy;

            // Simuliere eine "playerUpdate"-Nachricht für den Bot
            handleServerMessage({
                type: 'playerUpdate',
                id: id,
                x: newX,
                y: newY,
                mx: bot.mx, // Bleibt 0
                my: bot.my, // Bleibt 0
                isHitting: false // Bots schlagen hier nicht
            });
        }
    }
}


// --- Initialisierung ---
setupEventListeners();
// Warte nicht auf DOMContentLoaded, da das Script am Ende des Body steht
// init(); // Start wird jetzt durch Button ausgelöst
