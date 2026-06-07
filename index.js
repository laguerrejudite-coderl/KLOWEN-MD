
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeInMemoryStore 
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const pino = require("pino");

const startTime = Date.now();

// Fonctions utilitaires pour le menu
function getUptime() {
    const duration = Date.now() - startTime;
    let seconds = Math.floor((duration / 1000) % 60);
    let minutes = Math.floor((duration / (1000 * 60)) % 60);
    let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
    return `${hours}h ${minutes}m ${seconds}s`;
}

function getMemoryUsage() {
    return `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`;
}

// Nettoyage et formatage du numéro du propriétaire depuis le .env
function getOwnerJid() {
    const rawNumber = process.env.NUMBER_OWNER || "";
    // Supprime tout ce qui n'est pas un chiffre (parenthèses, espaces, etc.)
    const cleanNumber = rawNumber.replace(/\D/g, "");
    return cleanNumber ? `${cleanNumber}@s.whatsapp.net` : null;
}

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
store.readFromFile('./baileys_store.json');
setInterval(() => {
    store.writeToFile('./baileys_store.json');
}, 10000);

async function startBot() {
    // Utilisation du dossier de session standard visible dans votre dossier KLOWEN-MD
    const { state, saveCreds } = await useMultiFileAuthState('session_auth');

    const bot = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.0"],
        printQRInTerminal: false,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000
    });

    store.bind(bot.ev);

    // Gestion de la connexion et affichage du QR Code
    bot.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.clear();
            console.log("📌 SCANNEZ CE QR CODE AVEC WHATSAPP : \n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.clear();
            console.log("=============================================");
            console.log("✅ [KLOWEN-MD] CONNECTÉ AVEC SUCCÈS !");
            console.log(`👑 Propriétaire : ${process.env.OWNER_NAME || "LORMIL"}`);
            console.log(`🎵 Pack Sticker : ${process.env.STICKER_PACK_NAME || "LORMIL"}`);
            console.log("=============================================");
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log(`🔄 Connexion perdue. Reconnexion en cours...`);
                startBot();
            } else {
                console.log(`❌ Session expirée. Veuillez vider le dossier 'session_auth' et relancer.`);
            }
        }
    });

    bot.ev.on('creds.update', saveCreds);

    // Réception et traitement des messages
    bot.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        
        const msg = m.messages[0]; 
        if (!msg || !msg.message) return;

        const remoteJid = msg.key.remoteJid;

        // 🌟 GESTION AUTOMATIQUE DES STATUTS (Base de votre .env)
        if (remoteJid === 'status@broadcast') {
            if (process.env.AUTO_STATUS_SEEN === 'true') {
                await bot.readMessages([msg.key]);
                console.log(`👁️ Statut vu automatiquement`);
            }
            return; 
        }

        if (msg.key.fromMe) return;

        const pushName = msg.pushName || "Utilisateur";
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        // Lecture dynamique du préfixe défini dans votre .env
        const prefix = process.env.PREFIX || '!';
        if (!text.startsWith(prefix)) return;

        const args = text.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const query = args.join(' ');

        const ownerJid = getOwnerJid();
        // Vérification sécurisée de l'owner (via JID individuel ou participant de groupe)
        const isOwner = msg.key.participant === ownerJid || remoteJid === ownerJid;

        // 1. COMMANDE MENU
        if (command === 'menu') {
            const devName = process.env.OWNER_NAME || 'LORMIL 👑';

            const menuTexte = `╭───────────────⭓
│ ʙᴏᴛ : KLOWEN-MD
│ ᴜsᴇʀ: ${pushName.toUpperCase()}
│ ᴘʀᴇғɪx: ${prefix}
│ ᴜᴘᴛɪᴍᴇ: ${getUptime()}
│ ᴍᴇᴍᴏʀʏ : ${getMemoryUsage()}
│ box_dev: ${devName}
╰───────────────⭓

⭓───────────────⭓『 🤖 ᴀɪ 』
│ ⬡ ai          [FONCTIONNEL] ✅
│ ⬡ deepseek    [FONCTIONNEL] ✅
│ ⬡ openai      [FONCTIONNEL] ✅
╰──────────────────⭓
⭓───────────────⭓『 👑 ᴏᴡɴᴇʀ 』
│ ⬡ restart     [RÉSERVÉ OWNER] 🔐
╰──────────────────⭓`;

            await bot.sendMessage(remoteJid, { text: menuTexte }, { quoted: msg });
        }

        // 2. COMMANDES IA (ai, deepseek, openai)
        else if (command === 'ai' || command === 'deepseek' || command === 'openai') {
            if (!query) {
                return await bot.sendMessage(remoteJid, { 
                    text: `❌ Posez une question.\nExemple: *${prefix}${command} comment vas-tu ?*` 
                }, { quoted: msg });
            }
            
            await bot.sendMessage(remoteJid, { text: "🤖 *Klowen-AI analyse votre demande...*" }, { quoted: msg });

            try {
                // Correction du template string et intégration de l'API
                const res = await fetch(`https://simsimi.net{encodeURIComponent(query)}&lc=fr`);
                const data = await res.json();
                const reponseIA = data.success || "Désolé, je ne parviens pas à formuler une réponse.";
                
                await bot.sendMessage(remoteJid, { 
                    text: `🤖 *KLOWEN-AI (${command.toUpperCase()}) :*\n\n${reponseIA}` 
                }, { quoted: msg });
            } catch (err) {
                await bot.sendMessage(remoteJid, { text: '⚠️ Serveur IA indisponible actuellement.' }, { quoted: msg });
            }
        }

        // 3. COMMANDE OWNER : RESTART
        else if (command === 'restart') {
            if (!isOwner) {
                return await bot.sendMessage(remoteJid, { text: "❌ Cette commande est réservée à mon créateur LORMIL." }, { quoted: msg });
            }

            await bot.sendMessage(remoteJid, { text: "🔄 *Redémarrage du bot en cours...*" }, { quoted: msg });
            console.log("Reboot initié par le propriétaire...");
            process.exit(0); 
        }
    });
}

startBot().catch(err => console.log("Erreur d'initialisation :", err));
