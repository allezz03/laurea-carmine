# Laurea di Carmine — album fotografico

Web app React/Vite con album condiviso e approvazione manuale. Gli invitati non devono registrarsi: possono inviare foto dal link/QR; le immagini vengono mostrate solo dopo approvazione dell'organizzatore.

## Funzioni
- Upload da smartphone o galleria (JPG, PNG, WebP, HEIC/HEIF; max 12 MB per foto).
- Galleria pubblica con aggiornamento automatico ogni 15 secondi.
- Area organizzatore protetta da password: apri `https://TUO-DOMINIO/?admin=1`.
- Storage privato; la galleria riceve URL firmati di un'ora per le sole foto approvate.
- QR code generato nell'interfaccia.

## Configurazione Supabase
1. Crea un progetto Supabase dedicato (oppure usa un progetto esistente, facendo attenzione a non sovrascrivere altre tabelle).
2. Apri SQL Editor e esegui `supabase_setup.sql`.
3. In Project Settings > API, copia Project URL e `service_role` secret key. La service role key è segreta e va usata soltanto sul server.

## Deploy Vercel
1. Carica questa cartella in un repository GitHub.
2. Importa il repository su Vercel.
3. Aggiungi in **Environment Variables**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD` (usa una password lunga, unica e non condivisa con gli invitati)
   - `VITE_PUBLIC_APP_URL` (dominio finale dell'app, facoltativo)
4. Redeploy dopo aver aggiunto le variabili.

## Uso
- Invitati: aprono il dominio o inquadrano il QR e caricano le foto.
- Organizzatore: apri `/?admin=1`, inserisci la password e approva o rifiuta ogni immagine.
- Solo le foto approvate compaiono nella galleria.

## Test locale
Richiede Node.js 20+.
```bash
npm install
npm run dev
```
Per testare le API serverless, usa `vercel dev` dopo aver configurato le variabili d'ambiente. `npm run dev` da solo avvia solo il frontend.

## Privacy e limiti
- Il link non richiede login; chiunque abbia il link può inviare foto. Per evitare spam, condividi il QR solo con gli invitati.
- La password protegge le API di moderazione, ma per un uso pubblico è opportuno usare una password robusta e monitorare i caricamenti.
- Le foto caricate restano private nello Storage; URL firmati scadono dopo un'ora.
- L'API accetta un'immagine per richiesta, max 12 MB. Verifica la compatibilità HEIC sui browser usati dagli invitati.
- Nessun dato è inviato a un servizio esterno salvo il progetto Supabase configurato.


## Icona iPhone e pagina organizzatore
- La pagina di moderazione è accessibile da `/organizzatore` (il vecchio `?admin=1` continua a funzionare).
- Nel footer pubblico c'è il collegamento **Area organizzatore**.
- `public/manifest.webmanifest` e `public/icons/apple-touch-icon.png` forniscono nome e icona per la Home di iOS.
- Su iPhone aprire il sito in Safari, toccare Condividi e scegliere **Aggiungi alla schermata Home**. iOS non consente alla pagina web di aprirsi automaticamente nel foglio di condivisione; per questo l'installazione resta un'azione dell'utente.


## Album separati Cena e Festa
Per un database già esistente, eseguire una sola volta `supabase_migration_cena_festa.sql` nel SQL Editor di Supabase. Le foto già presenti vengono assegnate all'album **Festa**; le nuove foto salvano l'evento selezionato. L'area organizzatore consente di eliminare definitivamente foto pubblicate.


## Download foto su smartphone
Il pulsante “Scarica foto” usa `/api/download?id=...`: il server controlla che la foto sia approvata e la invia come allegato (`Content-Disposition: attachment`), così i browser mobili gestiscono il salvataggio in modo più affidabile rispetto al link diretto a Supabase.


## Salvataggio delle foto su smartphone
Il pulsante nella visualizzazione della foto usa la condivisione nativa del browser quando supporta la condivisione di file. Su iPhone, nel menu Condividi l'utente può scegliere **Salva immagine** per aggiungerla a Foto. Nei browser non compatibili viene avviato il download classico. Per motivi di privacy, il sito non può salvare automaticamente nel rullino senza un'azione dell'utente.


## Download multiplo delle foto
Nella galleria, scegli **Seleziona foto da scaricare**, seleziona una o più immagini e premi **Scarica selezionate**. Il sito prepara un archivio ZIP scaricabile. Su iPhone, apri lo ZIP nell'app File e, se necessario, estrailo prima di salvare le immagini in Foto. Nel dettaglio della singola foto, le istruzioni per iPhone sono visualizzate sopra il pulsante **Salva in Foto**.
