const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs'); // Datei-System-Modul importieren
const crypto = require('crypto'); // crypto-Modul importieren
const nodemailer = require('nodemailer'); // nodemailer-Modul importieren
const multer = require('multer'); // multer-Modul importieren
const cors = require('cors'); // cors-Modul importieren
const session = require('express-session'); // Session-Modul importieren
const app = express();
const port = process.env.PORT || 4000; // Port auf 4000 geändert

// Middleware, um Anfragen an thundergaming.de zu akzeptieren
app.use(cors({
    origin: ['http://thundergaming.de', 'http://localhost']
}));

// Weiterleitung von Anfragen an thundergaming.de
app.use((req, res, next) => {
    if (req.headers.host === 'thundergaming.de') {
        return res.redirect(301, 'https://github.com/thunderflash');
    }
    next();
});

const algorithm = 'aes-256-ctr';
const secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3';

const encrypt = (text) => {
    const iv = crypto.randomBytes(16); // IV hier initialisieren
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
};

const decrypt = (hash) => {
    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);
    return decrypted.toString();
};

const encryptIP = (ip) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(ip), cipher.final()]);
    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
};

const decryptIP = (hash) => {
    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);
    return decrypted.toString();
};

let messages = [];
let users = []; // Hinzufügen eines Arrays zur Speicherung von Benutzern
let currentVote = ''; // Variable zur Speicherung der aktuellen Abstimmung
let answers = []; // Variable zur Speicherung der Antworten
let endTime = ''; // Variable zur Speicherung der Endzeit
let votes = {}; // Variable zur Speicherung der Stimmen
let votedUsers = new Set(); // Set zur Speicherung der Benutzer, die bereits abgestimmt haben
let teamMembers = {
    Admins: ['Dynamo_Mathias', 'Theredjar', 'Thunderflash'],
    Moderator: ['skipyall']
}; // Teammitglieder nach Kategorien
let posts = []; // Hinzufügen eines Arrays zur Speicherung von Beiträgen
let loginStatus = { loggedOut: true, ip: null }; // Hinzufügen einer Variable zur Speicherung des Login-Status und der IP

// Benutzerkonten aus Datei laden
function loadUsers() {
    if (fs.existsSync('users.json')) {
        const data = fs.readFileSync('users.json', 'utf8');
        if (data) {
            try {
                const decryptedData = decrypt(JSON.parse(data));
                users = JSON.parse(decryptedData);
            } catch (error) {
                console.error('Fehler beim Entschlüsseln der Benutzerdaten:', error);
            }
        }
    }
}

// Benutzerkonten in Datei speichern
function saveUsers() {
    const encryptedData = encrypt(JSON.stringify(users));
    fs.writeFileSync('users.json', JSON.stringify(encryptedData, null, 2));
}

// Teammitglieder und Kategorien aus Datei laden
function loadTeamMembers() {
    if (fs.existsSync('teamMembers.json')) {
        const data = fs.readFileSync('teamMembers.json', 'utf8');
        if (data) {
            teamMembers = JSON.parse(data);
        }
    }
}

// Teammitglieder und Kategorien in Datei speichern
function saveTeamMembers() {
    fs.writeFileSync('teamMembers.json', JSON.stringify(teamMembers, null, 2));
}

// Beiträge aus Datei laden
function loadPosts() {
    if (fs.existsSync('posts.json')) {
        const data = fs.readFileSync('posts.json', 'utf8');
        if (data) {
            posts = JSON.parse(data);
        }
    }
}

// Beiträge in Datei speichern
function savePosts() {
    fs.writeFileSync('posts.json', JSON.stringify(posts, null, 2));
}

loadUsers();
loadTeamMembers();
loadPosts(); // Beiträge laden

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Statische Dateien aus dem Upload-Ordner bedienen
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Setze auf true, wenn HTTPS verwendet wird
}));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password'
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${req.body.username}.jpg`);
    }
});

const upload = multer({ storage });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.post('/admin', (req, res) => {
    const { password } = req.body;
    if (password === '2q') {
        res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
    } else {
        res.redirect('/');
    }
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/admin/vote', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-vote.html'));
});

app.get('/admin/edit-privacy-policy', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-edit-privacy-policy.html'));
});

app.post('/admin/vote', (req, res) => {
    const { currentVote: newCurrentVote, allowCustomAnswers, answers: newAnswers, endTime: newEndTime } = req.body;
    currentVote = newCurrentVote;
    answers = newAnswers;
    endTime = newEndTime;
    votes = newAnswers.reduce((acc, answer) => {
        acc[answer] = 0;
        return acc;
    }, {});
    votedUsers.clear(); // Set zurücksetzen, wenn eine neue Abstimmung erstellt wird
    res.json({ success: true });
});

app.post('/admin/delete-user', (req, res) => {
    const { username } = req.body;
    users = users.filter(user => user.username !== username);
    saveUsers(); // Benutzerkonten speichern
    res.json({ success: true });
});

app.post('/admin/delete-all-users', (req, res) => {
    users = [];
    saveUsers(); // Benutzerkonten speichern
    res.json({ success: true });
});

app.post('/admin/end-vote', (req, res) => {
    endTime = new Date().toISOString(); // Setze die Endzeit auf die aktuelle Zeit
    res.json({ success: true });
});

app.post('/admin/delete-vote', (req, res) => {
    currentVote = '';
    answers = [];
    endTime = '';
    votes = {};
    votedUsers.clear();
    res.json({ success: true });
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.post('/register', (req, res) => {
    const { email, username, password } = req.body;
    const emailExists = users.some(user => user.email === email);
    const usernameExists = users.some(user => user.username === username);

    if (emailExists) {
        res.json({ error: 'Diese E-Mail ist bereits in Nutzung.' });
    } else if (usernameExists) {
        res.json({ error: 'Dieser Benutzername ist bereits in Nutzung.' });
    } else {
        users.push({ email, username, password });
        saveUsers(); // Benutzerkonten speichern
        logActivity(`${username} hat sich registriert`);
        req.session.user = { email, username }; // Benutzer in der Session speichern
        loginStatus.loggedOut = false; // Setze den Status auf eingeloggt
        loginStatus.ip = req.ip; // Speichere die IP-Adresse
        res.json({ success: true, message: 'Registrierung erfolgreich! Sie werden zur Startseite weitergeleitet.' });
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

const loginLogFilePath = path.join(__dirname, 'login-log.txt'); // Pfad zur Login-Log-Datei

function logLogin(username) {
    const logEntry = `${new Date().toISOString()} - ${username} hat sich eingeloggt\n`;
    fs.appendFileSync(loginLogFilePath, logEntry, 'utf8');
}

const activityLogFilePath = path.join(__dirname, 'activity-log.txt'); // Pfad zur Aktivitäts-Log-Datei

function logActivity(activity) {
    const logEntry = `${new Date().toISOString()} - ${activity}\n`;
    fs.appendFileSync(activityLogFilePath, logEntry, 'utf8');
}

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(user => user.username === username && user.password === password);

    if (user) {
        req.session.user = user; // Speichere den Benutzer in der Session
        logLogin(username); // Logge den Login
        logActivity(`${username} hat sich eingeloggt`);
        loginStatus.loggedOut = false; // Setze den Status auf eingeloggt
        loginStatus.ip = req.ip; // Speichere die IP-Adresse
        res.json({ success: true, message: 'Erfolgreich eingeloggt!' });
    } else {
        res.json({ error: 'Ungültiger Benutzername oder Passwort.' });
    }
});

app.use((req, res, next) => {
    if (req.session.user) {
        res.locals.user = req.session.user;
    }
    next();
});

// Middleware zum Überprüfen der Authentifizierung
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// Beispiel für eine geschützte Route
app.get('/protected', isAuthenticated, (req, res) => {
    res.send('Dies ist eine geschützte Seite.');
    logActivity(`${req.session.user.username} hat die geschützte Seite aufgerufen`);
});

// Beispiel für eine geschützte Route
app.get('/vote', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'vote.html'));
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/admin/vote', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-vote.html'));
});

app.get('/admin/edit-privacy-policy', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-edit-privacy-policy.html'));
});

app.post('/admin/vote', (req, res) => {
    const { currentVote: newCurrentVote, allowCustomAnswers, answers: newAnswers, endTime: newEndTime } = req.body;
    currentVote = newCurrentVote;
    answers = newAnswers;
    endTime = newEndTime;
    votes = newAnswers.reduce((acc, answer) => {
        acc[answer] = 0;
        return acc;
    }, {});
    votedUsers.clear(); // Set zurücksetzen, wenn eine neue Abstimmung erstellt wird
    res.json({ success: true });
});

app.post('/admin/delete-user', (req, res) => {
    const { username } = req.body;
    users = users.filter(user => user.username !== username);
    saveUsers(); // Benutzerkonten speichern
    res.json({ success: true });
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.post('/register', (req, res) => {
    const { email, username, password } = req.body;
    const emailExists = users.some(user => user.email === email);
    const usernameExists = users.some(user => user.username === username);

    if (emailExists) {
        res.json({ error: 'Diese E-Mail ist bereits in Nutzung.' });
    } else if (usernameExists) {
        res.json({ error: 'Dieser Benutzername ist bereits in Nutzung.' });
    } else {
        users.push({ email, username, password });
        saveUsers(); // Benutzerkonten speichern
        logActivity(`${username} hat sich registriert`);
        req.session.user = { email, username }; // Benutzer in der Session speichern
        loginStatus.loggedOut = false; // Setze den Status auf eingeloggt
        loginStatus.ip = req.ip; // Speichere die IP-Adresse
        res.json({ success: true, message: 'Registrierung erfolgreich! Sie werden zur Startseite weitergeleitet.' });
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(user => user.username === username && user.password === password);

    if (user) {
        const isEnded = new Date() > new Date(endTime);
        res.json({ success: true, currentVote, answers, isEnded, results: Object.entries(votes).map(([answer, votes]) => ({ answer, votes })) });
    } else {
        res.json({ error: 'Ungültiger Benutzername oder Passwort.' });
    }
});

app.get('/vote', (req, res) => {
    res.sendFile(path.join(__dirname, 'vote.html'));
});

app.post('/vote', (req, res) => {
    const { username, selectedAnswers } = req.body;
    if (votedUsers.has(username)) {
        const isEnded = new Date() > new Date(endTime);
        return res.json({ error: 'Sie haben bereits abgestimmt.', isEnded, results: Object.entries(votes).map(([answer, votes]) => ({ answer, votes })) });
    }
    selectedAnswers.forEach(answer => {
        if (votes[answer] !== undefined) {
            votes[answer]++;
        } else if (allowCustomAnswers) {
            votes[answer] = 1;
            answers.push(answer); // Füge die neue Antwort zur Liste der Antworten hinzu
        }
    });
    votedUsers.add(username); // Benutzer zur Liste der Abstimmenden hinzufügen
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`Server läuft auf Port ${port}`);
});
