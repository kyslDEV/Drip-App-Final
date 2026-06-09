(function () {
  const THEME_KEY = 'driptest_theme_v1';
  const ROLE_KEY = 'drip_access_role';
  const META_THEME = document.querySelector('meta[name="theme-color"]');
  let splashTimer = null;

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    if (META_THEME) {
      META_THEME.setAttribute('content', theme === 'dark' ? '#0d1520' : '#1663d8');
    }
    const label = theme === 'dark' ? 'Modo claro' : 'Modo escuro';
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.textContent = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
  }

  function toggleTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }

  function reinforceThemeLayer() {
    if (document.getElementById('drip-theme-runtime')) return;
    const link = document.createElement('link');
    link.id = 'drip-theme-runtime';
    link.rel = 'stylesheet';
    link.href = 'drip-theme.css?v=ui-2026-3';
    document.head.appendChild(link);
  }

  function showSplash(mode) {
    if (document.querySelector('.app-splash')) return;

    const splash = document.createElement('div');
    splash.className = 'app-splash';
    splash.setAttribute('role', 'status');
    splash.setAttribute('aria-live', 'polite');
    splash.innerHTML = [
      '<div class="app-splash-card">',
      '  <div class="app-splash-mark">DT</div>',
      '  <div class="app-splash-copy">',
      '    <strong>DripTest</strong>',
      '    <span>Preparando dados, laudo e banco.</span>',
      '  </div>',
      '  <div class="app-splash-bar" aria-hidden="true"><span></span></div>',
      '</div>'
    ].join('');
    document.body.appendChild(splash);

    window.requestAnimationFrame(() => splash.classList.add('is-visible'));
    window.clearTimeout(splashTimer);
    splashTimer = window.setTimeout(() => hideSplash(), mode === 'nav' ? 420 : 820);
  }

  function hideSplash() {
    const splash = document.querySelector('.app-splash');
    if (!splash) return;
    splash.classList.add('is-hiding');
    window.setTimeout(() => splash.remove(), 260);
  }

  function injectHeaderActions() {
    const containers = document.querySelectorAll('.topbar .header-actions, .theme-slot');
    containers.forEach((container) => {
      if (container.querySelector('[data-theme-toggle]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ghost theme-toggle';
      button.setAttribute('data-theme-toggle', 'true');
      button.addEventListener('click', toggleTheme);
      container.appendChild(button);
    });
    applyTheme(getPreferredTheme());
  }

  function getCurrentPageName() {
    const current = location.pathname.split('/').pop() || 'index.html';
    return current || 'index.html';
  }

  function getAccessRole() {
    let role = '';
    try {
      role = localStorage.getItem(ROLE_KEY);
    } catch (error) {
      role = '';
    }
    return role === 'monitor' || role === 'supervisor' || role === 'dev' ? role : '';
  }

  function isPublicPage(page) {
    return page === 'index.html' || page === '';
  }

  function isAllowedForRole(page, role) {
    if (isPublicPage(page)) return true;
    if (role === 'dev') return true;
    if (role === 'supervisor') {
      return page === 'DripSupervisor.html' || page === 'DripReports.html' || page === 'DripSettings.html';
    }
    if (role === 'monitor') {
      return ['login.html', 'DripTeste.html', 'DripTestF.html', 'DripSchedule.html', 'DripReports.html'].includes(page);
    }
    return false;
  }

  function defaultPageForRole(role) {
    if (role === 'dev') return 'DripSettings.html';
    if (role === 'supervisor') return 'DripSupervisor.html';
    if (role === 'monitor') return 'login.html';
    return 'index.html';
  }

  function ensureMobileNavigation() {
    const current = getCurrentPageName();
    if (isPublicPage(current)) return;

    const role = getAccessRole();
    const roleLinks = {
      monitor: [
        { href: 'login.html', label: 'Cadastro' },
        { href: 'DripTeste.html', label: 'Inicial' },
        { href: 'DripTestF.html', label: 'Final' },
        { href: 'DripSchedule.html', label: 'Agenda' },
        { href: 'DripReports.html', label: 'Laudos' }
      ],
      supervisor: [
        { href: 'index.html', label: 'Perfil' },
        { href: 'DripSupervisor.html', label: 'Supervisao' },
        { href: 'DripReports.html', label: 'Laudos' },
        { href: 'DripSettings.html', label: 'Banco' }
      ],
      dev: [
        { href: 'index.html', label: 'Perfil' },
        { href: 'DripTeste.html', label: 'Inicial' },
        { href: 'DripTestF.html', label: 'Final' },
        { href: 'DripReports.html', label: 'Laudos' },
        { href: 'DripSettings.html', label: 'Banco' }
      ]
    };
    const links = roleLinks[role] || [{ href: 'index.html', label: 'Perfil' }];

    let tabbar = document.querySelector('.mobile-tabbar');
    if (!tabbar) {
      tabbar = document.createElement('nav');
      tabbar.className = 'mobile-tabbar';
      tabbar.setAttribute('aria-label', 'Navegação principal');
      document.body.appendChild(tabbar);
    }

    tabbar.replaceChildren();
    tabbar.classList.remove('mobile-tabs-count-3', 'mobile-tabs-count-4', 'mobile-tabs-count-5');
    tabbar.classList.add('mobile-tabs-count-' + Math.min(links.length, 5));
    links.forEach((link) => {
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.textContent = link.label;
      if (current === link.href) {
        anchor.className = 'active';
        anchor.setAttribute('aria-current', 'page');
      }
      tabbar.appendChild(anchor);
    });

    if (!document.querySelector('.mobile-tabbar-spacer')) {
      const spacer = document.createElement('div');
      spacer.className = 'mobile-tabbar-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(spacer);
    }
  }

  function injectMobileThemeToggle() {
    if (isPublicPage(getCurrentPageName())) return;
    if (document.querySelector('.mobile-theme-toggle')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost theme-toggle mobile-theme-toggle';
    button.setAttribute('data-theme-toggle', 'true');
    button.addEventListener('click', toggleTheme);
    document.body.appendChild(button);
    applyTheme(getPreferredTheme());
  }

  function shouldKeepVisible(action, index, keptCount) {
    const featuredIds = new Set(['issueOfficialBtn', 'pdfBtn', 'calculateBtn', 'addInitialBtn']);
    if (featuredIds.has(action.id)) return true;
    if (action.classList.contains('primary') && keptCount < 2) return true;
    return index === 0 && keptCount === 0;
  }

  function condenseActionGroups() {
    document.querySelectorAll('.panel .toolbar .header-actions, .panel .toolbar .toolbar-group').forEach((group) => {
      if (group.dataset.condensed === 'true') return;

      const actions = Array.from(group.children).filter((item) => {
        return item.matches && item.matches('button, a.button-link');
      });
      if (actions.length < 4) return;

      const menu = document.createElement('details');
      menu.className = 'app-menu';
      menu.innerHTML = '<summary>Acoes</summary><div class="menu-content"></div>';
      const menuContent = menu.querySelector('.menu-content');
      let keptCount = 0;

      actions.forEach((action, index) => {
        if (shouldKeepVisible(action, index, keptCount)) {
          keptCount += 1;
          action.classList.add('is-featured-action');
          return;
        }
        action.classList.add('is-menu-action');
        menuContent.appendChild(action);
      });

      if (menuContent.children.length) {
        group.appendChild(menu);
        group.classList.add('is-condensed-actions');
        group.dataset.condensed = 'true';
      }
    });
  }

  function closeActionMenusOnOutsideClick() {
    document.addEventListener('click', (event) => {
      document.querySelectorAll('.app-menu[open]').forEach((menu) => {
        if (!menu.contains(event.target)) {
          menu.open = false;
        }
      });
    });
  }

  function filterDesktopNavigation() {
    const role = getAccessRole();
    document.querySelectorAll('.topbar .header-actions a[href]').forEach((link) => {
      const page = (link.getAttribute('href') || '').split('?')[0].split('#')[0];
      if (!page || page === 'index.html') return;
      if (!isAllowedForRole(page, role)) {
        link.remove();
      }
    });

    document.querySelectorAll('.topbar .header-actions').forEach((container) => {
      if (!container.querySelector('a[href="index.html"]')) {
        const profile = document.createElement('a');
        profile.href = 'index.html';
        profile.className = 'button-link ghost';
        profile.textContent = 'Perfil';
        container.insertBefore(profile, container.firstChild);
      }
    });
  }

  function wireRouteTransitions() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || link.target || link.hasAttribute('download')) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.origin !== window.location.origin || !nextUrl.pathname.endsWith('.html')) return;

      event.preventDefault();
      showSplash('nav');
      window.setTimeout(() => {
        window.location.href = nextUrl.href;
      }, 140);
    });
  }

  function ensureUser() {
    try {
      const page = getCurrentPageName();
      const role = getAccessRole();
      if (isPublicPage(page)) return;
      if (!role) {
        window.location.href = './index.html';
        return;
      }
      if (!isAllowedForRole(page, role)) {
        window.location.href = './' + defaultPageForRole(role);
        return;
      }
      if (page === 'login.html' || page === 'DripSettings.html' || page === 'DripSupervisor.html') return;
      const user = localStorage.getItem('drip_user');
      if (!user) {
        const next = location.pathname.split('/').pop() + location.search + location.hash;
        window.location.href = './login.html?next=' + encodeURIComponent(next);
      }
    } catch (e) {
      console.warn('Erro ao verificar usuário', e);
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((error) => {
        console.warn('Service worker nao registrado', error);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    reinforceThemeLayer();
    ensureUser();
    injectHeaderActions();
    filterDesktopNavigation();
    ensureMobileNavigation();
    injectMobileThemeToggle();
    condenseActionGroups();
    closeActionMenusOnOutsideClick();
    wireRouteTransitions();
  });

  reinforceThemeLayer();
  if (document.body) {
    showSplash('load');
  } else {
    document.addEventListener('DOMContentLoaded', () => showSplash('load'), { once: true });
  }
  // registerServiceWorker(); // Service worker desativado nesta fase
})();
