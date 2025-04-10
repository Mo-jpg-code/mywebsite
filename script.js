// --- DOM Elemente ---
// Login Bereich
const loginSection = document.getElementById('loginSection');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const apiKeyInput = document.getElementById('apiKey');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

// Hauptbereich
const mainContent = document.getElementById('mainContent');
const logoutBtn = document.getElementById('logoutBtn');
const generateBtn = document.getElementById('generateBtn');
const recipeOutput = document.getElementById('recipeOutput');
const loadingIndicator = document.getElementById('loading');
const errorDiv = document.getElementById('error'); // Für Rezept-Fehler

// --- Konfiguration (Simuliertes Login) ---
// !! Dies ist NICHT sicher für echte Anwendungen !!
const FAKE_USERNAME = 'user';
const FAKE_PASSWORD = 'pass123';

// --- Initialisierung beim Laden der Seite ---
document.addEventListener('DOMContentLoaded', checkLoginState);

// --- Event Listeners ---
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
generateBtn.addEventListener('click', generateRecipe);

// --- Login & Logout Logik ---

function checkLoginState() {
    const storedApiKey = sessionStorage.getItem('userApiKey');
    if (storedApiKey) {
        showMainContent();
    } else {
        showLoginSection();
    }
}

function handleLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    // Validierung
    if (!username || !password || !apiKey) {
        showLoginError('Bitte alle Felder ausfüllen.');
        return;
    }

    if (username === FAKE_USERNAME && password === FAKE_PASSWORD) {
        // API Key Format Check (sehr einfach)
        if (!apiKey.startsWith('AIzaSy')) {
             showLoginError('Ungültiges API-Key Format. Es sollte mit "AIzaSy" beginnen.');
             return;
        }

        // Erfolgreich "eingeloggt" -> API Key speichern und UI wechseln
        sessionStorage.setItem('userApiKey', apiKey); // Speichert den Key für die Session
        showMainContent();
        clearLoginFields();
        hideLoginError(); // Fehler ausblenden bei Erfolg
    } else {
        showLoginError('Ungültiger Benutzername oder Passwort.');
    }
}

function handleLogout() {
    sessionStorage.removeItem('userApiKey'); // Key aus Session Storage entfernen
    showLoginSection();
    // Rezeptanzeige zurücksetzen beim Ausloggen
    recipeOutput.innerHTML = '';
    recipeOutput.classList.add('hidden');
    recipeOutput.classList.remove('visible');
    errorDiv.classList.add('hidden'); // Auch Rezept-Fehler löschen
}

function showLoginSection() {
    mainContent.classList.add('hidden');
    loginSection.classList.remove('hidden');
}

function showMainContent() {
    loginSection.classList.add('hidden');
    mainContent.classList.remove('hidden');
     // Stelle sicher, dass der Button beim Anzeigen des Hauptinhalts bereit ist
     generateBtn.disabled = false;
     if (!generateBtn.classList.contains('button-pulse')) {
         generateBtn.classList.add('button-pulse');
     }
     loadingIndicator.classList.add('hidden'); // Ladeanzeige verstecken
}

function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
}

function hideLoginError() {
    loginError.classList.add('hidden');
    loginError.textContent = '';
}

function clearLoginFields() {
    usernameInput.value = '';
    passwordInput.value = '';
    apiKeyInput.value = ''; // Auch API Key Feld leeren
}

// --- Rezept-Generator Logik ---

async function generateRecipe() {
    // API Key aus dem Session Storage holen
    const userApiKey = sessionStorage.getItem('userApiKey');

    if (!userApiKey) {
        // Sollte nicht passieren, wenn die Logik stimmt, aber als Sicherheitsnetz
        displayRecipeError("Fehler: Kein API-Schlüssel gefunden. Bitte neu anmelden.");
        handleLogout(); // Zum Login zurückschicken
        return;
    }

    // UI zurücksetzen und Ladezustand anzeigen
    recipeOutput.classList.add('hidden');
    recipeOutput.classList.remove('visible');
    errorDiv.classList.add('hidden'); // Rezeptfehler ausblenden
    loadingIndicator.classList.remove('hidden');
    generateBtn.disabled = true;
    generateBtn.classList.remove('button-pulse');

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${userApiKey}`;

    // Der Prompt für die KI (wie vorher)
    const prompt = `
    Erstelle ein kreatives und überraschendes Kochrezept mit einem coolen, einzigartigen Namen.
    Das Rezept sollte relativ einfach nachzukochen sein (alltagstauglich), aber einen besonderen Twist haben.
    Gib das Rezept in folgendem Format aus, und zwar NUR das Rezept, keine zusätzlichen Sätze davor oder danach:

    # Rezept Name

    ## Zutaten:
    *   Zutat 1 (Menge)
    *   Zutat 2 (Menge)
    *   ... (Benutze Sternchen * für die Listenpunkte)

    ## Zubereitung:
    1.  Schritt 1
    2.  Schritt 2
    3.  ... (Benutze nummerierte Listenpunkte)
    `;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                // Falls die Antwort kein JSON ist
                 errorData = { error: { message: await response.text() } };
            }
            console.error("API Error Response:", errorData);
             // Spezifische Fehlerbehandlung für API-Key-Probleme
            if (response.status === 400 && errorData?.error?.message?.toLowerCase().includes('api key not valid')) {
                 throw new Error(`API-Schlüssel ungültig oder falsch. Bitte überprüfe den Key und melde dich neu an.`);
            } else if (response.status === 403) {
                 throw new Error(`API-Schlüssel hat keine Berechtigung für dieses Modell oder der Dienst ist nicht aktiviert (Fehler ${response.status}).`);
            }
            else {
                 throw new Error(`API-Fehler: ${response.status} ${response.statusText}. ${errorData?.error?.message || 'Keine Details.'}`);
            }
        }

        const data = await response.json();

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const recipeText = data.candidates[0].content.parts[0].text;
            displayRecipe(recipeText);
        } else {
            console.error("Unerwartete API-Antwortstruktur:", data);
            throw new Error("Konnte kein gültiges Rezept aus der KI-Antwort extrahieren.");
        }

    } catch (error) {
        console.error('Fehler beim Abrufen des Rezepts:', error);
        // Wenn der API Key ungültig war, logge den User aus
        if (error.message.includes("API-Schlüssel ungültig")) {
             displayRecipeError(error.message); // Zeige den Fehler an
             handleLogout(); // Logge den User aus
        } else {
             displayRecipeError(`Ups! Etwas ist schiefgelaufen: ${error.message}`);
        }
    } finally {
        loadingIndicator.classList.add('hidden');
        generateBtn.disabled = false;
        generateBtn.classList.add('button-pulse');
    }
}

// Funktion zum Anzeigen des Rezepts (angepasst für Markdown-Listen)
function displayRecipe(recipeText) {
    let formattedHtml = recipeText
        .replace(/^# (.*$)/gim, '<h2>$1</h2>')      // # Titel -> <h2>
        .replace(/^## (.*$)/gim, '<h3>$1</h3>')    // ## Untertitel -> <h3>
        .replace(/^\* (.*$)/gim, '<li>$1</li>')    // * Punkt -> <li> (für Zutaten)
        .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>'); // 1. Punkt -> <li> (für Schritte)

    // Füge <ul> oder <ol> Tags hinzu, wo nötig
    formattedHtml = formattedHtml.replace(/<h3>Zutaten:<\/h3>\s*?(<li>.*<\/li>)/s, '<h3>Zutaten:</h3><ul>$1</ul>');
    formattedHtml = formattedHtml.replace(/<h3>Zubereitung:<\/h3>\s*?(<li>.*<\/li>)/s, '<h3>Zubereitung:</h3><ol>$1</ol>');

    // Entferne eventuell doppelte Listenpunkte falls die API sie hinzufügt
    formattedHtml = formattedHtml.replace(/<ul>\s*<ul>/g, '<ul>').replace(/<\/ul>\s*<\/ul>/g, '</ul>');
    formattedHtml = formattedHtml.replace(/<ol>\s*<ol>/g, '<ol>').replace(/<\/ol>\s*<\/ol>/g, '</ol>');


    recipeOutput.innerHTML = formattedHtml;
    recipeOutput.classList.remove('hidden');
    recipeOutput.classList.add('visible');
    errorDiv.classList.add('hidden'); // Sicherstellen, dass vorherige Fehler weg sind
}

// Funktion zum Anzeigen von Fehlern im Rezeptbereich
function displayRecipeError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    recipeOutput.classList.add('hidden'); // Rezept ausblenden bei Fehler
    recipeOutput.classList.remove('visible');
}
