const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs'); // Datei-System-Modul importieren
const crypto = require('crypto'); // crypto-Modul importieren
const nodemailer = require('nodemailer'); // nodemailer-Modul importieren
const multer = require('multer'); // multer-Modul importieren
const cors = require('cors'); // cors-Modul importieren
const session = require('express-session'); // Session-Modul importieren
const MongoStore = require('connect-mongo'); // MongoStore-Modul importieren
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

// Login-Status aus Datei laden
function loadLoginStatus() {
    if (fs.existsSync('login-status.json')) {
        const data = fs.readFileSync('login-status.json', 'utf8');
        if (data) {
            loginStatus = JSON.parse(data);
            if (loginStatus.ip) {
                loginStatus.ip = decryptIP(loginStatus.ip);
            }
        }
    }
}

// Login-Status in Datei speichern
function saveLoginStatus() {
    if (loginStatus.ip) {
        loginStatus.ip = encryptIP(loginStatus.ip);
    }
    fs.writeFileSync('login-status.json', JSON.stringify(loginStatus, null, 2));
    if (loginStatus.ip) {
        loginStatus.ip = decryptIP(loginStatus.ip);
    }
}

loadUsers();
loadTeamMembers();
loadPosts(); // Beiträge laden
loadLoginStatus(); // Login-Status laden

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Statische Dateien aus dem Upload-Ordner bedienen
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/sessions', // URL zu Ihrer MongoDB-Datenbank
        collectionName: 'sessions'
    }),
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

app.get('/Gaming-Projects/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gaming-Projects/index.html'));
});

app.get('/Gaming-Projects/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gaming-Projects/admin.html'));
});

app.post('/Gaming-Projects/admin.html', (req, res) => {
    const { password } = req.body;
    if (password === '2q') {
        res.sendFile(path.join(__dirname, 'Gaming-Projects/admin-dashboard.html'));
    } else {
        res.redirect('/');
    }
});

app.get('/Gaming-Projects/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gaming-Projects/admin-dashboard.html'));
});

app.get('/Gaming-Projects/admin/vote.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gaming-Projects/admin-vote.html'));
});

app.get('/Gaming-Projects/admin/edit-privacy-policy.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gaming-Projects/admin-edit-privacy-policy.html'));
});

app.post('/Gaming-Projects/admin/vote.html', (req, res) => {
    const { currentVote: newCurrentVote, answers: newAnswers, endTime: newEndTime } = req.body;
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

app.post('/Gaming-Projects/admin/delete-user.html', (req, res) => {
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

app.get('/Gaming-Projects/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gaming-Projects/register.html'));
});

app.post('/Gaming-Projects/register.html', (req, res) => {
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
        res.json({ success: true, message: 'Registrierung erfolgreich! Sie werden zur Startseite weitergeleitet.' });
    }
});

app.get('/Gaming-Projects/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Gaming-Projects/login.html'));
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

app.post('/Gaming-Projects/login.html', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(user => user.username === username && user.password === password);

    if (user) {
        req.session.user = user; // Speichere den Benutzer in der Session
        logLogin(username); // Logge den Login
        logActivity(`${username} hat sich eingeloggt`);
        loginStatus.loggedOut = false; // Setze den Status auf eingeloggt
        loginStatus.ip = req.ip; // Speichere die IP-Adresse
        saveLoginStatus(); // Login-Status speichern
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
app.get('/Gaming-Projects/vote', isAuthenticated, (req, res) => {
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
    const { currentVote: newCurrentVote, answers: newAnswers, endTime: newEndTime } = req.body;
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
        }
    });
    votedUsers.add(username); // Benutzer zur Liste der Abstimmenden hinzufügen
    res.json({ success: true });
});

app.get('/messages', (req, res) => {
    res.json(messages);
});

app.post('/send-message', (req, res) => {
    const { username, content } = req.body;
    messages.push({ username, content });
    logActivity(`${username} hat eine Nachricht gesendet: ${content}`);
    res.json({ success: true });
});

app.get('/users', (req, res) => {
    res.json(users);
});

app.get('/current-vote', (req, res) => {
    const remainingTime = new Date(endTime) - new Date();
    res.json({ currentVote, results: Object.entries(votes).map(([answer, votes]) => ({ answer, votes })), remainingTime });
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'reset-password-request.html'));
});

app.post('/reset-password', (req, res) => {
    const { email } = req.body;
    const user = users.find(user => user.email === email);

    if (user) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetLink = `http://localhost:${port}/reset-password/${resetToken}`;

        // Speichere den Reset-Token im Benutzerobjekt
        user.resetToken = resetToken;
        saveUsers();

        const mailOptions = {
            from: 'your-email@gmail.com',
            to: email,
            subject: 'Passwort zurücksetzen',
            text: `Klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen: ${resetLink}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Fehler beim Senden der E-Mail:', error);
                res.json({ error: 'Fehler beim Senden der E-Mail.', details: error.message });
            } else {
                console.log('E-Mail gesendet: ' + info.response);
                res.json({ success: 'E-Mail zum Zurücksetzen des Passworts wurde gesendet.' });
            }
        });
    } else {
        res.json({ error: 'E-Mail nicht gefunden.' });
    }
});

app.get('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    const user = users.find(user => user.resetToken === token);

    if (user) {
        res.sendFile(path.join(__dirname, 'reset-password.html'));
    } else {
        res.status(400).send('Ungültiger oder abgelaufener Token.');
    }
});

app.post('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    const { username, password } = req.body;
    const user = users.find(user => user.resetToken === token);

    if (user) {
        user.username = username;
        user.password = password;
        delete user.resetToken; // Entferne den Reset-Token nach erfolgreichem Zurücksetzen
        saveUsers();
        res.json({ success: 'Benutzername und Passwort erfolgreich zurückgesetzt.' });
    } else {
        res.status(400).json({ error: 'Ungültiger oder abgelaufener Token.' });
    }
});

app.get('/delete-account', (req, res) => {
    res.sendFile(path.join(__dirname, 'delete-account.html'));
});

app.post('/delete-account', (req, res) => {
    const { email, username, password } = req.body;
    const userIndex = users.findIndex(user => user.email === email && user.username === username && user.password === password);

    if (userIndex !== -1) {
        users.splice(userIndex, 1);
        saveUsers();
        res.json({ success: 'Account erfolgreich gelöscht.' });
    } else {
        res.json({ error: 'Ungültige E-Mail, Benutzername oder Passwort.' });
    }
});

app.get('/team', (req, res) => {
    res.sendFile(path.join(__dirname, 'team.html'));
});

app.get('/team-members', (req, res) => {
    res.json(teamMembers);
});

app.post('/upload-profile-pic', upload.single('profilePic'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Fehler beim Hochladen der Datei.' });
    }
    res.json({ success: true });
});

app.post('/add-member', (req, res) => {
    const { newMemberName, newMemberCategory } = req.body;
    if (!teamMembers[newMemberCategory]) {
        return res.status(400).json({ error: 'Kategorie nicht gefunden.' });
    }
    teamMembers[newMemberCategory].push(newMemberName);
    saveTeamMembers();
    res.json({ success: true });
});

app.post('/add-category', (req, res) => {
    const { newCategoryName } = req.body;
    if (teamMembers[newCategoryName]) {
        return res.status(400).json({ error: 'Kategorie existiert bereits.' });
    }
    teamMembers[newCategoryName] = [];
    saveTeamMembers();
    res.json({ success: true });
});

app.post('/delete-member', (req, res) => {
    const { deleteMemberName } = req.body;
    let memberFound = false;
    Object.keys(teamMembers).forEach(category => {
        const memberIndex = teamMembers[category].indexOf(deleteMemberName);
        if (memberIndex !== -1) {
            teamMembers[category].splice(memberIndex, 1);
            memberFound = true;
        }
    });
    if (memberFound) {
        saveTeamMembers();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Teammitglied nicht gefunden.' });
    }
});

app.post('/reorder-categories', (req, res) => {
    const { categoryOrder } = req.body;
    const newTeamMembers = {};
    categoryOrder.forEach(category => {
        if (teamMembers[category]) {
            newTeamMembers[category] = teamMembers[category];
        }
    });
    teamMembers = newTeamMembers;
    saveTeamMembers();
    res.json({ success: true });
});

app.post('/reorder-members', (req, res) => {
    const { memberOrder } = req.body;
    const newTeamMembers = {};
    Object.keys(teamMembers).forEach(category => {
        newTeamMembers[category] = [];
    });
    memberOrder.forEach(member => {
        Object.keys(teamMembers).forEach(category => {
            if (teamMembers[category].includes(member)) {
                newTeamMembers[category].push(member);
            }
        });
    });
    teamMembers = newTeamMembers;
    saveTeamMembers();
    res.json({ success: true });
});

app.post('/delete-category', (req, res) => {
    const { category } = req.body;
    if (teamMembers[category]) {
        delete teamMembers[category];
        saveTeamMembers();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Kategorie nicht gefunden.' });
    }
});

app.get('/privacy-policy', (req, res) => {
    res.sendFile(path.join(__dirname, 'privacy-policy.html'));
});

// Route zum Abrufen des Datenschutzinhalts
app.get('/privacy-policy-content', (req, res) => {
    fs.readFile(path.join(__dirname, 'privacy-policy.html'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Fehler beim Laden des Datenschutzinhalts.');
        }
        // Extrahiere nur den angezeigten Text
        const contentMatch = data.match(/<div class="content">([\s\S]*?)<\/div>/);
        if (contentMatch) {
            res.send(contentMatch[1]);
        } else {
            res.status(500).send('Fehler beim Extrahieren des Datenschutzinhalts.');
        }
    });
});

// Route zum Aktualisieren des Datenschutzinhalts
app.post('/admin/edit-privacy-policy', (req, res) => {
    const { privacyPolicyContent } = req.body;
    fs.readFile(path.join(__dirname, 'privacy-policy.html'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Fehler beim Laden des Datenschutzinhalts.' });
        }
        // Ersetze den angezeigten Text
        const updatedData = data.replace(/<div class="content">([\s\S]*?)<\/div>/, `<div class="content">${privacyPolicyContent}</div>`);
        fs.writeFile(path.join(__dirname, 'privacy-policy.html'), updatedData, 'utf8', (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Fehler beim Speichern des Datenschutzinhalts.' });
            }
            res.json({ success: true });
        });
    });
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/qanda', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'qanda.html'));
});

// Route für die Log-Seite
app.get('/logs', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'logs.html'));
});

// Route zum Abrufen der Log-Daten
app.get('/logs-data', isAuthenticated, (req, res) => {
    fs.readFile(activityLogFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Fehler beim Laden der Log-Daten.');
        }
        res.send(data);
    });
});

// Route zum Abrufen aller Beiträge
app.get('/posts', (req, res) => {
    res.json(posts);
});

// Route zum Erstellen eines neuen Beitrags
app.post('/posts', (req, res) => {
    const { title, description, username } = req.body;
    const newPost = {
        id: crypto.randomBytes(16).toString('hex'),
        title,
        description,
        username,
        answers: []
    };
    posts.push(newPost);
    savePosts(); // Beiträge speichern
    res.json({ success: true, post: newPost });
});

// Route zum Hinzufügen einer Antwort zu einem Beitrag
app.post('/posts/:id/answers', (req, res) => {
    const { id } = req.params;
    const { username, content } = req.body;
    const post = posts.find(post => post.id === id);
    if (post) {
        post.answers.push({ username, content });
        savePosts(); // Beiträge speichern
        res.json({ success: true, post });
    } else {
        res.status(404).json({ error: 'Beitrag nicht gefunden.' });
    }
});

app.post('/posts/:id/delete', (req, res) => {
    const { id } = req.params;
    const postIndex = posts.findIndex(post => post.id === id);
    if (postIndex !== -1) {
        const post = posts[postIndex];
        if (post.username === req.session.user.username) {
            posts.splice(postIndex, 1);
            savePosts(); // Beiträge speichern
            res.json({ success: true });
        } else {
            res.status(403).json({ error: 'Sie sind nicht berechtigt, diesen Beitrag zu löschen.' });
        }
    } else {
        res.status(404).json({ error: 'Beitrag nicht gefunden.' });
    }
});

// Fehler-Middleware hinzufügen
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(path.join(__dirname, 'error.html'));
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Fehler beim Ausloggen.');
        }
        loginStatus.loggedOut = true; // Setze den Status auf ausgeloggt
        loginStatus.ip = null; // Lösche die gespeicherte IP-Adresse
        saveLoginStatus(); // Login-Status speichern
        res.sendFile(path.join(__dirname, 'logout.html'));
    });
});

app.get('/logout-status', (req, res) => {
    res.json(loginStatus);
});

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`Server läuft auf http://localhost:${port}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${port} ist bereits in Verwendung. Versuche, einen anderen Port zu verwenden.`);
            startServer(0); // Versuche, einen zufälligen verfügbaren Port zu verwenden
        } else {
            throw err;
        }
    });
}

startServer(port);
