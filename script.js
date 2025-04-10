// --- DOM Elemente ---
// API Key Eingabe Bereich
const apiKeyEntrySection = document.getElementById('apiKeyEntrySection');
const apiKeyInput = document.getElementById('apiKey');
const submitApiKeyBtn = document.getElementById('submitApiKeyBtn');
const apiKeyError = document.getElementById('apiKeyError');

// Hauptbereich
const mainContent = document.getElementById('mainContent');
const logoutBtn = document.getElementById('logoutBtn');
const generateBtn = document.getElementById('generateBtn');
const recipeOutput = document.getElementById('recipeOutput');
const loadingIndicator = document.getElementById('loading');
const errorDiv = document.getElementById('error'); // Für Rezept-Fehler

// --- Konstanten ---
const API_KEY_STORAGE_KEY = 'userApiKey'; // Schlüssel für sessionStorage

// --- Initialisierung beim Laden der Seite ---
document.addEventListener('DOMContentLoaded', checkApiKeyState);

// --- Event Listeners ---
submitApiKeyBtn.addEventListener('click', handleSubmitApiKey);
logoutBtn.addEventListener('click', handleLogout); // Logout-Button umbenannt zu "Key ändern"
generateBtn.addEventListener('click', generateRecipe);

// --- API Key Handling & UI Umschaltung ---

function checkApiKeyState() {
    const storedApiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedApiKey && storedApiKey.startsWith('AIzaSy')) { // Zusätzliche Prüfung beim Laden
        showMainContent();
    } else {
        sessionStorage.removeItem(API_KEY_STORAGE_KEY); // Ungültigen Key entfernen
        showApiKeyEntry();
    }
}

function handleSubmitApiKey() {
    const apiKey = apiKeyInput.value.trim();
    hideApiKeyError(); // Vorherigen Fehler ausblenden

    // Validierung
    if (!apiKey) {
        showApiKeyError('Bitte gib deinen API-Schlüssel ein.');
        return;
    }
    // Einfacher Format-Check
    if (!apiKey.startsWith('AIzaSy')) {
         showApiKeyError('Ungültiges API-Key Format. Es sollte mit "AIzaSy" beginnen.');
         return;
    }

    // Erfolgreich -> API Key speichern und UI wechseln
    sessionStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    showMainContent();
    apiKeyInput.value = ''; // Feld leeren nach erfolgreicher Eingabe
}

function handleLogout() {
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    showApiKeyEntry();
    // Zustand zurücksetzen
    recipeOutput.innerHTML = '';
    recipeOutput.classList.add('hidden');
    recipeOutput.classList.remove('visible');
    errorDiv.classList.add('hidden');
}

function showApiKeyEntry() {
    mainContent.classList.add('hidden');
    apiKeyEntrySection.classList.remove('hidden');
    hideApiKeyError(); // Sicherstellen, dass keine alten Fehler angezeigt werden
}

function showMainContent() {
    apiKeyEntrySection.classList.add('hidden');
    mainContent.classList.remove('hidden');
     // Sicherstellen, dass der Button beim Anzeigen bereit ist
     generateBtn.disabled = false;
     if (!generateBtn.classList.contains('button-pulse')) {
         generateBtn.classList.add('button-pulse');
     }
     loadingIndicator.classList.add('hidden');
     hideRecipeError(); // Ggf. alten Rezeptfehler ausblenden
}

function showApiKeyError(message) {
    apiKeyError.textContent = message;
    apiKeyError.classList.remove('hidden');
}

function hideApiKeyError() {
    apiKeyError.classList.add('hidden');
    apiKeyError.textContent = '';
}

function hideRecipeError() {
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';
}


// --- Rezept-Generator Logik ---

async function generateRecipe() {
    const userApiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);

    if (!userApiKey) {
        displayRecipeError("Fehler: API-Schlüssel nicht gefunden. Bitte erneut eingeben.");
        handleLogout(); // Zurück zur Key-Eingabe
        return;
    }

    // UI für Laden vorbereiten
    recipeOutput.classList.add('hidden');
    recipeOutput.classList.remove('visible');
    hideRecipeError(); // Alten Fehler ausblenden
    loadingIndicator.classList.remove('hidden');
    generateBtn.disabled = true;
    generateBtn.classList.remove('button-pulse'); // Pulsieren während Laden stoppen

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${userApiKey}`; // Modell aktualisiert
    // Alternativ: gemini-pro

    const prompt = `
    Erstelle ein kreatives, überraschendes und köstliches Kochrezept mit einem coolen, einprägsamen Namen im "Deluxe"-Stil.
    Das Rezept sollte für Hobbyköche machbar sein, aber einen raffinierten Twist oder eine besondere Zutat enthalten.
    Formatierungsvorgabe (strikt einhalten, nur das Rezept ausgeben):

    # Rezept Name Deluxe

    ## Zutaten:
    *   Zutat 1 (Genaue Menge und ggf. Vorbereitungshinweis)
    *   Zutat 2 (...)
    *   ... (Benutze Sternchen * UND Einrückung für die Listenpunkte)

    ## Zubereitung:
    1.  Schritt 1 (Klar und prägnant beschrieben)
    2.  Schritt 2 (...)
    3.  ... (Benutze nummerierte Listenpunkte)

    Optional: Füge einen kurzen Abschnitt "Tipp:" am Ende hinzu.
    `;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // Angepasst an die v1beta Struktur (kann je nach Modell leicht variieren)
                contents: [{ parts: [{ text: prompt }] }],
                // Sicherheitseinstellungen (optional, aber empfohlen)
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                 ],
                 generationConfig: { // Optional: Parameter für die Generierung
                     temperature: 0.7, // Kreativität (0.0 - 1.0)
                     topK: 40,
                     topP: 0.95,
                     maxOutputTokens: 1024, // Maximale Länge der Antwort
                 }
            })
        });

        if (!response.ok) {
            let errorData = { error: { message: `HTTP-Fehler ${response.status}` } }; // Default
            try {
                errorData = await response.json();
            } catch (e) { console.warn("Konnte Fehler-JSON nicht parsen."); }

            console.error("API Error Response:", errorData);
            const errorMessage = errorData?.error?.message || `Fehler ${response.status}: ${response.statusText}`;

            if (errorMessage.includes('API key') || response.status === 400 || response.status === 403) {
                 throw new Error(`API-Schlüssel Problem: ${errorMessage}. Bitte überprüfe den Key und versuche es erneut.`);
            } else {
                 throw new Error(`API-Fehler: ${errorMessage}`);
            }
        }

        const data = await response.json();

        // Extrahiere den Text - Prüfe verschiedene mögliche Pfade in der Antwortstruktur
        let recipeText = '';
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            recipeText = data.candidates[0].content.parts[0].text;
        } else if (data.candidates && data.candidates[0]?.text) { // Manchmal ist es direkt im Kandidaten
            recipeText = data.candidates[0].text;
        } else {
             // Wenn die Struktur unerwartet ist, versuche den gesamten JSON-String anzuzeigen (zur Fehlersuche)
             console.error("Unerwartete API-Antwortstruktur:", data);
             throw new Error("Konnte kein gültiges Rezept aus der KI-Antwort extrahieren. Antwortstruktur siehe Konsole.");
        }

         if (!recipeText.trim()) {
             // Manchmal blockiert der Safety Filter die Antwort, ohne einen Fehler zu werfen
             if (data.candidates && data.candidates[0]?.finishReason === 'SAFETY') {
                 throw new Error("Die Anfrage wurde aufgrund von Sicherheitseinstellungen blockiert. Versuche einen anderen Prompt.");
             } else {
                 throw new Error("Die KI hat eine leere Antwort zurückgegeben.");
             }
         }

        displayRecipe(recipeText);

    } catch (error) {
        console.error('Fehler beim Abrufen des Rezepts:', error);
        // Wenn der Fehler auf ein API-Key-Problem hindeutet, leite zurück zur Eingabe
        if (error.message.includes("API-Schlüssel Problem")) {
             displayRecipeError(error.message + " Du wirst zur Key-Eingabe weitergeleitet.");
             // Kleine Verzögerung, damit der User die Meldung lesen kann
             setTimeout(handleLogout, 3000);
        } else {
             displayRecipeError(`Hoppla! Ein Fehler ist aufgetreten: ${error.message}`);
        }
    } finally {
        // UI nach Laden/Fehler aufräumen
        loadingIndicator.classList.add('hidden');
        generateBtn.disabled = false;
        generateBtn.classList.add('button-pulse'); // Pulsieren wieder starten
    }
}

// Funktion zum Anzeigen des Rezepts (angepasst für Markdown-Listen und Styling)
function displayRecipe(recipeText) {
    // Ersetze Markdown-Überschriften
    let formattedHtml = recipeText
        .replace(/^# (.*$)/gim, '<h2>$1</h2>')
        .replace(/^## (.*$)/gim, '<h3>$1</h3>');

    // Wandle Markdown-Listen in HTML-Listen um
    // Behandelt Blöcke von '*' und '1.'
    formattedHtml = formattedHtml.replace(/^\s*\* (.*$)/gim, '<li>$1</li>'); // Ungeordnete Liste
    formattedHtml = formattedHtml.replace(/^\s*(\d+)\. (.*$)/gim, '<li>$2</li>'); // Geordnete Liste

    // Gruppiere die <li> Elemente in <ul> bzw. <ol>
    // Sucht nach <h3> gefolgt von <li>s und umschließt sie
    formattedHtml = formattedHtml.replace(/(<h3>Zutaten:<\/h3>\s*(?:<li>.*?<\/li>\s*)+)/gis, (match, p1) => {
        const lis = match.match(/<li>.*?<\/li>/gis).join('');
        return `<h3>Zutaten:</h3><ul>${lis}</ul>`;
    });
     formattedHtml = formattedHtml.replace(/(<h3>Zubereitung:<\/h3>\s*(?:<li>.*?<\/li>\s*)+)/gis, (match, p1) => {
        const lis = match.match(/<li>.*?<\/li>/gis).join('');
        return `<h3>Zubereitung:</h3><ol>${lis}</ol>`;
    });
     // Optional: Behandlung für einen "Tipp:" Abschnitt
     formattedHtml = formattedHtml.replace(/^(Tipp:.*)$/gim, '<p class="recipe-tip"><strong>Tipp:</strong> $1</p>');


    recipeOutput.innerHTML = formattedHtml;
    recipeOutput.classList.remove('hidden');
    // Verwende die CSS-Transition für das Einblenden
    requestAnimationFrame(() => { // Sorgt dafür, dass der Browser die Änderung bemerkt
         recipeOutput.classList.add('visible');
    });

    hideRecipeError(); // Sicherstellen, dass vorherige Fehler weg sind
}

// Funktion zum Anzeigen von Fehlern im Rezeptbereich
function displayRecipeError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    recipeOutput.classList.add('hidden'); // Rezept ausblenden bei Fehler
    recipeOutput.classList.remove('visible');
}
