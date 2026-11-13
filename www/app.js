const LN = window.Capacitor?.Plugins?.LocalNotifications;
const isNative = window.Capacitor?.isNativePlatform?.() ?? false;

const $ = (id) => document.getElementById(id);
const KEY = 'reminders';
const load = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const save = (r) => localStorage.setItem(KEY, JSON.stringify(r));
const say = (msg) => ($('status').textContent = msg);

// Notification IDs must be 32-bit ints
const nextId = () => {
  const id = (parseInt(localStorage.getItem('lastId') || '0', 10) % 2147483646) + 1;
  localStorage.setItem('lastId', id);
  return id;
};

async function ensurePermission() {
  if (isNative) {
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    return p.display === 'granted';
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') await Notification.requestPermission();
  return Notification.permission === 'granted';
}

async function schedule(r) {
  const at = new Date(r.at);
  if (isNative) {
    await LN.schedule({
      notifications: [{
        id: r.id,
        title: r.title,
        body: `Scheduled for ${at.toLocaleString()}`,
        schedule: { at, allowWhileIdle: true },
      }],
    });
  } else {
    // Browser fallback for testing only (works while the tab is open)
    setTimeout(() => new Notification(r.title), at - Date.now());
  }
}

async function cancel(id) {
  if (isNative) await LN.cancel({ notifications: [{ id }] });
}

function render() {
  const list = $('list');
  list.innerHTML = '';
  const now = Date.now();
  load().sort((a, b) => a.at - b.at).forEach((r) => {
    const li = document.createElement('li');
    if (r.at <= now) li.className = 'past';
    li.innerHTML = `<div>${r.title.replace(/</g, '&lt;')}<small>${new Date(r.at).toLocaleString()}</small></div>`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => {
      await cancel(r.id);
      save(load().filter((x) => x.id !== r.id));
      render();
    };
    li.appendChild(del);
    list.appendChild(li);
  });
}

$('add').onclick = async () => {
  const title = $('title').value.trim() || 'Reminder';
  const when = $('when').value;
  if (!when) return say('Pick a date and time.');
  const at = new Date(when).getTime();
  if (at <= Date.now()) return say('Pick a time in the future.');

  if (!(await ensurePermission())) return say('Notification permission denied.');

  const r = { id: nextId(), title, at };
  try {
    await schedule(r);
  } catch (e) {
    return say('Failed: ' + e.message);
  }
  save([...load(), r]);
  $('title').value = '';
  say('Scheduled.');
  render();
};

// Android 12+: exact alarms may need user approval in system settings
(async () => {
  if (isNative && LN?.checkExactNotificationSetting) {
    try {
      const s = await LN.checkExactNotificationSetting();
      if (s.exact_alarm !== 'granted') say('Exact alarms are off, so notifications may be delayed a few minutes.');
    } catch {}
  }
})();

render();
