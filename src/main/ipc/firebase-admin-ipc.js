'use strict';

const { app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');

const REQUIRED_FIELDS = [
  'type',
  'project_id',
  'private_key_id',
  'private_key',
  'client_email',
  'client_id',
  'auth_uri',
  'token_uri',
  'auth_provider_x509_cert_url',
  'client_x509_cert_url',
  'universe_domain'
];
const TEAMS_SESSION_SUBCOLLECTIONS = ['trackers', 'updates'];
const FIREBASE_RULES_BASE_URL = 'https://firebaserules.googleapis.com/v1';
const FIREBASE_MGMT_BASE_URL = 'https://firebase.googleapis.com/v1beta1';
const FIREBASE_AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';

const getCredentialsPath = () => path.join(app.getPath('userData'), 'credentials', 'firebase-admin.json');

const loadFirebaseAdminSdk = () => {
  try {
    const module = require('firebase-admin');
    return module?.default || module;
  } catch (err) {
    return null;
  }
};

const validateServiceAccountJson = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Firebase Admin credentials must be a JSON object.' };
  }
  if (value.type !== 'service_account') {
    return { ok: false, error: 'Firebase Admin credentials must have type "service_account".' };
  }
  const missing = [];
  REQUIRED_FIELDS.forEach((field) => {
    const raw = value[field];
    if (typeof raw !== 'string' || !raw.trim()) missing.push(field);
  });
  if (missing.length) {
    return { ok: false, error: `Firebase Admin credentials missing fields: ${missing.join(', ')}` };
  }
  return { ok: true };
};

const parseJsonFile = async (filePath) => {
  const raw = await fsp.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed;
};

const parseJsonText = (raw) => {
  const parsed = JSON.parse(raw);
  return parsed;
};

const verifyFirebaseAdminAccess = async (serviceAccount) => {
  const admin = loadFirebaseAdminSdk();
  if (!admin) {
    return { ok: false, error: 'Firebase Admin SDK is not installed.' };
  }
  const credential = admin.credential.cert(serviceAccount);
  const appName = `command-verify-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let appInstance = null;
  try {
    appInstance = admin.initializeApp({
      credential,
      projectId: serviceAccount.project_id
    }, appName);
    await credential.getAccessToken();
    return { ok: true };
  } catch (err) {
    const details = err?.response?.data?.error || err?.response?.data || null;
    const message = err?.message || (typeof details === 'string' ? details : null) || 'Unable to verify Firebase Admin credentials.';
    return { ok: false, error: message, details };
  } finally {
    if (appInstance) {
      try { await appInstance.delete(); } catch {}
    }
  }
};

const saveCredentials = async (serviceAccount) => {
  const targetPath = getCredentialsPath();
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, `${JSON.stringify(serviceAccount, null, 2)}\n`, 'utf8');
  return targetPath;
};

const processCredentials = async (serviceAccount) => {
  const validation = validateServiceAccountJson(serviceAccount);
  if (!validation.ok) return { ok: false, error: validation.error };
  const verification = await verifyFirebaseAdminAccess(serviceAccount);
  if (!verification.ok) return { ok: false, error: verification.error };
  await saveCredentials(serviceAccount);
  return {
    ok: true,
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email
  };
};

const clearSessionsWithAdmin = async (serviceAccount) => {
  const admin = loadFirebaseAdminSdk();
  if (!admin) return { ok: false, error: 'Firebase Admin SDK is not installed.' };
  const credential = admin.credential.cert(serviceAccount);
  const appName = `command-clear-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let appInstance = null;
  try {
    appInstance = admin.initializeApp({
      credential,
      projectId: serviceAccount.project_id
    }, appName);
    const db = typeof appInstance?.firestore === 'function'
      ? appInstance.firestore()
      : (typeof admin.firestore === 'function' ? admin.firestore(appInstance) : null);
    if (!db || typeof db.collection !== 'function') {
      return { ok: false, error: 'Firestore is unavailable in Firebase Admin SDK.' };
    }
    const sessionsSnap = await db.collection('sessions').get();
    const sessionDocs = sessionsSnap?.docs || [];
    for (const docSnap of sessionDocs) {
      const sessionId = docSnap.id;
      for (const subcollection of TEAMS_SESSION_SUBCOLLECTIONS) {
        const subSnap = await db.collection('sessions').doc(sessionId).collection(subcollection).get();
        const deletions = subSnap.docs.map((subDoc) => subDoc.ref.delete());
        await Promise.all(deletions);
      }
      await docSnap.ref.delete();
    }
    return { ok: true, count: sessionDocs.length };
  } catch (err) {
    return { ok: false, error: err?.message || 'Unable to clear sessions.' };
  } finally {
    if (appInstance) {
      try { await appInstance.delete(); } catch {}
    }
  }
};

const createAnonymousTokenWithAdmin = async (serviceAccount, { sessionDays = 5 } = {}) => {
  const admin = loadFirebaseAdminSdk();
  if (!admin) return { ok: false, error: 'Firebase Admin SDK is not installed.' };
  const credential = admin.credential.cert(serviceAccount);
  const appName = `command-auth-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let appInstance = null;
  try {
    appInstance = admin.initializeApp({
      credential,
      projectId: serviceAccount.project_id
    }, appName);
    const auth = appInstance.auth();
    const uid = `anon_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    await auth.createUser({ uid });
    const token = await auth.createCustomToken(uid, { anon: true, sessionDays });
    return { ok: true, token, uid, sessionDays };
  } catch (err) {
    return { ok: false, error: err?.message || 'Unable to create Firebase Auth token.' };
  } finally {
    if (appInstance) {
      try { await appInstance.delete(); } catch {}
    }
  }
};

const signInWithCustomToken = async ({ apiKey, customToken }) => {
  if (!apiKey) return { ok: false, error: 'Firebase API key is required to authenticate the custom token.' };
  if (!customToken) return { ok: false, error: 'Custom token is missing.' };
  const url = `${FIREBASE_AUTH_BASE_URL}/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message || data?.error || 'Unable to authenticate custom token.';
      return { ok: false, error: message, details: data?.error || data };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || 'Unable to authenticate custom token.' };
  }
};

const clearAnonymousUsersWithAdmin = async (serviceAccount) => {
  const admin = loadFirebaseAdminSdk();
  if (!admin) return { ok: false, error: 'Firebase Admin SDK is not installed.' };
  const credential = admin.credential.cert(serviceAccount);
  const appName = `command-clear-anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let appInstance = null;
  try {
    appInstance = admin.initializeApp({
      credential,
      projectId: serviceAccount.project_id
    }, appName);
    const auth = appInstance.auth();
    let pageToken = undefined;
    let deleted = 0;
    let failures = 0;
    do {
      const result = await auth.listUsers(1000, pageToken);
      const anonUids = (result.users || [])
        .filter((user) => (user?.providerData?.length ?? 0) === 0)
        .map((user) => user.uid);
      if (anonUids.length) {
        const deleteResult = await auth.deleteUsers(anonUids);
        deleted += deleteResult?.successCount || 0;
        failures += deleteResult?.failureCount || 0;
      }
      pageToken = result.pageToken;
    } while (pageToken);
    return { ok: true, deleted, failures };
  } catch (err) {
    return { ok: false, error: err?.message || 'Unable to clear anonymous users.' };
  } finally {
    if (appInstance) {
      try { await appInstance.delete(); } catch {}
    }
  }
};

const requestRulesApi = async (path, { method = 'GET', token, body } = {}) => {
  const url = `${FIREBASE_RULES_BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.error || data?.raw || `Request failed with status ${response.status}`;
    const details = data?.error?.details || data?.error || data?.raw || null;
    return { ok: false, status: response.status, error: message, details, data };
  }
  return { ok: true, data };
};

const requestFirebaseManagementApi = async (path, { method = 'GET', token, body } = {}) => {
  const url = `${FIREBASE_MGMT_BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.error || data?.raw || `Request failed with status ${response.status}`;
    const details = data?.error?.details || data?.error || data?.raw || null;
    return { ok: false, status: response.status, error: message, details, data };
  }
  return { ok: true, data };
};

const fetchFirebaseWebConfig = async (serviceAccount) => {
  const tokenResult = await getAccessToken(serviceAccount);
  if (!tokenResult.ok) return tokenResult;
  const token = tokenResult.token;
  const projectId = serviceAccount.project_id;
  const appsResult = await requestFirebaseManagementApi(`/projects/${projectId}/webApps`, { token });
  if (!appsResult.ok) return appsResult;
  const apps = appsResult.data?.apps || [];
  if (!apps.length) {
    return { ok: false, error: 'No Firebase Web Apps found. Create a Web App in the Firebase console first.' };
  }
  const appName = apps[0]?.name || '';
  if (!appName) {
    return { ok: false, error: 'Unable to resolve Firebase Web App.' };
  }
  const configResult = await requestFirebaseManagementApi(`/${appName}/config`, { token });
  if (!configResult.ok) return configResult;
  return { ok: true, config: configResult.data };
};

const getAccessToken = async (serviceAccount) => {
  const admin = loadFirebaseAdminSdk();
  if (!admin) return { ok: false, error: 'Firebase Admin SDK is not installed.' };
  try {
    const credential = admin.credential.cert(serviceAccount);
    const token = await credential.getAccessToken();
    const accessToken = token?.access_token || token?.token;
    if (!accessToken) return { ok: false, error: 'Unable to obtain Firebase access token.' };
    return { ok: true, token: accessToken };
  } catch (err) {
    return { ok: false, error: err?.message || 'Unable to obtain Firebase access token.' };
  }
};

const createRuleset = async ({ projectId, token, name, content }) => {
  const payload = {
    source: {
      files: [
        {
          name,
          content
        }
      ]
    }
  };
  return requestRulesApi(`/projects/${projectId}/rulesets`, {
    method: 'POST',
    token,
    body: payload
  });
};

const upsertRelease = async ({ projectId, token, releaseId, rulesetName }) => {
  const releaseName = `projects/${projectId}/releases/${releaseId}`;
  const createResult = await requestRulesApi(`/projects/${projectId}/releases`, {
    method: 'POST',
    token,
    body: {
      name: releaseName,
      rulesetName
    }
  });
  if (createResult.ok) return createResult;
  if (createResult.status !== 409) return createResult;
  const encodedReleaseId = encodeURIComponent(releaseId);
  return requestRulesApi(`/projects/${projectId}/releases/${encodedReleaseId}`, {
    method: 'PATCH',
    token,
    body: {
      release: {
        name: releaseName,
        rulesetName
      }
    }
  });
};

const deployRulesWithAdmin = async ({ serviceAccount, rulesText, fileName, releaseId, logger }) => {
  const trimmed = String(rulesText || '').trim();
  if (!trimmed) return { ok: false, error: 'Rules content is empty.' };
  const log = typeof logger === 'function' ? logger : null;
  const logLine = (message) => { if (log) log(message); };
  logLine('Requesting Firebase access token...');
  const tokenResult = await getAccessToken(serviceAccount);
  if (!tokenResult.ok) return tokenResult;
  const token = tokenResult.token;
  logLine(`Creating ruleset for ${fileName}...`);
  const rulesetResult = await createRuleset({
    projectId: serviceAccount.project_id,
    token,
    name: fileName,
    content: rulesText
  });
  if (!rulesetResult.ok) {
    return {
      ...rulesetResult,
      error: `Ruleset create failed: ${rulesetResult.error || 'Request failed.'}`
    };
  }
  const rulesetName = rulesetResult.data?.name;
  if (!rulesetName) return { ok: false, error: 'Unable to create ruleset.' };
  logLine(`Updating release ${releaseId}...`);
  const releaseResult = await upsertRelease({
    projectId: serviceAccount.project_id,
    token,
    releaseId,
    rulesetName
  });
  if (!releaseResult.ok) {
    return {
      ...releaseResult,
      error: `Release update failed: ${releaseResult.error || 'Request failed.'}`
    };
  }
  return { ok: true, rulesetName, releaseName: releaseResult.data?.name };
};

const getCommandName = (base) => (process.platform === 'win32' ? `${base}.cmd` : base);

const runCommand = (command, args, { cwd, env, onStdout, onStderr } = {}) => new Promise((resolve) => {
  const child = spawn(command, args, { cwd, env });
  let stdout = '';
  let stderr = '';
  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (onStdout) onStdout(text);
    });
  }
  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (onStderr) onStderr(text);
    });
  }
  child.on('error', (err) => {
    resolve({ ok: false, error: err?.message || 'Command failed.', stdout, stderr });
  });
  child.on('close', (code) => {
    if (code === 0) {
      resolve({ ok: true, stdout, stderr });
    } else {
      resolve({
        ok: false,
        error: `Command failed with exit code ${code}.`,
        stdout,
        stderr,
        code
      });
    }
  });
});

const summarizeCommandOutput = (stdout, stderr, limit = 800) => {
  const combined = [stderr, stdout].filter(Boolean).join('\n').trim();
  if (!combined) return null;
  if (combined.length <= limit) return combined;
  return combined.slice(-limit);
};

const extractFunctionsRegion = (source = '') => {
  const text = String(source || '');
  const regionCallMatch = text.match(/\.region\(\s*['"]([^'"]+)['"]\s*\)/);
  if (regionCallMatch?.[1]) return regionCallMatch[1];
  const constMatch = text.match(/const\s+REGION\s*=\s*['"]([^'"]+)['"]/);
  if (constMatch?.[1]) return constMatch[1];
  return null;
};

const deployTrackerUpdatesFunctionWithAdmin = async ({ serviceAccount, indexJs, logger }) => {
  const raw = typeof indexJs === 'string' ? indexJs : String(indexJs ?? '');
  if (!raw.trim()) return { ok: false, error: 'Function code is empty.' };
  const log = typeof logger === 'function' ? logger : null;
  const logLine = (message) => { if (log) log(message); };
  const projectDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cynoops-functions-'));
  const env = {
    ...process.env,
    GOOGLE_APPLICATION_CREDENTIALS: getCredentialsPath()
  };
  try {
    logLine('Preparing Cloud Function bundle...');
    const functionsDir = path.join(projectDir, 'functions');
    await fsp.mkdir(functionsDir, { recursive: true });
    const packageJson = {
      name: 'cynoops-tracker-updates',
      private: true,
      main: 'index.js',
      engines: { node: '20' },
      dependencies: {
        'firebase-admin': '^12.7.0',
        'firebase-functions': '^4.9.0'
      }
    };
    const firebaseJson = { functions: { source: 'functions' } };
    const indexPath = path.join(functionsDir, 'index.js');
    const packagePath = path.join(functionsDir, 'package.json');
    const firebasePath = path.join(projectDir, 'firebase.json');
    const indexPayload = raw.endsWith('\n') ? raw : `${raw}\n`;
    await fsp.writeFile(indexPath, indexPayload, 'utf8');
    await fsp.writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    await fsp.writeFile(firebasePath, `${JSON.stringify(firebaseJson, null, 2)}\n`, 'utf8');

    const npmCmd = getCommandName('npm');
    const npxCmd = getCommandName('npx');
    logLine('Installing dependencies...');
    const installResult = await runCommand(npmCmd, ['install', '--no-audit', '--no-fund'], {
      cwd: functionsDir,
      env,
      onStdout: (text) => logLine(text),
      onStderr: (text) => logLine(text)
    });
    if (!installResult.ok) {
      return {
        ok: false,
        error: 'npm install failed.',
        details: summarizeCommandOutput(installResult.stdout, installResult.stderr)
      };
    }

    const deployArgs = [
      'firebase-tools',
      'deploy',
      '--only',
      'functions',
      '--project',
      serviceAccount.project_id,
      '--force',
      '--non-interactive'
    ];
    logLine('Deploying functions via Firebase CLI...');
    const deployResult = await runCommand(npxCmd, deployArgs, {
      cwd: projectDir,
      env,
      onStdout: (text) => logLine(text),
      onStderr: (text) => logLine(text)
    });
    if (!deployResult.ok) {
      return {
        ok: false,
        error: 'Firebase deploy failed.',
        details: summarizeCommandOutput(deployResult.stdout, deployResult.stderr)
      };
    }
    const region = extractFunctionsRegion(raw);
    if (region) {
      logLine(`Setting artifacts cleanup policy (1) for ${region}...`);
      const policyArgs = [
        'firebase-tools',
        'functions:artifacts:setpolicy',
        '--project',
        serviceAccount.project_id,
        '--location',
        region,
        '--policy',
        '1',
        '--force',
        '--non-interactive'
      ];
      const policyResult = await runCommand(npxCmd, policyArgs, {
        cwd: projectDir,
        env,
        onStdout: (text) => logLine(text),
        onStderr: (text) => logLine(text)
      });
      if (!policyResult.ok) {
        logLine('Warning: cleanup policy setup failed after deploy.');
        logLine(summarizeCommandOutput(policyResult.stdout, policyResult.stderr) || 'No output from cleanup policy command.');
      }
    } else {
      logLine('Skipping cleanup policy setup (function region not detected).');
    }
    return { ok: true };
  } finally {
    try {
      await fsp.rm(projectDir, { recursive: true, force: true });
    } catch {}
  }
};

const readStoredCredentials = async () => {
  const targetPath = getCredentialsPath();
  try {
    const raw = await fsp.readFile(targetPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ok: true, value: parsed };
  } catch (err) {
    if (err && err.code === 'ENOENT') return { ok: false, missing: true };
    return { ok: false, error: err };
  }
};

const createDeployLogger = (event, deployId) => {
  if (!event?.sender || !deployId) return null;
  return (message) => {
    try {
      event.sender.send('firebase-admin:deploy-log', { id: deployId, message });
    } catch {}
  };
};

function registerFirebaseAdminIPC({ ipcMain, dialog }, state) {
  ipcMain.handle('firebase-admin:select-credentials', async () => {
    try {
      const dialogResult = await dialog.showOpenDialog(state.mainWindow, {
        title: 'Select Firebase Admin Credentials JSON',
        properties: ['openFile'],
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ]
      });
      if (dialogResult.canceled || !dialogResult.filePaths?.length) {
        return { ok: false, cancelled: true };
      }
      const filePath = dialogResult.filePaths[0];
      const parsed = await parseJsonFile(filePath);
      return await processCredentials(parsed);
    } catch (err) {
      return { ok: false, error: err?.message || 'Unable to load Firebase Admin credentials.' };
    }
  });

  ipcMain.handle('firebase-admin:ingest-credentials', async (_event, payload) => {
    try {
      const raw = String(payload?.raw ?? '').trim();
      if (!raw) return { ok: false, error: 'Firebase Admin credentials are empty.' };
      const parsed = parseJsonText(raw);
      return await processCredentials(parsed);
    } catch (err) {
      return { ok: false, error: err?.message || 'Unable to load Firebase Admin credentials.' };
    }
  });

  ipcMain.handle('firebase-admin:get-status', async () => {
    const stored = await readStoredCredentials();
    if (!stored.ok) {
      if (stored.missing) return { ok: false, missing: true };
      return { ok: false, error: stored.error?.message || 'Unable to read Firebase Admin credentials.' };
    }
    const validation = validateServiceAccountJson(stored.value);
    if (!validation.ok) return { ok: false, error: validation.error };
    return {
      ok: true,
      projectId: stored.value.project_id,
      clientEmail: stored.value.client_email
    };
  });

  ipcMain.handle('firebase-admin:clear-credentials', async () => {
    const targetPath = getCredentialsPath();
    try {
      await fsp.rm(targetPath, { force: true });
    } catch {}
    return { ok: true };
  });

  ipcMain.handle('firebase-admin:clear-sessions', async () => {
    const stored = await readStoredCredentials();
    if (!stored.ok) {
      if (stored.missing) return { ok: false, error: 'Firebase Admin credentials not found.' };
      return { ok: false, error: stored.error?.message || 'Unable to read Firebase Admin credentials.' };
    }
    const validation = validateServiceAccountJson(stored.value);
    if (!validation.ok) return { ok: false, error: validation.error };
    return await clearSessionsWithAdmin(stored.value);
  });

  ipcMain.handle('firebase-admin:clear-anonymous-users', async () => {
    const stored = await readStoredCredentials();
    if (!stored.ok) {
      if (stored.missing) return { ok: false, error: 'Firebase Admin credentials not found.' };
      return { ok: false, error: stored.error?.message || 'Unable to read Firebase Admin credentials.' };
    }
    const validation = validateServiceAccountJson(stored.value);
    if (!validation.ok) return { ok: false, error: validation.error };
    return await clearAnonymousUsersWithAdmin(stored.value);
  });

  ipcMain.handle('firebase-admin:create-anonymous-token', async (_event, payload) => {
    const stored = await readStoredCredentials();
    if (!stored.ok) {
      if (stored.missing) return { ok: false, error: 'Firebase Admin credentials not found.' };
      return { ok: false, error: stored.error?.message || 'Unable to read Firebase Admin credentials.' };
    }
    const validation = validateServiceAccountJson(stored.value);
    if (!validation.ok) return { ok: false, error: validation.error };
    const rawDays = Number(payload?.sessionDays);
    const sessionDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(Math.round(rawDays), 14) : 5;
    const apiKey = typeof payload?.apiKey === 'string' ? payload.apiKey.trim() : '';
    const created = await createAnonymousTokenWithAdmin(stored.value, { sessionDays });
    if (!created.ok) return created;
    const signedIn = await signInWithCustomToken({ apiKey, customToken: created.token });
    if (!signedIn.ok) {
      return {
        ok: false,
        error: signedIn.error || 'Unable to authenticate custom token.',
        details: signedIn.details || null
      };
    }
    const auth = signedIn.data || {};
    return {
      ok: true,
      token: auth.idToken || null,
      idToken: auth.idToken || null,
      refreshToken: auth.refreshToken || null,
      expiresIn: auth.expiresIn || null,
      uid: auth.localId || created.uid || null,
      customToken: created.token,
      sessionDays: created.sessionDays
    };
  });

  ipcMain.handle('firebase-admin:get-firebase-config', async () => {
    const stored = await readStoredCredentials();
    if (!stored.ok) {
      if (stored.missing) return { ok: false, error: 'Firebase Admin credentials not found.' };
      return { ok: false, error: stored.error?.message || 'Unable to read Firebase Admin credentials.' };
    }
    const validation = validateServiceAccountJson(stored.value);
    if (!validation.ok) return { ok: false, error: validation.error };
    return await fetchFirebaseWebConfig(stored.value);
  });

  ipcMain.handle('firebase-admin:deploy-firestore-rules', async (event, payload) => {
    const stored = await readStoredCredentials();
    if (!stored.ok) {
      if (stored.missing) return { ok: false, error: 'Firebase Admin credentials not found.' };
      return { ok: false, error: stored.error?.message || 'Unable to read Firebase Admin credentials.' };
    }
    const validation = validateServiceAccountJson(stored.value);
    if (!validation.ok) return { ok: false, error: validation.error };
    const logger = createDeployLogger(event, payload?.deployId);
    return await deployRulesWithAdmin({
      serviceAccount: stored.value,
      rulesText: payload?.content,
      fileName: 'firestore.rules',
      releaseId: 'cloud.firestore',
      logger
    });
  });

  ipcMain.handle('firebase-admin:deploy-storage-rules', async (event, payload) => {
    const stored = await readStoredCredentials();
    if (!stored.ok) {
      if (stored.missing) return { ok: false, error: 'Firebase Admin credentials not found.' };
      return { ok: false, error: stored.error?.message || 'Unable to read Firebase Admin credentials.' };
    }
    const validation = validateServiceAccountJson(stored.value);
    if (!validation.ok) return { ok: false, error: validation.error };
    const bucketRaw = typeof payload?.bucket === 'string' ? payload.bucket : '';
    const bucketName = bucketRaw.replace(/^gs:\/\//, '').trim();
    const releaseId = bucketName ? `firebase.storage/${bucketName}` : 'firebase.storage';
    const logger = createDeployLogger(event, payload?.deployId);
    return await deployRulesWithAdmin({
      serviceAccount: stored.value,
      rulesText: payload?.content,
      fileName: 'storage.rules',
      releaseId,
      logger
    });
  });

  ipcMain.handle('firebase-admin:deploy-tracker-updates-function', async (event, payload) => {
    const stored = await readStoredCredentials();
    if (!stored.ok) {
      if (stored.missing) return { ok: false, error: 'Firebase Admin credentials not found.' };
      return { ok: false, error: stored.error?.message || 'Unable to read Firebase Admin credentials.' };
    }
    const validation = validateServiceAccountJson(stored.value);
    if (!validation.ok) return { ok: false, error: validation.error };
    const logger = createDeployLogger(event, payload?.deployId);
    return await deployTrackerUpdatesFunctionWithAdmin({
      serviceAccount: stored.value,
      indexJs: payload?.content,
      logger
    });
  });
}

module.exports = { registerFirebaseAdminIPC };
