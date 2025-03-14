const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs'); // Datei-System-Modul importieren
const crypto = require('crypto'); // crypto-Modul importieren
const nodemailer = require('nodemailer'); // nodemailer-Modul importieren
const multer = require('multer'); // multer-Modul importieren
const app = express();
const port = process.env.PORT || 3002; // Port auf 3002 geändert

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

loadUsers();
loadTeamMembers();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Statische Dateien aus dem Upload-Ordner bedienen
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    res.sendFile(path.join(__dirname, 'website.html'));
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
        res.json({ success: true });
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
                res.json({ error: 'Fehler beim Senden der E-Mail.' });
            } else {
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

// Fehler-Middleware hinzufügen
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(path.join(__dirname, 'error.html'));
});

app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
