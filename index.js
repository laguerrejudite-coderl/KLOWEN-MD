require('dotenv').config(); 
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers, 
    delay 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");

// 🔑 ÉTAPE 1 : Décodage automatique du SESSION_ID d'Heroku/Render
function decodeSession() {
    const sessionId = process.env.SESSION_ID;
    if (!sessionId) {
        console.log("❌ ERREUR COMPTE : Aucun SESSION_ID trouvé dans l'environnement !");
        process.exit(1);
    }
    if (!fs.existsSync('./session_auth')) {
        fs.mkdirSync('./session_auth');
    }
    try {
        // Nettoyage au cas où le générateur ajoute un préfixe avec un symbole ~
        const cleanData = sessionId.includes('~') ? sessionId.split('~')[1] : sessionId;
        const decrypted = Buffer.from(cleanData, 'base64').toString('utf-8');
        fs.writeFileSync('./session_auth/creds.json', decrypted);
        console.log("✅ [KLOWEN-MD] Session synchronisée avec succès !");
    } catch (err) {
        console.log("❌ Erreur de décodage de votre SESSION_ID :", err.message);
        process.exit(1);
    }
}

async function startBot() {
    decodeSession();

    const { state, saveCreds } = await useMultiFileAuthState('session_auth');

    const bot = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        browser: Browsers.macOS("Desktop"),
        printQRInTerminal: false,
        keepAliveIntervalMs: 30000
    });

    // 📞 GESTION DU REJET DES APPELS (Option REJECT_CALL)
    bot.ev.on('call', async (callEvent) => {
        if (process.env.REJECT_CALL === 'true') {
            const callId = callEvent[0].id;
            const from = callEvent[0].from;
            await bot.rejectCall(callId, from);
            await bot.sendMessage(from, { 
                text: `⚠️ *[KLOWEN-MD]* : Les appels ne sont pas autorisés. Veuillez laisser un message écrit.` 
            });
        }
    });

    bot.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.clear();
            console.log("=============================================");
            console.log("✅ [KLOWEN-MD] EST CONNECTÉ ET EN LIGNE !");
            console.log(`👑 Développeur : ${process.env.OWNER_NAME || 'LORMIL'}`);
            console.log(`🌍 Mode Actif  : ${process.env.MODE || 'public'}`);
            console.log("=============================================");
            
            // Statut En Ligne Permanent (Option ALWAYS_ONLINE)
            if (process.env.ALWAYS_ONLINE === 'true') {
                bot.sendPresenceUpdate('available');
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("🔄 Reconnexion au serveur WhatsApp...");
                startBot();
            }
        }
    });

    bot.ev.on('creds.update', saveCreds);

    // 💬 TRAITEMENT DES MESSAGES ET COMMANDES
    bot.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        const msg = m.messages[0];
        if (!msg || !msg.message) return;

        const remoteJid = msg.key.remoteJid;

        // 👁️ VUE AUTOMATIQUE DES STATUTS (Option AUTO_STATUS_SEEN)
        if (remoteJid === 'status@broadcast') {
            if (process.env.AUTO_STATUS_SEEN === 'true') {
                await bot.readMessages([msg.key]);
                console.log(`👁️ Statut vu automatiquement par KLOWEN-MD`);
            }
            return;
        }

        // Lecture automatique des messages (Option AUTO_READ)
        if (process.env.AUTO_READ === 'true') {
            await bot.readMessages([msg.key]);
        }

        // Sécurité contre ses propres messages
        if (msg.key.fromMe) return;

        // 🔐 GESTION DU MODE PUBLIC / PRIVÉ
        const ownerNumber = process.env.NUMBER_OWNER ? process.env.NUMBER_OWNER.replace(/\D/g, '') : '';
        const isOwner = remoteJid.includes(ownerNumber) || msg.key.participant?.includes(ownerNumber);
        const mode = process.env.MODE || 'public';

        if (mode === 'private' && !isOwner) return; // Ignore si le bot est en privé et que ce n'est pas vous

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const prefix = process.env.PREFIX || '!';

        if (!text.startsWith(prefix)) return;

        const args = text.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const query = args.join(' ');

        // 🎭 SIMULATIONS (Options AUTO_TYPING et AUTO_RECORDING)
        if (process.env.AUTO_TYPING === 'true') {
            await bot.sendPresenceUpdate('composing', remoteJid);
            await delay(1500);
        } else if (process.env.AUTO_RECORDING === 'true') {
            await bot.sendPresenceUpdate('recording', remoteJid);
            await delay(1500);
        }

        // --- COMMANDES DU BOT ---
        
        // 1. COMMANDE PING
        if (command === 'ping') {
            await bot.sendMessage(remoteJid, { 
                text: `🏓 *Pong !* \n\n*KLOWEN-MD* est ultra rapide et opérationnel.\n👑 Créateur : LORMIL` 
            }, { quoted: msg });
        }

        // 2. COMMANDE MENU
        else if (command === 'menu') {
            const pushName = msg.pushName || "Utilisateur";
            const menuTexte = `╭───────────────⭓
│ ʙᴏᴛ : KLOWEN-MD 👑
│ ᴜsᴇʀ: ${pushName.toUpperCase()}
│ ᴘʀᴇғɪx: ${prefix}
│ ᴍᴏᴅᴇ: ${mode.toUpperCase()}
│ ᴅᴇᴠ: LORMIL
╰───────────────⭓

⭓───────────────⭓『 ⚙️ GENERAL 』
│ ⬡ ping
│ ⬡ menu
╰──────────────────⭓`;
            await bot.sendMessage(remoteJid, { text: menuTexte }, { quoted: msg });
        }
    });
}

startBot().catch(err => console.error("Erreur de lancement :", err));
