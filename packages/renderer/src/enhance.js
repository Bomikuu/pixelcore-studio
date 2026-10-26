export function enhancePage(root, { media = true, motion = true } = {}) {
  const win = root.ownerDocument.defaultView;
  const reduce = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const videos = media ? [...root.querySelectorAll('video.wb-background-video')] : [];
  const play = (video) => {
    if (reduce?.matches || win?.navigator?.connection?.saveData) {
      video.pause();
      return;
    }
    const result = video.play();
    result?.catch?.(() => {});
  };
  const tabCleanups = [];
  for (const group of root.querySelectorAll('.wb-tabs')) {
    const list = group.querySelector('.wb-tab-list');
    const tabs = [...list.querySelectorAll('button')];
    const panels = [...group.children].filter((n) => n.classList.contains('wb-tab-panel'));
    if (!tabs.length || tabs.length !== panels.length) continue;
    list.hidden = false;
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Content sections');
    const activate = (index, focus = false) => {
      tabs.forEach((tab, i) => {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      panels.forEach((panel, i) => {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tabs[i].id);
        panel.tabIndex = 0;
        panel.hidden = i !== index;
      });
      if (focus) tabs[index].focus();
    };
    const click = (e) => {
      const i = tabs.indexOf(e.target.closest('button'));
      if (i >= 0) activate(i);
    };
    const keydown = (e) => {
      const i = tabs.indexOf(e.target);
      if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      activate(
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? tabs.length - 1
            : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length,
        true,
      );
    };
    activate(0);
    list.addEventListener('click', click);
    list.addEventListener('keydown', keydown);
    tabCleanups.push(() => {
      list.removeEventListener('click', click);
      list.removeEventListener('keydown', keydown);
      list.hidden = true;
      list.removeAttribute('role');
      tabs.forEach((tab) => {
        tab.removeAttribute('role');
        tab.removeAttribute('aria-selected');
        tab.removeAttribute('tabindex');
      });
      panels.forEach((panel) => {
        panel.hidden = false;
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
        panel.removeAttribute('tabindex');
      });
    });
  }
  let observer;
  if (win?.IntersectionObserver) {
    observer = new win.IntersectionObserver((entries) => {
      for (const entry of entries) entry.isIntersecting ? play(entry.target) : entry.target.pause();
    });
    videos.forEach((v) => observer.observe(v));
  }
  const changed = () =>
    videos.forEach((v) => {
      if (reduce?.matches) v.pause();
    });
  reduce?.addEventListener?.('change', changed);
  let sections;
  if (motion && win?.IntersectionObserver && !reduce?.matches) {
    sections = new win.IntersectionObserver((entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-wb-revealed', '');
          sections.unobserve(entry.target);
        }
    });
    root.querySelectorAll('[data-motion-trigger=section]').forEach((n) => sections.observe(n));
  }
  return () => {
    tabCleanups.forEach((clean) => clean());
    sections?.disconnect();
    observer?.disconnect();
    reduce?.removeEventListener?.('change', changed);
    videos.forEach((v) => v.pause());
  };
}
