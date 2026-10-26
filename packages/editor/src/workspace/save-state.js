export function createSaveState(
  adapter,
  { version = 0, delay = 650, onState = () => {}, onPending = () => {}, onSettled = () => {} } = {},
) {
  let next = null,
    generation = 0,
    savedGeneration = 0,
    timer = null,
    inflight = null,
    alive = true,
    error = null;
  const emit = (state) => {
    if (alive) onState({ state, error, version, dirty: generation !== savedGeneration });
  };
  const flush = async () => {
    clearTimeout(timer);
    if (!alive) return;
    if (inflight) {
      await inflight;
      if (error) return;
      return generation !== savedGeneration ? flush() : undefined;
    }
    if (!next || generation === savedGeneration) return;
    const captured = generation,
      payload = structuredClone(next);
    error = null;
    emit('saving');
    inflight = (async () => {
      try {
        if (!adapter.saveDraft) throw new Error('This host has not configured draft saving.');
        const result = await adapter.saveDraft(payload, version);
        if (!alive) return;
        if (!Number.isInteger(result?.version))
          throw new Error('The server did not return a draft version.');
        version = result.version;
        savedGeneration = captured;
        if (generation === savedGeneration) onSettled();
        else onPending(next, version);
        emit(generation === savedGeneration ? 'saved' : 'unsaved');
      } catch (e) {
        error = e;
        emit(e.code === 'CONFLICT' ? 'conflict' : e.code === 'OFFLINE' ? 'offline' : 'error');
      } finally {
        inflight = null;
      }
    })();
    await inflight;
    if (!error && generation !== savedGeneration && alive) return flush();
  };
  return {
    get dirty() {
      return generation !== savedGeneration;
    },
    get version() {
      return version;
    },
    get error() {
      return error;
    },
    request(document) {
      if (!alive) return;
      next = structuredClone(document);
      generation++;
      onPending(next, version);
      clearTimeout(timer);
      emit('unsaved');
      if (!error) timer = setTimeout(flush, delay);
    },
    flush,
    reset(newVersion = 0) {
      if (!alive) return;
      clearTimeout(timer);
      version = newVersion;
      next = null;
      generation = 0;
      savedGeneration = 0;
      error = null;
      onSettled();
      emit('saved');
    },
    destroy() {
      alive = false;
      clearTimeout(timer);
    },
  };
}
