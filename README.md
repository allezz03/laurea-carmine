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
Nella galleria, scegli **Seleziona foto da scaricare**, seleziona una o più immagini e premi **Salva foto selezionate**. Il sito scarica ogni immagine come file separato, senza creare un archivio ZIP. Alcuni browser possono chiedere di autorizzare i download multipli; su iPhone il comportamento dipende dal browser utilizzato. Nel dettaglio della singola foto, le istruzioni per iPhone sono visualizzate sopra il pulsante **Salva in Foto**.


**Salvataggio multiplo su iPhone:** seleziona le foto e premi “Salva foto selezionate”. Se Safari supporta la condivisione di più file, si apre il menu nativo iOS; scegli “Salva immagini” per salvarle in Foto senza ZIP. Il sito non può salvare automaticamente nel rullino senza conferma dell’utente.


### Selezione foto dal telefono
Il pulsante di caricamento apre il selettore immagini del dispositivo e permette di scegliere una o più foto dalla galleria. Nell’anteprima di una foto è presente una X ben visibile in alto a destra per chiuderla.


### Caricamento foto
La homepage offre due scelte: **Scatta una foto** (richiede il supporto del browser per `capture="environment"`) e **Scegli dalla galleria** (consente la selezione multipla). Su alcuni dispositivi il browser può comunque mostrare un selettore di sistema invece di aprire direttamente la fotocamera.

## Attivare o disattivare la revisione delle foto

La revisione è attiva per impostazione predefinita. Per abilitare il selettore nell'area organizzatore, esegui una sola volta `supabase_migration_review_setting.sql` nel SQL Editor di Supabase. Dall'area `/organizzatore` puoi quindi attivare o disattivare la revisione. Quando la disattivi, tutte le foto in attesa vengono approvate automaticamente e le nuove foto vengono pubblicate subito; quando la riattivi, i nuovi caricamenti tornano in attesa di approvazione.


## Didascalie stile Polaroid
Le persone possono aggiungere una didascalia facoltativa (max 180 caratteri) a ogni foto prima del caricamento. Per abilitare il campo nel database, eseguire `supabase_migration_photo_captions.sql` nel SQL Editor di Supabase. Le didascalie vengono mostrate sotto ogni foto nell’album e nell’anteprima.

## Eliminazione multipla nell'area organizzatore
Nella sezione **Foto già pubblicate** puoi selezionare singole foto oppure usare **Seleziona tutto**, quindi premere **Elimina selezionate**. L'app chiede conferma prima di eliminare definitivamente le immagini. L'endpoint dedicato verifica la password organizzatore e rimuove i record approvati selezionati e i relativi file dallo storage privato.

## Video degli invitati (nuova funzionalità)

Prima del deploy, eseguire `supabase_migration_videos.sql` nel SQL Editor del progetto Supabase. La migrazione aggiunge `media_type` alla tabella `photos`, porta il limite del bucket privato `laurea-photos` a 50 MiB e consente MP4, MOV e WebM.

I video vengono caricati direttamente su Supabase Storage usando un URL di caricamento firmato generato lato server: il file non passa attraverso una Vercel Function, evitando il limite di 4,5 MB del body delle Functions. La web app accetta video fino a 180 secondi e 50 MiB, mostra una didascalia facoltativa e rispetta l'impostazione di revisione. I video approvati sono riproducibili nella galleria; l'area organizzatore permette approvazione, rifiuto ed eliminazione anche dei video. Il download multiplo resta dedicato alle foto; i video si scaricano singolarmente.

Nota: il limite di 50 MiB è compatibile con il massimo del piano Supabase Free, ma il bucket deve avere un limite globale almeno pari a 50 MiB. Per video sopra i 6 MB Supabase raccomanda upload resumable TUS per una maggiore affidabilità su connessioni instabili; questa prima versione usa un upload diretto firmato standard, quindi un'interruzione può richiedere di ripetere il caricamento.
