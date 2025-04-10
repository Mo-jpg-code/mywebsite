// Elemente aus dem DOM holen
const generateBtn = document.getElementById('generateBtn');
const recipeOutput = document.getElementById('recipeOutput');
const loadingIndicator = document.getElementById('loading');
const errorDiv = document.getElementById('error');

// --- WICHTIG: API Key ---
// Dieser Schlüssel sollte NICHT im Frontend-Code stehen bleiben,
// wenn die Seite öffentlich zugänglich ist. Jeder kann ihn sehen!
// Für eine echte Anwendung: Nutze ein Backend.
const API_KEY = 'AIzaSyAzI9jH-L8Vv5dw7oXQWRt90Ce8UxzSI4U';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

// Event Listener für den Button-Klick
generateBtn.addEventListener('click', generateRecipe);

// Funktion zum Generieren des Rezepts
async function generateRecipe() {
    // UI zurücksetzen und Ladezustand anzeigen
    recipeOutput.classList.add('hidden');
    recipeOutput.classList.remove('visible'); // Animationsklasse entfernen
    errorDiv.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');
    generateBtn.disabled = true;
    generateBtn.classList.remove('button-pulse'); // Pulsieren stoppen während Laden

    // Der Prompt für die KI
    const prompt = `
    Erstelle ein kreatives und überraschendes Kochrezept mit einem coolen, einzigartigen Namen.
    Das Rezept sollte relativ einfach nachzukochen sein (alltagstauglich), aber einen besonderen Twist haben.
    Gib das Rezept in folgendem Format aus:

    # Rezept Name

    ## Zutaten:
    - Zutat 1 (Menge)
    - Zutat 2 (Menge)
    - ...

    ## Zubereitung:
    1. Schritt 1
    2. Schritt 2
    3. ...

    Gib NUR das Rezept in diesem Format zurück, ohne einleitende oder abschließende Sätze.
    `;

    try {
        // API-Anfrage senden
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        // Antwort prüfen
        if (!response.ok) {
            // Versuche, Fehlerdetails aus der API-Antwort zu lesen
            let errorData = await response.json();
            console.error("API Error Response:", errorData);
            throw new Error(`API-Fehler: ${response.status} ${response.statusText}. Details: ${errorData?.error?.message || 'Keine Details verfügbar.'}`);
        }

        const data = await response.json();

        // Den generierten Text aus der Antwort extrahieren
        // Prüfe, ob die erwartete Struktur vorhanden ist
        if (data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0)
        {
            const recipeText = data.candidates[0].content.parts[0].text;
            displayRecipe(recipeText);
        } else {
            // Fallback, falls die Struktur unerwartet ist
            console.error("Unerwartete API-Antwortstruktur:", data);
            throw new Error("Konnte kein gültiges Rezept aus der KI-Antwort extrahieren.");
        }

    } catch (error) {
        console.error('Fehler beim Abrufen des Rezepts:', error);
        displayError(`Ups! Etwas ist schiefgelaufen: ${error.message}`);
    } finally {
        // Ladezustand beenden und Button wieder aktivieren
        loadingIndicator.classList.add('hidden');
        generateBtn.disabled = false;
         generateBtn.classList.add('button-pulse'); // Pulsieren wieder starten
    }
}

// Funktion zum Anzeigen des Rezepts im HTML
function displayRecipe(recipeText) {
    // Einfache Formatierung (ersetzt Markdown-ähnliche Titel)
    let formattedHtml = recipeText
        .replace(/^# (.*$)/gim, '<h2>$1</h2>')      // # Titel -> <h2>Titel</h2>
        .replace(/^## (.*$)/gim, '<h3>$1</h3>');    // ## Untertitel -> <h3>Untertitel</h3>
       // Listen bleiben dank white-space: pre-wrap; im CSS korrekt

    recipeOutput.innerHTML = formattedHtml;
    recipeOutput.classList.remove('hidden');
    recipeOutput.classList.add('visible'); // Startet die Fade-In Animation
}

// Funktion zum Anzeigen von Fehlern
function displayError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    recipeOutput.classList.add('hidden'); // Rezept ggf. ausblenden
    recipeOutput.classList.remove('visible');
}