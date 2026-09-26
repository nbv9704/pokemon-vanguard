const body = document.body;
const app = document.querySelector('#app');
const toggle = document.querySelector('.gba-menu-toggle');

function setMenu(open) {
  body.classList.toggle('gba-menu-open', open);
  toggle?.setAttribute('aria-expanded', String(open));
  toggle?.setAttribute('aria-label', open ? 'Close game menu' : 'Open game menu');
}

function syncScreen() {
  const active = app?.querySelector('.nav.active');
  const page = active?.dataset.action?.split(':')[1] || (app?.querySelector('.battle-shell-layout') ? 'battle' : 'loading');
  body.dataset.gbaScreen = page;
  toggle?.toggleAttribute('hidden', page === 'battle' || page === 'loading');
  if (page === 'home') enhanceHome();
}

function actionButton(label, action, detail) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.innerHTML = `<b>${label}</b><small>${detail}</small>`;
  return button;
}

function enhanceHome() {
  const content = app?.querySelector('.content');
  if (!content || content.querySelector('.gba-hub-scene')) return;

  const leadArt = [...content.querySelectorAll('.heroart .pokemon-art')].slice(0, 2).map(node => node.cloneNode(true));
  const squad = [...content.querySelectorAll('.v3-teamstrip .mini')].slice(0, 6).map(node => {
    const member = document.createElement('button');
    member.type = 'button';
    member.className = 'gba-party-member';
    member.dataset.action = node.dataset.action;
    const art = node.querySelector('.pokemon-art')?.cloneNode(true);
    const name = node.querySelector('b')?.textContent || 'Pokémon';
    if (art) member.append(art);
    member.insertAdjacentHTML('beforeend', `<span>${name}</span>`);
    return member;
  });

  const scene = document.createElement('section');
  scene.className = 'gba-hub-scene';
  scene.innerHTML = `
    <div class="gba-route-sign"><small>ROUTE 01</small><b>VANGUARD GATE</b><span>REGULATION M-A</span></div>
    <div class="gba-map-layer" aria-hidden="true">
      <i class="gba-tree tree-a"></i><i class="gba-tree tree-b"></i><i class="gba-tree tree-c"></i>
      <i class="gba-tree tree-d"></i><i class="gba-pond"></i><i class="gba-path"></i>
    </div>
    <div class="gba-lead-stage" aria-label="Lead Pokémon"></div>
    <div class="gba-squad-ribbon"><small>PARTY</small><div class="gba-squad-list"></div></div>
    <div class="gba-command-box">
      <div class="gba-command-copy"><small>VANGUARD LEAGUE</small><strong>What would you like to do?</strong><span>Choose a destination to continue your adventure.</span></div>
      <div class="gba-hub-actions"></div>
    </div>`;

  scene.querySelector('.gba-lead-stage').append(...leadArt);
  scene.querySelector('.gba-squad-list').append(...squad);
  scene.querySelector('.gba-hub-actions').append(
    actionButton('BATTLE', 'nav:battle', 'Enter the arena'),
    actionButton('PARTY', 'nav:teams', 'Arrange your team'),
    actionButton('POKÉDEX', 'nav:collection', 'View all entries'),
    actionButton('RANCH', 'nav:recruitment', 'Recruit Pokémon')
  );
  content.replaceChildren(scene);
}

toggle?.addEventListener('click', () => setMenu(!body.classList.contains('gba-menu-open')));

document.addEventListener('click', event => {
  if (event.target.closest('.nav')) setMenu(false);
});

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key.toLowerCase() !== 'm' || event.target.closest('input, select, textarea')) return;
  event.preventDefault();
  setMenu(!body.classList.contains('gba-menu-open'));
});

new MutationObserver(syncScreen).observe(app, { childList: true, subtree: true });
syncScreen();
