/**
 * Guahh AI - Interface Controller with Chat History
 * Session management, sidebar, and chat interface
 */

// ========== SESSION MANAGEMENT ==========

// Global State
let activeChat, activeInput, activeBtn, logView, statusText;
let lastUserQuery = '';
const feedbackData = [];

// Session Management
let currentSession = null;
const STORAGE_KEY = 'guahh_chat_sessions';
const MAX_SESSIONS = 50; // Limit to prevent localStorage overflow

// Chat Sync Configuration
const CHAT_SYNC_ENABLED = true; // Master toggle for chat sync feature
const CHAT_SYNC_API_URL = 'https://script.google.com/macros/s/AKfycbwLOQB9KizyeOC07kNJHyfq_mRXj1HBWUmgZlzTUK06lcUdbIYXZkPJPpX4OqgyeAFYmg/exec';
let syncInProgress = false;
let lastSyncTime = null;


// Session Class
class ChatSession {
    constructor(id) {
        this.id = id || 'session_' + Date.now();
        this.title = 'New Chat';
        this.created = Date.now();
        this.lastUpdated = Date.now();
        this.messages = [];
    }

    addMessage(role, content) {
        this.messages.push({
            role, // 'user' or 'assistant'
            content,
            timestamp: Date.now()
        });
        this.lastUpdated = Date.now();

        // Auto-generate title from first user message
        if (role === 'user' && this.title === 'New Chat') {
            this.title = this.generateTitle(content);
        }
    }

    generateTitle(message) {
        const maxLength = 50;
        let title = message.trim();
        if (title.length > maxLength) {
            title = title.substring(0, maxLength) + '...';
        }
        return title;
    }
}

// Session Storage Functions
function getAllSessions() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error loading sessions:', e);
        return [];
    }
}

function saveSession(session) {
    try {
        let sessions = getAllSessions();

        // Update or add session
        const index = sessions.findIndex(s => s.id === session.id);
        if (index !== -1) {
            sessions[index] = session;
        } else {
            sessions.unshift(session); // Add to beginning
        }

        // Limit number of sessions
        if (sessions.length > MAX_SESSIONS) {
            sessions = sessions.slice(0, MAX_SESSIONS);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        renderSessionList();

        // Trigger cloud sync if enabled and user is logged in
        triggerCloudSync(session);
    } catch (e) {
        console.error('Error saving session:', e);
    }
}

async function deleteSession(sessionId) {
    try {
        let sessions = getAllSessions();
        sessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));

        // Update UI immediately for better UX
        if (currentSession && currentSession.id === sessionId) {
            createNewChat();
        } else {
            renderSessionList();
        }

        // Delete from cloud if sync is enabled
        const syncEnabled = localStorage.getItem('guahh_chat_sync_enabled') !== 'false';
        if (syncEnabled && GuahhAuthAPI && GuahhAuthAPI.isLoggedIn()) {
            await deleteSessionFromCloud(sessionId);
            // Sync after delete to ensure state is consistent
            await syncChatsFromCloud();
        }
    } catch (e) {
        console.error('Error deleting session:', e);
    }
}

function loadSession(sessionId) {
    const sessions = getAllSessions();
    const sessionData = sessions.find(s => s.id === sessionId);

    if (!sessionData) return;

    // Reconstruct session object
    currentSession = new ChatSession(sessionData.id);
    Object.assign(currentSession, sessionData);

    // Clear and reload messages
    if (activeChat) {
        activeChat.innerHTML = '';

        sessionData.messages.forEach(msg => {
            if (msg.role === 'user') {
                addMessage(msg.content, true);
            } else {
                // Skip typing animation for loaded messages
                const aiMsg = addMessage(msg.content, false, true);
                // Don't add feedback buttons to loaded messages
            }
        });
    }

    renderSessionList();
}

function createNewChat() {
    // Save current session if it has messages
    if (currentSession && currentSession.messages.length > 0) {
        saveSession(currentSession);
    }

    // Create new session
    currentSession = new ChatSession();

    // Clear chat area
    if (activeChat) {
        activeChat.innerHTML = '';
    }

    // Clear input
    if (activeInput) {
        activeInput.value = '';
        activeInput.style.height = 'auto';
    }

    renderSessionList();
}

function renderSessionList() {
    const sessionList = document.getElementById('sessionList');
    if (!sessionList) return;

    const sessions = getAllSessions();

    if (sessions.length === 0) {
        sessionList.innerHTML = '<div class="session-list-empty">No chat history yet.<br>Start a conversation!</div>';
        return;
    }

    sessionList.innerHTML = sessions.map(session => {
        const isActive = currentSession && currentSession.id === session.id;
        const date = new Date(session.lastUpdated);
        const dateStr = formatDate(date);

        return `
            <div class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
                <div class="session-text">
                    <div class="session-title">${escapeHtml(session.title)}</div>
                    <div class="session-date">${dateStr}</div>
                </div>
                <button class="session-delete" data-session-id="${session.id}" title="Delete chat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');

    // Add click handlers
    sessionList.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.session-delete')) {
                loadSession(item.dataset.sessionId);
                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    toggleSidebar();
                }
            }
        });
    });

    sessionList.querySelectorAll('.session-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(btn.dataset.sessionId);
        });
    });
}

function formatDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Sidebar Toggle (Mobile)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

// Fallback dictionary
const localFallbackMemory = [
    { q: "hi", a: "Hello! I am Guahh AI 1 (a). I'm running in Local Mode. My deep memory is offline, but I can still answer math questions and search Wikipedia! Try asking 'What is an apple?'", tokens: ["hi"] },
    { q: "hello", a: "Hello! I am Guahh AI 1 (a). I'm running in Local Mode. My deep memory is offline, but I can still answer math questions and search Wikipedia! Try asking 'What is an apple?'", tokens: ["hello"] },
    { q: "who are you", a: "I am Guahh AI 1 (a).", tokens: ["who", "are", "you"] }
];

// Make globally available for HTML onclick
window.sendMessage = async function () {
    console.log("sendMessage called");
    if (!activeInput) {
        console.error("Interface not initialized");
        return;
    }

    const text = activeInput.value.trim();
    if (!text) return;

    // CHECK PROMPT LIMIT
    if (!checkPromptLimit()) {
        const msg = addMessage("You have reached your daily limit of 30 prompts. Please log in with a Guahh Account for unlimited access.", false);
        // Add login button to the message
        const loginBtn = document.createElement('button');
        loginBtn.className = 'feedback-btn'; // Reuse style
        loginBtn.innerHTML = 'Sign In with Guahh Account';
        loginBtn.style.marginTop = '10px';
        loginBtn.onclick = () => GuahhAuthAPI.showLogin();
        msg.querySelector('.message-content').appendChild(loginBtn);
        return; // Stop execution
    }

    // Create session if none exists
    if (!currentSession) {
        currentSession = new ChatSession();
    }

    lastUserQuery = text;
    activeInput.value = '';
    activeInput.style.height = 'auto';
    activeBtn.disabled = true;

    // Add to session
    currentSession.addMessage('user', text);

    // User msg
    addMessage(text, true);

    // Show typing indicator
    const typingIndicator = addTypingIndicator();

    // Thought simulation delay
    await new Promise(r => setTimeout(r, 600));

    // Generate
    if (typeof GuahhEngine === 'undefined') {
        removeTypingIndicator(typingIndicator);
        addMessage("System Error: Neural Engine not loaded.", false);
        activeBtn.disabled = false;
        return;
    }

    // Lazy Init fallback if not ready
    if (!GuahhEngine.isReady) {
        console.warn("Engine not ready, forcing fallback init...");
        GuahhEngine.init(localFallbackMemory, logToTerminal);
        if (statusText) statusText.innerText = 'Guahh AI 1 (a) (Local)';

        // Sync user context after fallback init
        if (typeof GuahhAuthAPI !== 'undefined' && GuahhAuthAPI.isLoggedIn()) {
            const user = GuahhAuthAPI.getCurrentUser();
            if (user && GuahhEngine.setUser) {
                GuahhEngine.setUser({
                    displayName: user.displayName,
                    username: user.username,
                    userId: user.userId
                });
                console.log('[Guahh AI] User context synced after fallback init:', user.displayName);
            }
        }
    }

    if (!GuahhEngine.isReady) {
        // If STILL not ready
        removeTypingIndicator(typingIndicator);
        addMessage("System Error: Neural Core failed to initialize.", false);
        activeBtn.disabled = false;
        return;
    }

    // Get user's name if logged in
    let userName = null;
    if (typeof GuahhAuthAPI !== 'undefined' && GuahhAuthAPI.isLoggedIn()) {
        const user = GuahhAuthAPI.getCurrentUser();
        if (user && user.displayName) {
            userName = user.displayName;
        }
    }

    const result = await GuahhEngine.generateResponse(text, currentSession.messages, userName);

    // Remove typing indicator
    removeTypingIndicator(typingIndicator);

    // Add to session
    currentSession.addMessage('assistant', result.text);
    saveSession(currentSession);

    // Render AI Msg with feedback buttons
    const aiMessageElement = addMessage(result.text, false);
    addFeedbackButtons(aiMessageElement, lastUserQuery, result.text);

    activeBtn.disabled = false;
};

// Helper Functions
function addMessage(text, isUser, skipTyping = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'ai'}`;

    if (!isUser) {
        msgDiv.innerHTML = `
            <div class="message-label">Guahh AI 1 (a)</div>
            <div class="message-content"></div>
        `;
        const contentDiv = msgDiv.querySelector('.message-content');
        if (skipTyping) {
            // Show instantly for chat history
            contentDiv.innerHTML = formatMarkdown(text);
        } else {
            // Animated typing for new messages
            typeWriter(contentDiv, text);
        }
    } else {
        msgDiv.innerHTML = `
            <div class="message-label">You</div>
            <div class="message-content">${text}</div>
        `;
    }

    if (activeChat) {
        activeChat.appendChild(msgDiv);
        activeChat.scrollTop = activeChat.scrollHeight;
    }
    return msgDiv;
}

function typeWriter(element, text) {
    const words = text.split(' '); // Split by words
    let wordIndex = 0;
    const speed = 70; // Slower speed for "thinking" feel

    function type() {
        if (wordIndex < words.length) {
            // Build text word by word
            const currentText = words.slice(0, wordIndex + 1).join(' ');
            element.innerHTML = formatMarkdown(currentText);
            wordIndex++;
            if (activeChat) activeChat.scrollTop = activeChat.scrollHeight;
            setTimeout(type, speed);
        } else {
            // When done typing, apply full markdown formatting
            element.innerHTML = formatMarkdown(text);
            if (activeChat) activeChat.scrollTop = activeChat.scrollHeight;
        }
    }
    type();
}

function formatMarkdown(text) {
    if (!text) return '';

    let processed = text;

    // 1. Extract Closed Code Blocks (```language ... ```)
    const codeBlocks = [];
    processed = processed.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const index = codeBlocks.length;
        codeBlocks.push({ lang, code });
        return `__CODE_BLOCK_${index}__`;
    });

    // 2. Handle Unclosed Code Block at the end (for animation)
    // If text ends with ```lang ... (and no closing ```)
    const openBlockMatch = processed.match(/```(\w*)\n([\s\S]*)$/);
    let openBlockReplacement = '';
    if (openBlockMatch) {
        const lang = openBlockMatch[1];
        const code = openBlockMatch[2];
        // Remove the raw markdown from processed text so we can append the styled block
        processed = processed.substring(0, openBlockMatch.index);
        // Create the styling for the open block
        const languageClass = lang ? `language-${lang}` : '';
        openBlockReplacement = `<pre><code class="${languageClass}">${escapeHtml(code)}</code></pre>`;
    }

    // 3. Inline Code (`...`)
    const inlineCode = [];
    processed = processed.replace(/`([^`]+)`/g, (match, code) => {
        const index = inlineCode.length;
        inlineCode.push(code);
        return `__INLINE_CODE_${index}__`;
    });

    // 4. Basic Formatting
    processed = processed
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold
        .replace(/\*(.*?)\*/g, '<i>$1</i>')     // Italic
        .replace(/\n/g, '<br>');                 // Newlines

    // 5. Restore Inline Code
    processed = processed.replace(/__INLINE_CODE_(\d+)__/g, (match, index) => {
        return `<code class="inline-code">${escapeHtml(inlineCode[index])}</code>`;
    });

    // 6. Restore Closed Code Blocks
    processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
        const block = codeBlocks[index];
        const languageClass = block.lang ? `language-${block.lang}` : '';
        return `<pre><code class="${languageClass}">${escapeHtml(block.code.trim())}</code></pre>`;
    });

    // 7. Append the Open Block (if any)
    processed += openBlockReplacement;

    return processed;
}

// Helper to prevent HTML injection in code
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-label">Guahh AI 1 (a)</div>
        <div class="message-content">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </div>
    `;
    if (activeChat) {
        activeChat.appendChild(typingDiv);
        activeChat.scrollTop = activeChat.scrollHeight;
    }
    return typingDiv;
}

function removeTypingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
    }
}

function addFeedbackButtons(messageElement, query, response) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'feedback-buttons';

    // ... (Feedback button logic remains the same but concise for now)
    const goodBtn = createBtn('👍', 'Good');
    const badBtn = createBtn('👎', 'Bad');

    goodBtn.onclick = () => handleFeedback(goodBtn, badBtn, query, response, 'good');
    badBtn.onclick = () => handleFeedback(badBtn, goodBtn, query, response, 'bad');

    feedbackDiv.appendChild(goodBtn);
    feedbackDiv.appendChild(badBtn);
    messageElement.appendChild(feedbackDiv);
}

function createBtn(icon, text) {
    const btn = document.createElement('button');
    btn.className = 'feedback-btn';
    btn.innerHTML = `<span>${icon}</span> ${text}`;
    return btn;
}

function handleFeedback(clickedBtn, otherBtn, query, response, rating) {
    logFeedback(query, response, rating);
    clickedBtn.classList.add('selected');
    clickedBtn.classList.add(rating);
    otherBtn.disabled = true;
    clickedBtn.disabled = true;
    otherBtn.style.opacity = '0.3';

    // If negative feedback, show refinement options
    if (rating === 'bad') {
        console.log("Feedback logged: User disliked response");
        // Removed detailed feedback options as per user request
    }
}

function showFeedbackOptions(parentDiv, query, response) {
    // Check if options already exist
    if (parentDiv.querySelector('.feedback-options')) return;

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'feedback-options';

    const options = [
        { label: "Too Long", value: "too_long" },
        { label: "Too Short", value: "too_short" },
        { label: "Too Simple", value: "too_simple" },
        { label: "Too Complex", value: "too_complex" },
        { label: "Inaccurate", value: "inaccurate" },
        { label: "Wrong Tone", value: "wrong_tone" }
    ];

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'feedback-option-btn';
        btn.textContent = opt.label;
        btn.onclick = () => {
            // Disable all option buttons
            const allBtns = optionsDiv.querySelectorAll('.feedback-option-btn');
            allBtns.forEach(b => b.disabled = true);
            btn.classList.add('selected');

            // Trigger regeneration
            triggerRegeneration(query, opt.value, response);
        };
        optionsDiv.appendChild(btn);
    });

    parentDiv.appendChild(optionsDiv);
}

async function triggerRegeneration(query, issueType, originalResponse) {
    // Show AI is working
    const typingIndicator = addTypingIndicator();
    activeChat.scrollTop = activeChat.scrollHeight;

    try {
        const result = await GuahhEngine.generateRefinedResponse(query, issueType, originalResponse);

        removeTypingIndicator(typingIndicator);

        // Add specific intro based on issue
        let intro = "Let me try to improve that.";
        if (issueType === 'too_simple') intro = "I'll elaborate with more detail.";
        if (issueType === 'too_complex') intro = "I'll simplify that explanation.";
        if (issueType === 'inaccurate') intro = "Let me correct that information.";

        const fullText = `**${intro}**\n\n${result.text}`;

        const newMsg = addMessage(fullText, false);
        currentSession.addMessage('assistant', fullText);
        saveSession(currentSession);

        // Add feedback buttons to the new message too (recursive improvement!)
        addFeedbackButtons(newMsg, query, fullText);

    } catch (e) {
        console.error(e);
        removeTypingIndicator(typingIndicator);
        addMessage("Sorry, I couldn't regenerate the response.", false);
    }
}

function logToTerminal(msg, type = "info") {
    if (!logView) return;
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    div.innerHTML = `<span style="opacity:0.5">[${time}]</span> ${msg}`;
    logView.appendChild(div);
    logView.scrollTop = logView.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
    // Refs
    activeChat = document.getElementById('chatArea') || document.getElementById('chat-viewport');
    logView = document.getElementById('neural-log');
    activeInput = document.getElementById('userInput') || document.getElementById('user-input');
    activeBtn = document.getElementById('sendBtn') || document.getElementById('send-btn');
    statusText = document.getElementById('status-text');

    // Initialize session management
    currentSession = new ChatSession();
    renderSessionList();

    // Initialize Guahh Auth
    if (typeof GuahhAuthAPI !== 'undefined') {
        GuahhAuthAPI.onReady(() => {
            initAuthUI();
        });
    }

    // Sidebar event listeners
    const newChatBtn = document.getElementById('newChatBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (newChatBtn) {
        newChatBtn.addEventListener('click', createNewChat);
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    if (activeInput) {
        activeInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        // Keydown listener
        activeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.sendMessage();
            }
        });
    }

    // Button listener (Backup if HTML onclick missing)
    if (activeBtn) {
        activeBtn.addEventListener('click', window.sendMessage);
    }

    // Boot Sequence
    if (statusText) statusText.innerText = 'Initializing Neural Core...';

    // Fallback dictionary for local mode
    // (Moved to global scope)

    const isLocal = window.location.protocol === 'file:';

    if (isLocal) {
        // LOCAL MODE: Skip fetch and use fallback immediately
        logToTerminal("⚠ LOCAL FILE MODE DETECTED", "warning");
        logToTerminal("Browsers block 'memory.json' when opening files directly.", "warning");
        logToTerminal("Initializing with reduced fallback memory...", "process");

        setTimeout(() => {
            if (window.GuahhEngine) {
                GuahhEngine.init(localFallbackMemory, logToTerminal);
                if (statusText) statusText.innerText = 'Guahh AI (Local Mode)';

                // Set user context if already logged in (with retry for async auth loading)
                const syncUserContext = (attempts = 0) => {
                    if (typeof GuahhAuthAPI !== 'undefined' && GuahhAuthAPI.isLoggedIn()) {
                        const user = GuahhAuthAPI.getCurrentUser();
                        if (user && GuahhEngine.setUser) {
                            GuahhEngine.setUser({
                                displayName: user.displayName,
                                username: user.username,
                                userId: user.userId
                            });
                            console.log('[Guahh AI] User context synced:', user.displayName);
                        }
                    } else if (attempts < 5) {
                        // Auth might still be loading user from localStorage
                        setTimeout(() => syncUserContext(attempts + 1), 300);
                    }
                };
                syncUserContext();
            }
        }, 500);

    } else {
        // NORMAL MODE: Fetch full memory (Multi-file)
        logToTerminal("Loading memory index...", "process");

        fetch('memory_index.json')
            .then(response => {
                if (!response.ok) throw new Error("Failed to load memory index");
                return response.json();
            })
            .then(maxFiles => {
                logToTerminal(`Found ${maxFiles.length} memory banks. Loading...`, "info");

                // Load all memory files
                const promises = maxFiles.map(filename =>
                    fetch(filename)
                        .then(res => res.json())
                        .catch(err => {
                            console.warn(`Failed to load ${filename}:`, err);
                            return []; // Return empty array on failure to preserve others
                        })
                );

                return Promise.all(promises);
            })
            .then(results => {
                // Combine all arrays
                const combinedData = results.flat();
                const totalEntries = combinedData.length;
                const totalSizeMB = (new Blob([JSON.stringify(combinedData)]).size / (1024 * 1024)).toFixed(2);

                logToTerminal(`Memory banks loaded: ${totalEntries} entries (~${totalSizeMB} MB).`, "success");

                setTimeout(() => {
                    if (window.GuahhEngine) {
                        GuahhEngine.init(combinedData, logToTerminal);
                        if (statusText) statusText.innerText = 'Guahh AI 1 (a)';

                        // Set user context if already logged in (with retry for async auth loading)
                        const syncUserContext = (attempts = 0) => {
                            if (typeof GuahhAuthAPI !== 'undefined' && GuahhAuthAPI.isLoggedIn()) {
                                const user = GuahhAuthAPI.getCurrentUser();
                                if (user && GuahhEngine.setUser) {
                                    GuahhEngine.setUser({
                                        displayName: user.displayName,
                                        username: user.username,
                                        userId: user.userId
                                    });
                                    console.log('[Guahh AI] User context synced:', user.displayName);
                                }
                            } else if (attempts < 5) {
                                // Auth might still be loading user from localStorage
                                setTimeout(() => syncUserContext(attempts + 1), 300);
                            }
                        };
                        syncUserContext();
                    }
                }, 300);
            })
            .catch(err => {
                console.error("Memory Load Error:", err);
                logToTerminal(`CRITICAL: Failed to load memory banks. ${err.message}`, "error");

                logToTerminal("Attempting legacy fallback...", "warning");
                fetch('memory.json')
                    .then(res => res.json())
                    .then(data => {
                        logToTerminal("Legacy memory.json loaded.", "success");
                        GuahhEngine.init(data, logToTerminal);
                    })
                    .catch(legacyErr => {
                        console.error("Legacy Load Error:", legacyErr);
                        logToTerminal("Legacy memory load failed. Initializing with minimal fallback...", "error");
                        // FINAL FALLBACK: Ensure engine initializes even if all memory fails
                        // Using localFallbackMemory gives it at least basic conversational skills
                        if (window.GuahhEngine) {
                            GuahhEngine.init(localFallbackMemory, logToTerminal);
                            if (statusText) statusText.innerText = 'Guahh AI (Online - No Memory)';
                        }
                    });
            })
            .catch(e => {
                if (statusText) statusText.innerText = 'Error: Memory Missing';
                if (activeBtn) activeBtn.disabled = false;
            });
    }
});


// Feedback Logging (Simplified)
function logFeedback(query, response, rating) {
    const feedback = { timestamp: new Date().toISOString(), query, response, rating };
    feedbackData.push(feedback);
    console.log(`FEEDBACK: ${rating}`, feedback);
    window.exportFeedback = () => console.log(JSON.stringify(feedbackData, null, 2));

    // Store feedback in current session
    if (currentSession) {
        // Find the message and add feedback to it
        const messageIndex = currentSession.messages.findIndex(
            m => m.role === 'assistant' && m.content === response
        );

        if (messageIndex !== -1) {
            if (!currentSession.messages[messageIndex].feedback) {
                currentSession.messages[messageIndex].feedback = [];
            }
            currentSession.messages[messageIndex].feedback.push({
                rating: rating,
                timestamp: feedback.timestamp
            });

            // Save session and trigger sync
            saveSession(currentSession);
        }
    }
}

// ========== GUAHH AUTH INTEGRATION ==========

function initAuthUI() {
    const profilePic = document.getElementById('profilePic');
    const userProfile = document.getElementById('userProfile');
    const profileName = document.getElementById('profileName');
    const profileStatus = document.getElementById('profileStatus');

    if (!profilePic || !userProfile) return;

    const updateUI = () => {
        const user = GuahhAuthAPI.getCurrentUser();
        if (user) {
            // Logged In
            const pfp = user.profilePictureUrl || `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.username}`;
            profilePic.style.backgroundImage = `url('${pfp}')`;
            profilePic.title = `Logged in as ${user.displayName}`;

            // Update sidebar text
            if (profileName) profileName.textContent = user.displayName;
            if (profileStatus) profileStatus.textContent = '@' + user.username;

            // Unlimited Prompts
            if (activeInput) activeInput.placeholder = "Message Guahh AI...";

            // Pass user info to AI engine for personalization
            // Retry mechanism in case engine isn't ready yet
            const setUserWithRetry = (retryCount = 0) => {
                if (window.GuahhEngine && GuahhEngine.setUser && GuahhEngine.isReady) {
                    GuahhEngine.setUser({
                        displayName: user.displayName,
                        username: user.username,
                        userId: user.userId
                    });
                } else if (retryCount < 10) {
                    // Retry after a delay (engine might still be initializing)
                    setTimeout(() => setUserWithRetry(retryCount + 1), 200);
                }
            };
            setUserWithRetry();

            // Trigger chat sync on login
            syncChatsFromCloud();
        } else {
            // Logged Out
            profilePic.style.backgroundImage = `url('https://api.iconify.design/carbon:user-avatar-filled.svg?color=%23a0a0a0')`; // Reset to default
            profilePic.title = "Sign In";

            // Update sidebar text
            if (profileName) profileName.textContent = 'Guest';
            if (profileStatus) profileStatus.textContent = 'Sign in';

            // Clear user context in AI engine
            if (window.GuahhEngine && GuahhEngine.setUser) {
                GuahhEngine.setUser(null);
            }

            // Show remaining prompts
            updatePromptCounterUI();
        }
    };

    // Initial check
    updateUI();

    // Listeners
    GuahhAuthAPI.onLogin(updateUI);
    GuahhAuthAPI.onLogout(updateUI);


    // Click handler (with mobile touch support)
    const handleProfileClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (GuahhAuthAPI.isLoggedIn()) {
            openAccountModal();
        } else {
            GuahhAuthAPI.showLogin();
        }
    };

    userProfile.addEventListener('click', handleProfileClick);
    userProfile.addEventListener('touchend', handleProfileClick);

    // Modal Listeners
    setupModalListeners();
}

function openAccountModal() {
    const user = GuahhAuthAPI.getCurrentUser();
    if (!user) return;

    const overlay = document.getElementById('accountModalOverlay');
    const modalProfilePic = document.getElementById('modalProfilePic');
    const modalDisplayName = document.getElementById('modalDisplayName');
    const modalUsername = document.getElementById('modalUsername');
    const syncToggle = document.getElementById('chatSyncToggle');

    if (overlay && modalProfilePic && modalDisplayName && modalUsername) {
        // Populate modal with user info
        const pfp = user.profilePictureUrl || `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.username}`;
        modalProfilePic.style.backgroundImage = `url('${pfp}')`; // Keep style.backgroundImage for consistency with profilePic
        modalDisplayName.textContent = user.displayName;

        // Add verified badge if user is verified
        if (user.isVerified === 'TRUE' || user.isVerified === true) {
            if (!modalDisplayName.querySelector('.verified-badge')) {
                const badge = document.createElement('span');
                badge.className = 'verified-badge';
                badge.innerHTML = '<span class="material-icons">verified</span>';
                modalDisplayName.appendChild(badge);
            }
        }

        modalUsername.textContent = `@${user.username}`;

        // Load sync preference
        const syncEnabled = localStorage.getItem('guahh_chat_sync_enabled') !== 'false';
        if (syncToggle) {
            syncToggle.checked = syncEnabled;

            // Add toggle event listener
            syncToggle.onchange = async (e) => {
                const isEnabled = e.target.checked;
                localStorage.setItem('guahh_chat_sync_enabled', isEnabled ? 'true' : 'false');

                if (!isEnabled) {
                    // User disabled sync - delete all cloud chats
                    if (confirm('This will delete all your synced chats from the cloud. Your local chats will remain. Continue?')) {
                        await deleteAllCloudChats();
                        updateSyncIndicator(''); // This will show "Syncing is off"
                    } else {
                        // User cancelled, re-enable toggle
                        e.target.checked = true;
                        localStorage.setItem('guahh_chat_sync_enabled', 'true');
                    }
                } else {
                    // User enabled sync - sync current chats
                    const allSessions = getAllSessions();
                    for (const session of allSessions) {
                        await uploadChatToCloud(session);
                    }
                }
            };
        }

        // Setup edit profile handlers
        setupEditProfileHandlers(user);

        // Show
        overlay.style.display = 'flex';
        // Add active class after a small delay for animation
        setTimeout(() => overlay.classList.add('active'), 10);
    }
}

// Setup edit profile event handlers
function setupEditProfileHandlers(user) {
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileSection = document.getElementById('editProfileSection');
    const editProfileForm = document.getElementById('editProfileForm');
    const editDisplayName = document.getElementById('editDisplayName');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const accountInfo = document.querySelector('.account-info');

    if (!editProfileBtn || !editProfileSection || !editProfileForm) return;

    // Show edit form
    editProfileBtn.onclick = () => {
        editDisplayName.value = user.displayName;
        editProfileSection.style.display = 'block';
        editProfileBtn.style.display = 'none';
        if (accountInfo) accountInfo.style.display = 'none';
    };

    // Cancel editing
    cancelEditBtn.onclick = () => {
        editProfileSection.style.display = 'none';
        editProfileBtn.style.display = 'block';
        if (accountInfo) accountInfo.style.display = 'flex';
    };

    // Save profile changes
    editProfileForm.onsubmit = async (e) => {
        e.preventDefault();

        const newDisplayName = editDisplayName.value.trim();
        if (!newDisplayName) {
            alert('Display name cannot be empty');
            return;
        }

        try {
            const result = await GuahhAuthAPI.updateProfile({
                displayName: newDisplayName
            });

            if (result.status === 'success') {
                // Update UI immediately
                document.getElementById('modalDisplayName').textContent = newDisplayName;

                // Update stored user data
                const currentUser = GuahhAuthAPI.getCurrentUser();
                if (currentUser) {
                    currentUser.displayName = newDisplayName;
                    GuahhAuthAPI.saveUserData(currentUser);
                }

                // Hide edit form
                editProfileSection.style.display = 'none';
                editProfileBtn.style.display = 'block';
                if (accountInfo) accountInfo.style.display = 'flex';

                alert('Profile updated successfully!');
            } else {
                alert('Failed to update profile: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('An error occurred while updating your profile');
        }
    };
}

function closeAccountModal() {
    const overlay = document.getElementById('accountModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 200); // Wait for transition
    }
}

function setupModalListeners() {
    const overlay = document.getElementById('accountModalOverlay');
    const closeBtn = document.getElementById('modalClose');
    const logoutBtn = document.getElementById('logoutBtn'); // Fixed: was modalLogoutBtn

    if (closeBtn) {
        closeBtn.addEventListener('click', closeAccountModal);
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeAccountModal();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to log out?")) {
                GuahhAuthAPI.logout(() => {
                    closeAccountModal();
                    location.reload(); // Refresh page
                });
            }
        });
    }
}

function checkPromptLimit() {
    // 1. Check if logged in (Client-side check)
    if (typeof GuahhAuthAPI !== 'undefined' && GuahhAuthAPI.isLoggedIn()) {
        return true; // Unlimited
    }

    // 2. Check LocalStorage usage
    const today = new Date().toISOString().split('T')[0];
    let usage = JSON.parse(localStorage.getItem('guahh_daily_prompts') || '{}');

    if (usage.date !== today) {
        // Reset for new day
        usage = { date: today, count: 0 };
    }

    if (usage.count >= 30) {
        return false; // Limit reached
    }

    // Increment
    usage.count++;
    localStorage.setItem('guahh_daily_prompts', JSON.stringify(usage));
    updatePromptCounterUI(); // Update UI after increment
    return true;
}

function updatePromptCounterUI() {
    if (typeof GuahhAuthAPI !== 'undefined' && GuahhAuthAPI.isLoggedIn()) return;
    if (!activeInput) return;

    const today = new Date().toISOString().split('T')[0];
    let usage = JSON.parse(localStorage.getItem('guahh_daily_prompts') || '{}');
    if (usage.date !== today) usage = { count: 0 };

    const remaining = Math.max(0, 30 - usage.count);
    activeInput.placeholder = `Message Guahh AI... (${remaining} chats left)`;

    if (remaining === 0) {
        activeInput.placeholder = `No chats left. Sign in for infinite.`;
    }
}

// ========== CHAT SYNC FUNCTIONS ==========

// Trigger cloud sync with debounce
// Trigger cloud sync immediately (Debounce removed as per user request)
function triggerCloudSync(session) {
    if (!CHAT_SYNC_ENABLED) return;
    if (!GuahhAuthAPI || !GuahhAuthAPI.isLoggedIn()) return;

    // Check if user has enabled sync
    const syncEnabled = localStorage.getItem('guahh_chat_sync_enabled') !== 'false';
    if (!syncEnabled) return;

    // Sync immediately
    uploadChatToCloud(session);
}

// Upload a single chat session to cloud
async function uploadChatToCloud(session) {
    if (!CHAT_SYNC_ENABLED || syncInProgress) return;
    if (!GuahhAuthAPI || !GuahhAuthAPI.isLoggedIn()) return;

    const user = GuahhAuthAPI.getCurrentUser();
    if (!user || !user.userId) {
        console.error('Upload failed: No user ID');
        return;
    }

    try {
        syncInProgress = true;
        updateSyncIndicator('syncing');

        console.log('Uploading chat to cloud:', session.id, 'User:', user.userId);

        const response = await fetch(CHAT_SYNC_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                action: 'saveChat',
                userId: user.userId,
                sessionId: session.id,
                chatData: {
                    title: session.title,
                    created: session.created,
                    lastUpdated: session.lastUpdated,
                    messages: session.messages
                },
                feedbackData: extractFeedbackFromSession(session)
            })
        });

        console.log('Sync response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Sync result:', result);

        if (result.status === 'success') {
            lastSyncTime = Date.now();
            updateSyncIndicator('synced');
            console.log('✓ Chat synced to cloud:', session.id);
        } else {
            updateSyncIndicator('error');
            console.error('✗ Sync failed:', result.message);
        }
    } catch (error) {
        updateSyncIndicator('error');
        console.error('✗ Error syncing to cloud:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
    } finally {
        syncInProgress = false;
    }
}

// Download all chats from cloud and merge with local
async function syncChatsFromCloud() {
    if (!CHAT_SYNC_ENABLED) return;
    if (!GuahhAuthAPI || !GuahhAuthAPI.isLoggedIn()) return;

    const user = GuahhAuthAPI.getCurrentUser();
    if (!user || !user.userId) {
        console.error('Sync failed: No user ID');
        return;
    }

    // Check if user has enabled sync
    const syncEnabled = localStorage.getItem('guahh_chat_sync_enabled') !== 'false';
    if (!syncEnabled) {
        console.log('Sync disabled by user preference');
        return;
    }

    try {
        syncInProgress = true;
        updateSyncIndicator('syncing');

        console.log('Downloading chats from cloud for user:', user.userId);

        const response = await fetch(`${CHAT_SYNC_API_URL}?action=getChats&userId=${user.userId}`);
        console.log('Download response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Download result:', result);

        if (result.status === 'success' && result.chats) {
            console.log(`✓ Downloaded ${result.count} chats from cloud`);

            // Merge cloud chats with local chats
            let localSessions = getAllSessions();
            const localSessionMap = new Map(localSessions.map(s => [s.id, s]));

            result.chats.forEach(cloudChat => {
                const localSession = localSessionMap.get(cloudChat.sessionId);

                if (!localSession) {
                    // New chat from cloud, add it
                    localSessions.push({
                        id: cloudChat.sessionId,
                        title: cloudChat.chatData.title || 'Synced Chat',
                        created: cloudChat.chatData.created || Date.now(),
                        lastUpdated: cloudChat.chatData.lastUpdated || Date.now(),
                        messages: cloudChat.chatData.messages || []
                    });
                } else {
                    // Chat exists locally, use the one with latest timestamp
                    const cloudUpdated = new Date(cloudChat.lastUpdated).getTime();
                    const localUpdated = localSession.lastUpdated;

                    if (cloudUpdated > localUpdated) {
                        // Cloud is newer, update local
                        localSession.title = cloudChat.chatData.title;
                        localSession.lastUpdated = cloudChat.chatData.lastUpdated;
                        localSession.messages = cloudChat.chatData.messages;
                    }
                }
            });

            // Sort by last updated
            localSessions.sort((a, b) => b.lastUpdated - a.lastUpdated);

            // Save merged sessions
            localStorage.setItem(STORAGE_KEY, JSON.stringify(localSessions));
            renderSessionList();

            lastSyncTime = Date.now();
            updateSyncIndicator('synced');
        } else {
            updateSyncIndicator('error');
            console.error('✗ Failed to download chats:', result.message);
        }
    } catch (error) {
        updateSyncIndicator('error');
        console.error('✗ Error downloading chats:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
    } finally {
        syncInProgress = false;
    }
}

// Update sync indicator UI
function updateSyncIndicator(status) {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;

    // Check if sync is disabled
    const syncEnabled = localStorage.getItem('guahh_chat_sync_enabled') !== 'false';
    if (!syncEnabled) {
        indicator.textContent = 'Syncing is off';
        indicator.style.color = '#666';
        return;
    }

    switch (status) {
        case 'syncing':
            indicator.textContent = 'Syncing...';
            indicator.style.color = '#4a9eff';
            break;
        case 'synced':
            indicator.textContent = 'Synced';
            indicator.style.color = '#10b981';
            setTimeout(() => {
                if (lastSyncTime) {
                    const timeDiff = Math.floor((Date.now() - lastSyncTime) / 1000);
                    indicator.textContent = `Last synced: ${timeDiff}s ago`;
                }
            }, 2000);
            break;
        case 'error':
            indicator.textContent = 'Sync error';
            indicator.style.color = '#ef4444';
            break;
        default:
            indicator.textContent = '';
    }
}

// Manual sync trigger (for sync button)
async function manualSyncTrigger() {
    if (syncInProgress) return;
    await syncChatsFromCloud();
}

// Delete all cloud chats for current user
async function deleteAllCloudChats() {
    if (!GuahhAuthAPI || !GuahhAuthAPI.isLoggedIn()) return;

    const user = GuahhAuthAPI.getCurrentUser();
    if (!user || !user.userId) return;

    try {
        updateSyncIndicator('syncing');

        // Get all user's chats from cloud
        const response = await fetch(`${CHAT_SYNC_API_URL}?action=getChats&userId=${user.userId}`);
        const result = await response.json();

        if (result.status === 'success' && result.chats) {
            // Delete each chat
            for (const chat of result.chats) {
                await fetch(CHAT_SYNC_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: JSON.stringify({
                        action: 'deleteChat',
                        userId: user.userId,
                        sessionId: chat.sessionId
                    })
                });
            }

            console.log(`Deleted ${result.chats.length} chats from cloud`);
            updateSyncIndicator('');
        }
    } catch (error) {
        console.error('Error deleting cloud chats:', error);
        updateSyncIndicator('error');
    }
}

// Delete a single session from cloud
async function deleteSessionFromCloud(sessionId) {
    if (!GuahhAuthAPI || !GuahhAuthAPI.isLoggedIn()) return;

    const user = GuahhAuthAPI.getCurrentUser();
    if (!user || !user.userId) return;

    try {
        await fetch(CHAT_SYNC_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                action: 'deleteChat',
                userId: user.userId,
                sessionId: sessionId
            })
        });

        console.log('Deleted session from cloud:', sessionId);
    } catch (error) {
        console.error('Error deleting session from cloud:', error);
    }
}

// Extract feedback data from session
function extractFeedbackFromSession(session) {
    const feedbackMap = {};

    if (session && session.messages) {
        session.messages.forEach((msg, index) => {
            if (msg.role === 'assistant' && msg.feedback) {
                feedbackMap[`message_${index}`] = msg.feedback;
            }
        });
    }

    return feedbackMap;
}
