/**
 * Guahh AI - Neural Engine V8.1 (Ultra-Intelligence + Safety)
 * Features: 30+ Intents, 12 Intelligent Wikipedia Strategies, Partial Knowledge Synthesis, Advanced Context Understanding, Content Safety Filter, Enhanced Brainstorming
 */

const GuahhEngine = {
    // Core Data
    memory: [],
    dictionary: {},
    idf: {},
    isReady: false,
    lastTopic: null,
    emotion: "neutral", // Current emotional state
    region: "AU", // Default region for spelling/tone
    onLog: function (msg, type) { console.log(`[${type || 'info'}] ${msg}`); },
    df: {}, // Document frequency cache

    // User Context - Stores logged-in Guahh Account info
    userContext: {
        isLoggedIn: false,
        displayName: null,
        username: null,
        userId: null
    },

    // Content Safety Filter - Prevents inappropriate language
    contentSafetyFilter: [
        // Racial slurs and hate speech
        /\bn[i1!]gg[e3a@][r\$]s?\b/gi,
        /\bn[i1!]gg[a@]h?s?\b/gi,
        /\bch[i1!]nk\b/gi,
        /\bsp[i1!]c\b/gi,
        /\bg[o0][o0]k\b/gi,
        /\bk[i1!]k[e3]\b/gi,
        /\bw[e3]tb[a@]ck\b/gi,
        // Profanity and vulgar terms
        /\bf[u\*]ck(ing|er|ed)?\b/gi,
        /\bsh[i1!]t(ty|ing|ted)?\b/gi,
        /\bb[i1!]tch(es|ing|y)?\b/gi,
        /\bc[u\*]nt\b/gi,
        /\bd[a@]mn(ed)?\b/gi,
        /\bh[e3]ll\b/gi,
        /\b[a@]ss(hole|h[o0]le)?\b/gi,
        /\bcr[a@]p(py)?\b/gi,
        // Offensive terms and slurs
        /\bf[a@]g(got)?\b/gi,
        /\bdy[k3]e\b/gi,
        /\br[e3]t[a@]rd(ed)?\b/gi,
        /\btr[a@]nny\b/gi
    ],

    // Brainstorming Idea Generators by Topic Type
    brainstormGenerators: {
        // For concrete items (clothes, food, gadgets, etc.)
        concrete: {
            styles: ['minimalist', 'vintage', 'futuristic', 'eclectic', 'classic', 'bohemian', 'modern', 'rustic'],
            descriptors: ['unique', 'eye-catching', 'sophisticated', 'casual', 'elegant', 'bold', 'refined', 'playful'],
            occasions: ['everyday wear', 'special occasions', 'work/professional', 'weekend casual', 'evening events', 'outdoor activities'],
        },
        // For activities and hobbies
        activities: {
            approaches: ['beginner-friendly', 'challenging', 'social', 'solo', 'creative', 'physical', 'relaxing', 'adventurous'],
            benefits: ['skill-building', 'stress-relief', 'fitness', 'creativity', 'social connection', 'personal growth'],
        },
        // For business and projects
        business: {
            models: ['subscription-based', 'marketplace', 'SaaS platform', 'community-driven', 'freemium', 'B2B service'],
            innovations: ['AI-powered', 'blockchain-based', 'eco-friendly', 'social enterprise', 'mobile-first', 'data-driven'],
        },
        // For creative projects
        creative: {
            mediums: ['digital art', 'photography series', 'short film', 'podcast', 'blog', 'social media campaign', 'interactive installation'],
            themes: ['storytelling', 'social commentary', 'personal journey', 'cultural exploration', 'experimental'],
        },
    },

    // Config
    vocab: new Set(),
    temperature: 0.85,
    topP: 0.92,
    intentThreshold: 0.6,
    maxAlternativeQueries: 8,
    paraphraseStyle: 'neutral',
    coherenceThreshold: 0.7,
    repetitionWindow: 20,

    // Caching & History
    responseCache: new Map(),
    recentOutputs: [],
    conversationHistory: [],
    wikiCache: new Map(),

    // Feedback Learning System
    feedbackMemory: {
        corrections: [],
        preferences: {
            preferredLength: 'medium',
            preferredStyle: 'balanced',
            preferredComplexity: 'moderate'
        },
        successPatterns: [],
        failurePatterns: [],
        userCorrections: []
    },

    // Generic Corpus for smoother generation when memory is low
    genericCorpus: "The world is full of fascinating things to discover. Science and technology are rapidly evolving fields. Nature provides us with beauty and resources. History teaches us valuable lessons about the past. Art allows us to express our emotions and creativity. Communication is key to understanding one another. The future holds infinite possibilities. We learn and grow every day. Space exploration reveals the mysteries of the universe. Oceans cover most of our planet and are full of life. Music brings joy to many people. Reading expands our minds and imagination. Kindness is a virtue we should all practice. Innovation drives progress in society.",

    // Letter Corpus for professional/formal tone
    letterCorpus: "I appreciate your attention to this matter. We should move forward with the proposed plan. Thank you for your continued support. Please let me know if you have any questions. I look forward to hearing from you soon. This creates a significant opportunity for improvement. We value your feedback and collaboration. Efficiency and quality are our top priorities. I would like to request a meeting to discuss this further. Please review the attached documents at your earliest convenience. We are committed to delivering the best results. Your prompt response would be greatly appreciated. Let's schedule a time to connect.",



    // Callbacks
    onLog: (msg, type) => console.log(`[${type}] ${msg}`),

    init(data, logCallback) {
        if (!data) return false;
        if (logCallback) this.onLog = logCallback;

        this.onLog("Initializing Neural Core...", "info");
        this.onLog(`Loading memory bank: ${data.length} entries`, "info");

        this.memory = [];
        this.dictionary = {};
        this.vocab = new Set();

        // 1. Process Data
        data.forEach(item => {
            if (item.type === 'dict') {
                this.dictionary[item.word] = item;
            } else {
                // Tokenize query if present, otherwise tokenize the answer (for knowledge entries)
                const textToTokenize = item.q || item.a;
                const tokens = this.tokenize(textToTokenize);

                this.memory.push({
                    q: item.q || "", // Ensure q is never undefined
                    a: item.a,
                    tokens: tokens,
                    tokenSet: new Set(tokens), // O(1) Lookup
                    type: item.type || 'conv'
                });
                tokens.forEach(t => this.vocab.add(t));
            }
        });

        // 2. Pre-calculate Document Frequency (DF) for TF-IDF optimization
        this.df = {};
        this.totalDocs = this.memory.length;
        this.memory.forEach(entry => {
            // We use tokenSet to ensure we only count each word once per document
            entry.tokenSet.forEach(t => {
                this.df[t] = (this.df[t] || 0) + 1;
            });
        });

        // 3. Load feedback from storage
        this.loadFeedbackFromStorage();

        this.onLog("Building Vector Space Model...", "process");
        this.onLog("System Ready.", "success");
        this.isReady = true;
        return true;
    },

    // Set the current logged-in user context
    setUser(userInfo) {
        if (userInfo && userInfo.displayName) {
            this.userContext = {
                isLoggedIn: true,
                displayName: userInfo.displayName,
                username: userInfo.username || null,
                userId: userInfo.userId || null
            };
            this.onLog(`User context set: ${userInfo.displayName}`, "success");
        } else {
            this.userContext = {
                isLoggedIn: false,
                displayName: null,
                username: null,
                userId: null
            };
            this.onLog("User context cleared (guest mode)", "info");
        }
    },

    // Get the user's first name for natural conversation
    getUserFirstName() {
        if (this.userContext.isLoggedIn && this.userContext.displayName) {
            // Extract first name (first word of display name)
            return this.userContext.displayName.split(' ')[0];
        }
        return null;
    },

    tokenize(text) {
        if (!text) return [];
        return text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2);
    },

    capitalizeProperNouns(topic) {
        if (!topic) return topic;

        // Common proper noun corrections (names, places, etc.)
        const properNouns = {
            // People
            "shakespeare": "Shakespeare", "newton": "Newton", "einstein": "Einstein",
            "darwin": "Darwin", "galileo": "Galileo", "tesla": "Tesla",
            "mozart": "Mozart", "beethoven": "Beethoven", "da vinci": "Da Vinci",
            "picasso": "Picasso", "michelangelo": "Michelangelo", "leonardo": "Leonardo",
            "plato": "Plato", "aristotle": "Aristotle", "socrates": "Socrates",
            "napoleon": "Napoleon", "caesar": "Caesar", "cleopatra": "Cleopatra",

            // Places
            "australia": "Australia", "america": "America", "england": "England",
            "france": "France", "germany": "Germany", "italy": "Italy",
            "spain": "Spain", "china": "China", "japan": "Japan",
            "paris": "Paris", "london": "London", "rome": "Rome",
            "new york": "New York", "los angeles": "Los Angeles",

            // Concepts/Titles
            "world war": "World War", "the bible": "The Bible",
            "the quran": "The Quran", "the renaissance": "The Renaissance"
        };

        let result = topic;

        // Apply corrections for known proper nouns
        for (const [incorrect, correct] of Object.entries(properNouns)) {
            const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
            result = result.replace(regex, correct);
        }

        // Capitalize first letter of each word if it looks like a name (2+ capital letters originally)
        // This handles cases like "Isaac Newton" typed as "isaac newton"
        const words = result.split(' ');
        const capitalizedWords = words.map((word, idx) => {
            // Always capitalize first word
            if (idx === 0) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }
            // Capitalize if it's a known title word or looks like a proper noun
            if (word.length > 2 && !/^(the|a|an|of|in|on|at|to|for|and|or|but)$/i.test(word)) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }
            return word;
        });

        return capitalizedWords.join(' ');
    },

    preprocessQuery(query) {
        const stopwords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by'];
        let cleaned = query.toLowerCase().trim();

        // TYPO CORRECTION MAP (Common fat-finger errors)
        const typoMap = {
            "whtats": "what is", "whts": "what is", "whst": "what is", "waht": "what",
            "wat": "what", "wht": "what", "wha": "what",
            "dos": "does", "do's": "does",
            "thnks": "thanks", "thx": "thanks", "tnx": "thanks",
            "hwo": "how", "hw": "how",
            "becuase": "because", "becasue": "because", "cuz": "because", "cos": "because",
            "rlly": "really", "rly": "really",
            "pls": "please", "plz": "please",
            "srry": "sorry", "sry": "sorry",
            "dont": "don't", "cant": "can't", "wont": "won't",
            "im": "i'm", "iam": "i am",
            "ur": "your", "ure": "you're",
            "whats": "what is", "what's": "what is"
        };

        // Fix typos before other processing
        const words = cleaned.split(/\s+/);
        const correctedWords = words.map(w => typoMap[w] || w);
        cleaned = correctedWords.join(' ');

        // Expand common abbreviations and colloquialisms
        cleaned = cleaned
            .replace(/\bai\b/g, 'artificial intelligence')
            .replace(/\bml\b/g, 'machine learning')
            .replace(/\bwho's\b/g, 'who is')
            .replace(/\bwhos\b/g, 'who is')
            .replace(/\bhow's\b/g, 'how is')
            .replace(/\bhows\b/g, 'how is')
            .replace(/\binfo\b/g, 'information')
            .replace(/\bpic\b/g, 'picture')
            .replace(/\bvid\b/g, 'video')
            .replace(/\bbtw\b/g, 'by the way')
            .replace(/\bfyi\b/g, 'for your information')
            .replace(/\baka\b/g, 'also known as')
            .replace(/\betc\b/g, 'and so on')
            .replace(/\be\.g\.\b/g, 'for example')
            .replace(/\bi\.e\.\b/g, 'that is');

        return cleaned;
    },

    sanitizeInput(query) {
        // Remove emojis and specific control characters
        if (!query) return "";
        return query.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
            .trim();
    },

    isMetaQuery(query) {
        const q = query.toLowerCase();

        // Questions about the AI's identity and capabilities
        const metaPatterns = [
            // Identity questions
            /^(who|what) (are|is) (you|guahh)/i,
            /^your name/i,
            /^tell me about (yourself|you|guahh)/i,
            /^introduce yourself/i,

            // Capability questions - starts with "can you" or "do you"
            /^can you (help|assist|do|make|create|write|code|answer|explain|tell|show|teach)/i,
            /^are you (able|capable)/i,
            /^do you (know|understand|have|support|offer|provide|code|program)/i,
            /^will you/i,
            /^could you/i,

            // Function/purpose questions
            /what can you do/i,
            /what are you (for|good at|capable of)/i,
            /what (is|are) your (purpose|function|capabilities|features|abilities)/i,
            /how do you work/i,
            /what do you do/i,
            /how (are you|does this) (made|built|created)/i,

            // Version/update questions
            /what version/i,
            /when (were you|was this) (created|made|built|updated)/i,
        ];

        return metaPatterns.some(p => p.test(query));
    },

    isSearchQuery(query) {
        // Questions that require external knowledge/Wikipedia search
        const q = query.toLowerCase();

        // If it's a meta query, it's NOT a search query
        if (this.isMetaQuery(query)) return false;

        // Ignore personal statements (I love ..., I think ...)
        if (/^i (love|like|think|feel|am|really|just|want|don't)/i.test(q)) return false;

        // Factual/informational question patterns
        const searchPatterns = [
            // Definitional questions about external topics
            /^what (is|are|was|were) (a|an|the)?\s*(?!you|your|guahh)/i,
            /^who (is|are|was|were)\s+(?!you)/i,
            /^where (is|are|was|were)/i,
            /^when (did|was|were|is)/i,
            /^why (is|are|was|were|did|do|does)/i,
            /^how (does|do|did|is|are)\s+(?!you|this|guahh)/i,

            // Information requests about external topics
            /^(tell me about|explain|describe|define)\s+(?!yourself|you|guahh)/i,
            /^(facts about|information on|details about)/i,

            // Specific entity queries (proper nouns often indicate search queries)
            // MUST be at least 2 words or a known entity, preventing "I" or "Really" from triggering
            /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/,  // Multi-word Proper nouns (e.g. New York)
        ];

        return searchPatterns.some(p => p.test(query));
    },

    isCodingRequest(query) {
        const codingPatterns = [
            /^code\s+(a|an|the|something|me)/i,
            /^(write|create|make|generate|build)\s+(?:a|an|the|some)?\s*(?:code|program|script|function|class)/i,
            /^(write|create|make|generate).*(?:in|using|with)\s+(python|javascript|java|c\+\+|ruby|php)/i,
            /code.*(?:generator|calculator|converter|function)/i, /write.*code.*for/i
        ];
        return codingPatterns.some(p => p.test(query));
    },

    isMathQuery(query) {
        const clean = query.toLowerCase();
        // Check for specific math operators or keywords combined with numbers
        // Must contain numbers AND operators to be a math query
        const hasNumbers = /\d/.test(clean);
        const hasOperators = /[\+\-\*\/^]|\b(plus|minus|times|divided by|multiplied by|squared|cubed)\b/.test(clean);

        if (hasNumbers && hasOperators) {
            // Ensure it's not a date "1990-2000" or phone number
            // It should look like a calculation
            return true;
        }

        // Simple "calculate X" check
        if (/^(calculate|compute|solve)\s+.+/.test(clean)) return true;

        return false;
    },

    evaluateExpression(expr) {
        try {
            // Clean up the expression
            let cleanExpr = expr.toLowerCase()
                .replace(/what is\s*/i, '').replace(/calculate\s*/i, '').replace(/compute\s*/i, '').replace(/solve\s*/i, '')
                .replace(/\btimes\b/g, '*').replace(/\bmultiplied by\b/g, '*')
                .replace(/\bdivided by\b/g, '/')
                .replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-')
                .replace(/\bsquared\b/g, '**2').replace(/\bcubed\b/g, '**3')
                .replace(/\^/g, '**').replace(/√(\d+)/g, 'Math.sqrt($1)')
                .replace(/[^\d\s+\-*/().*]|(?<!Math)\./g, '') // strictly allow only math chars
                .trim();

            if (!cleanExpr || !/^[\d\s+\-*/().*]+$/.test(cleanExpr) || !/\d/.test(cleanExpr)) return null;

            // Safe evaluation using Function
            const result = Function('"use strict"; return (' + cleanExpr + ')')();

            if (isNaN(result) || !isFinite(result)) return null;
            return { expr: cleanExpr, result: Number.isInteger(result) ? result : result.toFixed(4) };
        } catch (e) { return null; }
    },

    calculateMath(query) {
        // check for multiple distinct queries
        // Split by 'and', commas, semicolons, OR spaces if they look like separate math expressions
        // The regex looks for:
        // 1. "and", ",", ";" delimiters
        // 2. OR a space that is likely a separator between two math expressions (e.g. "1+2 3+4")
        //    (Lookbehind for digit, lookahead for digit, but space in between)

        // Let's refine the splitting logic.
        // We want to split string "1+2 4*8 5/2" into ["1+2", "4*8", "5/2"]
        // But "calculate 5 + 5" should be ["5 + 5"]

        let cleaned = query.toLowerCase()
            .replace(/what is|calculate|compute|solve/gi, '')
            .trim();

        // If we just use spaces as delimiters, we break "5 + 5".
        // But if we first normalize the expression to REMOVE spaces around operators, 
        // e.g. "5 + 5" -> "5+5", then we CAN split by space.

        // 1. Normalize spacing around operators
        cleaned = cleaned.replace(/\s*([\+\-\*\/^])\s*/g, '$1');

        // 2. Also normalize word operators
        cleaned = cleaned
            .replace(/\s+plus\s+/g, '+')
            .replace(/\s+minus\s+/g, '-')
            .replace(/\s+times\s+/g, '*')
            .replace(/\s+divided by\s+/g, '/')
            .replace(/\s+multiplied by\s+/g, '*');

        // 3. Now split by space, comma, semicolon, or 'and'
        const parts = cleaned.split(/[\s,;]+|\band\b/i).map(p => p.trim()).filter(p => p.length > 0);

        const results = [];

        for (const part of parts) {
            const result = this.evaluateExpression(part);
            if (result) {
                results.push(result);
            }
        }

        if (results.length === 0) return null;

        if (results.length === 1) {
            return `The answer is ${results[0].result}`;
        }

        // Multiple results
        let response = "Here are the answers:\n\n";
        results.forEach((res) => {
            response += `• ${res.expr} = **${res.result}**\n`;
        });

        return response;
    },

    isGreeting(query) {
        const greetings = [
            /^(hi|hello|hey|greetings|howdy|sup|yo|waddup|what's good|what's crackin|what's up|whats up|wazzup)$/i,
            /^(hi|hello|hey|greetings|howdy|sup|yo|waddup)\s+(there|guahh|ai|mate|friend)?$/i,
            /^good\s+(morning|afternoon|evening|day)$/i
        ];
        return greetings.some(p => p.test(query.trim()));
    },

    isContextualFollowUp(query) {
        const q = query.toLowerCase();
        return /\b(it|that|this|longer|shorter|more|detail|elaborate|continue|again|summarize|summarise|summary)\b/i.test(q);
    },

    extractTopic(query) {
        const clean = query.toLowerCase().trim();
        let topic = null;

        // Specific pattern matching
        let match = clean.match(/(?:write|make|create|generate)\s+(?:a|an|the)?\s*(?:story|letter|email|essay|article|poem|song|paragraph|report)\s+(?:about|on|regarding|to|for)\s+(?:the\s+)?(.+)/i);
        if (match) topic = match[1].trim();

        // Government/political patterns (NEW - handles "structure of X government")
        // Use original query for case-sensitive matching
        if (!topic) {
            match = query.match(/(?:structure|organization|system|form)\s+of\s+(?:the\s+)?(.+?\s+(?:government|parliament|administration|council|regime))/i);
            if (match) topic = match[1].trim();
        }

        // "X government/parliament" pattern - extract the proper noun before government
        if (!topic) {
            match = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(government|parliament|administration|congress|senate)/i);
            if (match) topic = match[1] + ' ' + match[2];
        }

        // Prime minister / president patterns
        if (!topic) {
            match = query.match(/(?:prime minister|president|leader|king|queen|ruler)\s+of\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
            if (match) topic = match[1];
        }

        if (!topic) { match = clean.match(/tell\s+me\s+about\s+(.+)/i); if (match) topic = match[1].trim(); }
        if (!topic) { match = clean.match(/what\s+(?:is|are|was|were)\s+(?:a|an|the)?\s*(.+)/i); if (match) topic = match[1].trim(); }
        if (!topic) { match = clean.match(/who\s+(?:is|are|was|were)\s+(.+)/i); if (match) topic = match[1].trim(); }
        if (!topic) { match = clean.match(/(?:explain|describe|define)\s+(.+)/i); if (match) topic = match[1].trim(); }
        if (!topic) { match = clean.match(/(?:facts about|information on|details about)\s+(.+)/i); if (match) topic = match[1].trim(); }

        if (topic) {
            const words = topic.split(' ');
            if (words.length > 1 && /^(game|movie|film|book|show|app|website|platform)$/i.test(words[0])) {
                topic = words.slice(1).join(' ');
            }
            this.lastTopic = topic;
            return topic;
        }
        return null;
    },

    detectQueryType(query) {
        const q = query.toLowerCase();
        if (/^(hi|hello|hey|greetings|howdy|sup|yo)/i.test(q.trim())) return 'greeting';
        if (this.isMetaQuery(query)) return 'meta';
        if (/^(what|who|where|when|why|how)\s/i.test(q)) return 'question';
        if (/write|create|make|generate|compose|tell me a story/i.test(q)) return 'creative';
        if (/explain|describe|tell.*about|define/i.test(q)) return 'explain';
        return 'general';
    },

    extractKeywords(query) {
        const stopwords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'about', 'what', 'who', 'how', 'why', 'when', 'where', 'that', 'this', 'write', 'story', 'make', 'create', 'generate'];
        return query.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopwords.includes(word))
            .slice(0, 3);
    },

    generateAlternativeQueries(originalQuery, topic) {
        const alternatives = [];
        if (topic && topic !== originalQuery) alternatives.push(topic);
        if (topic) {
            if (topic.endsWith('s')) alternatives.push(topic.slice(0, -1));
            else alternatives.push(topic + 's');
        }
        const keywords = this.extractKeywords(originalQuery);
        if (keywords.length > 0) alternatives.push(keywords[0]);
        return [...new Set(alternatives)];
    },

    // ========== ADVANCED INTENT ANALYSIS ==========

    analyzeIntent(query) {
        const intents = this.detectMultipleIntents(query);
        if (intents.length === 0) {
            return { primary: 'general', secondary: [], confidence: 0.5 };
        }

        // Sort by confidence and return primary + secondary intents
        intents.sort((a, b) => b.confidence - a.confidence);
        return {
            primary: intents[0].type,
            secondary: intents.slice(1).map(i => i.type),
            confidence: intents[0].confidence,
            allIntents: intents
        };
    },

    detectMultipleIntents(query) {
        const q = query.toLowerCase();
        const intents = [];

        // === CONVERSATIONAL INTENTS ===

        // Greeting intent
        if (/^(hi|hello|hey|greetings|howdy|sup|yo|good (morning|afternoon|evening)|hola|bonjour)/i.test(q.trim())) {
            intents.push({ type: 'greeting', confidence: 0.95 });
        }

        // Farewell intent
        if (/^(bye|goodbye|see you|farewell|take care|later|cya|so long|good night)/i.test(q.trim())) {
            intents.push({ type: 'farewell', confidence: 0.95 });
        }

        // Gratitude intent
        if (/^(thank|thanks|thx|appreciate|grateful|cheers)/i.test(q)) {
            intents.push({ type: 'gratitude', confidence: 0.95 });
        }

        // Generic Casual/Small Talk intent
        if (/^(how are you|how.*(it|things|life).*going|what.*up|good day|nice to meet|who.*you|tell me about yourself)/i.test(q) && !/who (is|are|was|were) (the|a|an)?\s*[A-Z]/i.test(q)) {
            intents.push({ type: 'casual', confidence: 0.92 });
        }

        // Compliments/Critiques
        if (/(you.*(cool|awesome|smart|helpful|funny|great)|good job|well done)/i.test(q)) {
            intents.push({ type: 'casual', confidence: 0.9 });
        }

        // Personal Sharing / Statement (New)
        if (/^i (really |just )?(love|like|hate|dislike|enjoy|prefer|think|feel|believe|am)/i.test(q)) {
            intents.push({ type: 'personal_sharing', confidence: 0.9 });
        }

        // === QUESTION INTENTS ===

        // Factual question
        if (/^(what|who|where|when|which)\s/i.test(q)) {
            intents.push({ type: 'question', confidence: 0.9 });
        }

        // How-to question
        if (/^how (do|can|to|should|would)\s/i.test(q) || /how to\s/i.test(q) || /way to\s/i.test(q)) {
            intents.push({ type: 'how_to', confidence: 0.92 });
        }

        // Why/Cause question
        if (/^why\s/i.test(q) || /what (causes|caused|makes|reason)/i.test(q)) {
            intents.push({ type: 'why_cause', confidence: 0.9 });
        }

        // Definition request
        if (/(what (is|are|was|were) (the )?(definition|meaning) of|define|what does.*mean|meaning of)/i.test(q)) {
            intents.push({ type: 'definition', confidence: 0.95 });
        }

        // Comparison request
        if (/(compare|difference between|versus|vs|better than|worse than|similar to|distinguish)/i.test(q)) {
            intents.push({ type: 'comparison', confidence: 0.9 });
        }

        // List request
        if (/(list|name.*all|what are (the|some)|give me.*examples|types of|kinds of|categories)/i.test(q)) {
            intents.push({ type: 'list', confidence: 0.88 });
        }

        // === CREATIVE INTENTS ===

        // Creative writing intent
        if (/write|create|make|generate|compose|prepare/i.test(q) && /(story|essay|article|poem|letter|email|script|speech|lyrics)/i.test(q)) {
            intents.push({ type: 'creative', confidence: 0.9 });
        }

        // "Make me a X"
        if (/make (me )?a (story|essay|poem|recipe|plan)/i.test(q)) {
            intents.push({ type: 'creative', confidence: 0.9 });
        }

        // Brainstorm intent
        if (/(brainstorm|ideas for|suggest|come up with|think of|inspiration|options for)/i.test(q)) {
            intents.push({ type: 'brainstorm', confidence: 0.85 });
        }

        // === TRANSFORMATION INTENTS ===

        // Paraphrase intent
        if (/(rephrase|paraphrase|reword|say.*different|put.*different|another way|rewrite|word it differently)/i.test(q)) {
            intents.push({ type: 'paraphrase', confidence: 0.95 });
        }

        // Translation intent
        if (/(translate|translation|in.*language|how do you say.*in)/i.test(q)) {
            intents.push({ type: 'translate', confidence: 0.92 });
        }

        // Correction intent
        if (/(correct|fix|grammar|spelling|mistake|error|wrong|proofread|edit)/i.test(q)) {
            intents.push({ type: 'correction', confidence: 0.88 });
        }

        // === ANALYTICAL INTENTS ===

        // Explanation intent
        // Explanation intent
        if (/(explain|describe|tell.*about|define|clarify|elaborate|break down|walk.*through|help me understand)/i.test(q)) {
            intents.push({ type: 'explain', confidence: 0.85 });
        }

        // CONFUSION / FEEDBACK INTENT
        // "huh", "what do you mean", "I don't get it", "what are you doing"
        if (/^(huh|what\??|eh\??)$/i.test(q.trim()) ||
            /(what (do|did) you (mean|say)|i don't (get|understand)|confused|what are you doing|make sense)/i.test(q)) {
            intents.push({ type: 'confusion', confidence: 0.99 });
        }

        // "What is X" is often an explanation request if searching for a complex topic
        if (/what is/i.test(q) && q.split(' ').length > 3) {
            intents.push({ type: 'explain', confidence: 0.6 });
        }

        // Summarization intent
        if (/(summarize|summarise|sum up|summary|brief|short version|tldr|condense|digest|overview|main points)/i.test(q)) {
            intents.push({ type: 'summarize', confidence: 0.95 });
        }

        // Analysis intent
        if (/(analyze|analyse|analysis|examine|evaluate|assess|review|pros and cons|benefits of)/i.test(q)) {
            intents.push({ type: 'analysis', confidence: 0.88 });
        }

        // === RECOMMENDATION INTENTS ===

        // Recommendation request
        if (/(recommend|suggestion|should i|what.*best|advice|tips|which.*choose|good.*for)/i.test(q)) {
            intents.push({ type: 'recommendation', confidence: 0.87 });
        }

        // Opinion request
        if (/(what.*think|your opinion|do you (like|prefer)|thoughts on|believe)/i.test(q)) {
            // Check if it's asking about "what others think"
            if (!/what (do|does) \w+ think/i.test(q)) {
                intents.push({ type: 'opinion', confidence: 0.82 });
            }
        }

        // Confirmation/Negation (for answering questions)
        if (/^(yes|yeah|yep|sure|absolutely|correct|right|i do|please|go ahead)$/i.test(q)) {
            intents.push({ type: 'confirmation', confidence: 0.95 });
        }
        if (/^(no|nope|nah|not really|i don't|wrong|stop|cancel)$/i.test(q)) {
            intents.push({ type: 'negation', confidence: 0.95 });
        }

        // === COMPUTATIONAL INTENTS ===

        // Math intent
        if (this.isMathQuery(q)) {
            intents.push({ type: 'math', confidence: 0.95 });
        }

        // Code intent
        if (this.isCodingRequest(q)) {
            intents.push({ type: 'code', confidence: 0.9 });
        }

        // Calculation intent
        if (/(calculate|compute|figure out|work out|how (much|many)|solve)/i.test(q)) {
            // Ensure it's not just "how many people live in..." which is a question
            if (/\d/i.test(q) || /(plus|minus|times|divided)/i.test(q)) {
                intents.push({ type: 'calculation', confidence: 0.88 });
            }
        }

        // === CONTEXT INTENTS ===

        // Meta/capability inquiry
        if (this.isMetaQuery(q)) {
            intents.push({ type: 'meta', confidence: 0.9 });
        }

        // Contextual follow-up
        if (this.isContextualFollowUp(q)) {
            intents.push({ type: 'followup', confidence: 0.8 });
        }

        // "It" reference check
        if (/(what about it|tell me more about it)/i.test(q)) {
            intents.push({ type: 'followup', confidence: 0.85 });
        }

        // === MODIFICATION INTENTS ===

        // Tone adjustment intent
        if (/(make.*more|make.*less|convert.*to|change.*tone|more formal|less formal|casual|professional|wittier|funnier)/i.test(q)) {
            intents.push({ type: 'tone_adjust', confidence: 0.85 });
        }

        // Expansion intent
        if (/(expand|elaborate|more detail|tell me more|go deeper|longer version|make it longer|continue)/i.test(q)) {
            intents.push({ type: 'expand', confidence: 0.95 });
        }

        // Simplification intent
        if (/(simplify|simpler|easier|eli5|explain like|dumb.*down|basic|too complex)/i.test(q)) {
            intents.push({ type: 'simplify', confidence: 0.9 });
        }

        // === PROCEDURE INTENTS ===

        // Step-by-step request
        if (/(step by step|steps|instructions|guide|tutorial|how.*process|procedure for)/i.test(q)) {
            intents.push({ type: 'step_by_step', confidence: 0.87 });
        }

        // Troubleshooting intent
        if (/(troubleshoot|problem|issue|not working|help.*fix|debug|error|fail)/i.test(q)) {
            intents.push({ type: 'troubleshoot', confidence: 0.85 });
        }

        // === INFORMATIONAL INTENTS ===

        // Historical intent
        if (/(history of|historical|in the past|back then|ancient|origin|biography|life of)/i.test(q)) {
            intents.push({ type: 'historical', confidence: 0.83 });
        }

        // Future/prediction request
        if (/(future|will.*be|predict|forecast|what.*happen|upcoming|trends)/i.test(q)) {
            intents.push({ type: 'future', confidence: 0.8 });
        }

        // Verification intent
        if (/(is (it|this|that) (true|correct|right)|verify|confirm|fact check|are you sure)/i.test(q)) {
            intents.push({ type: 'verification', confidence: 0.85 });
        }

        // === TIME / UTILITY MODIFIER CHECK ===
        // If the user's query is a modifier for the last response, treat it as a utility query
        if (this.lastResponseType === 'TIME' && /24.*hour|military|12.*hour|standard/i.test(q)) {
            intents.push({ type: 'utility', confidence: 0.99 });
        }
        if ((this.lastResponseType === 'DICE' || this.lastResponseType === 'COIN') && /again|another|one more|roll|flip/i.test(q)) {
            intents.push({ type: 'utility', confidence: 0.99 });
        }

        // === CASUAL / SHORT RESPONSE INTENTS (Prevent Dictionary Definitions) ===
        if (/^(cool|nice|awesome|great|ok|okay|wow|sweet|good|thanks|thank you|thx|thanks!|understood|got it)$/i.test(q)) {
            intents.push({ type: 'casual', confidence: 1.0 }); // Override everything else
        }

        // === UTILITY INTENTS ===
        if (/(time|date|clock|year|month|day is it)/i.test(q) && /(what|current|tell me)/i.test(q)) {
            intents.push({ type: 'utility', confidence: 0.96 });
        }
        if (/(random number|pick a number|roll a dice|roll a die|roll d\d+|flip a coin|coin toss|heads or tails)/i.test(q)) {
            intents.push({ type: 'utility', confidence: 0.96 });
        }
        if (/(spell.*backwards?|reverse.*word|backwards? spelling)/i.test(q)) {
            intents.push({ type: 'utility', confidence: 0.96 });
        }

        // === SEARCH INTENT (Implicit) ===
        // If query smells like a factual lookup and hasn't matched other things strongly
        if (intents.length === 0 && q.split(' ').length > 1 && !this.isMathQuery(q)) {
            // Assume general search if it contains proper nouns or complexity
            if (/[A-Z]/.test(query) || q.split(' ').length > 3) {
                intents.push({ type: 'question', confidence: 0.5 });
            }
        }

        return intents;
    },

    extractEntities(text) {
        const entities = {
            persons: [],
            places: [],
            concepts: [],
            keywords: []
        };

        // Common words to exclude from entity extraction
        const commonWords = ['structure', 'system', 'type', 'kind', 'form', 'way', 'thing', 'part', 'piece',
            'what', 'how', 'why', 'when', 'where', 'who', 'which', 'that', 'this', 'these', 'those',
            'about', 'from', 'with', 'into', 'through', 'during', 'before', 'after'];

        // Extract multi-word capitalized phrases (PRIORITY - likely proper nouns like "Greenland Government")
        const multiWordProperNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
        multiWordProperNouns.forEach(phrase => {
            entities.keywords.push(phrase);
            entities.concepts.push(phrase);
        });

        // Extract single capitalized words (but lower priority)
        const capitalizedWords = text.match(/\b[A-Z][a-z]+\b/g) || [];
        capitalizedWords.forEach(word => {
            // Only add if not already in multi-word phrases and not a common word
            const alreadyInMultiWord = multiWordProperNouns.some(phrase => phrase.includes(word));
            if (!alreadyInMultiWord && !commonWords.includes(word.toLowerCase())) {
                entities.keywords.push(word);
            }
        });

        // Extract quoted phrases (explicit entities)
        const quotedPhrases = text.match(/"([^"]+)"/g) || [];
        quotedPhrases.forEach(phrase => {
            entities.concepts.push(phrase.replace(/"/g, ''));
        });

        // Extract key noun phrases (meaningful words, excluding common terms)
        const words = text.toLowerCase().split(/\s+/);
        const stopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were'];
        const meaningfulWords = words.filter(w =>
            w.length > 3 &&
            !stopwords.includes(w) &&
            !commonWords.includes(w)
        );

        // Only add if we don't already have good proper noun entities
        if (entities.concepts.length === 0) {
            entities.concepts.push(...meaningfulWords.slice(0, 5));
        }

        return entities;
    },

    buildQueryContext(query, history) {
        const context = {
            query: query,
            lastTopic: this.lastTopic,
            lastResponseType: this.lastResponseType || null, // Track what kind of response we just gave
            recentQueries: history.slice(-3).map(h => h.query),
            recentResponses: history.slice(-3).map(h => h.response),
            lastAIQuestion: history.length > 0 && history[history.length - 1].response.trim().endsWith('?')
                ? history[history.length - 1].response
                : null,
            hasPronouns: /\b(it|that|this|they|them|these|those)\b/i.test(query),
            isFollowUp: this.isContextualFollowUp(query)
        };

        // Detect pending actions from the last question
        if (context.lastAIQuestion) {
            if (/dig deeper|more details|history of this/i.test(context.lastAIQuestion)) {
                context.pendingAction = 'DEEP_SEARCH';
            } else if (/search|look up|find/i.test(context.lastAIQuestion)) {
                context.pendingAction = 'SEARCH';
            }
        }

        // If query has pronouns, resolve them
        if (context.hasPronouns && context.lastTopic) {
            context.resolvedQuery = this.resolvePronouns(query, context);
        } else {
            context.resolvedQuery = query;
        }

        return context;
    },

    resolvePronouns(query, context) {
        let resolved = query;

        // If no topic, maybe check if we can infer one from recent history
        let topic = context.lastTopic;
        if (!topic && context.recentQueries.length > 0) {
            // Try to find a topic in the last user query
            // This is a simple heuristic fallback
            const lastUserQuery = context.recentQueries[context.recentQueries.length - 1];
            topic = this.extractTopic(lastUserQuery);
        }

        if (!topic) return query;

        // "Tell me more" pattern - implicit reference
        if (/^(tell me more|go on|continue|expand|details|elaborate)$/i.test(query.trim())) {
            return `${query} about ${topic}`;
        }

        // "Why?" pattern - implicit reference
        if (/^why\??$/i.test(query.trim())) {
            return `why is ${topic} like that?`;
        }

        // Replace common pronouns with the last topic
        // We use a more careful boundary check
        resolved = resolved.replace(/\b(it|that|this|the first one)\b/gi, (match) => {
            // detailed logic could go here, for now swapping it in
            return topic;
        });

        // "and?" pattern
        if (/^and\??$/i.test(query.trim())) {
            return `what else about ${topic}?`;
        }

        return resolved;
    },

    expandQuery(query) {
        const expansions = [query];
        const words = query.toLowerCase().split(/\s+/);

        // Add singular/plural variations
        words.forEach((word, idx) => {
            if (word.endsWith('s') && word.length > 3) {
                const singular = word.slice(0, -1);
                const newQuery = [...words];
                newQuery[idx] = singular;
                expansions.push(newQuery.join(' '));
            } else if (!word.endsWith('s') && word.length > 3) {
                const plural = word + 's';
                const newQuery = [...words];
                newQuery[idx] = plural;
                expansions.push(newQuery.join(' '));
            }
        });

        return [...new Set(expansions)];
    },

    // ========== END INTENT ANALYSIS ==========


    // ========== INTELLIGENT WIKIPEDIA QUERY GENERATION ==========

    generateIntelligentSearchQuery(userQuery, intentAnalysis) {
        // Use AI to understand what the user wants and generate the best Wikipedia search query
        // Returns either a single string or an array of strings for multi-query searches
        this.onLog("🧠 Analyzing query to generate intelligent search...", "process");

        const q = userQuery.toLowerCase();
        let searchQuery = null;

        // === COMPARISON QUERIES (Returns MULTIPLE queries) ===
        if (/(difference between|vs|versus|compare)/i.test(q)) {
            // Extract both items being compared
            let match = userQuery.match(/(?:difference between|compare)\s+(.+?)\s+(?:and|vs|versus)\s+(.+)/i);
            if (match) {
                const item1 = match[1].trim().replace(/\?+$/, '');
                const item2 = match[2].trim().replace(/\?+$/, '');
                this.onLog(`→ Comparison query detected: searching for both "${item1}" and "${item2}"`, "data");
                return [item1, item2]; // Return array for multi-search
            }
        }

        // === GOVERNMENT/POLITICAL QUERIES ===
        if (/government|parliament|administration|politics|political/i.test(q)) {
            // "structure of X government" → "X government"
            let match = userQuery.match(/(?:structure|organization|system|form|composition)\s+of\s+(?:the\s+)?(.+?\s+(?:government|parliament))/i);
            if (match) {
                searchQuery = match[1].trim();
                this.onLog(`→ Political query detected: "${searchQuery}"`, "data");
                return searchQuery;
            }
        }

        // === PERSON QUERIES ===
        if (/who is|prime minister|president|leader|ceo|founder|created by/i.test(q)) {
            // "who is the prime minister of X" → "X" (the country/org)
            let match = userQuery.match(/(?:prime minister|president|leader|king|queen|ruler)\s+of\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
            if (match) {
                searchQuery = match[1].trim();
                this.onLog(`→ Leadership query detected: "${searchQuery}"`, "data");
                return searchQuery;
            }

            // "who is X" → "X"
            match = userQuery.match(/who\s+(?:is|was|are|were)\s+(?:the\s+)?(.+)/i);
            if (match) {
                searchQuery = match[1].trim();
                this.onLog(`→ Person query detected: "${searchQuery}"`, "data");
                return searchQuery;
            }
        }

        // === DEFINITION QUERIES ===
        if (/what is|what are|what's|define|definition|meaning/i.test(q)) {
            // Extract the subject being defined
            let match = userQuery.match(/what\s+(?:is|are|was|were)\s+(?:a|an|the)?\s*(.+?)(?:\?|$)/i);
            if (match) {
                let subject = match[1].trim();

                // Remove filler phrases
                subject = subject.replace(/\b(used for|good for|known for|made of|composed of)\b.*/i, '');

                searchQuery = subject;
                this.onLog(`→ Definition query detected: "${searchQuery}"`, "data");
                return searchQuery;
            }
        }

        // === HOW-TO / PROCESS QUERIES ===
        if (/how (do|does|to|can|is)/i.test(q)) {
            // "how does X work" → "X" or "how X works"
            let match = userQuery.match(/how\s+(?:does|do)\s+(?:a|an|the)?\s*(.+?)\s+work/i);
            if (match) {
                searchQuery = match[1].trim();
                this.onLog(`→ How-it-works query detected: "${searchQuery}"`, "data");
                return searchQuery;
            }
        }

        // === HISTORICAL QUERIES ===
        if (/history|historical|ancient|origin|founded|established|created/i.test(q)) {
            // Extract the main subject
            let match = userQuery.match(/(?:history|origin)\s+of\s+(?:the\s+)?(.+)/i);
            if (match) {
                searchQuery = match[1].trim();
                this.onLog(`→ Historical query detected: "${searchQuery}"`, "data");
                return searchQuery;
            }
        }

        // === EXTRACT PROPER NOUNS (Fallback) ===
        const properNouns = userQuery.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
        if (properNouns && properNouns.length > 0) {
            // Prefer longer phrases
            properNouns.sort((a, b) => b.split(' ').length - a.split(' ').length);
            searchQuery = properNouns[0];
            this.onLog(`→ Extracted proper noun: "${searchQuery}"`, "data");
            return searchQuery;
        }

        // === GENERIC FALLBACK ===
        // Remove question words and extract the core subject
        searchQuery = userQuery
            .replace(/^(what|who|where|when|why|how|which|is|are|was|were|do|does|did|can|could|would|should|tell me about|explain|describe)\s+/i, '')
            .replace(/\?+$/, '')
            .trim();

        this.onLog(`→ Generic extraction: "${searchQuery}"`, "data");
        return searchQuery;
    },


    async searchWikipedia(query, isLongForm = false) {
        if (this.wikiCache.has(query)) {
            this.onLog(`Wikipedia: Using cached result for "${query}"`, "success");
            return this.wikiCache.get(query);
        }

        this.onLog(`Wikipedia: Intelligent search for "${query}"...`, "process");
        let result = null;

        // STEP 1: Use intelligent query generation to get the best search term(s)
        const intelligentQuery = this.generateIntelligentSearchQuery(query, null);

        // Handle multi-query searches (e.g., comparisons)
        if (Array.isArray(intelligentQuery)) {
            this.onLog(`🎯 Using AI-generated multi-query: ${intelligentQuery.join(' vs ')}`, "success");
            result = await this.searchMultipleAndCombine(intelligentQuery, isLongForm);
            if (result) return this._cacheAndReturn(query, result);
        } else if (intelligentQuery && intelligentQuery !== query) {
            this.onLog(`🎯 Using AI-generated query: "${intelligentQuery}"`, "success");
            result = await this._fetchWikipedia(intelligentQuery, isLongForm);
            if (result) return this._cacheAndReturn(query, result);
        }

        // STEP 2: Analyze query to prioritize search strategies
        const queryAnalysis = this.analyzeQueryForSearch(query);
        this.onLog(`Query type: ${queryAnalysis.type}, confidence: ${queryAnalysis.confidence}`, "data");

        // STEP 3: Get prioritized search strategies
        const strategies = this.getPrioritizedSearchStrategies(query, queryAnalysis);
        this.onLog(`Using ${strategies.length} search strategies in optimized order`, "process");

        // Try each strategy in priority order
        for (const strategy of strategies) {
            this.onLog(`Trying strategy: ${strategy.name}`, "process");
            result = await this._fetchWikipedia(strategy.query, isLongForm);
            if (result) {
                this.onLog(`✓ Success with strategy: ${strategy.name}`, "success");
                return this._cacheAndReturn(query, result);
            }
        }

        this.onLog("All search strategies failed.", "error");
        return null;
    },

    analyzeQueryForSearch(query) {
        const q = query.toLowerCase();
        const analysis = {
            type: 'general',
            confidence: 0.5,
            hasProperNoun: false,
            hasAcronym: false,
            hasNumbers: false,
            isScientific: false,
            isComparison: false
        };

        // Detect proper nouns (capitalized words)
        if (/[A-Z][a-z]+/.test(query)) {
            analysis.hasProperNoun = true;
            analysis.type = 'proper_noun';
            analysis.confidence = 0.9;
        }

        // Detect acronyms (all caps, 2-5 letters)
        if (/\b[A-Z]{2,5}\b/.test(query)) {
            analysis.hasAcronym = true;
            analysis.type = 'acronym';
            analysis.confidence = 0.95;
        }

        // Detect scientific/technical terms
        if (/(acid|cell|molecule|protein|gene|theory|principle|law of|quantum|atomic)/i.test(q)) {
            analysis.isScientific = true;
            analysis.type = 'scientific';
            analysis.confidence = 0.85;
        }

        // Detect comparison queries
        if (/(vs|versus|difference between|compare)/i.test(q)) {
            analysis.isComparison = true;
            analysis.type = 'comparison';
        }

        // Detect number-related queries
        if (/\d/.test(query)) {
            analysis.hasNumbers = true;
        }

        return analysis;
    },

    getPrioritizedSearchStrategies(originalQuery, analysis) {
        const strategies = [];

        // Clean query (remove question words AND creative commands)
        let cleanQuery = originalQuery
            .replace(/^(what is|who is|tell me about|define|search for|meaning of|information on|facts about)\s+/i, '')
            .replace(/^(write|compose|create|make|generate)\s+(a|an)\s+(\d+\s+words?\s+)?(essay|story|poem|article|letter|email|paragraph)\s+(about|on|regarding|for)\s+/i, '')
            .replace(/^(write|compose|create)\s+(about|on)\s+/i, '');

        cleanQuery = cleanQuery.replace(/\?+$/, '').trim();

        // === STRATEGY 1: Use exact proper nouns ===
        if (analysis.hasProperNoun) {
            const properNouns = originalQuery.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
            properNouns.forEach(noun => {
                strategies.push({
                    name: 'Proper Noun Exact',
                    query: noun,
                    priority: 10
                });
            });
        }

        // === STRATEGY 2: Acronym expansion ===
        if (analysis.hasAcronym) {
            const acronym = originalQuery.match(/\b[A-Z]{2,5}\b/);
            if (acronym) {
                strategies.push({
                    name: 'Acronym',
                    query: acronym[0],
                    priority: 9
                });
            }
        }

        // === STRATEGY 3: Cleaned query (highest priority for most) ===
        strategies.push({
            name: 'Cleaned Query',
            query: cleanQuery,
            priority: 8
        });

        // === STRATEGY 4: Extract entities ===
        const entities = this.extractEntities(originalQuery);
        if (entities.keywords.length > 0) {
            entities.keywords.slice(0, 2).forEach(keyword => {
                strategies.push({
                    name: 'Entity Keyword',
                    query: keyword,
                    priority: 7
                });
            });
        }

        // === STRATEGY 5: Multi-word phrases ===
        const phrases = cleanQuery.match(/\b\w+\s+\w+\b/g) || [];
        if (phrases.length > 0) {
            strategies.push({
                name: 'Two-word Phrase',
                query: phrases[0],
                priority: 6
            });
        }

        // === STRATEGY 6: Original query ===
        if (cleanQuery !== originalQuery) {
            strategies.push({
                name: 'Original Query',
                query: originalQuery,
                priority: 5
            });
        }

        // === STRATEGY 7: Singular/plural variations ===
        const expanded = this.expandQuery(cleanQuery);
        expanded.forEach((variant, idx) => {
            if (variant !== cleanQuery) {
                strategies.push({
                    name: 'Singular/Plural Variant',
                    query: variant,
                    priority: 4 - (idx * 0.1)
                });
            }
        });

        // === STRATEGY 8: Remove parentheticals ===
        if (/\(.*\)/.test(cleanQuery)) {
            const withoutParens = cleanQuery.replace(/\s*\(.*?\)\s*/g, ' ').trim();
            strategies.push({
                name: 'Without Parentheticals',
                query: withoutParens,
                priority: 3.5
            });
        }

        // === STRATEGY 9: Only first word ===
        const words = cleanQuery.split(/\s+/);
        if (words.length > 2) {
            strategies.push({
                name: 'First Word Only',
                query: words[0],
                priority: 3
            });
        }

        // === STRATEGY 10: Last significant word ===
        if (words.length > 1) {
            const lastWord = words[words.length - 1];
            if (lastWord.length > 3) {
                strategies.push({
                    name: 'Last Word',
                    query: lastWord,
                    priority: 2.5
                });
            }
        }

        // === STRATEGY 11: Key concepts from sentence ===
        const concepts = entities.concepts.slice(0, 3);
        concepts.forEach((concept, idx) => {
            if (concept && concept.length > 3) {
                strategies.push({
                    name: 'Concept Extraction',
                    query: concept,
                    priority: 2 - (idx * 0.2)
                });
            }
        });

        // === STRATEGY 12: Quote-wrapped terms ===
        const quoted = originalQuery.match(/"([^"]+)"/);
        if (quoted) {
            strategies.push({
                name: 'Quoted Term',
                query: quoted[1],
                priority: 9.5  // High priority if explicitly quoted
            });
        }

        // Sort by priority (highest first), deduplicate, limit to maxAlternativeQueries
        const uniqueStrategies = [];
        const seen = new Set();

        strategies.sort((a, b) => b.priority - a.priority);

        for (const strategy of strategies) {
            const normalized = strategy.query.toLowerCase().trim();
            if (!seen.has(normalized) && normalized.length > 1) {
                seen.add(normalized);
                uniqueStrategies.push(strategy);
            }
        }

        return uniqueStrategies.slice(0, this.maxAlternativeQueries);
    },

    _cacheAndReturn(originalQuery, result) {
        if (this.wikiCache.size >= 50) {
            const firstKey = this.wikiCache.keys().next().value;
            this.wikiCache.delete(firstKey);
        }
        this.wikiCache.set(originalQuery, result);
        return result;
    },

    async searchMultipleAndCombine(queries, isLongForm = false) {
        // Search multiple topics and combine the results
        this.onLog(`📚 Multi-query search for: ${queries.join(', ')}`, "process");

        const results = [];
        for (const query of queries) {
            this.onLog(`  → Searching for: "${query}"`, "data");
            const result = await this._fetchWikipedia(query, isLongForm);
            if (result) {
                results.push({ query, content: result });
                this.onLog(`  ✓ Found information for "${query}"`, "success");
            } else {
                this.onLog(`  ✗ No results for "${query}"`, "warning");
            }
        }

        if (results.length === 0) {
            return null;
        }

        // Combine results with headers
        let combined = "";
        if (results.length > 1) {
            results.forEach((r, idx) => {
                combined += `**${r.query}:**\n${r.content}\n`;
                if (idx < results.length - 1) combined += "\n";
            });
        } else {
            // Single result, just return it
            combined = results[0].content;
        }

        this.onLog(`✓ Combined ${results.length} results`, "success");
        return combined;
    },

    // ========== ADVANCED TOPIC & SEARCH UNDERSTANDING ==========

    extractTopic(query) {
        // Smart topic extraction that handles natural language nuances
        let topic = query.toLowerCase();

        // 0. GOLDEN EXTRACTION STRATEGY (High Priority)
        // If the user explicitly says "write an essay on X", we trust X is the topic
        // This handles "write an essay on lady mc beth" -> "lady mc beth"
        const goldenMatch = query.match(/(?:write|create|make|generate).*(?:essay|story|article|poem)\s+(?:on|about|regarding|titled)\s+(.+)/i);
        if (goldenMatch) {
            let extracted = goldenMatch[1].trim();
            // Still clean up trailing punctuation
            extracted = extracted.replace(/[?.!]+$/, '');
            // If it's not super long (likely a whole sentence), return it
            if (extracted.length < 100) {
                return extracted;
            }
        }

        // 1. Remove polite conversational fillers
        topic = topic.replace(/^(please|could you|can you|would you|i want you to|i'd like you to|hey|hi|hello)\s+/i, '');

        // 2. Remove action verbs and command structures
        const commands = [
            'write a', 'write an', 'write', 'compose', 'create', 'generate', 'make', 'draft',
            'tell me about', 'tell me', 'give me info on', 'give me information about',
            'search for', 'look up', 'find', 'define', 'explain', 'describe', 'what is', 'who is'
        ];

        // Sort by length to match longest phrases first
        commands.sort((a, b) => b.length - a.length);

        for (const cmd of commands) {
            if (topic.startsWith(cmd)) {
                topic = topic.substring(cmd.length).trim();
                break;
            }
        }

        // 3. Remove format specifiers
        const formats = ['essay', 'story', 'poem', 'article', 'paragraph', 'summary', 'overview', 'biography', 'letter', 'email', 'script'];
        const formatRegex = new RegExp(`(^|\\s+)(${formats.join('|')})\\b`, 'gi');
        topic = topic.replace(formatRegex, '').trim();

        topic = topic.replace(/^(short|long|detailed|brief|quick)\s+/i, '');
        topic = topic.replace(/\s+(\d+\s+words?)\b/i, '');

        // 4. Remove prepositions connecting format to topic
        topic = topic.replace(/^(about|on|regarding|concerning|covering|dealing with|for)\s+/i, '');

        // 5. Clean up strict punctuation
        topic = topic.replace(/[?.!]+$/, '').trim();

        // 6. Handle "the topic of X"
        topic = topic.replace(/^the topic of\s+/i, '');

        // Validation
        if (!topic || topic.length < 2 || /^(essay|story|poem|article)$/i.test(topic)) {
            // Try to find ANY capitalized sequence in the original query as a fallback
            const properNouns = query.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
            if (properNouns && properNouns.length > 0) {
                // Return the longest proper noun sequence
                return properNouns.sort((a, b) => b.length - a.length)[0];
            }
            return null;
        }

        // Restore original casing for proper nouns if possible
        const originalWords = query.split(/\s+/);
        const topicWords = topic.split(/\s+/);

        // This is a naive reconstruction but helps with "Shakespeare" vs "shakespeare"
        // (A sophisticated version would use the original string indices)

        return topic;
    },

    generateIntelligentSearchQuery(userQuery, intentAnalysis) {
        this.onLog("🧠 AI analyzing query for optimal search terms...", "process");

        const q = userQuery.toLowerCase();

        // Strategy 1: Explicit "Search for X"
        const searchMatch = userQuery.match(/(?:search for|look up|find info on)\s+(.+)/i);
        if (searchMatch) return searchMatch[1].trim();

        // Strategy 2: Multi-entity Comparison
        if (/(difference between|vs|versus|compare)/i.test(q)) {
            const parts = userQuery.split(/vs\.?|versus|difference between|compare/i);
            if (parts.length > 1) {
                // Extract potential entities (filtering out common words)
                const entities = parts.map(p => this.extractTopic(p.trim())).filter(e => e && e.length > 2);
                if (entities.length >= 2) {
                    this.onLog(`→ Comparison detected: ${entities.join(' vs ')}`, "data");
                    return entities; // Returns array for multi-search
                }
            }
        }

        // Strategy 3: Specific Domain Queries (Government, History, Science)

        // Government/Leadership
        if (/president|minister|king|queen|leader|governor|mayor|ceo/i.test(q)) {
            // "President of X" -> Search "Politics of X" or just "X" if it's a country
            const ofMatch = userQuery.match(/(?:of|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
            if (ofMatch) return ofMatch[1];
        }

        // History
        if (/history|origin|background|founded|started/i.test(q)) {
            // "History of the internet" -> "History of the Internet"
            // Often Wikipedia has specific "History of X" pages
            const subject = this.extractTopic(userQuery);
            if (subject) return `History of ${subject}`;
        }

        // Strategy 4: Proper Noun Extraction (The "Best Guess")
        // If we see capitalized words in the middle of a sentence, those are likely the topic
        const properNouns = userQuery.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
        if (properNouns && properNouns.length > 0) {
            // Filter out common sentence starters if they aren't part of a name
            const filtered = properNouns.filter(n => !['What', 'Who', 'Where', 'When', 'Why', 'How', 'Tell', 'Write', 'Please'].includes(n));

            if (filtered.length > 0) {
                // Sort by length (longest usually most specific)
                const bestGuess = filtered.sort((a, b) => b.length - a.length)[0];
                this.onLog(`→ Extracted Entity: "${bestGuess}"`, "data");
                return bestGuess;
            }
        }

        // Strategy 5: Generic Subject Extraction (Fallback)
        // Use our improved topic extractor
        const smartTopic = this.extractTopic(userQuery);
        if (smartTopic) {
            this.onLog(`→ Extracted Subject: "${smartTopic}"`, "data");
            return smartTopic;
        }

        // Strategy 6: Last Resort - meaningful words
        // Filter out stopwords
        const stopWords = ['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'is', 'are', 'was', 'were'];
        const words = userQuery.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/);
        const meaningful = words.filter(w => !stopWords.includes(w.toLowerCase()) && w.length > 2);

        return meaningful.join(' ');
    },

    async _fetchWikipedia(searchTerm, isLongForm = false) {
        // STEP 1: Try exact title search (Fastest, best quality)
        let url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&redirects=1&origin=*&titles=${encodeURIComponent(searchTerm)}`;
        try {
            this.onLog(`Wikipedia: Fetching "${url}"...`, "data");
            let res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

            let data = await res.json();
            let pages = data.query.pages;
            let pageId = Object.keys(pages)[0];

            // If exact search failed (pageId -1), try FUZZY/OPEN SEARCH
            if (pageId === "-1") {
                this.onLog(`Wikipedia: No exact match for "${searchTerm}". Trying fuzzy search...`, "warning");

                // Opensearch/Search API to find the closest match
                // list=search is better for finding "Closest" page
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&format=json&origin=*`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();

                if (searchData.query.search && searchData.query.search.length > 0) {
                    const bestMatch = searchData.query.search[0].title;
                    this.onLog(`Wikipedia: Fuzzy match found -> "${bestMatch}"`, "success");

                    // Re-fetch with the CORRECT title
                    const correctUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&redirects=1&origin=*&titles=${encodeURIComponent(bestMatch)}`;
                    res = await fetch(correctUrl);
                    data = await res.json();
                    pages = data.query.pages;
                    pageId = Object.keys(pages)[0];
                } else {
                    return null; // Truly nothing found
                }
            }

            // Double check we have a valid page now
            if (pageId === "-1") {
                this.onLog(`Wikipedia: No page found for "${searchTerm}" after fuzzy search.`, "warning");
                return null;
            }

            const extract = pages[pageId].extract;
            if (!extract || extract.includes("refer to:") || extract.includes("may refer to")) return null;

            const sentences = extract.split('. ').filter(s => s.trim().length > 20);
            const sentenceCount = isLongForm ? 12 : 5; // Slightly increased for better context
            let summary = sentences.slice(0, sentenceCount).join('. ');

            // Ensure proper ending
            if (summary.length > 0 && !summary.endsWith('.')) {
                summary += '.';
            }

            // Clean up any double periods or weird spacing
            summary = summary.replace(/\.\s*\./g, '.').trim();

            if (summary.length < 50) return null;

            this.onLog(`Wikipedia: ✓ Found "${searchTerm}"`, "success");
            return summary;
        } catch (e) {
            console.error("Wikipedia API Error:", e);
            this.onLog(`Wikipedia: Network Error - ${e.message}`, "error");
            if (window.location.protocol === 'file:') {
                this.onLog("NOTE: Live search often fails on local files due to browser security (CORS). Upload to GitHub to fix.", "warning");
            }
            return null;
        }
    },

    // ========== PARAPHRASING SYSTEM ==========

    // ========== ADVANCED PARAPHRASING SYSTEM ==========

    paraphraseText(text, style = 'neutral') {
        if (!text || text.length < 5) return text;

        this.onLog(`Paraphrasing with style: ${style}`, "process");

        // styles: 'neutral', 'formal', 'casual', 'concise', 'elaborate', 'academic', 'creative', 'witty'
        let paraphrased = text;

        // Pre-processing
        const originalWords = text.split(/\s+/).length;

        // Apply style-specific transformations
        switch (style.toLowerCase()) {
            case 'formal':
            case 'professional':
                paraphrased = this.applyFormalTone(text);
                break;
            case 'casual':
            case 'informal':
                paraphrased = this.applyCasualTone(text);
                break;
            case 'concise':
            case 'brief':
            case 'short':
            case 'simplify':
                paraphrased = this.applyConciseTone(text);
                break;
            case 'elaborate':
            case 'detailed':
            case 'expanded':
                paraphrased = this.applyElaborateTone(text);
                break;
            case 'academic':
            case 'scholarly':
                paraphrased = this.applyAcademicTone(text);
                break;
            case 'creative':
            case 'flowery':
                paraphrased = this.applyCreativeTone(text);
                break;
            case 'witty':
            case 'funny':
                paraphrased = this.applyWittyTone(text);
                break;
            default:
                // Neutral - intelligent synonym replacement
                paraphrased = this.featureRichSynonymReplacement(text, 'neutral');
        }

        // Post-processing check: Ensure we didn't butcher the meaning too much
        // (Basic length check for now)
        if (paraphrased.length < text.length * 0.3) {
            this.onLog("Paraphrase overly aggressive, reverting slightly.", "warning");
            return this.applyAustralianTone(text); // Safety fallback with AU spelling
        }

        return this.applyAustralianTone(paraphrased);
    },

    applyAustralianTone(text) {
        if (!text) return text;
        let t = text;

        // 1. Spelling Conversion (US -> AU/UK)
        const spellingMap = {
            "color": "colour", "honor": "honour", "labor": "labour", "favor": "favour", "neighbor": "neighbour",
            "center": "centre", "theater": "theatre", "meter": "metre", "liter": "litre",
            "organize": "organise", "realize": "realise", "analyze": "analyse", "paralyze": "paralyse",
            "defense": "defence", "license": "licence", "offense": "offence", "practice": "practise", // verb distinction is tricky, defaulting to s for verbs usually but c for nouns. keeping simple for now
            "program": "programme", "catalog": "catalogue", "dialog": "dialogue",
            "traveler": "traveller", "jewelry": "jewellery", "check": "cheque" // Context dependent, but okay for general
        };

        // Apply spelling fixes
        for (const [us, au] of Object.entries(spellingMap)) {
            // Match whole words, case insensitive
            t = t.replace(new RegExp(`\\b${us}\\b`, 'gi'), (match) => {
                // Preserve case
                if (match === match.toUpperCase()) return au.toUpperCase();
                if (match[0] === match[0].toUpperCase()) return au.charAt(0).toUpperCase() + au.slice(1);
                return au;
            });
            // Handle suffixes like -ing, -ed, -s for some
            if (us.endsWith('ize')) {
                const root = us.slice(0, -3);
                const auRoot = au.slice(0, -3);
                t = t.replace(new RegExp(`\\b${root}izing\\b`, 'gi'), `${auRoot}ising`);
                t = t.replace(new RegExp(`\\b${root}ized\\b`, 'gi'), `${auRoot}ised`);
                t = t.replace(new RegExp(`\\b${root}izes\\b`, 'gi'), `${auRoot}ises`);
            }
        }

        return t;
    },

    isFormalContext(text) {
        // Simple check for formal words
        return /therefore|furthermore|consequently|regarding|sincerely|hereby/i.test(text);
    },

    applyFormalTone(text) {
        let t = text;
        // Expand contractions
        const contractions = {
            "can't": "cannot", "won't": "will not", "don't": "do not", "didn't": "did not",
            "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
            "haven't": "have not", "hasn't": "has not", "hadn't": "had not", "shouldn't": "should not",
            "wouldn't": "would not", "couldn't": "could not", "i'm": "I am", "you're": "you are",
            "they're": "they are", "we're": "we are", "it's": "it is", "let's": "let us"
        };
        for (const [key, val] of Object.entries(contractions)) {
            t = t.replace(new RegExp(`\\b${key}\\b`, 'gi'), val);
        }

        // Formal vocabulary mapping
        const vocab = {
            "get": "acquire", "got": "obtained", "buy": "purchase", "need": "require",
            "ask": "inquire", "check": "verify", "tell": "inform", "help": "assist",
            "start": "commence", "end": "conclude", "use": "utilize", "show": "demonstrate",
            "bad": "detrimental", "good": "beneficial", "big": "substantial", "small": "minimal",
            "happy": "gratified", "sad": "disheartened", "really": "significantly", "maybe": "perhaps",
            "make": "construct", "fix": "rectify", "job": "occupation", "smart": "intelligent",
            "guess": "estimate", "hard": "arduous", "easy": "effortless", "wrong": "incorrect",
            "right": "accurate", "idea": "concept", "think": "perceive", "funny": "humorous"
        };

        return this.replaceVocab(t, vocab);
    },

    applyCasualTone(text) {
        let t = text;
        // Add contractions
        const expansions = {
            "cannot": "can't", "will not": "won't", "do not": "don't", "did not": "didn't",
            "is not": "isn't", "are not": "aren't", "was not": "wasn't", "were not": "weren't",
            "have not": "haven't", "has not": "hasn't", "should not": "shouldn't", "could not": "couldn't"
        };
        for (const [key, val] of Object.entries(expansions)) {
            t = t.replace(new RegExp(`\\b${key}\\b`, 'gi'), val);
        }

        const vocab = {
            "acquire": "get", "purchase": "buy", "require": "need", "inquire": "ask",
            "verify": "check", "inform": "tell", "assist": "help", "commence": "start",
            "conclude": "end", "utilize": "use", "demonstrate": "show", "detrimental": "bad",
            "beneficial": "good", "substantial": "big", "minimal": "small", "gratified": "happy",
            "significantly": "really", "perhaps": "maybe", "construct": "make", "rectify": "fix",
            "occupation": "job", "intelligent": "smart", "estimate": "guess", "arduous": "hard",
            "effortless": "easy", "item": "thing", "items": "things"
        };

        // Add some casual fillers occasionally
        t = this.replaceVocab(t, vocab);
        if (Math.random() > 0.7 && !t.includes("like,")) {
            t = t.replace(/, /g, ", like, ");
        }
        return t;
    },

    applyConciseTone(text) {
        // Remove fluff words
        let t = text;
        const fluff = ["basically", "essentially", "literally", "actually", "very", "really", "quite", "somewhat", "in order to", "due to the fact that"];
        fluff.forEach(word => {
            t = t.replace(new RegExp(`\\b${word}\\b`, 'gi'), "");
        });

        // Shorten phrases
        const shorts = {
            "at this point in time": "now", "in the event that": "if", "on a daily basis": "daily",
            "reach a decision": "decide", "make a choice": "choose", "give an indication": "indicate",
            "take into consideration": "consider", "make an adjustment": "adjust"
        };

        t = this.replaceVocab(t, shorts);
        return t.replace(/\s+/g, ' ').trim(); // Clean up spaces
    },

    applyElaborateTone(text) {
        // Identify simple sentences and expand them
        const sentences = text.split('. ');
        return sentences.map(s => {
            if (s.length < 50 && Math.random() > 0.4) {
                const openers = [
                    "It is important to note that ", "Considering the context, ", "In particular, ",
                    "Upon closer inspection, ", "Interestingly enough, "
                ];
                const closers = [
                    ", which significantly impacts the outcome", ", adding a layer of complexity",
                    ", demonstrating the nuance of the situation", ", as many experts have observed"
                ];

                // Add opener OR closer
                if (Math.random() > 0.5) {
                    return openers[Math.floor(Math.random() * openers.length)] + s.charAt(0).toLowerCase() + s.slice(1);
                } else {
                    return s + closers[Math.floor(Math.random() * closers.length)];
                }
            }
            return s;
        }).join('. ');
    },

    applyAcademicTone(text) {
        // High-level vocabulary
        const vocab = {
            "think": "hypothesize", "change": "modify", "find": "ascertain", "show": "illustrate",
            "bad": "adverse", "lots of": "a plethora of", "idea": "notion", "problem": "issue",
            "look at": "examine", "talk about": "discuss", "get": "derive", "use": "employ"
        };
        let t = this.replaceVocab(text, vocab);

        // Passive voice injection (classic academic style)
        t = t.replace(/\bwe (found|saw|noticed)\b/gi, "it was observed");
        t = t.replace(/\bI (believe|think)\b/gi, "it is suggested");

        return t;
    },

    applyCreativeTone(text) {
        // Vivid imagery
        const vocab = {
            "red": "crimson", "blue": "azure", "green": "emerald", "bright": "luminous",
            "dark": "shadowy", "fast": "swift", "slow": "languid", "happy": "euphoric",
            "sad": "melancholic", "walk": "wander", "run": "sprint", "look": "gaze"
        };
        return this.replaceVocab(text, vocab);
    },

    applyWittyTone(text) {
        let t = this.applyCasualTone(text); // Base casual

        // Insert mild sarcasm or wit
        const inserts = [
            " - shocker, right?", " (who would have thought?)", ", oddly enough,",
            " - keeping things interesting,", ", specifically speaking,"
        ];

        if (Math.random() > 0.5) {
            const parts = t.split(/[,.]/);
            if (parts.length > 1) {
                // Insert distinct wit at first clause
                const validParts = parts.filter(p => p.length > 10);
                if (validParts.length > 0) {
                    // Complex replacement to avoid breaking grammar too badly
                    // For now, simple append to sentence end is safer
                    t = t.trim();
                    if (t.endsWith('.')) t = t.slice(0, -1);
                    t += inserts[Math.floor(Math.random() * inserts.length)] + ".";
                }
            }
        }
        return t;
    },

    featureRichSynonymReplacement(text, style) {
        // Used for the default/neutral case
        // More subtle than the heavy-handed approach
        const vocab = {
            "basically": "essentially", "important": "crucial", "good": "positive",
            "bad": "negative", "happy": "content", "sad": "upset", "big": "large",
            "small": "tiny", "fast": "quick", "slow": "gradual"
        };
        return this.replaceVocab(text, vocab);
    },

    replaceVocab(text, map) {
        let regexStr = "\\b(" + Object.keys(map).join("|") + ")\\b";
        let regex = new RegExp(regexStr, "gi");

        return text.replace(regex, (matched) => {
            const lower = matched.toLowerCase();
            const replacement = map[lower] || matched;

            // Preserve capitalization
            if (matched[0] === matched[0].toUpperCase()) {
                return replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }
            return replacement;
        });
    },

    // ========== END ADVANCED PARAPHRASING SYSTEM ==========

    // ========== END PARAPHRASING SYSTEM ==========


    // Content Safety Filter Method
    applySafetyFilter(text) {
        if (!text) return text;

        let filteredText = text;
        let hasViolation = false;

        // Check for inappropriate content
        for (const pattern of this.contentSafetyFilter) {
            if (pattern.test(filteredText)) {
                hasViolation = true;
                // Replace inappropriate words with asterisks
                filteredText = filteredText.replace(pattern, (match) => '*'.repeat(match.length));
            }
        }

        if (hasViolation) {
            this.onLog("Content safety filter applied", "warning");
        }

        return filteredText;
    },

    // Enhanced Brainstorming Method - Works for ANY topic
    generateBrainstormIdeas(topic) {
        this.onLog(`Generating brainstorm ideas for: "${topic}"`, "process");

        const ideas = [];
        const topicType = this.detectTopicType(topic);

        // Generate 6-8 unique ideas based on topic type
        const numberOfIdeas = 6 + Math.floor(Math.random() * 3);

        for (let i = 0; i < numberOfIdeas; i++) {
            const idea = this.generateContextualIdea(topic, topicType, i);
            if (idea) {
                ideas.push(`${i + 1}. ${idea}`);
            }
        }

        return ideas.join('\n\n');
    },

    detectTopicType(topic) {
        const t = topic.toLowerCase();

        // Concrete items (fashion, food, gadgets)
        if (/outfit|cloth|wear|fashion|dress|shirt|pants|shoe|accessory|jewelry/i.test(t)) return 'fashion';
        if (/food|meal|recipe|dish|snack|drink|cuisine/i.test(t)) return 'food';
        if (/gadget|device|tool|product|item/i.test(t)) return 'product';

        // Activities and hobbies
        if (/activity|activities|hobby|hobbies|thing to do|ways to/i.test(t)) return 'activity';
        if (/game|sport|exercise|workout/i.test(t)) return 'activity';

        // Business and professional
        if (/business|startup|company|venture|service/i.test(t)) return 'business';
        if (/app|software|platform|website|tool/i.test(t)) return 'tech';

        // Creative projects
        if (/project|creative|art|design|content|campaign/i.test(t)) return 'creative';
        if (/story|book|film|music|video|podcast/i.test(t)) return 'creative';

        // Learning and education
        if (/learn|study|course|skill|topic|subject/i.test(t)) return 'learning';

        // Travel and exploration
        if (/travel|trip|vacation|holiday|visit|tour|destination|explore/i.test(t)) return 'travel';


        // Default
        return 'general';
    },

    generateContextualIdea(topic, type, index) {
        switch (type) {
            case 'fashion':
                return this.generateFashionIdea(topic, index);
            case 'food':
                return this.generateFoodIdea(topic, index);
            case 'activity':
                return this.generateActivityIdea(topic, index);
            case 'business':
                return this.generateBusinessIdea(topic, index);
            case 'tech':
                return this.generateTechIdea(topic, index);
            case 'creative':
                return this.generateCreativeIdea(topic, index);
            case 'product':
                return this.generateProductIdea(topic, index);
            case 'learning':
                return this.generateLearningIdea(topic, index);
            case 'travel':
                return this.generateTravelIdea(topic, index);
            default:
                return this.generateGeneralIdea(topic, index);
        }
    },

    generateFashionIdea(topic, index) {
        const styles = ['minimalist monochrome', 'vintage-inspired', 'modern athleisure', 'bohemian layered',
            'classic tailored', 'streetwear casual', 'elegant sophisticated', 'eclectic mixed-pattern'];
        const occasions = ['work meetings', 'casual weekends', 'date nights', 'outdoor adventures',
            'formal events', 'creative gatherings', 'everyday comfort', 'special celebrations'];
        const features = ['comfortable and practical', 'statement-making bold', 'seasonally appropriate',
            'versatile mix-and-match', 'trend-forward unique', 'timeless classic'];

        const templates = [
            `${styles[index % styles.length]} look perfect for ${occasions[index % occasions.length]}`,
            `${features[index % features.length]} ensemble with ${styles[(index + 2) % styles.length]} vibes`,
            `Layer textures and colors for a ${styles[(index + 1) % styles.length]} aesthetic`,
            `${occasions[(index + 3) % occasions.length]} outfit featuring ${features[(index + 1) % features.length]} pieces`,
            `Experiment with a ${styles[(index + 3) % styles.length]} style mixing unexpected elements`,
        ];

        return templates[index % templates.length];
    },

    generateFoodIdea(topic, index) {
        const cuisines = ['Mediterranean', 'Asian fusion', 'comfort food', 'farm-to-table', 'plant-based', 'artisanal'];
        const styles = ['quick weeknight', 'gourmet weekend', 'healthy balanced', 'indulgent treat', 'meal-prep friendly'];

        const templates = [
            `How about a ${styles[index % styles.length]} ${cuisines[index % cuisines.length]} dish?`,
            `Try a ${cuisines[(index + 1) % cuisines.length]} meal with ${styles[(index + 2) % styles.length]} elements.`,
            `A ${styles[(index + 3) % styles.length]} option featuring ${cuisines[(index + 2) % cuisines.length]} flavors.`,
            `Consider a ${cuisines[(index + 3) % cuisines.length]} inspired banquet.`,
            `Why not make something ${styles[(index + 1) % styles.length]} using ${cuisines[index % cuisines.length]} techniques?`
        ];

        return templates[index % templates.length];
    },

    generateActivityIdea(topic, index) {
        const approaches = ['social group', 'solo mindful', 'challenging skill-building', 'relaxing therapeutic',
            'outdoor adventure', 'creative expression', 'fitness-focused', 'community service'];
        const benefits = ['stress relief', 'personal growth', 'physical wellness', 'social connection', 'creativity', 'mindfulness'];

        const templates = [
            `${approaches[index % approaches.length]} approach focusing on ${benefits[index % benefits.length]}`,
            `Try ${topic} as a ${approaches[(index + 2) % approaches.length]} experience`,
            `Combine ${topic} with ${benefits[(index + 1) % benefits.length]} for holistic wellness`,
        ];

        return templates[index % templates.length];
    },

    generateBusinessIdea(topic, index) {
        const models = ['subscription service', 'marketplace platform', 'consulting agency', 'SaaS solution', 'community hub', 'B2B service'];
        const innovations = ['AI-powered', 'sustainability-focused', 'mobile-first', 'data-driven', 'social impact', 'automation-based'];

        const templates = [
            `${innovations[index % innovations.length]} ${models[index % models.length]} for ${topic}`,
            `Launch a ${models[(index + 1) % models.length]} that revolutionizes ${topic}`,
            `Create an ${innovations[(index + 2) % innovations.length]} approach to ${topic}`,
        ];

        return templates[index % templates.length];
    },

    generateTechIdea(topic, index) {
        const tech = ['AI/ML', 'blockchain', 'VR/AR', 'IoT', 'cloud-based', 'mobile app', 'web platform', 'API service'];
        const features = ['automation', 'personalization', 'real-time collaboration', 'predictive analytics', 'gamification', 'social integration'];

        const templates = [
            `${tech[index % tech.length]} ${topic} with ${features[index % features.length]} features`,
            `Build a ${tech[(index + 1) % tech.length]} solution that adds ${features[(index + 2) % features.length]} to ${topic}`,
            `${topic} platform leveraging ${tech[(index + 2) % tech.length]} for ${features[(index + 1) % features.length]}`,
        ];

        return templates[index % templates.length];
    },

    generateCreativeIdea(topic, index) {
        const mediums = ['photography series', 'short film', 'interactive installation', 'podcast series',
            'social media campaign', 'illustrated blog', 'video documentary', 'digital art collection'];
        const themes = ['personal storytelling', 'social commentary', 'cultural exploration', 'experimental abstract',
            'community voices', 'historical perspective', 'future vision'];

        const templates = [
            `${mediums[index % mediums.length]} exploring ${topic} through ${themes[index % themes.length]}`,
            `${themes[(index + 1) % themes.length]} ${mediums[(index + 2) % mediums.length]} centered on ${topic}`,
            `Create a ${mediums[(index + 1) % mediums.length]} that reimagines ${topic} with ${themes[(index + 2) % themes.length]}`,
        ];

        return templates[index % templates.length];
    },

    generateProductIdea(topic, index) {
        const features = ['eco-friendly', 'smart/connected', 'customizable', 'portable', 'multifunctional', 'premium quality'];
        const markets = ['busy professionals', 'environmentally conscious consumers', 'tech enthusiasts',
            'minimalists', 'families', 'creative individuals'];

        const templates = [
            `${features[index % features.length]} ${topic} designed for ${markets[index % markets.length]}`,
            `Innovative ${topic} with ${features[(index + 1) % features.length]} features targeting ${markets[(index + 2) % markets.length]}`,
        ];

        return templates[index % templates.length];
    },

    generateLearningIdea(topic, index) {
        const formats = ['online course', 'workshop series', 'mentorship program', 'self-paced bootcamp',
            'certification program', 'community learning circle', 'practical project-based'];
        const approaches = ['beginner-friendly', 'advanced mastery', 'hands-on practical', 'theory and application', 'collaborative peer'];

        const templates = [
            `${approaches[index % approaches.length]} ${formats[index % formats.length]} for ${topic}`,
            `${formats[(index + 1) % formats.length]} with ${approaches[(index + 2) % approaches.length]} approach to ${topic}`,
        ];

        return templates[index % templates.length];
    },

    generateTravelIdea(topic, index) {
        const types = ['road trip', 'backpacking adventure', 'luxury retreat', 'cultural immersion', 'eco-tourism', 'city break'];
        const activities = ['local cuisine tasting', 'hiking hidden trails', 'historical sightseeing', 'meeting locals', 'photography tour', 'relaxation'];

        const templates = [
            `Plan a ${types[index % types.length]} focused on ${activities[index % activities.length]}`,
            `Explore ${topic} through a ${types[(index + 1) % types.length]} lens`,
            `Combine ${activities[(index + 2) % activities.length]} with a ${types[(index + 2) % types.length]} in ${topic}`,
            `Discover the hidden gems of ${topic} on a ${types[(index + 3) % types.length]}`
        ];

        return templates[index % templates.length];
    },

    generateGeneralIdea(topic, index) {
        const approaches = ['innovative', 'community-driven', 'sustainable', 'technology-enhanced', 'collaborative', 'experimental'];
        const actions = ['platform', 'initiative', 'project', 'movement', 'solution', 'approach'];

        const templates = [
            `${approaches[index % approaches.length]} ${actions[index % actions.length]} for ${topic}`,
            `Create a ${approaches[(index + 1) % approaches.length]} way to approach ${topic}`,
            `Launch a ${actions[(index + 2) % actions.length]} that reimagines ${topic} using ${approaches[(index + 2) % approaches.length]} methods`,
        ];

        return templates[index % templates.length];
    },

    generateCustomBrainstormIdea(topic) {
        const ideaPrefixes = [
            "What if we could",
            "Imagine creating",
            "Consider developing",
            "How about building",
            "Picture designing"
        ];

        const ideaMiddles = [
            "a revolutionary way to approach",
            "an entirely new perspective on",
            "a collaborative platform centered around",
            "a data-driven solution for",
            "a community-focused initiative for"
        ];

        const ideaSuffixes = [
            "that empowers individuals to make a difference",
            "bringing together diverse perspectives",
            "using cutting-edge innovation",
            "that creates lasting positive impact",
            "transforming how people engage with the world"
        ];

        const prefix = ideaPrefixes[Math.floor(Math.random() * ideaPrefixes.length)];
        const middle = ideaMiddles[Math.floor(Math.random() * ideaMiddles.length)];
        const suffix = ideaSuffixes[Math.floor(Math.random() * ideaSuffixes.length)];

        return `${prefix} ${middle} ${topic || 'this concept'}, ${suffix}?`;
    },

    generateFusionIdea(topic) {
        const domains = ['Bio-mimicry', 'Cyberpunk', 'Minimalism', 'Quantum mechanics', 'Retro-futurism', 'Social psychology', 'Sustainable design'];
        const actions = ['gamify', 'decentralize', 'visualize', 'automate', 'democratize', 'hybridize', 'remix'];
        const outputs = ['mobile app', 'urban installation', 'wearable device', 'subscription box', 'community platform', 'short film', 'AI assistant'];

        const d = domains[Math.floor(Math.random() * domains.length)];
        const a = actions[Math.floor(Math.random() * actions.length)];
        const o = outputs[Math.floor(Math.random() * outputs.length)];

        return `**Fusion Concept**: A unique ${o} that uses **${d}** principles to **${a}** the experience of ${topic}.`;
    },

    generateBrainstormIdeas(topic) {
        // Detect topic type
        const t = topic.toLowerCase();
        let type = 'general';

        if (/fashion|clothes|wear|outfit|style|dress|shirt|shoes/i.test(t)) type = 'fashion';
        else if (/food|cook|recipe|dinner|lunch|meal|eat|diet/i.test(t)) type = 'food';
        else if (/hobby|activity|fun|weekend|time|learn/i.test(t)) type = 'activity';
        else if (/business|startup|company|market|sell|money/i.test(t)) type = 'business';
        else if (/app|software|tech|code|program|web|site/i.test(t)) type = 'tech';
        else if (/story|plot|character|write|novel|book/i.test(t)) type = 'creative';
        else if (/product|invent|device|gadget/i.test(t)) type = 'product';
        else if (/course|teach|class|study|education/i.test(t)) type = 'learning';
        else if (/travel|trip|vacation|holiday/i.test(t)) type = 'travel';

        // Generate 4 distinct ideas
        let ideas = [];
        for (let i = 0; i < 4; i++) {
            // Mix specific type ideas with one "custom" creative idea
            if (i === 3) {
                ideas.push(`* ${this.generateCustomBrainstormIdea(topic)}`);
            } else {
                ideas.push(`* ${this.generateContextualIdea(topic, type, i)}`);
            }
        }

        return ideas.join('\n\n');
    },

    paraphraseText(text, style = 'neutral') {
        if (!text) return "";

        // Concise / Summarize
        if (style === 'concise') {
            return this.summarizeText(text);
        }

        // Elaborate / Detail
        if (style === 'elaborate') {
            // Try to add knowledge-based details
            const keywords = this.extractKeywords(text);
            let addedDetail = "";

            // Try to find relevant info for the top keyword
            if (keywords.length > 0) {
                const bestKeyword = keywords[0]; // Assume first is most important
                const tokens = this.tokenize(bestKeyword);
                const docs = this.retrieveRelevant(tokens);

                // Lowered threshold to 0.25 to catch more relevant info
                if (docs.length > 0 && docs[0].score > 0.25) {
                    addedDetail = docs[0].doc.a;
                }
            }

            // Expand the text itself (simple heuristics)
            let expanded = text
                .replace(/\b(it's)\b/gi, "it is")
                .replace(/\b(can't)\b/gi, "cannot")
                .replace(/\b(won't)\b/gi, "will not")
                .replace(/\b(don't)\b/gi, "do not")
                .replace(/\b(I'm)\b/gi, "I am")
                .replace(/\b(good)\b/gi, "excellent and beneficial")
                .replace(/\b(bad)\b/gi, "suboptimal and unfavorable")
                .replace(/\b(big)\b/gi, "significant and substantial")
                .replace(/\b(important)\b/gi, "crucial and noteworthy");

            if (addedDetail && !expanded.includes(addedDetail.substring(0, 20))) {
                return `${expanded}\n\n**Additional Context:** ${addedDetail}`;
            }
            return expanded;
        }

        // Formal
        if (style === 'formal' || style === 'academic') {
            return text
                .replace(/\b(can't)\b/gi, "cannot")
                .replace(/\b(won't)\b/gi, "will not")
                .replace(/\b(don't)\b/gi, "do not")
                .replace(/\b(doesn't)\b/gi, "does not")
                .replace(/\b(I'm)\b/gi, "I am")
                .replace(/\b(you're)\b/gi, "you are")
                .replace(/\b(kids)\b/gi, "children")
                .replace(/\b(guy|dude)\b/gi, "individual")
                .replace(/\b(awesome|cool)\b/gi, "remarkable")
                .replace(/\b(get)\b/gi, "obtain")
                .replace(/\b(need)\b/gi, "require")
                // Replace exclamation marks with periods for formal tone, except in quotes
                .replace(/!/g, ".");
        }

        // Casual
        if (style === 'casual' || style === 'witty') {
            return text
                .replace(/\b(cannot)\b/gi, "can't")
                .replace(/\b(will not)\b/gi, "won't")
                .replace(/\b(do not)\b/gi, "don't")
                .replace(/\b(does not)\b/gi, "doesn't")
                .replace(/\b(I am)\b/gi, "I'm")
                .replace(/\b(you are)\b/gi, "you're")
                .replace(/\b(children)\b/gi, "kids")
                .replace(/\b(hello)\b/gi, "hey")
                .replace(/\b(yes)\b/gi, "yep")
                .replace(/\b(no)\b/gi, "nope");
        }

        // Simple
        if (style === 'simple') {
            return text
                .replace(/\b(utilize)\b/gi, "use")
                .replace(/\b(assist)\b/gi, "help")
                .replace(/\b(commence)\b/gi, "start")
                .replace(/\b(terminate)\b/gi, "end")
                .replace(/\b(sufficient)\b/gi, "enough")
                .replace(/\b(incorrect)\b/gi, "wrong")
                .replace(/\b(demonstrate)\b/gi, "show")
                .replace(/\b(construct)\b/gi, "build");
        }

        return text;
    },

    // ========== CONVERSATIONAL ENGINE ==========

    // Advanced Feedback Regeneration
    async generateRefinedResponse(query, issueType, originalResponse) {
        this.onLog(`Refining response for issue: ${issueType}`, "process");

        let refinementPrompt = "";

        if (issueType === 'too_simple') {
            refinementPrompt = `elaborate on ${query} with more technical details and depth`;
        } else if (issueType === 'too_complex') {
            refinementPrompt = `explain ${query} simply like I'm 5`;
        } else if (issueType === 'inaccurate') {
            // Force search if accuracy is questioned
            this.onLog("Accuracy challenged - engaging deep search", "warning");
            const wikiResult = await this.searchWikipedia(query, true); // Force long search
            if (wikiResult) {
                return { text: `I apologize for the inaccuracy. Here is verified information from Wikipedia:\n\n${wikiResult}`, sources: ["Wikipedia (Verified)"] };
            }
            refinementPrompt = `correct the information about ${query}`;
        } else if (issueType === 'too_long') {
            refinementPrompt = `summarize this briefly: ${query}`;
        } else if (issueType === 'too_short') {
            refinementPrompt = `expand on this in detail: ${query}`;
        } else if (issueType === 'wrong_tone') {
            refinementPrompt = `rewrite this with a different tone: ${query}`;
        } else {
            refinementPrompt = `improve the answer for ${query}`;
        }

        // Recursive call with specific instructions
        return await this._generateResponseInternal(refinementPrompt);
    },

    shouldAskFollowUp(query, responseText) {
        // Don't follow up on short greetings or if already asking a question
        if (responseText.length < 50 || responseText.includes('?')) return false;
        // 30% chance to follow up on substantial responses
        return Math.random() > 0.7;
    },

    generateFollowUpQuestion(topic) {
        const starters = [
            "Does that make sense to you?",
            `Have you explored ${topic} before?`,
            "Would you like more specific details on any part of that?",
            "What are your thoughts on this approach?",
            "Shall I dig deeper into the history of this?"
        ];
        return starters[Math.floor(Math.random() * starters.length)];
    },

    generateConversationalResponse(intent, query, context) {
        const q = query.toLowerCase();

        // 1. Casual / Small Talk
        if (intent === 'casual' || intent === 'greeting' || intent === 'personal_sharing') {
            // Handle personal sharing specifically
            if (intent === 'personal_sharing') {
                return { text: this.generateConversationalFallback(q), sources: ["Conversational"] };
            }

            // Context check: Don't excessively greet if we just did
            const lastResponse = this.recentOutputs.length > 0 ? this.recentOutputs[this.recentOutputs.length - 1] : "";
            if (intent === 'greeting' && /hello|hi|good|greetings/i.test(lastResponse)) {
                return { text: "I'm still here! What's on your mind?", sources: ["Conversational"] };
            }

            if (/how are you|how.*doing/i.test(q)) {
                return { text: "I'm functioning perfectly, thanks for asking! I'm ready to help you with research, writing, or just chatting. How can I help you today?", sources: ["Conversational"] };
            }
            if (/what.*up|waddup|sup/i.test(q)) {
                const responses = [
                    "Not much, just processing data and ready to assist. What's up with you?",
                    "Everything is running smoothly here. What can I do for you?",
                    "Just waiting for your next great idea! What are we working on?"
                ];
                return { text: responses[Math.floor(Math.random() * responses.length)], sources: ["Conversational"] };
            }
            if (/who.*you/i.test(q) || /what.*you/i.test(q) && !/doing/i.test(q)) {
                return {
                    text: "I am Guahh AI, a sophisticated virtual assistant designed to help you with coding, creative writing, and complex problem-solving. My goal is to make your work easier and more creative.",
                    sources: ["Identity Core"]
                };
            }

            // Time-Aware & Varied Greetings
            const hour = new Date().getHours();
            let timeGreeting = "Hello";
            if (hour < 12) timeGreeting = "Good morning";
            else if (hour < 18) timeGreeting = "Good afternoon";
            else timeGreeting = "Good evening";

            const fallbacks = [
                `${timeGreeting}! It's great to connect with you. What would you like to explore today?`,
                "Hello! I'm ready for anything. What's the plan?",
                "Hey there! Good to see you. How can I help?",
                "Greetings! I'm at your service for coding, writing, or research."
            ];
            return { text: fallbacks[Math.floor(Math.random() * fallbacks.length)], sources: ["Conversational"] };
        }

        // 2. Gratitude
        if (intent === 'gratitude') {
            const responses = [
                "You're very welcome! Let me know if you need anything else.",
                "Happy to help!",
                "No problem at all. Is there anything else I can do for you?",
                "Glad I could be of assistance!"
            ];
            return { text: responses[Math.floor(Math.random() * responses.length)], sources: ["Conversational"] };
        }

        // 3. Farewell
        if (intent === 'farewell') {
            return { text: "Goodbye! Have a wonderful day. I'll be here if you need me.", sources: ["Conversational"] };
        }

        // 4. Opinion / Advice (Simulated)
        if (intent === 'opinion' || intent === 'recommendation') {
            // Basic opinion simulation
            if (/movie|film/i.test(q)) return { text: "I don't watch movies, but classics like 'The Godfather' or sci-fi like 'Interstellar' are often highly recommended for their storytelling and visuals.", sources: ["Knowledge Base"] };
            if (/book|read/i.test(q)) return { text: "Reading is excellent. 'Sapiens' by Yuval Noah Harari is a popular choice for non-fiction, while '1984' remains a relevant classic.", sources: ["Knowledge Base"] };
            if (/language/i.test(q)) return { text: "Python is great for beginners and AI, while JavaScript is essential for the web. It depends on what you want to build!", sources: ["Knowledge Base"] };

            return { text: "That's an interesting question. I think exploring different perspectives is always valuable. Could you share more details so I can give a better recommendation?", sources: ["Conversational"] };
        }

        // 5. Handling Answers (Confirmation/Negation)
        if (intent === 'confirmation' || intent === 'negation') {
            if (context.lastAIQuestion) {
                // Simple acknowledgement of the answer
                if (intent === 'confirmation') {
                    return { text: "Great! I'm glad to hear that. Is there anything specific about it you'd like to discuss?", sources: ["Conversational"] };
                } else {
                    return { text: "I understand. Everyone has different preferences. What do you prefer instead?", sources: ["Conversational"] };
                }
            }
            // Fallback if we don't know what they are saying yes/no to
            return { text: "I'm not sure what we're confirming, but I appreciate your enthusiasm! What shall we talk about next?", sources: ["Conversational"] };
        }

        return null; // Fallback to standard generation
    },

    async generateResponse(query) {
        try {
            if (!this.isReady) {
                this.onLog("Engine not initialized. Waiting for memory...", "warning");
                return { text: "I'm still waking up (loading memory). Please try again in a moment.", sources: [] };
            }

            const response = await this._generateResponseInternal(query);

            // Apply safety filter to response text
            if (response && response.text) {
                response.text = this.applySafetyFilter(response.text);
                // Apply Australian Tone/Spelling as final pass
                response.text = this.applyAustralianTone(response.text);
            }

            return response;
        } catch (error) {
            this.onLog(`ERROR in generateResponse: ${error.message} \nStack: ${error.stack}`, "error");
            console.error("Generate Response Error:", error);
            return {
                text: "I encountered an error while processing your request. Please try rephrasing your question or asking something else.",
                sources: ["Error Handler"]
            };
        }
    },

    processUtilityRequest(query) {
        const q = query.toLowerCase();

        // 1. Time / Date
        // Check for context-aware followups (e.g., "what about in 24 hour format?")
        if (/(time|clock)/i.test(q) || (this.lastResponseType === 'TIME' && /24.*hour|military|12.*hour|standard/i.test(q))) {
            const now = new Date();
            const is24 = /24.*hour|military/i.test(q);
            const timeStr = now.toLocaleTimeString('en-US', { hour12: !is24, hour: 'numeric', minute: '2-digit' });
            const response = `The current time is **${timeStr}**.`;
            this.lastResponseType = 'TIME';
            return { text: response, sources: ["System Clock"] };
        }
        if (/(date|year|month|day)/i.test(q)) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const response = `Today is **${dateStr}**.`;
            this.lastResponseType = 'DATE';
            return { text: response, sources: ["System Clock"] };
        }

        // 2. Random Number / Coin / Dice
        if (/flip.*coin|coin.*toss|heads.*tails|flip again/i.test(q)) {
            const result = Math.random() > 0.5 ? "Heads" : "Tails";
            this.lastResponseType = 'COIN';
            return { text: `It's **${result}**!`, sources: ["Random Number Generator"] };
        }

        if (/roll.*d(\d+)/i.test(q)) {
            const match = q.match(/roll.*d(\d+)/i);
            const sides = parseInt(match[1]);
            const result = Math.floor(Math.random() * sides) + 1;
            this.lastResponseType = 'DICE';
            return { text: `Rolling a d${sides}... **${result}**!`, sources: ["Dice Roller"] };
        }

        if (/roll.*dice|roll.*die|roll again/i.test(q)) {
            const result = Math.floor(Math.random() * 6) + 1;
            this.lastResponseType = 'DICE';
            return { text: `Rolling a die... **${result}**!`, sources: ["Dice Roller"] };
        }

        if (/random number/i.test(q)) {
            // Supports "1-10", "1 to 10", "between 1 and 10"
            const match = q.match(/(\d+)[\s-]*(?:to|and|-)\s*(\d+)|between\s+(\d+)\s+and\s+(\d+)/i);
            let min = 1, max = 100;
            if (match) {
                // Match groups can vary based on which part of regex hit
                const v1 = match[1] || match[3];
                const v2 = match[2] || match[4];
                if (v1 && v2) {
                    min = parseInt(v1);
                    max = parseInt(v2);
                }
            }
            const result = Math.floor(Math.random() * (max - min + 1)) + min;
            this.lastResponseType = 'RNG';
            return { text: `Here's a random number between ${min} and ${max}: **${result}**`, sources: ["Random Number Generator"] };
        }

        // 3. Spell Backwards
        if (/spell.*backwards?|reverse/i.test(q)) {
            // Extract target word/phrase: "spell apple backwards" -> "apple"
            const clean = q.replace(/spell|backwards?|reverse|word|phrase|say|tell me how to/gi, '').trim();
            const reversed = clean.split('').reverse().join('');
            this.lastResponseType = 'SPELL';
            return { text: `"${clean}" spelled backwards is **"${reversed}"**.`, sources: ["String Processor"] };
        }

        return null;
    },

    async _generateResponseInternal(query) {
        // ALLOW WIKIPEDIA EVEN IF NOT FULLY READY (for Local Mode)
        // if (!this.isReady) return { text: "Neural core not initialized.", sources: [] };

        // SANITIZE INPUT (Fixes Emoji Crash)
        const sanitizedQuery = this.sanitizeInput(query);
        if (!sanitizedQuery || sanitizedQuery.length === 0) {
            return { text: "I couldn't understand that. Could you try typing it again with standard text?", sources: ["Input Handler"] };
        }

        this.onLog(`Received input: "${sanitizedQuery}"`, "input");

        // Build query context for better understanding
        const queryContext = this.buildQueryContext(sanitizedQuery, this.conversationHistory);

        // Use the resolved query (with pronouns replaced) for better understanding
        const effectiveQuery = queryContext.resolvedQuery || query;
        this.onLog(`Effective query: "${effectiveQuery}"`, "data");

        // Advanced intent analysis
        const intentAnalysis = this.analyzeIntent(effectiveQuery);
        this.onLog(`Primary Intent: ${intentAnalysis.primary} (${(intentAnalysis.confidence * 100).toFixed(0)}%)`, "success");

        if (intentAnalysis.secondary.length > 0) {
            this.onLog(`Secondary Intents: ${intentAnalysis.secondary.join(', ')}`, "info");
        }

        // === PRIORITY HANDLING FOR PENDING QUESTIONS ===
        // If the AI previously asked a question, prioritize confirmation/negation over other intents
        // Example: "Yes thank you" -> detected as Gratitude (primary) but is actually an Answer (secondary)
        if (queryContext.lastAIQuestion &&
            (intentAnalysis.secondary.includes('confirmation') || intentAnalysis.secondary.includes('negation'))) {

            this.onLog("Found pending question + secondary answer intent -> Re-prioritizing.", "warning");
            intentAnalysis.primary = intentAnalysis.secondary.includes('confirmation') ? 'confirmation' : 'negation';
        }

        // === HANDLE PENDING ACTIONS (e.g. "Shall I dig deeper?") ===
        if (intentAnalysis.primary === 'confirmation' && queryContext.pendingAction === 'DEEP_SEARCH') {
            this.onLog("Action Confirmed: DEEP_SEARCH", "process");
            const searchTopic = queryContext.lastTopic || effectiveQuery;
            const wikiResult = await this.searchWikipedia("history of " + searchTopic, true);
            if (wikiResult) {
                // Update topic context
                this.lastTopic = searchTopic;

                const response = {
                    text: wikiResult,
                    sources: ["Wikipedia", "Knowledge Base"]
                };
                this.addToHistory(query, response.text);
                return response;
            }
        }

        if (this.isGreeting(effectiveQuery)) {
            this.onLog("Intent: GREETING", "success");
            const firstName = this.getUserFirstName();

            // Personalized greetings when logged in
            const greetings = firstName ? [
                `Hello ${firstName}! How can I help you today?`,
                `Hi ${firstName}! What can I do for you?`,
                `Hey ${firstName}! What would you like to know?`,
                `Good to see you, ${firstName}! I'm ready to assist.`
            ] : [
                "Hello! How can I help you today?",
                "Hi there! What can I do for you?",
                "Hey! What would you like to know?",
                "Greetings! I'm ready to assist you."
            ];

            const result = {
                text: greetings[Math.floor(Math.random() * greetings.length)],
                sources: ["Conversational"]
            };
            this.addToHistory(query, result.text);
            return result;
        }

        // --- USER NAME QUESTION ---
        if (/what('?s| is) my name|who am i|do you know (me|my name)|remember my name/i.test(effectiveQuery)) {
            this.onLog("Intent: NAME QUESTION", "success");
            let responseText;

            if (this.userContext.isLoggedIn && this.userContext.displayName) {
                responseText = `You're **${this.userContext.displayName}**! `;
                if (this.userContext.username) {
                    responseText += `Your username is @${this.userContext.username}. `;
                }
                responseText += "I remember you because you're logged in with Guahh.";
            } else {
                responseText = "I don't know your name yet! You're currently browsing as a guest. **Sign in with your Guahh Account** and I'll remember you!";
            }

            const result = {
                text: responseText,
                sources: ["User Context"]
            };
            this.addToHistory(query, result.text);
            return result;
        }

        // --- DEFINITION REQUEST ---
        if (/^define\s+|^what\s+(does|is)\s+.+\s+mean|^meaning\s+of\s+|^definition\s+of\s+/i.test(effectiveQuery)) {
            this.onLog("Intent: DEFINITION", "process");

            // Extract the term to define
            let term = effectiveQuery
                .replace(/^(define|meaning of|definition of)\s+/i, '')
                .replace(/^what\s+(does|is)\s+/i, '')
                .replace(/\s+mean(\?)?$/i, '')
                .replace(/[?]/g, '')
                .trim();

            if (term) {
                this.onLog(`Looking up definition for: "${term}"`, "info");

                // Search Wikipedia for definition
                const wikiResult = await this.searchWikipedia(term, false);

                if (wikiResult) {
                    // Extract first sentence or two as a concise definition
                    const sentences = wikiResult.split(/[.!?]/).filter(s => s.trim().length > 10);
                    const definition = sentences.slice(0, 2).join('. ') + '.';

                    const result = {
                        text: `**${this.capitalizeProperNouns(term)}**\n\n${definition}`,
                        sources: ["Wikipedia", "Definition Engine"]
                    };
                    this.addToHistory(query, result.text);
                    return result;
                } else {
                    return {
                        text: `I couldn't find a definition for "${term}". Could you try rephrasing or check the spelling?`,
                        sources: ["Definition Engine"]
                    };
                }
            }
        }

        // --- COMPARISON REQUEST ---
        if (/difference\s+between|compare\s+.+\s+(and|vs|versus|to)|(.+)\s+vs\.?\s+(.+)|what\s+is\s+.+\s+compared\s+to/i.test(effectiveQuery)) {
            this.onLog("Intent: COMPARISON", "process");

            // Extract the two items to compare
            let item1 = "", item2 = "";

            const vsMatch = effectiveQuery.match(/(.+?)\s+vs\.?\s+(.+)/i);
            const diffMatch = effectiveQuery.match(/difference\s+between\s+(.+?)\s+and\s+(.+)/i);
            const compareMatch = effectiveQuery.match(/compare\s+(.+?)\s+(and|vs|versus|to)\s+(.+)/i);

            if (vsMatch) {
                item1 = vsMatch[1].replace(/^(what is|compare)\s+/i, '').trim();
                item2 = vsMatch[2].replace(/[?]/g, '').trim();
            } else if (diffMatch) {
                item1 = diffMatch[1].trim();
                item2 = diffMatch[2].replace(/[?]/g, '').trim();
            } else if (compareMatch) {
                item1 = compareMatch[1].trim();
                item2 = compareMatch[3].replace(/[?]/g, '').trim();
            }

            if (item1 && item2) {
                this.onLog(`Comparing: "${item1}" vs "${item2}"`, "info");

                // Fetch info on both items
                const [info1, info2] = await Promise.all([
                    this.searchWikipedia(item1, false),
                    this.searchWikipedia(item2, false)
                ]);

                let comparisonText = `## ${this.capitalizeProperNouns(item1)} vs ${this.capitalizeProperNouns(item2)}\n\n`;

                if (info1) {
                    const summary1 = info1.split(/[.!?]/).slice(0, 2).join('. ') + '.';
                    comparisonText += `**${this.capitalizeProperNouns(item1)}:** ${summary1}\n\n`;
                } else {
                    comparisonText += `**${this.capitalizeProperNouns(item1)}:** I couldn't find detailed information on this.\n\n`;
                }

                if (info2) {
                    const summary2 = info2.split(/[.!?]/).slice(0, 2).join('. ') + '.';
                    comparisonText += `**${this.capitalizeProperNouns(item2)}:** ${summary2}\n\n`;
                } else {
                    comparisonText += `**${this.capitalizeProperNouns(item2)}:** I couldn't find detailed information on this.\n\n`;
                }

                comparisonText += "**Key Differences:** These are distinct concepts that serve different purposes. Would you like me to elaborate on either one?";

                const result = {
                    text: comparisonText,
                    sources: ["Wikipedia", "Comparison Engine"]
                };
                this.addToHistory(query, result.text);
                return result;
            }
        }

        // --- HOW-TO REQUEST ---
        if (/^how\s+(do\s+i|to|can\s+i|would\s+i)\s+/i.test(effectiveQuery)) {
            this.onLog("Intent: HOW-TO", "process");

            // Extract the task
            let task = effectiveQuery
                .replace(/^how\s+(do\s+i|to|can\s+i|would\s+i)\s+/i, '')
                .replace(/[?]/g, '')
                .trim();

            if (task) {
                this.onLog(`Generating how-to for: "${task}"`, "info");

                // Search for relevant information
                const wikiResult = await this.searchWikipedia(task, true);

                // Generate step-by-step format
                let howToText = `## How to ${task}\n\n`;

                if (wikiResult && wikiResult.length > 50) {
                    howToText += `Here's what I found:\n\n${wikiResult}\n\n`;
                    howToText += "**Tip:** For more detailed instructions, consider searching online tutorials or guides specific to your situation.";
                } else {
                    // Generate generic helpful response
                    howToText += `Here are some general steps to help you **${task}**:\n\n`;
                    howToText += `1. **Research** - Start by gathering information about ${task}\n`;
                    howToText += `2. **Prepare** - Get the necessary tools, materials, or resources ready\n`;
                    howToText += `3. **Plan** - Break down the process into manageable steps\n`;
                    howToText += `4. **Execute** - Follow your plan carefully, step by step\n`;
                    howToText += `5. **Review** - Check your work and make adjustments if needed\n\n`;
                    howToText += "Would you like more specific guidance? Try asking about a particular aspect!";
                }

                const result = {
                    text: howToText,
                    sources: wikiResult ? ["Wikipedia", "How-To Engine"] : ["How-To Engine"]
                };
                this.addToHistory(query, result.text);
                return result;
            }
        }

        // --- META CAPABILITY QUERIES ---
        // Use intent analysis to ensure we don't override stronger intents like confusion
        if (intentAnalysis.primary === 'meta' || (this.isMetaQuery(effectiveQuery) && intentAnalysis.primary !== 'confusion')) {
            this.onLog("Intent: META/CAPABILITY INQUIRY", "success");
            const metaResponses = {
                capabilities: "I'm Guahh AI, an advanced language assistant. I can:\n\n• Answer questions using Wikipedia\n• Write creative content (stories, letters, essays)\n• Perform calculations and solve math problems\n• Paraphrase and adjust tone (formal/casual)\n• Summarize text\n• Explain concepts and provide information\n\nJust ask me anything!",

                identity: "I'm Guahh AI, an intelligent assistant designed to help you with questions, creative writing, calculations, and more. I combine local knowledge with live Wikipedia searches to provide accurate information.",

                how_work: "I use advanced neural language processing to understand your queries. I analyze your intent, search for relevant information (including Wikipedia), and generate helpful responses. I can also learn from context and remember recent conversations."
            };

            let responseText = "";
            if (/what can you (do|help)/i.test(effectiveQuery) || /capabilities|functions/i.test(effectiveQuery)) {
                responseText = metaResponses.capabilities;
            } else if (/who are you|what are you|introduce yourself/i.test(effectiveQuery)) {
                responseText = metaResponses.identity;
            } else if (/how (do|does) (you|it) work/i.test(effectiveQuery)) {
                responseText = metaResponses.how_work;
            } else {
                responseText = metaResponses.capabilities; // Default
            }

            const result = {
                text: responseText,
                sources: ["System Information"]
            };
            this.addToHistory(query, result.text);
            return result;
        }

        // --- PARAPHRASING INTENT ---
        if (intentAnalysis.primary === 'paraphrase' || intentAnalysis.secondary.includes('paraphrase')) {
            this.onLog("Intent: PARAPHRASING", "process");
            const lastOutput = this.recentOutputs[this.recentOutputs.length - 1];
            if (lastOutput) {
                // Detect desired style from query
                let style = 'neutral';
                if (/(formal|professional|business)/i.test(query)) style = 'formal';
                else if (/(casual|informal|chill|friendly)/i.test(query)) style = 'casual';
                else if (/(concise|brief|short|summarize|simple)/i.test(query)) style = 'concise';
                else if (/(elaborate|detail|expand|long)/i.test(query)) style = 'elaborate';
                else if (/(academic|scholarly|smart|intelligent)/i.test(query)) style = 'academic';
                else if (/(creative|flowery|expressive)/i.test(query)) style = 'creative';
                else if (/(witty|funny|humorous|amusing|sarcastic)/i.test(query)) style = 'witty';

                const paraphrased = this.paraphraseText(lastOutput, style);
                const result = { text: paraphrased, sources: ["Paraphrasing Engine"] };
                this.addToHistory(query, result.text);
                return result;
            } else {
                return { text: "I don't have anything recent to paraphrase. Could you provide some text?", sources: ["System"] };
            }
        }

        // --- TONE ADJUSTMENT INTENT ---
        if (intentAnalysis.primary === 'tone_adjust') {
            this.onLog("Intent: TONE ADJUSTMENT", "process");
            const lastOutput = this.recentOutputs[this.recentOutputs.length - 1];
            if (lastOutput) {
                const tone = /(formal|professional)/i.test(query) ? 'formal' : 'casual';
                const adjusted = this.adjustTone(lastOutput, tone);
                const result = { text: adjusted, sources: ["Tone Adjuster"] };
                this.addToHistory(query, result.text);
                return result;
            } else {
                return { text: "I don't have anything recent to adjust. Could you provide some text?", sources: [] };
            }
        }

        // --- CODE GENERATION INTENT ---
        if (intentAnalysis.primary === 'code' || this.isCodingRequest(effectiveQuery)) {
            this.onLog("Intent: CODE GENERATION", "process");

            if (typeof GuahhCodingEngine !== 'undefined') {
                try {
                    const result = GuahhCodingEngine.processRequest(effectiveQuery, intentAnalysis);
                    this.addToHistory(query, result.text);
                    return result;
                } catch (codeError) {
                    this.onLog(`Coding Engine Crash: ${codeError.message}`, "error");
                    return { text: "I attempted to write code but the coding engine encountered an internal error. Please check the logs.", sources: ["System Error"] };
                }
            } else {
                this.onLog("GuahhCodingEngine is missing!", "error");
                return {
                    text: "I cannot generate code because the **Coding Engine module** failed to load. This may be due to a browser cache issue or a file error. Please try refreshing the page.",
                    sources: ["System Error"]
                };

            }
        }

        // --- EXPANSION / TELL ME MORE ---
        if (intentAnalysis.primary === 'expand' || /tell me more|more detail|go on|elaborate|continue|make.*longer|expand/i.test(effectiveQuery)) {
            this.onLog("Intent: EXPANSION", "process");

            // PRIORITY 1: If there's ANY previous output, extend it (don't search Wikipedia)
            const lastOutput = this.recentOutputs[this.recentOutputs.length - 1];
            if (lastOutput && lastOutput.length > 20) {
                this.onLog("Extending previous output...", "process");

                // Check if it was brainstorming
                if (this.lastResponseType === 'BRAINSTORM' && this.lastTopic) {
                    this.onLog(`Generating MORE ideas for: ${this.lastTopic}`, "process");
                    const moreIdeas = this.generateBrainstormIdeas(this.lastTopic);
                    const result = {
                        text: `Here are **more ideas** for **${this.lastTopic}**:\n\n${moreIdeas}`,
                        sources: ["Creative Brainstorming Engine"]
                    };
                    this.addToHistory(query, result.text);
                    return result;
                }

                // 2. CREATIVE EXPANSION (Story/Essay) - Use intelligent extension
                if (this.lastResponseType === 'CREATIVE' && this.lastTopic) {
                    this.onLog(`Extending essay/creative text for: ${this.lastTopic}`, "process");

                    // Get Wikipedia context if available
                    let wikiContext = "";
                    const wikiResult = await this.searchWikipedia(this.lastTopic, true);
                    if (wikiResult) {
                        wikiContext = wikiResult;
                    }

                    // Use the new intelligent essay extension
                    const extended = this.extendEssay(lastOutput, this.lastTopic, wikiContext, 200);

                    const result = {
                        text: extended,
                        sources: wikiContext ? ["Creative Engine", "Wikipedia"] : ["Creative Engine"]
                    };
                    this.addToHistory(query, result.text);
                    return result;
                }

                // 3. FACTUAL / WIKIPEDIA EXPANSION (Default)
                const topicToExpand = this.lastTopic || this.extractTopic(effectiveQuery);
                if (topicToExpand) {
                    this.onLog("Searching Wikipedia for more information...", "process");
                    const wikiResult = await this.searchWikipedia(topicToExpand, true);
                    if (wikiResult) {
                        const result = {
                            text: `Here is more detailed information about **${topicToExpand}**:\n\n${wikiResult}`,
                            sources: ["Wikipedia (Deep Search)"]
                        };
                        this.addToHistory(query, result.text);
                        return result;
                    } else {
                        return { text: `I couldn't find more information about ${topicToExpand}. Try asking a more specific question!`, sources: ["Search"] };
                    }
                } else {
                    return { text: "I'd love to tell you more, but I'm not sure which topic we're discussing. Could you be specific?", sources: ["Conversational"] };
                }
            }

        }

        // --- SUMMARIZATION ---
        if (intentAnalysis.primary === 'summarize' || /summarize|summarise|tldr|sum up|summary/i.test(effectiveQuery)) {
            this.onLog("Intent: SUMMARIZATION", "process");

            // 1. Check if text is provided in the query (e.g. "Summarize this: [TEXT]")
            // Remove the command part to find the payload
            let contentToSummarize = effectiveQuery
                .replace(/^(please )?(summarize|summarise|sum up|give me a summary of|tldr)/i, '')
                .replace(/^ this[:\s]*/i, '') // Remove "this" or "this:"
                .trim();

            // If user just said "Summarize this" without text, contentToSummarize will be empty
            // So we check recent history
            if (!contentToSummarize || contentToSummarize.length < 10) {
                const lastOutput = this.recentOutputs[this.recentOutputs.length - 1];
                if (lastOutput) {
                    this.onLog("Summarizing previous output...", "info");
                    contentToSummarize = lastOutput;
                } else {
                    return { text: "I don't have enough text to summarize. Please provide the text or ask me to summarize a previous response.", sources: [] };
                }
            } else {
                this.onLog("Summarizing provided text...", "info");
            }

            const summary = this.summarizeText(contentToSummarize);
            const result = { text: `Here is a summary:\n\n${summary}`, sources: ["Summarizer"] };
            this.addToHistory(query, result.text);
            return result;
        }

        // --- SIMPLIFICATION ---
        if (intentAnalysis.primary === 'simplify' || /explain.*like.*5|simple terms/i.test(effectiveQuery)) {
            this.onLog("Intent: SIMPLIFICATION", "process");
            const lastOutput = this.recentOutputs[this.recentOutputs.length - 1];
            if (lastOutput) {
                const simplified = this.paraphraseText(lastOutput, 'simple'); // reusing paraphrase with simple style
                const result = { text: `Here is a simpler explanation:\n\n${simplified}`, sources: ["Simplifier"] };
                this.addToHistory(query, result.text);
                return result;
            } else {
                return { text: "I don't have anything recent to simplify.", sources: [] };
            }
        }

        // --- CREATIVE WRITING INTENT (ESSAYS/STORIES) ---
        if (intentAnalysis.primary === 'creative' || this.detectQueryType(effectiveQuery) === 'creative') {
            this.onLog("Intent: CREATIVE WRITING", "process");

            // Extract Topic
            const topic = this.extractTopic(effectiveQuery) || effectiveQuery.replace(/write|create|make|essay|story|about/gi, '').trim();
            this.lastTopic = topic;
            this.lastResponseType = 'CREATIVE';

            // Check if it's an essay or story
            if (/essay|article|report|paper/i.test(effectiveQuery)) {

                // Search Wikipedia for facts first
                let context = "";
                const searchResult = await this.searchWikipedia(topic, false);
                if (searchResult) context = searchResult;

                const essay = this.generateAdvancedEssay(topic, context);
                const result = {
                    text: essay,
                    sources: context ? ["Creative Engine", "Wikipedia"] : ["Creative Engine"]
                };
                this.addToHistory(query, result.text);
                return result;
            }

            // Fallback for stories/poems (keep existing logic or add simple one)
            const creativeText = this.generateCreativeText(topic, effectiveQuery);
            const result = { text: creativeText, sources: ["Creative Engine"] };
            this.addToHistory(query, result.text);
            return result;
        }




        // --- CONFUSION / FEEDBACK HANDLING ---
        if (intentAnalysis.primary === 'confusion') {
            this.onLog("Intent: USER CONFUSION", "warning");

            // If we have a recent output, they might be confused about THAT
            const lastOutput = this.recentOutputs[this.recentOutputs.length - 1];
            const lastQuery = this.conversationHistory.length > 0 ? this.conversationHistory[this.conversationHistory.length - 1].query : null;

            if (lastOutput && lastQuery) {
                // Determine plausible reason for confusion
                const isCode = /```/.test(lastOutput);
                const isLong = lastOutput.length > 500;

                let responseText = "I apologize if my last response was unclear.";

                if (isCode) {
                    responseText += " I provided some code, but maybe you wanted an explanation? Would you like me to explain how it works?";
                } else if (isLong) {
                    responseText += " It was quite detailed. Would you like a simpler summary?";
                } else {
                    responseText += " Could you tell me which part was confusing, or should I try explaining it differently?";
                }

                const result = { text: responseText, sources: ["Feedback Handler"] };
                this.addToHistory(query, result.text);
                return result;
            } else {
                // General confusion (no context)
                const result = {
                    text: "I apologize if I'm doing something unexpected. I'm just here to help! Could you rephrase what you need so I can understand better?",
                    sources: ["Feedback Handler"]
                };
                this.addToHistory(query, result.text);
                return result;
            }
        }

        if (intentAnalysis.primary === 'utility' || intentAnalysis.secondary.includes('utility')) {
            this.onLog("Intent: UTILITY / TOOL", "process");
            const utilResult = this.processUtilityRequest(effectiveQuery);
            if (utilResult) {
                this.addToHistory(query, utilResult.text);
                return utilResult;
            }
        }

        // --- CONVERSATIONAL & CASUAL HANDLING ---
        //Handle explicit conversational intents or high-confidence casual queries
        if (['casual', 'greeting', 'farewell', 'gratitude', 'opinion', 'recommendation', 'confirmation', 'negation', 'personal_sharing'].includes(intentAnalysis.primary) ||
            intentAnalysis.secondary.includes('casual')) {

            this.onLog(`Intent: CONVERSATIONAL (${intentAnalysis.primary})`, "process");
            // Pass the updated Context (with lastAIQuestion) to the handler
            const chatResult = this.generateConversationalResponse(intentAnalysis.primary, effectiveQuery, queryContext);
            // Proactive Follow-up (Experimental)
            if (chatResult && this.shouldAskFollowUp(effectiveQuery, chatResult.text)) {
                // No specific topic for small talk usually, but let's try
                const followup = "Is there anything specific you'd like to talk about?";
                chatResult.text += `\n\n${followup}`;
            }

            if (chatResult) {
                this.addToHistory(query, chatResult.text);
                return chatResult;
            }
        }

        // --- ELABORATION / FOLLOW-UP HANDLING ---
        if (intentAnalysis.primary === 'expand' || intentAnalysis.primary === 'followup') {
            this.onLog("Intent: ELABORATION", "process");
            // If we have a topic, treat it like a search or detailed general query about that topic
            if (topic) {
                // For now, we can route this to the Wikipedia search or general generation
                // But strictly looking for "more info"
                this.onLog(`Elaborating on: ${topic}`, "info");
                // Let it fall through to search/general generation with the RESOLVED query (e.g. "tell me more about [topic]")
            }
        }

        const cacheKey = effectiveQuery.toLowerCase().trim();
        if (this.responseCache.has(cacheKey)) {
            this.onLog("Using cached response", "success");
            return this.responseCache.get(cacheKey);
        }

        const cleanQuery = this.preprocessQuery(effectiveQuery);
        this.onLog(`Preprocessed: "${cleanQuery}"`, "data");
        const qTokens = this.tokenize(cleanQuery);

        if (this.isMathQuery(cleanQuery)) {
            this.onLog("Intent: MATH CALCULATION", "success");
            const mathResult = this.calculateMath(cleanQuery);
            if (mathResult) {
                const result = { text: mathResult, sources: ["Calculator"] };
                this.addToHistory(query, result.text);
                return result;
            }
        }

        // --- EXTRACT TOPIC EARLY FOR USE IN VARIOUS INTENTS ---
        let topic = this.extractTopic(effectiveQuery);

        // === PRIORITY 0: CHECK LOCAL MEMORY (HIGH CONFIDENCE) ===
        // If we have a near-perfect match in our knowledge base, use it immediately.
        // This prevents searching Wikipedia for things we already know perfectly.
        const retrievalTokens = topic ? this.tokenize(topic) : qTokens;
        const relevantDocs = this.retrieveRelevant(retrievalTokens);

        // "Really really good match" > 0.95
        if (relevantDocs.length > 0 && relevantDocs[0].score >= 0.95) {
            this.onLog(`✓ PERFECT LOCAL MATCH (${(relevantDocs[0].score * 100).toFixed(0)}%): "${relevantDocs[0].doc.a.substring(0, 40)}..."`, "success");
            const result = { text: relevantDocs[0].doc.a, sources: ["Local Memory (Verified)"] };
            this.addToHistory(query, result.text);
            this.responseCache.set(cacheKey, result);
            return result;
        }

        // --- BRAINSTORMING INTENT ---
        if (intentAnalysis.primary === 'brainstorm' || /brainstorm|ideas? for|suggest|come up with|give.*ideas?/i.test(cleanQuery)) {
            this.onLog("Intent: BRAINSTORMING", "process");

            // Extract topic for brainstorming - clean up common phrases
            // Extract topic for brainstorming - clean up common phrases
            let brainstormTopic = effectiveQuery
                .replace(/^(brainstorm|give me|suggest|come up with|think of|show me|tell me)\s+/i, '')
                .replace(/^(some |a |an |the )?(ideas?|suggestions?|thoughts?|tips?|options?)\s+(for|about|on|regarding)\s+/i, '') // Fixed "ideas on"
                .replace(/^give\s+(some\s+)?ideas\s+(on|about|for)\s+/i, '') // Specific fix for "give ideas on"
                .replace(/\s+to\s+(wear|make|do|try|use|create|build)$/i, '')
                .replace(/\?+$/, '')
                .trim();

            // If still empty after cleaning, use the topic extraction
            if (!brainstormTopic || brainstormTopic.length < 2) {
                brainstormTopic = topic || 'general concepts';
            }

            let ideas = this.generateBrainstormIdeas(brainstormTopic);

            // If topic is valid, maybe include a Fusion Idea for flavor
            if (brainstormTopic.length > 3 && Math.random() > 0.5) {
                const fusion = this.generateFusionIdea(brainstormTopic);
                ideas += `\n\n${fusion}`;
            }

            const intro = brainstormTopic
                ? `Here are some creative ideas for **${brainstormTopic}**:\n\n`
                : "Here are some creative ideas:\n\n";

            const result = {
                text: intro + ideas,
                sources: ["Creative Brainstorming Engine"]
            };
            this.addToHistory(query, result.text);
            this.responseCache.set(cacheKey, result);
            this.lastResponseType = 'BRAINSTORM'; // Track type for expansion
            return result;
        }

        // --- SUMMARIZATION ---
        if (/^(summarize|summarise|sum up|summary)/i.test(cleanQuery)) {
            this.onLog("Intent: SUMMARIZATION", "process");
            const lastOutput = this.recentOutputs[this.recentOutputs.length - 1];
            if (lastOutput) {
                const summary = this.summarizeText(lastOutput);
                const result = { text: summary, sources: ["Analytical Engine"] };
                this.addToHistory(query, result.text);
                return result;
            } else {
                return { text: "I don't have anything recent to summarize.", sources: [] };
            }
        }

        // --- CREATIVE REQUEST HANDLING (PRIORITY: Handle BEFORE Wikipedia search) ---
        const isCreativeRequest = /write|essay|story|article|poem|create|make.*essay|make.*story|compose/i.test(effectiveQuery);

        if (isCreativeRequest) {
            this.onLog("Creative Intent detected.", "process");

            // Try to get Wikipedia context for the topic if available
            // implements MULTI-SEARCH for essays to ensure depth
            let wikiContext = "";
            if (topic) {
                this.onLog(`Fetching Wikipedia context for topic: "${topic}"`, "process");

                if (/essay|article|report|paper/i.test(effectiveQuery)) {
                    // For essays, we do a multi-pronged search to get better depth
                    const queries = [topic];

                    // Add logical sub-searches
                    queries.push(`History of ${topic}`);
                    queries.push(`Significance of ${topic}`);
                    if (/[A-Z]/.test(topic)) {
                        queries.push(`Themes in ${topic}`);
                    }

                    const combined = await this.searchMultipleAndCombine(queries, true);
                    if (combined) {
                        wikiContext = combined;
                        this.onLog("✓ Multi-source context acquired for essay.", "success");
                    }
                } else {
                    // Standard search for stories/poems
                    const wikiResult = await this.searchWikipedia(topic, true);
                    if (wikiResult) {
                        wikiContext = wikiResult;
                        this.onLog("✓ Wikipedia context retrieved.", "success");
                    }
                }
            }

            // Detect creative type
            let creativeText = "";

            // Extract word count if present (e.g. "500 words", "200 word")
            let targetWordCount = 550; // Default for creative writing (increased from 350)
            const wordCountMatch = effectiveQuery.match(/(\d+)\s*words?/i);

            if (wordCountMatch) {
                targetWordCount = parseInt(wordCountMatch[1]);
                // Cap at reasonable limit for performance/sanity
                if (targetWordCount > 2000) targetWordCount = 2000;
                if (targetWordCount < 50) targetWordCount = 50;
                this.onLog(`Target Word Count: ${targetWordCount}`, "info");

                // CRITICAL: Strip the word count from the topic to avoid polluting Wikipedia search
                // e.g. "Write a 500 word essay on frogs" -> Topic should be "frogs", not "frogs 500 words"
                if (topic) {
                    topic = topic.replace(wordCountMatch[0], '').replace(/\s+/g, ' ').trim();
                    this.onLog(`Cleaned Topic Strategy: "${topic}"`, "data");
                }
            } else if (/essay/i.test(effectiveQuery)) {
                // If explicitly an essay but no length specified, default longer
                targetWordCount = 600; // Increased from 450
            }

            if (/letter|email/i.test(effectiveQuery)) {
                this.onLog("Generating Letter...", "process");
                creativeText = this.generateLetter(topic, wikiContext);
            } else if (/story|tale|narrative/i.test(effectiveQuery)) {
                this.onLog("Generating Story...", "process");
                creativeText = this.generateStory(topic, wikiContext, targetWordCount);
            } else {
                // Default to story for generic "write about X"
                this.onLog("Generating Creative Content...", "process");
                creativeText = this.generateStory(topic, wikiContext, targetWordCount);
            }

            const result = {
                text: creativeText,
                sources: wikiContext ? ["Creative Engine", "Wikipedia"] : ["Creative Engine"]
            };
            this.addToHistory(query, result.text);
            this.responseCache.set(cacheKey, result);
            this.lastResponseType = 'CREATIVE'; // Track type for expansion
            this.lastTopic = topic; // Track topic for expansion
            return result;
        }
        // -----------------------------------------

        // --- INTELLIGENT SEARCH ROUTING ---
        const searchQuery = topic || effectiveQuery;
        const needsSearch = this.isSearchQuery(effectiveQuery);
        const hasLittleMemory = this.memory.length < 50;

        // Priority Wikipedia search for:
        // 1. Explicit search queries (what is X, who is Y, etc.)
        // 2. Local mode with little memory
        // 3. Questions with proper nouns (likely entities)
        // BUT: Skip if it was a creative request (already handled above)
        if ((needsSearch || hasLittleMemory) && !isCreativeRequest) {
            if (needsSearch) {
                this.onLog("🔍 Search query detected - engaging Wikipedia...", "process");
            } else {
                this.onLog("Local mode - attempting Wikipedia search...", "process");
            }

            const wikiResult = await this.searchWikipedia(searchQuery, false);
            if (wikiResult) {
                this.onLog("✓ Wikipedia Data Retrieved.", "success");
                let text = wikiResult;

                // Add follow up if topic is clear
                if (topic && this.shouldAskFollowUp(effectiveQuery, text)) {
                    text += `\n\n${this.generateFollowUpQuestion(topic)}`;
                }

                const result = { text: text, sources: ["Wikipedia"] };
                this.addToHistory(query, result.text);
                this.responseCache.set(cacheKey, result);
                this.lastResponseType = 'SEARCH'; // Track type
                this.lastTopic = topic; // Track topic for potential expansion
                return result;
            } else if (needsSearch) {
                // If it's clearly a search query but Wikipedia failed, inform user
                this.onLog("Wikipedia search failed for factual query", "warning");
            }
        }
        // -----------------------------------------

        this.onLog("Scanning local memory...", "warning");

        // 1. STRONG MATCH - Return directly
        if (relevantDocs.length > 0 && relevantDocs[0].score >= 0.4) {
            this.onLog(`Top Local Match (${(relevantDocs[0].score * 100).toFixed(0)}%): "${relevantDocs[0].doc.a.substring(0, 30)}..."`, "data");
            const result = { text: relevantDocs[0].doc.a, sources: ["Local Memory"] };
            this.addToHistory(query, result.text);
            this.responseCache.set(cacheKey, result);
            return result;
        }

        // 2. WEAK MATCHES - Synthesize partial knowledge
        if (relevantDocs.length > 0 && relevantDocs[0].score >= 0.08) {
            this.onLog(`Weak matches found (best: ${(relevantDocs[0].score * 100).toFixed(0)}%). Synthesizing partial knowledge...`, "process");
            const synthesized = this.synthesizePartialKnowledge(relevantDocs, query, topic);

            const result = {
                text: synthesized,
                sources: ["Knowledge Synthesis", "Local Memory"]
            };
            this.addToHistory(query, result.text);
            this.responseCache.set(cacheKey, result);
            this.lastResponseType = 'FACTUAL'; // Track type
            return result;
        }

        // 3. FINAL FALLBACK - General Template Generation
        // (Replaces the old "I don't know" error)
        // 3. FINAL FALLBACK - Smart Conversational Fallback
        // (Replaces the old "I don't know" error)
        this.onLog("No local matches. Generating smart fallback...", "process");

        // Try Intelligent Search as Last Resort before Conversation
        try {
            const wikiResult = await this.searchWikipedia(this.extractTopic(effectiveQuery) || effectiveQuery, false);
            if (wikiResult) {
                const result = { text: wikiResult, sources: ["Wikipedia"] };
                this.addToHistory(query, result.text);
                this.responseCache.set(cacheKey, result);
                return result;
            }
        } catch (e) {
            this.onLog(`Fallback search failed: ${e.message}`, "warning");
        }

        const fallbackText = this.generateConversationalFallback(effectiveQuery);
        let text = fallbackText;

        // Add proactive follow-up for general templates
        if (topic && this.shouldAskFollowUp(effectiveQuery, text)) {
            text += `\n\n${this.generateFollowUpQuestion(topic)}`;
        }

        const fallbackResult = {
            text: text,
            sources: ["General Knowledge Engine"]
        };
        this.addToHistory(query, fallbackResult.text);
        this.responseCache.set(cacheKey, fallbackResult);
        return fallbackResult;
    },

    // Backward compatibility alias for cached versions
    retrieveKnowledge(qTokens) {
        return this.retrieveRelevant(qTokens);
    },

    retrieveRelevant(qTokens) {
        if (qTokens.length === 0) return [];

        const totalDocs = this.totalDocs || this.memory.length;
        // Fallback for DF if not initialized (though init should handle it)
        const df = this.df || {};

        // 0. DIRECT STRING MATCH SHORTCUT (Guaranteed 100% Hit)
        const normalizedQuery = qTokens.join(' ').toLowerCase();

        // Fast Pass loop for exact matches
        for (const entry of this.memory) {
            // Check Exact Question Match
            if (entry.q && entry.q.toLowerCase().trim() === normalizedQuery) {
                return [{ doc: entry, score: 1.1, overlap: 999 }];
            }
            // Check Exact Answer Match (only for long unique queries > 4 words)
            if (qTokens.length > 4 && entry.a && entry.a.toLowerCase().includes(normalizedQuery)) {
                return [{ doc: entry, score: 1.1, overlap: 999 }];
            }
        }

        // 1. Calculate Max Possible IDF Score (for this query)
        // This allows us to normalize the score
        let maxPossibleScore = 0;
        const validTokens = [];

        qTokens.forEach(t => {
            const docFreq = df[t] || 0;
            // IDF = log(N / (df + 1)) + 1.  Rare words have high IDF.
            const idf = Math.log((totalDocs + 1) / (docFreq + 1)) + 1;
            validTokens.push({ token: t, idf: idf });
            maxPossibleScore += idf;
        });

        if (maxPossibleScore === 0) return [];

        // 2. Score Documents

        // IDENTIFY CRITICAL TERMS (Top 30% by IDF)
        // These are the "concept" words. If a doc misses ALL of them, it's likely irrelevant.
        validTokens.sort((a, b) => b.idf - a.idf);
        const numCritical = Math.max(1, Math.floor(validTokens.length * 0.3));
        const criticalTokens = new Set(validTokens.slice(0, numCritical).map(vt => vt.token));

        const scored = this.memory.map(entry => {
            let currentScore = 0;
            let overlap = 0;
            let criticalHits = 0;

            // O(QueryLen) lookup using Set
            for (const vt of validTokens) {
                if (entry.tokenSet.has(vt.token)) {
                    overlap++;
                    currentScore += vt.idf;
                    if (criticalTokens.has(vt.token)) {
                        criticalHits++;
                    }
                }
            }

            if (overlap === 0) return { doc: entry, score: 0, overlap: 0 };

            // Final Score = Sum of IDFs of matched terms / Sum of IDFs of all query terms
            let coverageScore = currentScore / maxPossibleScore;

            // PENALTY: If NO critical terms are found, slash the score.
            // e.g. Query "features of success" -> "success" is critical.
            // If doc has "features" but not "success", it gets penalized.
            if (criticalHits === 0) {
                coverageScore *= 0.1;
            }

            return {
                doc: entry,
                score: coverageScore,
                overlap: overlap
            };
        });

        // 3. Filter and Sort
        // Threshold 0.3 means roughly 30% of the query's "meaning" (by weight) was found
        return scored.filter(s => s.score >= 0.25).sort((a, b) => b.score - a.score).slice(0, 15);
    },

    synthesizePartialKnowledge(relevantDocs, query, topic) {
        // When we have weak matches (0.1 - 0.4 score), synthesize them into a response
        this.onLog("Synthesizing partial knowledge from multiple sources...", "process");

        const topDocs = relevantDocs.slice(0, 6); // Use top 6 partial matches

        // Group documents by theme/similarity
        const themes = this.clusterDocumentsByTheme(topDocs);
        this.onLog(`Found ${themes.length} knowledge clusters`, "data");

        // Build response from themes
        let synthesized = "";

        if (topic) {
            synthesized = `Based on what I know about ${topic}:\n\n`;
        } else {
            synthesized = "Based on related information I have:\n\n";
        }

        themes.forEach((theme, idx) => {
            // Extract key facts from each theme
            const facts = this.extractKeyFacts(theme.docs);
            if (facts.length > 0) {
                if (themes.length > 1) {
                    synthesized += `• `;
                }
                synthesized += facts.join(". ");
                if (!synthesized.endsWith('.')) synthesized += '.';
                synthesized += "\n\n";
            }
        });

        // Add disclaimer if confidence is low
        const avgScore = topDocs.reduce((sum, d) => sum + d.score, 0) / topDocs.length;
        if (avgScore < 0.25) {
            synthesized += "\n(Note: I'm making connections from related topics in my knowledge base. For more accurate information, I'd need additional context or could search Wikipedia.)";
        }

        return synthesized.trim();
    },

    clusterDocumentsByTheme(docs) {
        // Simple clustering by token overlap
        const clusters = [];
        const used = new Set();

        docs.forEach((doc, idx) => {
            if (used.has(idx)) return;

            const cluster = {
                docs: [doc],
                tokens: new Set(doc.doc.tokens)
            };
            used.add(idx);

            // Find similar docs
            docs.forEach((otherDoc, otherIdx) => {
                if (used.has(otherIdx) || idx === otherIdx) return;

                // Calculate token overlap
                const overlap = doc.doc.tokens.filter(t => otherDoc.doc.tokens.includes(t)).length;
                const similarity = overlap / Math.min(doc.doc.tokens.length, otherDoc.doc.tokens.length);

                if (similarity > 0.3) {
                    cluster.docs.push(otherDoc);
                    otherDoc.doc.tokens.forEach(t => cluster.tokens.add(t));
                    used.add(otherIdx);
                }
            });

            clusters.push(cluster);
        });

        return clusters;
    },

    extractKeyFacts(docs) {
        // Extract the most informative sentences from a cluster
        const facts = [];

        docs.forEach(doc => {
            const text = doc.doc.a;
            // Split into sentences
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

            if (sentences.length > 0) {
                // Take first sentence (usually most informative)
                facts.push(sentences[0].trim());
            }
        });

        // Deduplicate similar facts
        const unique = [];
        const seen = new Set();

        facts.forEach(fact => {
            const normalized = fact.toLowerCase().replace(/\s+/g, ' ');
            if (!seen.has(normalized)) {
                seen.add(normalized);
                unique.push(fact);
            }
        });

        return unique.slice(0, 3); // Return top 3 facts
    },

    getFallbackResponse() {
        const responses = [
            "I don't have sufficient context to answer that confidently.",
            "That topic isn't in my current knowledge base. Try asking something else or rephrasing your question.",
            "I'm not finding relevant information for that query.",
            "My database doesn't contain enough information about that subject."
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    },

    summarizeText(text) {
        if (!text) return "";

        // Split into sentences using a smarter regex that avoids splitting on "Mr.", "Mrs.", "etc."
        // (Simplified for performance, but handles basic cases)
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 20);

        if (cleanSentences.length <= 3) {
            return "That's already quite concise: " + text;
        }

        // Key algorithm:
        // 1. Keep the first sentence (Introduction/Hook).
        // 2. Keep the last sentence (Conclusion).
        // 3. Pick "important" sentences from the middle based on keyword density or position.

        const summaryArr = [];

        // Always include first sentence
        summaryArr.push(cleanSentences[0]);

        // Middle selection
        if (cleanSentences.length > 10) {
            // Pick 3 sentences distributed evenly
            const step = Math.floor((cleanSentences.length - 2) / 3);
            for (let i = 1; i <= 3; i++) {
                const idx = 1 + (step * i);
                if (cleanSentences[idx]) summaryArr.push(cleanSentences[idx]);
            }
        } else if (cleanSentences.length > 3) {
            // Pick 1 middle sentence
            const mid = Math.floor(cleanSentences.length / 2);
            summaryArr.push(cleanSentences[mid]);
        }

        // Always include last sentence
        if (cleanSentences.length > 1) {
            summaryArr.push(cleanSentences[cleanSentences.length - 1]);
        }

        return summaryArr.join(' ');
    },

    generateNeuralText(sourceText, targetLength = 40, retryCount = 0) {
        const words = sourceText.replace(/([.,!?;:])/g, " $1 ").split(/\s+/).filter(w => w);
        const bigrams = {};
        const trigrams = {};
        const starters = [];

        for (let i = 0; i < words.length - 2; i++) {
            const w1 = words[i], w2 = words[i + 1], w3 = words[i + 2];
            if (!bigrams[w1]) bigrams[w1] = {};
            bigrams[w1][w2] = (bigrams[w1][w2] || 0) + 1;

            const key = w1 + " " + w2;
            if (!trigrams[key]) trigrams[key] = {};
            trigrams[key][w3] = (trigrams[key][w3] || 0) + 1;

            if (i === 0 || ".!?".includes(words[i - 1])) starters.push(w1);
        }

        if (starters.length === 0) starters.push(words[0]);
        let currentWord = starters[Math.floor(Math.random() * starters.length)];
        let prevWord = "";
        let output = [currentWord];
        const recentWords = [currentWord]; // Track recent words for repetition penalty

        for (let i = 0; i < targetLength; i++) {
            let candidatePool = null;
            if (prevWord) {
                const key = prevWord + " " + currentWord;
                if (trigrams[key]) candidatePool = trigrams[key];
            }
            if (!candidatePool && bigrams[currentWord]) candidatePool = bigrams[currentWord];
            if (!candidatePool || Object.keys(candidatePool).length === 0) break;

            // Apply repetition penalty to recent words
            const penalizedPool = this.applyRepetitionPenalty(candidatePool, recentWords);
            const next = this.sampleWithTemperature(penalizedPool, this.temperature, this.topP);
            if (!next) break;

            output.push(next);
            recentWords.push(next);
            if (recentWords.length > this.repetitionWindow) recentWords.shift();

            prevWord = currentWord;
            currentWord = next;
            if (i > 15 && ".!?".includes(currentWord)) break;
        }

        let text = output.join(" ").replace(/\s+([.,!?;:])/g, "$1").replace(/^([a-z])/g, c => c.toUpperCase());

        // Enhanced validation with coherence check
        if (!this.validateOutput(text) || !this.checkCoherence(text)) {
            if (retryCount >= 2) {
                this.onLog("Output check failed (max retries). Returning best effort.", "warning");
                return text;
            }
            this.onLog(`Output checks failed. Retrying...`, "warning");
            return this.generateNeuralText(sourceText, targetLength, retryCount + 1);
        }
        return text;
    },

    generateStory(topic, externalContext = "", targetLength = 100) {
        // If target length is large (essay-like), use advanced essay generator
        if (targetLength >= 200) {
            return this.generateAdvancedEssay(topic, externalContext, targetLength);
        }

        // Otherwise use simple story generation for short content
        const templates = [
            `Once upon a time, there was a ${topic}. It lived in a world full of wonder and mystery.`,
            `In a distant land, a ${topic} began its journey. The path ahead was unknown but exciting.`,
            `The legend of the ${topic} is known throughout the kingdom. It started on a stormy night.`,
            `Nobody knew where the ${topic} came from, but everyone knew it was special.`
        ];

        const seed = templates[Math.floor(Math.random() * templates.length)];

        let backgroundKnowledge = externalContext || "";
        if (this.memory.length > 0) {
            for (let i = 0; i < 20; i++) {
                const randomEntry = this.memory[Math.floor(Math.random() * this.memory.length)];
                if (randomEntry && randomEntry.a && randomEntry.a.length > 20 && !/[\d+\-*/=]/.test(randomEntry.a) && !/[{}]/.test(randomEntry.a)) {
                    backgroundKnowledge += randomEntry.a + " ";
                }
            }
        }

        const sourceText = seed + " " + backgroundKnowledge.substring(0, 5000) + " " + this.genericCorpus;
        return seed + "\n\n" + this.generateNeuralText(sourceText, targetLength);
    },

    // ========== ADVANCED ESSAY WRITING SYSTEM ==========

    generateAdvancedEssay(topic, wikiContext = "", targetWordCount = 350, style = 'academic') {
        this.onLog(`Generating advanced essay on "${topic}" (${targetWordCount} words, ${style} style)`, "process");

        // Step 1: Create essay outline
        const outline = this.generateEssayOutline(topic, wikiContext, targetWordCount);

        // Step 2: Generate introduction
        const intro = this.generateIntroduction(topic, wikiContext, outline);

        // Step 3: Generate body paragraphs
        const body = this.generateBodyParagraphs(topic, wikiContext, outline);

        // Step 4: Generate conclusion
        const conclusion = this.generateConclusion(topic, outline, wikiContext);

        // Step 5: Combine and apply human-like variations
        let essay = `${intro}\n\n${body}\n\n${conclusion}`;
        essay = this.applyHumanLikeVariations(essay, topic);

        this.onLog(`Essay generated: ${essay.split(' ').length} words`, "success");
        return essay;
    },

    generateEssayOutline(topic, wikiContext, targetWordCount) {
        // Determine number of body paragraphs based on word count
        const numBodyParagraphs = Math.max(2, Math.min(5, Math.floor(targetWordCount / 120)));

        const outline = {
            thesis: this.generateThesis(topic, wikiContext),
            bodyPoints: [],
            conclusionPoint: null
        };

        // Generate main points for body paragraphs
        for (let i = 0; i < numBodyParagraphs; i++) {
            outline.bodyPoints.push(this.generateBodyPoint(topic, wikiContext, i));
        }

        outline.conclusionPoint = `Summarize the significance of ${topic} and its broader implications`;

        return outline;
    },

    generateThesis(topic, wikiContext) {
        // Extract key concept from Wikipedia context if available
        const keyInfo = wikiContext ? wikiContext.split('.')[0] : null;

        const thesisTemplates = [
            `${topic} represents a significant concept that merits careful examination`,
            `Understanding ${topic} requires exploring its various dimensions and implications`,
            `The study of ${topic} reveals important insights about our world`,
            `${topic} plays a crucial role in shaping our understanding of related concepts`,
            keyInfo ? `${keyInfo}, making it an important subject of study` : null
        ].filter(t => t);

        return thesisTemplates[Math.floor(Math.random() * thesisTemplates.length)];
    },

    generateBodyPoint(topic, wikiContext, index) {
        const aspects = [
            `the fundamental nature and characteristics of ${topic}`,
            `the historical development and evolution of ${topic}`,
            `the practical applications and real-world significance of ${topic}`,
            `the challenges and controversies surrounding ${topic}`,
            `the future implications and potential of ${topic}`
        ];

        return aspects[index % aspects.length];
    },

    generateIntroduction(topic, wikiContext, outline) {
        // Hook: Engaging opening sentence
        const hooks = [
            `In today's world, few topics are as intriguing as ${topic}.`,
            `The concept of ${topic} has captured the attention of many.`,
            `When we consider ${topic}, we encounter a fascinating subject.`,
            `${topic} stands as a topic worthy of deeper exploration.`,
            `Throughout history, ${topic} has played an important role.`
        ];

        const hook = hooks[Math.floor(Math.random() * hooks.length)];

        // Context: Background information (use Wikipedia if available)
        let context = "";
        if (wikiContext) {
            const sentences = wikiContext.split('.').filter(s => s.trim().length > 20);
            context = sentences.slice(0, 2).join('.') + '.';
        } else {
            context = `This subject encompasses various aspects that deserve careful consideration. Understanding its complexity requires examining multiple perspectives.`;
        }

        // Thesis
        const thesis = outline.thesis + ".";

        return `${hook} ${context} ${thesis}`;
    },

    generateBodyParagraphs(topic, wikiContext, outline) {
        const paragraphs = [];

        for (let i = 0; i < outline.bodyPoints.length; i++) {
            const point = outline.bodyPoints[i];
            const paragraph = this.generateBodyParagraph(topic, wikiContext, point, i);
            paragraphs.push(paragraph);
        }

        return paragraphs.join('\n\n');
    },

    generateBodyParagraph(topic, wikiContext, mainPoint, index) {
        // Topic sentence - complete, natural sentences
        const topicSentenceStarters = [
            // Natural, conversational starters
            `When we look at ${mainPoint}, several things stand out.`,
            `${mainPoint.charAt(0).toUpperCase() + mainPoint.slice(1)} deserves closer examination.`,
            `Consider ${mainPoint} for a moment.`,
            `${mainPoint.charAt(0).toUpperCase() + mainPoint.slice(1)} is particularly interesting.`,
            `We can't ignore ${mainPoint}.`,
            `${mainPoint.charAt(0).toUpperCase() + mainPoint.slice(1)} plays a key role here.`,
            `Looking at ${mainPoint}, we find important insights.`,
            `${mainPoint.charAt(0).toUpperCase() + mainPoint.slice(1)} presents an intriguing case.`,
            `There's something compelling about ${mainPoint}.`,
            `${mainPoint.charAt(0).toUpperCase() + mainPoint.slice(1)} offers valuable perspective.`,
            // Direct, simple starters
            `${mainPoint.charAt(0).toUpperCase() + mainPoint.slice(1)} matters greatly.`,
            `Think about ${mainPoint}.`,
            `${mainPoint.charAt(0).toUpperCase() + mainPoint.slice(1)} reveals important truths.`,
            `We should examine ${mainPoint} carefully.`,
            `${mainPoint.charAt(0).toUpperCase() + mainPoint.slice(1)} shows us a lot.`
        ];

        const starter = topicSentenceStarters[Math.floor(Math.random() * topicSentenceStarters.length)];
        const topicSentence = starter;

        // Supporting sentences (use Wikipedia context if available)
        let support = "";

        // Clean context of headers like "**Topic:**" before processing
        let cleanContext = wikiContext ? wikiContext.replace(/\*\*.*?\*\*[\s:]*/g, '') : "";

        if (cleanContext) {
            const sentences = cleanContext.split('.').filter(s => s.trim().length > 20);

            // KEY FIX: Offset slicing to avoid reusing Intro content
            // Intro checks first 3 sentences. Body paragraphs should start AFTER that.
            // Formula: Start at 3 + (index * 2)
            const startIdx = 3 + (index * 2);
            const relevantSentences = sentences.slice(startIdx, startIdx + 2);

            if (relevantSentences.length > 0) {
                // Remove topic name repeats at very start of sentence to assist flow
                support = relevantSentences.join('. ') + '.';
            } else {
                // Fallback if we run out of sentences
                support = this.generateSupportingSentences(topic, mainPoint, index);
            }
        } else {
            // Generate generic supporting content
            support = this.generateSupportingSentences(topic, mainPoint, index);
        }

        // Concluding sentence for paragraph - more natural, less formulaic
        const concluders = [
            `This helps explain why ${topic} remains relevant today.`,
            `These details matter more than they might first appear.`,
            `It's clear this plays a significant role.`,
            `This context changes how we view the bigger picture.`,
            `Without understanding this, we'd miss something important.`,
            `This adds another layer to what we already know.`,
            `The implications here are worth considering.`,
            `This shapes our overall understanding in meaningful ways.`,
            `We can see how this fits into the larger story.`,
            `This piece of the puzzle shouldn't be overlooked.`,
            // Sometimes no concluder - just let the support stand
            "",
            "",
            "" // Higher chance of no concluder for variety
        ];

        const concluder = concluders[Math.floor(Math.random() * concluders.length)];
        const conclusion = concluder ? ` ${concluder}` : "";

        return `${topicSentence} ${support}${conclusion}`;
    },

    generateSupportingSentences(topic, mainPoint, index) {
        // Generate 2-3 supporting sentences
        // Expanded template pool to 15 unique variants to avoid duplication (User Request)
        const templates = [
            `This aspect of ${topic} has been studied extensively. Researchers have found compelling evidence supporting various perspectives. The implications extend beyond immediate observations.`,
            `Examining this dimension reveals important patterns. Multiple factors contribute to the overall picture. Each element plays a distinct role in the larger framework.`,
            `Historical analysis shows how this has evolved over time. Contemporary understanding builds upon earlier foundations. Modern perspectives incorporate both traditional and innovative approaches.`,
            `Experts often point to this as a critical factor. The underlying mechanisms are complex but essential to understand. This helps validify the broader consensus on the subject.`,
            `When analyzed closely, the datal supports this view. There is a rich interplay between these factors. It becomes clear that simple explanations often miss the mark.`,
            `This has significant downstream effects. The influence it has on the surrounding context is undeniable. We can see clear cause-and-effect relationships at play here.`,
            `Critics and proponents alike debate the specifics. However, the core importance remains unchallenged. This ongoing dialogue shapes how we currently perceive ${topic}.`,
            `Data from various sources corroborates this. The consistent presence of this theme suggests it is foundational. Ignoring it would lead to an incomplete understanding.`,
            `This contributes deeply to the overall narrative. It serves as a bridge between different concepts. Without it, the structure would lack coherence.`,
            `This is more than just a minor detail. It represents a shift in how we approach the subject. The long-term consequences are still being evaluated.`,
            `Evidence suggests a strong correlation here. This aligns with broader trends we observe elsewhere. It fits neatly into the established theoretical models.`,
            `This component acts as a catalyst for other changes. Its impact resonates through the entire system. We can trace many outcomes back to this single point.`,
            `Scholars have long emphasized this particular point. It remains a focal point of academic discussion. The depth of analysis here continues to grow.`,
            `This illustrates the dynamic nature of ${topic}. Nothing exists in a vacuum, and this is no exception. It interacts fluidly with other key elements.`,
            `Taking a step back, this helps frame the entire issue. It provides the necessary context for deeper discussion. This perspective is essential for a holistic view.`
        ];

        // Use deterministic selection based on paragraph index to GUARANTEE uniqueness within an essay
        const safeIndex = (index || 0) % templates.length;

        return templates[safeIndex];
    },

    generateConclusion(topic, outline, wikiContext) {
        // Complete, natural conclusions
        const openings = [
            `${topic} is clearly an important topic.`,
            `After examining ${topic}, it's evident that this subject deserves attention.`,
            `${topic} continues to be relevant in today's world.`,
            `Looking at ${topic} this way helps us understand it better.`,
            `What stands out about ${topic} is its lasting significance.`,
            `${topic} matters for many reasons.`,
            `Understanding ${topic} better helps us make sense of related issues.`
        ];

        const opening = openings[Math.floor(Math.random() * openings.length)];

        // More natural summaries
        const summaries = [
            `we've covered a lot of ground here, from its origins to its current impact`,
            `there's more to this than meets the eye`,
            `this remains an important area worth our attention`,
            `the different angles we've explored all point to its significance`,
            `understanding this better helps us make sense of related issues`,
            `these various aspects all connect in meaningful ways`,
            `this subject keeps revealing new layers the more we examine it`,
            `the complexity here shouldn't be underestimated`,
            `we can appreciate both its historical importance and modern relevance`,
            `this continues to shape how we think about related topics`
        ];

        const summary = summaries[Math.floor(Math.random() * summaries.length)];

        // Natural endings - avoid "Looking ahead" and "will likely continue"
        const endings = [
            `People will probably keep debating this for years to come.`,
            `There's still plenty left to discover and discuss.`,
            `This conversation is far from over.`,
            `We'll undoubtedly see new perspectives emerge over time.`,
            `The more we learn, the more questions arise.`,
            `Future generations will bring their own insights to this.`,
            `This remains a topic that rewards closer study.`,
            `New research continues to shed light on different aspects.`,
            `Our understanding keeps evolving as we learn more.`,
            `This subject has proven its staying power.`,
            // Sometimes end without a forward-looking statement
            "",
            ""
        ];

        const ending = endings[Math.floor(Math.random() * endings.length)];

        // Construct conclusion with natural flow
        const parts = [opening, summary, ending].filter(p => p);

        if (parts.length === 0) {
            return `${topic} remains a subject that deserves our attention. The points we've explored here show why it continues to matter.`;
        }

        // Sometimes use shorter conclusions (more human-like)
        if (Math.random() > 0.5 && parts.length > 2) {
            return `${parts[0]} ${parts[1]}.`;
        }

        return parts.join(parts[0] === "" ? ". " : " ") + (ending ? "" : ".");
    },

    applyHumanLikeVariations(essay, topic) {
        // 1. Vary sentence lengths (mix short and long)
        essay = this.varySentenceLengths(essay);

        // 2. Add natural transitions
        essay = this.enhanceTransitions(essay);

        // 3. Add subtle imperfections (like humans make)
        essay = this.addHumanImperfections(essay);

        // 4. Inject personal voice occasionally
        essay = this.addPersonalVoice(essay, topic);

        // 5. Clean up formatting issues
        essay = this.cleanupFormatting(essay);

        return essay;
    },

    cleanupFormatting(text) {
        // Remove double periods and other formatting issues
        text = text.replace(/\.{2,}/g, '.'); // Replace multiple periods with single
        text = text.replace(/\s{2,}/g, ' '); // Replace multiple spaces with single
        text = text.replace(/\.\s*\./g, '.'); // Remove period-space-period patterns
        text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines

        // Fix spacing around punctuation
        text = text.replace(/\s+([.,!?;:])/g, '$1'); // Remove space before punctuation
        text = text.replace(/([.,!?;:])([A-Z])/g, '$1 $2'); // Add space after punctuation before capital

        return text.trim();
    },

    varySentenceLengths(text) {
        // Occasionally combine short sentences or split long ones
        const sentences = text.split('. ');
        const varied = [];

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            if (!sentence) continue;

            const words = sentence.split(' ');

            // If sentence is very short and next exists, occasionally combine
            if (words.length < 6 && i < sentences.length - 1 && Math.random() > 0.7) {
                const next = sentences[i + 1];
                varied.push(`${sentence}, and ${next.charAt(0).toLowerCase()}${next.slice(1)}`);
                i++; // Skip next since we combined
            } else {
                varied.push(sentence);
            }
        }

        return varied.join('. ') + '.';
    },

    enhanceTransitions(text) {
        // Add more natural transitions between ideas
        const transitions = [
            { from: '. Additionally,', to: '. In addition to this,' },
            { from: '. Furthermore,', to: '. What\'s more,' },
            { from: '. Moreover,', to: '. Beyond this,' },
            { from: '. However,', to: '. That said,' }
        ];

        let enhanced = text;
        transitions.forEach(t => {
            if (Math.random() > 0.5 && enhanced.includes(t.from)) {
                enhanced = enhanced.replace(t.from, t.to);
            }
        });

        return enhanced;
    },

    addHumanImperfections(text) {
        // Add very subtle, natural imperfections and remove AI-flagged phrases
        let imperfect = text;

        // Remove or replace common AI detector triggers
        const aiTriggers = [
            { pattern: /Another important aspect concerns/g, replacement: "We should also consider" },
            { pattern: /This perspective offers valuable insights into the broader context/g, replacement: "This helps us see the bigger picture" },
            { pattern: /The various dimensions explored here demonstrate/g, replacement: "What we've looked at shows" },
            { pattern: /Each aspect contributes to a more complete understanding/g, replacement: "All these pieces fit together" },
            { pattern: /stands as a topic worthy of continued attention/g, replacement: "deserves more attention" },
            { pattern: /Looking ahead,/g, replacement: "Going forward," },
            { pattern: /will likely continue to generate interest and debate/g, replacement: "will keep people talking" },
            { pattern: /It is also worth noting that/g, replacement: "It's worth mentioning" },
            { pattern: /Ultimately,/g, replacement: "In the end," },
            { pattern: /In conclusion,/g, replacement: "So," },
            { pattern: /To summarize,/g, replacement: "In short," },
            { pattern: /In final analysis,/g, replacement: "When you look at it," }
        ];

        aiTriggers.forEach(trigger => {
            imperfect = imperfect.replace(trigger.pattern, trigger.replacement);
        });

        // Add natural softeners
        const softeners = [
            { pattern: /\bis very important\b/g, replacement: 'matters a lot' },
            { pattern: /\bis significant\b/g, replacement: 'is pretty significant' },
            { pattern: /\bshows that\b/g, replacement: 'suggests' },
            { pattern: /\bdemonstrates that\b/g, replacement: 'shows' },
            { pattern: /\bnevertheless\b/g, replacement: 'even so' },
            { pattern: /\bfurthermore\b/g, replacement: 'plus' },
            { pattern: /\bmoreover\b/g, replacement: "what's more" },
            { pattern: /\bhowever,\b/gi, replacement: 'but' },
            { pattern: /\btherefore,\b/gi, replacement: 'so' }
        ];

        softeners.forEach(s => {
            if (Math.random() > 0.5) {
                imperfect = imperfect.replace(s.pattern, s.replacement);
            }
        });

        // Add occasional contractions (very human)
        const contractions = [
            { pattern: /\bit is\b/gi, replacement: "it's" },
            { pattern: /\bthat is\b/gi, replacement: "that's" },
            { pattern: /\bwe are\b/gi, replacement: "we're" },
            { pattern: /\bthey are\b/gi, replacement: "they're" },
            { pattern: /\bcannot\b/gi, replacement: "can't" },
            { pattern: /\bdo not\b/gi, replacement: "don't" },
            { pattern: /\bdoes not\b/gi, replacement: "doesn't" },
            { pattern: /\bwill not\b/gi, replacement: "won't" },
            { pattern: /\bwould not\b/gi, replacement: "wouldn't" },
            { pattern: /\bshould not\b/gi, replacement: "shouldn't" }
        ];

        contractions.forEach(c => {
            if (Math.random() > 0.6) { // Only sometimes
                // Only replace first 1-2 occurrences to avoid overdoing it
                let count = 0;
                imperfect = imperfect.replace(c.pattern, (match) => {
                    count++;
                    return count <= 2 ? c.replacement : match;
                });
            }
        });

        return imperfect;
    },

    addPersonalVoice(text, topic) {
        // Occasionally add a personal observation or rhetorical question
        if (Math.random() > 0.7) {
            const personalTouches = [
                `One might wonder about the deeper implications of ${topic}.`,
                `It's worth considering how ${topic} affects our daily lives.`,
                `Perhaps most intriguingly, ${topic} raises questions about our assumptions.`
            ];

            const touch = personalTouches[Math.floor(Math.random() * personalTouches.length)];

            // Insert in the middle somewhere
            const sentences = text.split('. ');
            const midPoint = Math.floor(sentences.length / 2);
            sentences.splice(midPoint, 0, touch);
            return sentences.join('. ');
        }

        return text;
    },

    // Enhanced essay extension for "make it longer"
    extendEssay(previousEssay, topic, wikiContext = "", additionalWords = 200) {
        this.onLog(`Extending essay on "${topic}" by ~${additionalWords} words`, "process");

        // Analyze existing essay structure
        const structure = this.analyzeEssayStructure(previousEssay);
        this.onLog(`Essay structure: ${structure.paragraphCount} paragraphs, conclusion: ${structure.hasConclusion}`, "data");

        // Strategy 1: If has conclusion, add new body paragraph before it
        if (structure.hasConclusion && structure.bodyParagraphCount < 5) {
            this.onLog("Strategy: Adding new body paragraph before conclusion", "data");
            const newPoint = this.generateBodyPoint(topic, wikiContext, structure.bodyParagraphCount);
            const newParagraph = this.generateBodyParagraph(topic, wikiContext, newPoint, structure.bodyParagraphCount);

            return this.insertBeforeConclusion(previousEssay, newParagraph, structure);
        }

        // Strategy 2: If no conclusion, add one plus additional content
        else if (!structure.hasConclusion) {
            this.onLog("Strategy: Adding body paragraph and conclusion", "data");

            // Add another body paragraph
            const newPoint = this.generateBodyPoint(topic, wikiContext, structure.bodyParagraphCount);
            const newParagraph = this.generateBodyParagraph(topic, wikiContext, newPoint, structure.bodyParagraphCount);

            // Add conclusion
            const outline = { thesis: `the significance of ${topic}` };
            const conclusion = this.generateConclusion(topic, outline, wikiContext);

            return `${previousEssay}\n\n${newParagraph}\n\n${conclusion}`;
        }

        // Strategy 3: If already has many paragraphs, expand existing ones
        else {
            this.onLog("Strategy: Expanding existing paragraphs with examples and details", "data");
            return this.expandExistingParagraphs(previousEssay, topic, wikiContext, additionalWords);
        }
    },

    expandExistingParagraphs(essay, topic, wikiContext, targetWords) {
        // Split into paragraphs
        const paragraphs = essay.split('\n\n').filter(p => p.trim().length > 0);

        // Find body paragraphs (not intro or conclusion)
        const bodyIndices = [];
        for (let i = 1; i < paragraphs.length - 1; i++) {
            bodyIndices.push(i);
        }

        if (bodyIndices.length === 0) {
            // Fallback: just add a new paragraph
            const newPoint = `additional perspectives on ${topic}`;
            const newParagraph = this.generateBodyParagraph(topic, wikiContext, newPoint, paragraphs.length);
            paragraphs.push(newParagraph);
            return paragraphs.join('\n\n');
        }

        // Expand a random body paragraph
        const indexToExpand = bodyIndices[Math.floor(Math.random() * bodyIndices.length)];
        const originalParagraph = paragraphs[indexToExpand];

        // Add examples, elaboration, or additional details
        const expansions = [
            ` For example, ${this.generateExample(topic, wikiContext)}.`,
            ` This becomes particularly evident when we consider ${this.generateElaboration(topic)}.`,
            ` Research has shown ${this.generateResearchPoint(topic, wikiContext)}.`,
            ` In practical terms, ${this.generatePracticalApplication(topic)}.`,
            ` Historical evidence suggests ${this.generateHistoricalPoint(topic, wikiContext)}.`
        ];

        const expansion = expansions[Math.floor(Math.random() * expansions.length)];
        paragraphs[indexToExpand] = originalParagraph + expansion;

        return paragraphs.join('\n\n');
    },

    generateExample(topic, wikiContext) {
        if (wikiContext) {
            const sentences = wikiContext.split('.').filter(s => s.trim().length > 30);
            if (sentences.length > 2) {
                return sentences[Math.floor(Math.random() * Math.min(sentences.length, 5))].trim();
            }
        }

        return `many scholars have noted the influence of ${topic} across various fields`;
    },

    generateElaboration(topic) {
        const elaborations = [
            `how ${topic} has evolved over time and adapted to changing circumstances`,
            `the various ways ${topic} manifests in different contexts`,
            `the underlying principles that make ${topic} so significant`,
            `how different perspectives on ${topic} can lead to new insights`,
            `the connections between ${topic} and related concepts`
        ];

        return elaborations[Math.floor(Math.random() * elaborations.length)];
    },

    generateResearchPoint(topic, wikiContext) {
        if (wikiContext) {
            const sentences = wikiContext.split('.').filter(s => s.trim().length > 20);
            if (sentences.length > 1) {
                return sentences[1].trim();
            }
        }

        return `that ${topic} plays a more significant role than previously understood`;
    },

    generatePracticalApplication(topic) {
        const applications = [
            `this understanding of ${topic} can be applied to solve real-world problems`,
            `${topic} influences how we approach related challenges`,
            `the principles of ${topic} extend beyond theoretical discussion`,
            `we can see ${topic} at work in everyday situations`,
            `${topic} provides a framework for understanding complex issues`
        ];

        return applications[Math.floor(Math.random() * applications.length)];
    },

    generateHistoricalPoint(topic, wikiContext) {
        if (wikiContext && /\d{4}|\d{2}th century|ancient|medieval|modern/i.test(wikiContext)) {
            const sentences = wikiContext.split('.').filter(s => /\d{4}|\d{2}th century|ancient|medieval|modern/i.test(s));
            if (sentences.length > 0) {
                return sentences[0].trim();
            }
        }

        return `that ${topic} has deep historical roots that continue to influence contemporary understanding`;
    },

    analyzeEssayStructure(essay) {
        const paragraphs = essay.split('\n\n').filter(p => p.trim().length > 0);

        // Check if last paragraph is a conclusion
        const lastPara = paragraphs[paragraphs.length - 1].toLowerCase();
        const hasConclusion = /\b(in conclusion|to summarize|ultimately|in final analysis)\b/.test(lastPara);

        return {
            paragraphCount: paragraphs.length,
            bodyParagraphCount: hasConclusion ? paragraphs.length - 2 : paragraphs.length - 1,
            hasConclusion: hasConclusion,
            paragraphs: paragraphs
        };
    },

    insertBeforeConclusion(essay, newParagraph, structure) {
        const paragraphs = structure.paragraphs;

        // Insert new paragraph before conclusion
        paragraphs.splice(paragraphs.length - 1, 0, newParagraph);

        return paragraphs.join('\n\n');
    },

    generateContinuation(previousEssay, topic, wikiContext, targetWords) {
        // Generate a continuation paragraph that flows from previous content
        const lastParagraph = previousEssay.split('\n\n').pop();

        // Create continuation based on context
        const continuationPoint = `the broader implications and applications of ${topic}`;
        const continuation = this.generateBodyParagraph(topic, wikiContext, continuationPoint, 99);

        return continuation;
    },

    // ========== FEEDBACK PROCESSING SYSTEM ==========

    processFeedback(originalQuery, originalResponse, feedbackType, userCorrection = null) {
        this.onLog(`Processing ${feedbackType} feedback`, "process");

        const feedback = {
            timestamp: Date.now(),
            query: originalQuery,
            response: originalResponse,
            type: feedbackType, // 'good', 'bad', 'correction'
            correction: userCorrection,
            patterns: this.extractPatterns(originalResponse),
            wordCount: originalResponse.split(' ').length,
            style: this.detectStyle(originalResponse)
        };

        this.feedbackMemory.corrections.push(feedback);
        this.updateLearningPatterns(feedback);
        this.saveFeedbackToStorage();

        this.onLog(`Feedback stored. Total feedback entries: ${this.feedbackMemory.corrections.length}`, "success");
    },

    extractPatterns(text) {
        return {
            avgSentenceLength: this.calculateAvgSentenceLength(text),
            vocabularyLevel: this.assessVocabularyLevel(text),
            structureType: this.detectStructureType(text),
            transitionWords: this.countTransitionWords(text),
            paragraphCount: text.split('\n\n').length
        };
    },

    calculateAvgSentenceLength(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const totalWords = sentences.reduce((sum, s) => sum + s.split(' ').length, 0);
        return sentences.length > 0 ? totalWords / sentences.length : 0;
    },

    assessVocabularyLevel(text) {
        const words = text.toLowerCase().split(/\s+/);
        const uniqueWords = new Set(words);
        return uniqueWords.size / words.length; // Lexical diversity
    },

    detectStructureType(text) {
        const hasIntro = /\b(in today's world|when we consider|throughout history)\b/i.test(text);
        const hasConclusion = /\b(in conclusion|to summarize|ultimately)\b/i.test(text);

        if (hasIntro && hasConclusion) return 'structured_essay';
        if (text.split('\n\n').length > 3) return 'multi_paragraph';
        return 'simple';
    },

    countTransitionWords(text) {
        const transitions = /\b(however|furthermore|moreover|additionally|therefore|thus|consequently|nevertheless)\b/gi;
        const matches = text.match(transitions);
        return matches ? matches.length : 0;
    },

    detectStyle(text) {
        if (/\b(dear|sincerely|regards)\b/i.test(text)) return 'letter';
        if (/\b(once upon|legend|journey)\b/i.test(text)) return 'narrative';
        if (/\b(furthermore|moreover|consequently)\b/i.test(text)) return 'academic';
        return 'general';
    },

    updateLearningPatterns(feedback) {
        if (feedback.type === 'good') {
            this.feedbackMemory.successPatterns.push(feedback.patterns);

            // Update preferences based on successful outputs
            this.feedbackMemory.preferences.preferredLength = this.categorizeLength(feedback.wordCount);
            this.feedbackMemory.preferences.preferredStyle = feedback.style;

            this.onLog("Updated success patterns", "data");
        } else if (feedback.type === 'bad') {
            this.feedbackMemory.failurePatterns.push(feedback.patterns);
            this.onLog("Updated failure patterns", "data");
        } else if (feedback.type === 'correction' && feedback.correction) {
            this.feedbackMemory.userCorrections.push({
                original: feedback.response,
                corrected: feedback.correction,
                timestamp: feedback.timestamp
            });
            this.onLog("Stored user correction for learning", "data");
        }

        // Tune parameters based on accumulated feedback
        this.tuneParametersFromFeedback();
    },

    categorizeLength(wordCount) {
        if (wordCount < 100) return 'short';
        if (wordCount < 300) return 'medium';
        return 'long';
    },

    tuneParametersFromFeedback() {
        // Adjust generation parameters based on feedback patterns
        if (this.feedbackMemory.successPatterns.length > 5) {
            const avgSuccessLength = this.feedbackMemory.successPatterns.reduce((sum, p) => sum + p.avgSentenceLength, 0) / this.feedbackMemory.successPatterns.length;

            // Subtle adjustments
            if (avgSuccessLength > 20) {
                this.temperature = Math.min(0.9, this.temperature + 0.02);
            } else if (avgSuccessLength < 12) {
                this.temperature = Math.max(0.75, this.temperature - 0.02);
            }

            this.onLog(`Tuned temperature to ${this.temperature.toFixed(2)} based on feedback`, "info");
        }
    },

    saveFeedbackToStorage() {
        try {
            localStorage.setItem('guahh_feedback_memory', JSON.stringify(this.feedbackMemory));
        } catch (e) {
            this.onLog("Could not save feedback to localStorage", "warning");
        }
    },

    loadFeedbackFromStorage() {
        try {
            const stored = localStorage.getItem('guahh_feedback_memory');
            if (stored) {
                this.feedbackMemory = JSON.parse(stored);
                this.onLog(`Loaded ${this.feedbackMemory.corrections.length} feedback entries from storage`, "success");
            }
        } catch (e) {
            this.onLog("Could not load feedback from localStorage", "warning");
        }
    },

    applyLearnedPatterns(text, context) {
        // Check if generated text matches failure patterns
        const currentPatterns = this.extractPatterns(text);

        let failureScore = 0;
        this.feedbackMemory.failurePatterns.forEach(pattern => {
            failureScore += this.comparePatterns(currentPatterns, pattern);
        });

        const avgFailureScore = this.feedbackMemory.failurePatterns.length > 0
            ? failureScore / this.feedbackMemory.failurePatterns.length
            : 0;

        if (avgFailureScore > 0.8) {
            this.onLog("Generated text too similar to failure patterns, adjusting...", "warning");
            return null; // Signal to regenerate
        }

        return text;
    },

    comparePatterns(pattern1, pattern2) {
        // Simple pattern similarity score
        let similarity = 0;
        let count = 0;

        if (Math.abs(pattern1.avgSentenceLength - pattern2.avgSentenceLength) < 3) {
            similarity += 1;
        }
        count++;

        if (Math.abs(pattern1.vocabularyLevel - pattern2.vocabularyLevel) < 0.1) {
            similarity += 1;
        }
        count++;

        if (pattern1.structureType === pattern2.structureType) {
            similarity += 1;
        }
        count++;

        return similarity / count;
    },

    // Generate response with feedback awareness
    async generateWithFeedback(query, userFeedback = null) {
        this.onLog("Generating with feedback awareness", "process");

        // If user provided specific feedback, incorporate it
        if (userFeedback) {
            query = `${query} (User feedback: ${userFeedback})`;
        }

        // Generate normally
        const result = await this.generateResponse(query);

        // Check against learned patterns
        const validated = this.applyLearnedPatterns(result.text, query);

        if (!validated && this.feedbackMemory.failurePatterns.length > 0) {
            // Regenerate with adjusted parameters
            this.onLog("Regenerating with adjusted parameters", "process");
            this.temperature += 0.1;
            const retry = await this.generateResponse(query);
            this.temperature -= 0.1; // Reset
            return retry;
        }

        return result;
    },

    // ========== END ADVANCED ESSAY SYSTEM ==========


    detectSentiment(text) {
        const happy = /good|great|love|happy|awesome|thanks|excellent|amazing/i;
        const sad = /bad|sad|hate|sorrow|sorry|regret|unhappy|terrible/i;
        if (happy.test(text)) this.emotion = "happy";
        else if (sad.test(text)) this.emotion = "sad";
        else this.emotion = "neutral";
        this.onLog(`Detected Sentiment: ${this.emotion.toUpperCase()}`, "info");
    },

    generateLetter(topic, externalContext = "") {
        const recipients = ["Friend", "Colleague", "Editor", "Sir/Madam", "Team"];
        let recipient = recipients[Math.floor(Math.random() * recipients.length)];

        if (topic) {
            // Smart recipient extraction: "my boss about a project" -> recipient: "my boss"
            const splitMarkers = [" about ", " regarding ", " on ", " for "];
            let cleanTopic = topic;

            for (const marker of splitMarkers) {
                if (topic.includes(marker)) {
                    recipient = topic.split(marker)[0].trim();
                    cleanTopic = topic.split(marker).slice(1).join(marker).trim();
                    break;
                }
            }
            if (recipient === topic && topic.split(' ').length < 4) {
                // If no marker found but topic is short, treat whole topic as recipient if it looks like a person/role? 
                // Or just leave it. better to be safe.
                recipient = topic;
                cleanTopic = "the matter at hand";
            } else if (recipient === topic) {
                // Topic is long description, probably NOT a recipient name
                recipient = "Sir/Madam";
                cleanTopic = topic;
            }
            // Fix "to my boss" -> "my boss" (already handled by extractTopic but double check)
            recipient = recipient.replace(/^(to|for)\s+/i, '');

            // Re-assign topic for the body generation
            topic = cleanTopic;
        }

        // Adjust tone based on emotion/intent
        let opening = "I am writing to you regarding";
        if (topic && /convinc|persuad|beg|ask/i.test(topic)) opening = "I am writing to passionately request";
        if (this.emotion === "happy") opening = "I am delighted to write to you about";
        if (this.emotion === "sad") opening = "It is with a heavy heart that I write regarding";

        const templates = [
            `Dear ${recipient},\n\n${opening} ${topic || "a recent matter"}. `,
            `To ${recipient},\n\nI wanted to share my thoughts on ${topic || "a subject of importance"}. `,
            `Dear ${recipient},\n\nThis is a message about ${topic || "the project"}. `
        ];

        const seed = templates[Math.floor(Math.random() * templates.length)];

        // Use memory to augment generation, similar to story
        let backgroundKnowledge = "";
        if (this.memory.length > 0) {
            for (let i = 0; i < 15; i++) {
                const randomEntry = this.memory[Math.floor(Math.random() * this.memory.length)];
                // Filter out math/code to prevent math symbols appearing in letters
                if (randomEntry && randomEntry.a && randomEntry.a.length > 20 && !/[\d+\-*/=]/.test(randomEntry.a) && !/[{}]/.test(randomEntry.a)) {
                    backgroundKnowledge += randomEntry.a + " ";
                }
            }
        }

        if (externalContext) backgroundKnowledge += " " + externalContext;

        const sourceText = seed + " " + backgroundKnowledge.substring(0, 6000) + " " + this.letterCorpus;
        const body = this.generateNeuralText(sourceText, 50);

        return `${seed}${body}\n\nSincerely,\nGuahh AI`;
    },

    sampleWithTemperature(candidateFreq, temperature = 1.0, topP = 0.9) {
        const candidates = Object.keys(candidateFreq);
        if (candidates.length === 0) return null;

        const total = Object.values(candidateFreq).reduce((a, b) => a + b, 0);
        let probs = candidates.map(word => ({ word, prob: Math.pow(candidateFreq[word] / total, 1 / temperature) }));
        const probSum = probs.reduce((a, b) => a + b.prob, 0);
        probs = probs.map(p => ({ word: p.word, prob: p.prob / probSum }));
        probs.sort((a, b) => b.prob - a.prob);

        let cumSum = 0;
        const nucleus = [];
        for (const p of probs) {
            cumSum += p.prob;
            nucleus.push(p);
            if (cumSum >= topP) break;
        }

        const rand = Math.random() * nucleus.reduce((a, b) => a + b.prob, 0);
        let running = 0;
        for (const p of nucleus) {
            running += p.prob;
            if (rand <= running) return p.word;
        }
        return nucleus[0].word;
    },

    validateOutput(text) {
        if (!text || text.length < 10) return false;
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return false;

        const uniqueRatio = new Set(words).size / words.length;
        // console.log(`[Validation] Length: ${text.length}, Unique: ${uniqueRatio.toFixed(2)}`);

        if (uniqueRatio < 0.35) return false; // Relaxed from 0.4

        // Check against recent outputs for diversity
        const similarity = this.recentOutputs.some(recent => {
            const overlap = this.computeSimilarity(text, recent);
            return overlap > 0.8; // Loosened from 0.7 to 0.8
        });

        return !similarity;
    },

    applyRepetitionPenalty(candidatePool, recentWords, penalty = 0.5) {
        // Reduce probability of recently used words
        const penalizedPool = {};
        for (const [word, freq] of Object.entries(candidatePool)) {
            const timesUsedRecently = recentWords.filter(w => w.toLowerCase() === word.toLowerCase()).length;
            const penalizedFreq = timesUsedRecently > 0 ? freq * Math.pow(penalty, timesUsedRecently) : freq;
            penalizedPool[word] = Math.max(penalizedFreq, 1); // Ensure at least 1
        }
        return penalizedPool;
    },

    checkCoherence(text) {
        if (!text || text.length < 20) return false;

        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
        if (sentences.length === 0) return false;

        // Check for basic coherence: sentences should have reasonable length and variety
        let totalWords = 0;
        let validSentences = 0;

        for (const sentence of sentences) {
            const words = sentence.trim().split(/\s+/).filter(w => w.length > 0);
            if (words.length >= 3 && words.length <= 50) {
                validSentences++;
                totalWords += words.length;
            }
        }

        // At least 50% of sentences should be valid length
        const validRatio = validSentences / sentences.length;
        return validRatio >= 0.5;
    },

    scoreTopicRelevance(text, topic) {
        if (!topic || !text) return 0.5;

        const topicWords = this.tokenize(topic);
        const textWords = this.tokenize(text);

        let matches = 0;
        for (const topicWord of topicWords) {
            if (textWords.includes(topicWord)) {
                matches++;
            }
        }

        return topicWords.length > 0 ? matches / topicWords.length : 0;
    },

    computeSimilarity(text1, text2) {
        const s1 = new Set(text1.toLowerCase().split(/\s+/));
        const s2 = new Set(text2.toLowerCase().split(/\s+/));
        const intersection = new Set([...s1].filter(x => s2.has(x)));
        const union = new Set([...s1, ...s2]);
        return union.size === 0 ? 0 : intersection.size / union.size;
    },

    addToHistory(query, response) {
        this.conversationHistory.push({ query, response, timestamp: Date.now() });
        // Increased from 10 to 50 for better context retention
        if (this.conversationHistory.length > 50) this.conversationHistory.shift();
        this.recentOutputs.push(response);
        // Increased from 5 to 15 for better output diversity tracking
        if (this.recentOutputs.length > 15) this.recentOutputs.shift();
    },

    checkDictionaryInquiry(query) {
        const clean = query.toLowerCase().replace(/[^a-z\s]/g, '').trim();
        const parts = clean.split(" ");
        const lastWord = parts[parts.length - 1];
        if (this.dictionary[clean] || this.dictionary[lastWord]) {
            const entry = this.dictionary[clean] || this.dictionary[lastWord];
            return `**${entry.word}** (${entry.pos}): ${entry.def}`;
        }
        return null;
    },

    generateConversationalFallback(query) {
        const q = query.toLowerCase();

        // Check for specific keywords to make the fallback feel smarter
        if (/(love|like|enjoy|fav)/i.test(q)) {
            return "That sounds really interesting! What is it specifically that you enjoy about it?";
        }
        if (/(hate|dislike|annoy|bad)/i.test(q)) {
            return "I hear you. It can be frustrating when things aren't right. What would make it better?";
        }
        if (/(think|thought|opinion)/i.test(q)) {
            return "That's a valid perspective. Have you considered looking at it from another angle?";
        }
        if (/(maybe|perhaps|guess)/i.test(q)) {
            return "Uncertainty is part of the process. Sometimes it helps to list out the pros and cons.";
        }
        if (q.length < 10) {
            return "Could you tell me a bit more about that? I'd love to understand better.";
        }

        // Generic but polite open-ended questions
        const templates = [
            "That's an interesting point. Tell me more!",
            "I see. How does that impact what you're working on?",
            "I'm listening. Please go on.",
            "That's quite unique. What else can you tell me?",
            "I'd love to hear more about your thoughts on this."
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    },

    // ========== ADVANCED ESSAY ENGINE ==========

    generateAdvancedEssay(topic, context) {
        this.onLog(`Generating High-Density Essay on: ${topic}`, "process");

        const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
        const title = `The Significance of ${capitalize(topic)}`;

        // 1. Process Context into Data Points
        let cleanContext = context ? context.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim() : "";
        // Split into sentences, handling common abbreviations (basic check)
        let sentences = cleanContext.match(/[^.!?]+[.!?]+/g) || [];
        sentences = sentences.map(s => s.trim()).filter(s => s.length > 20); // Filter short garbage

        this.onLog(`Extracted ${sentences.length} fact sentences for essay.`, "data");

        // 2. Distribute Facts (Round Robin Strategy)
        const facts = {
            intro: [],
            history: [],
            impact: [],
            future: []
        };

        // If we have facts, distribute them specific to section if possible (keywords)
        // Otherwise, simply fill buckets
        const historyKeywords = /history|origin|began|invented|ancient|century|early|first/i;
        const impactKeywords = /impact|use|function|role|important|significance|modern|today/i;
        const futureKeywords = /future|challenge|potential|develop|ongoing|will/i;

        sentences.forEach(s => {
            if (historyKeywords.test(s)) facts.history.push(s);
            else if (futureKeywords.test(s)) facts.future.push(s);
            else if (impactKeywords.test(s)) facts.impact.push(s);
            else {
                // Round robin overflow
                if (facts.intro.length < 2) facts.intro.push(s);
                else if (facts.history.length < 3) facts.history.push(s);
                else if (facts.impact.length < 3) facts.impact.push(s);
                else facts.future.push(s);
            }
        });

        // Helper to get a paragraph or fallback
        const buildPara = (sentences, genericStart, genericEnd) => {
            if (sentences.length === 0) return `${genericStart} ${genericEnd}`;
            // Combine sentences with simple transitions if needed, or just flow
            return `${genericStart} ` + sentences.join(" ") + (sentences.length < 2 ? ` ${genericEnd}` : "");
        };

        // 3. Construct Sections

        // Introduction
        const introHook = `The concept of ${topic} is a subject of significant interest.`;
        const introFacts = facts.intro.length > 0 ? facts.intro.join(" ") : `To understand ${topic}, one must look at its core definition.`;
        const thesis = `This essay examines the historical background, modern significance, and future outlook of ${topic}.`;
        const intro = `${introHook} ${introFacts} ${thesis}`;

        // Body 1: History / Background
        const body1 = buildPara(
            facts.history,
            "To begin with, the historical context provides a necessary foundation.",
            `The origins of ${topic} reveal a progression that has shaped its current state.`
        );

        // Body 2: Significance / Details
        const body2 = buildPara(
            facts.impact,
            "Furthermore, the significance of this subject is evident in its widespread application.",
            `It is clear that ${topic} plays a pivotal role in its respective field.`
        );

        // Body 3: Future / Challenges / Conclusion of Body
        const body3 = buildPara(
            facts.future,
            "However, it is also important to consider the ongoing developments and challenges.",
            `As time progresses, ${topic} continues to evolve, presenting both new opportunities and complexities.`
        );

        // Conclusion
        const conclusionStart = "In conclusion,";
        const finalSummary = `${topic} remains a dynamic and vital topic.`;
        const finalThought = facts.intro.length > 0
            ? `Reflecting on the facts presented, such as ${facts.intro[0].toLowerCase().replace(/[.!?]$/, '')}, we see its enduring value.`
            : "Detailed analysis confirms its importance in the broader context.";

        const conclusion = `${conclusionStart} ${finalSummary} from its history to its modern impact, it offers valuable insights. ${finalThought}`;

        // Assemble
        return `## ${title}\n\n${intro}\n\n${body1}\n\n${body2}\n\n${body3}\n\n${conclusion}`;
    },

    generateCreativeText(topic, query) {
        // Simple fallback for non-essay creative requests (stories, etc.)
        const genres = ["Fantasy", "Sci-Fi", "Mystery", "Drama"];
        const genre = genres[Math.floor(Math.random() * genres.length)];
        return `## A Story About ${topic}\n\n*(Genre: ${genre})*\n\nOnce upon a time, in a world defined by ${topic}, there was a shifting tide. The air crackled with the energy of ${topic}. It was a day unlike any other... \n\n(To be continued...)`;
    }
};
