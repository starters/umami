import 'promise-polyfill/src/polyfill';
import 'unfetch/polyfill';
import { post, hook } from '../lib/web';

((window, sessionKey) => {
  const {
    screen: { width, height },
    navigator: { language },
    location: { hostname, pathname, search },
    localStorage: store,
    document,
    history,
  } = window;

  const script = document.querySelector('script[data-website-id]');
  const website = script && script.getAttribute('data-website-id');
  const hostUrl = new URL(script.src).origin;
  const screen = `${width}x${height}`;
  const listeners = [];

  let currentUrl = `${pathname}${search}`;
  let currentRef = document.referrer;

  const collect = (type, params) => {
    const payload = {
      session: store.getItem(sessionKey),
      url: currentUrl,
      referrer: currentRef,
      website,
      hostname,
      screen,
      language,
    };

    if (params) {
      Object.keys(params).forEach(key => {
        payload[key] = params[key];
      });
    }

    return post(`${hostUrl}/api/collect`, {
      type,
      payload,
    }).then(({ session }) => session && store.setItem(sessionKey, session));
  };

  const pageView = () => collect('pageview').then(() => setTimeout(loadEvents, 300));

  const pageEvent = (event_type, event_value) => collect('event', { event_type, event_value });

  /* Handle history */

  const handlePush = (state, title, url) => {
    removeEvents();
    currentRef = currentUrl;
    currentUrl = url;
    pageView();
  };

  history.pushState = hook(history, 'pushState', handlePush);
  history.replaceState = hook(history, 'replaceState', handlePush);

  /* Handle events */

  const removeEvents = () => {
    listeners.forEach(([element, type, listener]) => {
      element && element.removeEventListener(type, listener, true);
    });
    listeners.length = 0;
  };

  const loadEvents = () => {
    document.querySelectorAll("[class*='umami--']").forEach(element => {
      element.className.split(' ').forEach(className => {
        if (/^umami--([a-z]+)--([a-z0-9_]+[a-z0-9-_]+)$/.test(className)) {
          const [, type, value] = className.split('--');
          const listener = () => pageEvent(type, value);

          listeners.push([element, type, listener]);
          element.addEventListener(type, listener, true);
        }
      });
    });
  };

  /* Start */

  pageView();
})(window, 'umami.session');
